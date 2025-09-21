import { PatchParseManager } from './patch-parse-manager';
import { TaskProgress, ProcessOptions, FileEntityMapping } from './types';
import { getAllGitChangedFiles } from './git-provider';

import { getWorkspacePackageMappings, findWorkspaceRoot, isValidWorkspacePackage, buildWorkspacePackageMap, buildWorkspaceDependencyMap, DependencyAnalysisResult, getWorkspacePath } from '@xhs/shared-utils';
import path from 'path';
import fs from 'fs';

// 导出接口和类型
export { TaskProgress, ProcessOptions, FileEntityMapping, PatchParseManager };

/**
 * 多工作空间返回结果接口
 */
export interface MultiWorkspaceResult<T> extends Map<string, T> {
  totalWorkspaces: number;
  successCount: number;
  errorCount: number;
  errors: Map<string, Error>;
}

/**
 * 单例多工作空间管理器 - 对 PatchParseManager 的上层封装
 * 用于批量执行多个 workspace 下的所有方法
 */
export class MultiWorkspaceManager {
  private static instance: MultiWorkspaceManager | null = null;
  private instances = new Map<string, PatchParseManager>();
  private callback: (progress: TaskProgress) => void;
  private options: ProcessOptions;
  private rootDir: string;
  private workspaceMapping: Map<string, string> = new Map(); // path -> packageName
  private dependencyAnalysis: DependencyAnalysisResult | null = null;
  private entitiesCache: Map<string, boolean> = new Map(); // workspace path -> has entities.enriched.json

  private constructor(callback: (progress: TaskProgress) => void, options: ProcessOptions) {
    if (!options.rootDir) {
      throw new Error('options.rootDir is required for MultiWorkspaceManager');
    }

    this.callback = callback;
    this.options = options;
    this.rootDir = options.rootDir;

    // 同步初始化workspace映射
    this.initializeWorkspaceMappingSync();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(callback?: (progress: TaskProgress) => void, options?: ProcessOptions): MultiWorkspaceManager {
    if (!this.instance) {
      if (!callback || !options) {
        throw new Error('callback and options are required for first initialization');
      }
      this.instance = new MultiWorkspaceManager(callback, options);
    }
    return this.instance;
  }

  /**
   * 重置单例实例（用于测试或重新初始化）
   */
  public static resetInstance(): void {
    if (this.instance) {
      this.instance.entitiesCache.clear(); // 清空缓存
    }
    this.instance = null;
  }

  /**
   * 检查单例是否已经存在
   */
  public static hasInstance(): boolean {
    return this.instance !== null;
  }

  /**
   * 同步初始化workspace映射
   */
  private initializeWorkspaceMappingSync(): void {
    console.log(`🔄 [多工作空间] 初始化workspace映射，rootDir: ${this.rootDir}`);

    // 查找workspace根目录
    const workspaceRoot = findWorkspaceRoot(this.rootDir);

    if (!workspaceRoot) {
      console.log(`📁 [多工作空间] 未找到workspace根目录，使用简单路径分析`);
      this.initializeWorkspaceMappingSimple();
      return;
    }

    console.log(`🏠 [多工作空间] workspace根目录: ${workspaceRoot}`);

    // 使用shared-utils中的buildWorkspacePackageMap获取所有workspace包映射
    const packageMap = buildWorkspacePackageMap(workspaceRoot, 3);
    console.log(`📦 [多工作空间] 从workspace配置获取 ${packageMap.size} 个包映射`);

    // 构建workspace映射（path -> packageName），暂不过滤entities.enriched.json
    this.workspaceMapping.clear();
    for (const [packageName, packagePath] of packageMap) {
      this.workspaceMapping.set(packagePath, packageName);
      console.log(`📦 [多工作空间] 添加workspace: ${packageName} -> ${path.relative(workspaceRoot, packagePath)}`);
    }

    // // 检查workspace根目录是否也是一个有效的workspace包（如果不在子包列表中）
    // const rootAlreadyIncluded = Array.from(packageMap.values()).some(
    //   (path) => path === workspaceRoot
    // );
    // if (!rootAlreadyIncluded && isValidWorkspacePackage(workspaceRoot)) {
    //   try {
    //     const rootPackageJsonPath = path.join(workspaceRoot, "package.json");
    //     const rootPackageJson = JSON.parse(
    //       fs.readFileSync(rootPackageJsonPath, "utf-8")
    //     );
    //     if (rootPackageJson.name) {
    //       this.workspaceMapping.set(workspaceRoot, rootPackageJson.name);
    //       console.log(
    //         `🏠 [多工作空间] 添加根workspace: ${rootPackageJson.name} -> .`
    //       );
    //     }
    //   } catch (error) {
    //     console.warn(`⚠️ [多工作空间] 解析根目录package.json失败:`, error);
    //   }
    // }

    console.log(`📊 [多工作空间] 初始化完成，发现 ${this.workspaceMapping.size} 个有效workspace`);

    // 构建entities.enriched.json存在性缓存
    this.buildEntitiesCache();

    // 构建依赖关系分析
    this.buildDependencyAnalysis(workspaceRoot);
  }

  /**
   * 简单的workspace映射初始化（当找不到workspace根目录时）
   */
  private initializeWorkspaceMappingSimple(): void {
    console.log(`📁 [多工作空间] 使用简单模式初始化workspace映射`);

    // 获取当前目录的包名
    const getPackageName = (dirPath: string): string | null => {
      try {
        const packageJsonPath = path.join(dirPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          return packageJson.name || null;
        }
      } catch (error) {
        console.warn(`⚠️ [多工作空间] 无法读取 ${dirPath} 的package.json`);
      }
      return null;
    };

    // 对于单工程项目，先尝试当前目录
    const currentDirPackageName = getPackageName(this.rootDir);
    if (currentDirPackageName) {
      this.workspaceMapping.set(this.rootDir, currentDirPackageName);
      console.log(`✅ [多工作空间] 发现单工程workspace: ${currentDirPackageName} -> ${this.rootDir}`);
    } else {
      // 检查是否在 packages/* 或 apps/* 结构中
      const parentDir = path.dirname(this.rootDir);
      const grandParentDir = path.dirname(parentDir);
      const relativePath = path.relative(grandParentDir, this.rootDir);
      const pathParts = relativePath.split(path.sep);

      if (pathParts.length >= 2 && (pathParts[0] === 'packages' || pathParts[0] === 'apps')) {
        // 尝试在各级目录中查找有package.json的workspace
        const possibleWorkspaces = [this.rootDir, path.join(grandParentDir, pathParts[0], pathParts[1]), grandParentDir];

        for (const workspacePath of possibleWorkspaces) {
          const packageName = getPackageName(workspacePath);
          if (packageName) {
            this.workspaceMapping.set(workspacePath, packageName);
            console.log(`✅ [多工作空间] 发现workspace: ${packageName} -> ${workspacePath}`);
            break;
          }
        }
      } else {
        // 如果都找不到，至少添加当前目录作为fallback
        this.workspaceMapping.set(this.rootDir, 'unknown');
        console.log(`⚠️ [多工作空间] 使用fallback workspace: unknown -> ${this.rootDir}`);
      }
    }

    console.log(`📊 [多工作空间] 简单模式初始化完成，发现 ${this.workspaceMapping.size} 个workspace`);

    // 构建entities.enriched.json存在性缓存
    this.buildEntitiesCache();
  }

  /**
   * 构建entities.enriched.json存在性缓存
   */
  private buildEntitiesCache(): void {
    console.log(`🗂️ [多工作空间] 开始构建entities.enriched.json存在性缓存...`);

    this.entitiesCache.clear();
    let hasEntitiesCount = 0;
    let totalCount = 0;

    for (const [workspacePath, packageName] of this.workspaceMapping) {
      const entitiesFile = path.join(workspacePath, 'data', 'entities.enriched.json');
      const hasEntities = fs.existsSync(entitiesFile);

      this.entitiesCache.set(workspacePath, hasEntities);
      totalCount++;

      if (hasEntities) {
        hasEntitiesCount++;
        console.log(`✅ [多工作空间] ${packageName}(${path.relative(this.rootDir, workspacePath)}) 有entities.enriched.json`);
      } else {
        console.log(`📭 [多工作空间] ${packageName}(${path.relative(this.rootDir, workspacePath)}) 无entities.enriched.json`);
      }
    }

    console.log(`🗂️ [多工作空间] entities缓存构建完成: ${hasEntitiesCount}/${totalCount} 个workspace有entities.enriched.json`);
  }

  /**
   * 构建workspace依赖关系分析
   */
  private buildDependencyAnalysis(workspaceRoot: string): void {
    try {
      console.log(`🔗 [多工作空间] 开始构建依赖关系分析...`);
      this.dependencyAnalysis = buildWorkspaceDependencyMap(workspaceRoot, 3);
      console.log(`✅ [多工作空间] 依赖关系分析构建完成`);
    } catch (error) {
      console.warn(`⚠️ [多工作空间] 构建依赖关系分析失败:`, error);
      this.dependencyAnalysis = null;
    }
  }

  /**
   * 获取或创建workspace实例
   */
  private getOrCreateInstance(rootDir: string): PatchParseManager {
    const existing = this.instances.get(rootDir);
    if (existing) {
      return existing;
    }

    const instance = new PatchParseManager(this.callback, {
      ...this.options,
      rootDir,
    });
    this.instances.set(rootDir, instance);
    return instance;
  }

  /**
   * 获取所有Git变更文件
   * @param commitHash 可选的commit hash
   */
  private async getAllGitChangedFiles(commitHash?: string): Promise<{ changedFiles: string[]; deletedFiles: string[] }> {
    return await getAllGitChangedFiles(this.rootDir, commitHash);
  }

  /**
   * 根据文件列表分析workspace映射（包含依赖关系扩展）
   * @param files 所有文件列表
   */
  private analyzeWorkspaceMappingForFiles(files: string[]): Map<string, string[]> {
    const workspaceMap = new Map<string, string[]>();

    if (files.length === 0) {
      return workspaceMap;
    }

    console.log(`🔍 [多工作空间] 分析 ${files.length} 个文件的workspace映射...`);

    // 第一步：为每个文件确定所属workspace，并进行依赖扩展
    for (const file of files) {
      let matchedWorkspace: string | null = null;
      let maxMatchLength = 0;

      // 找到最长匹配的workspace路径
      for (const workspacePath of this.workspaceMapping.keys()) {
        if (file.startsWith(workspacePath + path.sep) || file === workspacePath) {
          if (workspacePath.length > maxMatchLength) {
            maxMatchLength = workspacePath.length;
            matchedWorkspace = workspacePath;
          }
        }
      }

      if (matchedWorkspace && this.workspaceMapping.has(matchedWorkspace)) {
        const sourcePackageName = this.workspaceMapping.get(matchedWorkspace)!;

        // 将文件添加到源workspace
        if (!workspaceMap.has(matchedWorkspace)) {
          workspaceMap.set(matchedWorkspace, []);
        }
        workspaceMap.get(matchedWorkspace)!.push(file);

        console.log(`📄 [多工作空间] 文件 ${file} 属于 ${sourcePackageName}(${path.relative(this.rootDir, matchedWorkspace)})`);

        // 查找依赖这个包的其他workspace
        if (this.dependencyAnalysis) {
          const dependents = this.dependencyAnalysis.dependencyMap.dependents.get(sourcePackageName);
          if (dependents && dependents.size > 0) {
            console.log(`🔗 [多工作空间] ${sourcePackageName} 被以下包依赖: [${Array.from(dependents).join(', ')}]`);

            // 将文件也添加到依赖的workspace中
            for (const dependentPackageName of dependents) {
              const dependentPackagePath = this.dependencyAnalysis.dependencyMap.packagePaths.get(dependentPackageName);
              if (dependentPackagePath && this.workspaceMapping.has(dependentPackagePath)) {
                if (!workspaceMap.has(dependentPackagePath)) {
                  workspaceMap.set(dependentPackagePath, []);
                }
                workspaceMap.get(dependentPackagePath)!.push(file);
                console.log(`➕ [多工作空间] 文件 ${file} 扩展到依赖workspace ${dependentPackageName}(${path.relative(this.rootDir, dependentPackagePath)})`);
              }
            }
          } else {
            console.log(`📍 [多工作空间] ${sourcePackageName} 没有被其他workspace依赖，作为主workspace处理`);
          }
        }
      } else {
        console.log(`⚠️ [多工作空间] 文件 ${file} 不属于任何有效workspace`);
      }
    }

    console.log(`📊 [多工作空间] 依赖扩展完成，共 ${workspaceMap.size} 个workspace涉及文件处理`);

    // 第二步：过滤出有entities.enriched.json的workspace（使用初始化时构建的缓存）
    const filteredWorkspaceMap = new Map<string, string[]>();
    for (const [workspacePath, files] of workspaceMap) {
      const packageName = this.workspaceMapping.get(workspacePath)!;
      const hasEntities = this.entitiesCache.get(workspacePath) || false;

      if (hasEntities) {
        filteredWorkspaceMap.set(workspacePath, files);
        console.log(`✅ [多工作空间] workspace ${packageName}(${path.relative(this.rootDir, workspacePath)}) 有entities.enriched.json，保留处理: ${files.length} 个文件`);
      } else {
        console.log(`🔄 [多工作空间] workspace ${packageName}(${path.relative(this.rootDir, workspacePath)}) 无entities.enriched.json，过滤掉: ${files.length} 个文件`);
      }
    }

    console.log(`📊 [多工作空间] 最终workspace映射完成，共 ${filteredWorkspaceMap.size} 个有效workspace:`);
    for (const [workspace, files] of filteredWorkspaceMap) {
      const packageName = this.workspaceMapping.get(workspace)!;
      console.log(`   - ${packageName}(${path.relative(this.rootDir, workspace)}): ${files.length} 个文件`);
    }

    return filteredWorkspaceMap;
  }

  /**
   * 创建多workspace结果对象
   */
  private createMultiWorkspaceResult<T>(workspaceResults: Map<string, T>, errors: Map<string, Error>): MultiWorkspaceResult<T> {
    let successCount = 0;

    for (const workspace of workspaceResults.keys()) {
      if (!errors.has(workspace)) {
        successCount++;
      }
    }

    // 创建继承自Map的结果对象
    const result = new Map(workspaceResults) as MultiWorkspaceResult<T>;
    result.totalWorkspaces = workspaceResults.size;
    result.successCount = successCount;
    result.errorCount = errors.size;
    result.errors = errors;

    return result;
  }

  /**
   * 批量添加文件到处理队列（支持删除文件）
   */
  public async addFilesToQueueWithDeletion(files: string[], deletedFiles: string[] = []): Promise<MultiWorkspaceResult<FileEntityMapping[]>> {
    console.log(`🚀 [多工作空间] 批量添加文件到队列: ${files.length} 个文件, ${deletedFiles.length} 个删除文件`);

    // 分析所有文件的workspace映射
    const allFiles = [...files, ...deletedFiles];
    const workspaceMap = this.analyzeWorkspaceMappingForFiles(allFiles);

    const workspaceResults = new Map<string, FileEntityMapping[]>();
    const errors = new Map<string, Error>();

    // 并行处理所有workspace
    const workspacePromises = Array.from(workspaceMap.entries()).map(async ([workspaceRoot, workspaceFiles]) => {
      try {
        console.log(`📋 [多工作空间] 处理workspace: ${workspaceRoot}`);

        // 分离该workspace的变更文件和删除文件
        const workspaceChangedFiles = workspaceFiles.filter((f) => files.includes(f));
        const workspaceDeletedFiles = workspaceFiles.filter((f) => deletedFiles.includes(f));

        if (workspaceChangedFiles.length === 0 && workspaceDeletedFiles.length === 0) {
          workspaceResults.set(workspaceRoot, []);
          return;
        }

        // 创建该workspace的管理器
        const manager = this.getOrCreateInstance(workspaceRoot);

        // 执行添加操作
        const result = await manager.addFilesToQueueWithDeletion(workspaceChangedFiles, workspaceDeletedFiles, this.options);

        workspaceResults.set(workspaceRoot, result);
        console.log(`✅ [多工作空间] workspace ${workspaceRoot} 处理完成: ${result.length} 个映射`);
      } catch (error) {
        console.error(`❌ [多工作空间] workspace ${workspaceRoot} 处理失败:`, error);
        errors.set(workspaceRoot, error as Error);
        workspaceResults.set(workspaceRoot, []);
      }
    });

    await Promise.all(workspacePromises);

    return this.createMultiWorkspaceResult(workspaceResults, errors);
  }

  /**
   * 批量添加文件到处理队列
   */
  public async addFilesToQueue(files: string[]): Promise<MultiWorkspaceResult<FileEntityMapping[]>> {
    return await this.addFilesToQueueWithDeletion(files, []);
  }

  /**
   * 批量添加git变更文件到处理队列
   */
  public async addGitChangedFilesToQueue(commitHash?: string): Promise<MultiWorkspaceResult<FileEntityMapping[]>> {
    console.log(`🚀 [多工作空间] 批量添加git变更文件到队列`);

    // 1. 首先获取所有git变更文件
    const gitChanges = await this.getAllGitChangedFiles(commitHash);
    const allChangedFiles = [...gitChanges.changedFiles, ...gitChanges.deletedFiles];

    if (allChangedFiles.length === 0) {
      console.log('📭 [多工作空间] 没有检测到git变更文件');
      return this.createMultiWorkspaceResult(new Map(), new Map());
    }

    console.log(`📋 [多工作空间] 检测到 ${allChangedFiles.length} 个git变更文件`);

    // 2. 分析哪些workspace有变更文件
    const workspaceFileMap = this.analyzeWorkspaceMappingForFiles(allChangedFiles);
    console.log('workspaceFileMap', workspaceFileMap);
    if (workspaceFileMap.size === 0) {
      console.log('📭 [多工作空间] 变更文件不属于任何有效workspace');
      return this.createMultiWorkspaceResult(new Map(), new Map());
    }

    console.log(`📊 [多工作空间] 发现 ${workspaceFileMap.size} 个workspace有变更文件`);

    // 3. 只对有变更的workspace执行操作
    const workspaceResults = new Map<string, FileEntityMapping[]>();
    const errors = new Map<string, Error>();

    const workspacePromises = Array.from(workspaceFileMap.keys()).map(async (workspaceRoot) => {
      try {
        const files = workspaceFileMap.get(workspaceRoot)!;
        console.log(`📋 [多工作空间] 处理workspace git变更: ${workspaceRoot} (${files.length} 个文件)`);

        // 创建该workspace的管理器
        const manager = this.getOrCreateInstance(workspaceRoot);

        // 调用每个workspace自己的addGitChangedFilesToQueue方法
        // 这会自动过滤出该workspace范围内的文件，包括workspace包依赖
        const options = { ...this.options };
        if (commitHash) {
          options.commitHash = commitHash;
        }

        const result = await manager.addGitChangedFilesToQueue(options);

        workspaceResults.set(workspaceRoot, result);
        console.log(`✅ [多工作空间] workspace ${workspaceRoot} git变更处理完成: ${result.length} 个映射`);
      } catch (error) {
        console.error(`❌ [多工作空间] workspace ${workspaceRoot} git变更处理失败:`, error);
        errors.set(workspaceRoot, error as Error);
        workspaceResults.set(workspaceRoot, []);
      }
    });

    await Promise.all(workspacePromises);

    return this.createMultiWorkspaceResult(workspaceResults, errors);
  }

  /**
   * 批量开始处理任务队列
   */
  public async startTaskQueue(): Promise<MultiWorkspaceResult<void>> {
    console.log(`🚀 [多工作空间] 批量开始处理任务队列`);

    const workspaceResults = new Map<string, void>();
    const errors = new Map<string, Error>();

    // 并行处理所有workspace实例
    const workspacePromises = Array.from(this.instances.entries()).map(async ([workspaceRoot, manager]) => {
      try {
        await manager.startTaskQueue(this.options);
        workspaceResults.set(workspaceRoot, undefined);
        console.log(`✅ [多工作空间] workspace ${workspaceRoot} 任务队列处理完成`);
      } catch (error) {
        console.error(`❌ [多工作空间] workspace ${workspaceRoot} 任务队列处理失败:`, error);
        errors.set(workspaceRoot, error as Error);
      }
    });

    await Promise.all(workspacePromises);

    return this.createMultiWorkspaceResult(workspaceResults, errors);
  }

  /**
   * 批量暂停任务队列
   */
  public pauseTaskQueue(): void {
    console.log(`⏸️ [多工作空间] 批量暂停任务队列`);

    for (const [workspaceRoot, manager] of this.instances) {
      manager.pauseTaskQueue();
      console.log(`⏸️ [多工作空间] workspace ${workspaceRoot} 任务队列已暂停`);
    }
  }

  /**
   * 批量恢复任务队列
   */
  public async resumeTaskQueue(): Promise<MultiWorkspaceResult<void>> {
    console.log(`▶️ [多工作空间] 批量恢复任务队列`);

    const workspaceResults = new Map<string, void>();
    const errors = new Map<string, Error>();

    // 并行处理所有workspace实例
    const workspacePromises = Array.from(this.instances.entries()).map(async ([workspaceRoot, manager]) => {
      try {
        await manager.resumeTaskQueue(this.options);
        workspaceResults.set(workspaceRoot, undefined);
        console.log(`▶️ [多工作空间] workspace ${workspaceRoot} 任务队列已恢复`);
      } catch (error) {
        console.error(`❌ [多工作空间] workspace ${workspaceRoot} 任务队列恢复失败:`, error);
        errors.set(workspaceRoot, error as Error);
      }
    });

    await Promise.all(workspacePromises);

    return this.createMultiWorkspaceResult(workspaceResults, errors);
  }

  /**
   * 批量纯解析文件（不做enrichment）
   */
  public async parseFilesOnly(files: string[], deletedFiles: string[] = []): Promise<MultiWorkspaceResult<FileEntityMapping[]>> {
    console.log(`🚀 [多工作空间] 批量纯解析文件: ${files.length} 个文件, ${deletedFiles.length} 个删除文件`);

    // 分析所有文件的workspace映射
    const allFiles = [...files, ...deletedFiles];
    const workspaceMap = this.analyzeWorkspaceMappingForFiles(allFiles);

    // 获取当前选中的workspace路径并过滤
    const currentWorkspacePaths = getWorkspacePath();
    console.log(`🎯 [多工作空间] 当前选中的workspace: [${currentWorkspacePaths.join(', ')}]`);

    const filteredWorkspaceMap = new Map<string, string[]>();
    for (const [workspacePath, files] of workspaceMap) {
      const isInCurrentWorkspace = currentWorkspacePaths.includes(workspacePath);
      if (isInCurrentWorkspace) {
        filteredWorkspaceMap.set(workspacePath, files);
        const packageName = this.workspaceMapping.get(workspacePath) || '未知包名';
        console.log(`✅ [多工作空间] 保留当前workspace: ${packageName}(${path.relative(this.rootDir, workspacePath)})`);
      } else {
        const packageName = this.workspaceMapping.get(workspacePath) || '未知包名';
        console.log(`🔄 [多工作空间] 过滤非当前workspace: ${packageName}(${path.relative(this.rootDir, workspacePath)})`);
      }
    }

    console.log(`📊 [多工作空间] 过滤后保留 ${filteredWorkspaceMap.size}/${workspaceMap.size} 个workspace用于纯解析`);

    const workspaceResults = new Map<string, FileEntityMapping[]>();
    const errors = new Map<string, Error>();

    // 并行处理所有workspace
    const workspacePromises = Array.from(filteredWorkspaceMap.entries()).map(async ([workspaceRoot, workspaceFiles]) => {
      try {
        console.log(`📋 [多工作空间] 纯解析workspace: ${workspaceRoot}`);

        // 分离该workspace的变更文件和删除文件
        const workspaceChangedFiles = workspaceFiles.filter((f) => files.includes(f));
        const workspaceDeletedFiles = workspaceFiles.filter((f) => deletedFiles.includes(f));

        if (workspaceChangedFiles.length === 0 && workspaceDeletedFiles.length === 0) {
          workspaceResults.set(workspaceRoot, []);
          return;
        }

        // 创建该workspace的管理器
        const manager = this.getOrCreateInstance(workspaceRoot);

        // 执行纯解析操作
        const result = await manager.parseFilesOnly(workspaceChangedFiles, workspaceDeletedFiles, this.options);

        workspaceResults.set(workspaceRoot, result);
        console.log(`✅ [多工作空间] workspace ${workspaceRoot} 纯解析完成: ${result.length} 个映射`);
      } catch (error) {
        console.error(`❌ [多工作空间] workspace ${workspaceRoot} 纯解析失败:`, error);
        errors.set(workspaceRoot, error as Error);
        workspaceResults.set(workspaceRoot, []);
      }
    });

    await Promise.all(workspacePromises);

    return this.createMultiWorkspaceResult(workspaceResults, errors);
  }

  /**
   * 批量纯解析git变更文件（不做enrichment）
   */
  public async parseGitChangedFilesOnly(commitHash?: string): Promise<MultiWorkspaceResult<FileEntityMapping[]>> {
    console.log(`🚀 [多工作空间] 批量纯解析git变更文件`);

    // 1. 首先获取所有git变更文件
    const gitChanges = await this.getAllGitChangedFiles(commitHash);
    const allChangedFiles = [...gitChanges.changedFiles, ...gitChanges.deletedFiles];

    if (allChangedFiles.length === 0) {
      console.log('📭 [多工作空间] 没有检测到git变更文件');
      return this.createMultiWorkspaceResult(new Map(), new Map());
    }

    console.log(`📋 [多工作空间] 检测到 ${allChangedFiles.length} 个git变更文件`);

    // 2. 分析哪些workspace有变更文件
    const workspaceFileMap = this.analyzeWorkspaceMappingForFiles(allChangedFiles);

    if (workspaceFileMap.size === 0) {
      console.log('📭 [多工作空间] 变更文件不属于任何有效workspace');
      return this.createMultiWorkspaceResult(new Map(), new Map());
    }

    console.log(`📊 [多工作空间] 发现 ${workspaceFileMap.size} 个workspace有变更文件`);

    // 3. 只对有变更的workspace执行操作
    const workspaceResults = new Map<string, FileEntityMapping[]>();
    const errors = new Map<string, Error>();

    const workspacePromises = Array.from(workspaceFileMap.keys()).map(async (workspaceRoot) => {
      try {
        const files = workspaceFileMap.get(workspaceRoot)!;
        console.log(`📋 [多工作空间] 纯解析workspace git变更: ${workspaceRoot} (${files.length} 个文件)`);

        // 创建该workspace的管理器
        const manager = this.getOrCreateInstance(workspaceRoot);

        // 调用每个workspace自己的parseGitChangedFilesOnly方法
        // 这会自动过滤出该workspace范围内的文件，包括workspace包依赖
        const options = { ...this.options };
        if (commitHash) {
          options.commitHash = commitHash;
        }

        const result = await manager.parseGitChangedFilesOnly(options);

        workspaceResults.set(workspaceRoot, result);
        console.log(`✅ [多工作空间] workspace ${workspaceRoot} git变更纯解析完成: ${result.length} 个映射`);
      } catch (error) {
        console.error(`❌ [多工作空间] workspace ${workspaceRoot} git变更纯解析失败:`, error);
        errors.set(workspaceRoot, error as Error);
        workspaceResults.set(workspaceRoot, []);
      }
    });

    await Promise.all(workspacePromises);

    return this.createMultiWorkspaceResult(workspaceResults, errors);
  }

  /**
   * 获取所有workspace的任务进度
   */
  public getAllTaskProgress(): Map<string, TaskProgress> {
    const progressMap = new Map<string, TaskProgress>();

    for (const [rootDir, manager] of this.instances) {
      progressMap.set(rootDir, manager.getTaskProgress());
    }

    return progressMap;
  }

  /**
   * 重置所有workspace的任务队列
   */
  public resetAllTaskQueues(): void {
    let resetCount = 0;

    for (const [rootDir, manager] of this.instances) {
      manager.resetTaskQueue();
      resetCount++;
    }

    // 清空所有实例
    this.instances.clear();

    console.log(`🧹 [多工作空间] 已重置 ${resetCount} 个workspace的任务队列`);
  }

  /**
   * 获取所有workspace的统计信息
   */
  public getWorkspaceStatistics(): {
    totalWorkspaces: number;
    activeWorkspaces: number;
    workspaceList: Array<{
      rootDir: string;
      hasWork: boolean;
      progress: TaskProgress;
      isProcessing: boolean;
    }>;
  } {
    const workspaceList = [];
    let activeWorkspaces = 0;

    for (const [rootDir, manager] of this.instances) {
      const progress = manager.getTaskProgress();
      const hasWork = progress.pendingFiles > 0;
      const isProcessing = progress.percentage > 0 && progress.percentage < 100;

      if (hasWork || isProcessing) {
        activeWorkspaces++;
      }

      workspaceList.push({
        rootDir,
        hasWork,
        progress,
        isProcessing,
      });
    }

    return {
      totalWorkspaces: this.instances.size,
      activeWorkspaces,
      workspaceList,
    };
  }

  /**
   * 获取所有workspace的文件实体映射
   */
  public getAllFileEntityMappings(): Map<string, Map<string, FileEntityMapping>> {
    const mappingsMap = new Map<string, Map<string, FileEntityMapping>>();

    for (const [rootDir, manager] of this.instances) {
      mappingsMap.set(rootDir, manager.getFileEntityMappings());
    }

    return mappingsMap;
  }

  /**
   * 获取所有workspace的初始化配置
   */
  public getAllCurrentInitConfigs(): Map<string, any> {
    const configsMap = new Map<string, any>();

    for (const [rootDir, manager] of this.instances) {
      configsMap.set(rootDir, manager.getCurrentInitConfig());
    }

    return configsMap;
  }
}

// 兼容性：简化的向后兼容函数（保留核心功能）

/**
 * 兼容性函数：初始化任务队列（已废弃，建议使用 MultiWorkspaceManager 单例）
 */
export function initializeTaskQueue(callback: (progress: TaskProgress) => void, options: ProcessOptions = {}, force: boolean = false): void {
  console.warn('⚠️ initializeTaskQueue 已废弃，建议使用 MultiWorkspaceManager 类');
  if (!options.rootDir) {
    options.rootDir = findWorkspaceRoot(process.cwd()) || process.cwd();
  }
  // 初始化单例
  MultiWorkspaceManager.getInstance(callback, options);
}

/**
 * 兼容性函数：添加git变更文件到处理队列
 */
export async function addGitChangedFilesToQueue(options: ProcessOptions = {}): Promise<MultiWorkspaceResult<FileEntityMapping[]>> {
  console.warn('⚠️ addGitChangedFilesToQueue 已废弃，建议使用 MultiWorkspaceManager 类');

  const manager = ensureManagerExists();
  return await manager.addGitChangedFilesToQueue(options.commitHash);
}

/**
 * 兼容性函数：只获取文件对应的变更实体列表（不做enrichment）
 */
export async function parseFilesOnly(files: string[], deletedFiles: string[] = [], options: ProcessOptions = {}): Promise<MultiWorkspaceResult<FileEntityMapping[]>> {
  console.warn('⚠️ parseFilesOnly 已废弃，建议使用 MultiWorkspaceManager 类');

  const manager = ensureManagerExists();
  return await manager.parseFilesOnly(files, deletedFiles);
}

/**
 * 兼容性函数：获取Git变更文件对应的变更实体列表（不做enrichment）
 */
export async function parseGitChangedFilesOnly(options: ProcessOptions = {}): Promise<MultiWorkspaceResult<FileEntityMapping[]>> {
  console.warn('⚠️ parseGitChangedFilesOnly 已废弃，建议使用 MultiWorkspaceManager 类');

  const manager = ensureManagerExists();
  return await manager.parseGitChangedFilesOnly(options.commitHash);
}

/**
 * 检查MultiWorkspaceManager单例是否存在
 * @throws Error 如果单例不存在
 */
function ensureManagerExists(): MultiWorkspaceManager {
  if (!MultiWorkspaceManager.hasInstance()) {
    throw new Error('MultiWorkspaceManager 单例未初始化，请先调用 initializeTaskQueue() 或 MultiWorkspaceManager.getInstance()');
  }

  // 单例存在，直接获取（不需要参数）
  return MultiWorkspaceManager.getInstance();
}

/**
 * 兼容性函数：暂停任务队列
 */
export function pauseTaskQueue(): void {
  console.warn('⚠️ pauseTaskQueue 已废弃，建议使用 MultiWorkspaceManager 类');

  const manager = ensureManagerExists();
  manager.pauseTaskQueue();
}

/**
 * 兼容性函数：恢复任务队列
 */
export async function resumeTaskQueue(options: ProcessOptions = {}): Promise<void> {
  console.warn('⚠️ resumeTaskQueue 已废弃，建议使用 MultiWorkspaceManager 类');

  const manager = ensureManagerExists();
  await manager.resumeTaskQueue();
}

/**
 * 兼容性函数：获取任务进度
 */
export function getTaskProgress(): Map<string, TaskProgress> {
  console.warn('⚠️ getTaskProgress 已废弃，建议使用 MultiWorkspaceManager 类');

  const manager = ensureManagerExists();
  return manager.getAllTaskProgress();
}

/**
 * 兼容性函数：重置任务队列
 */
export function resetTaskQueue(): void {
  console.warn('⚠️ resetTaskQueue 已废弃，建议使用 MultiWorkspaceManager 类');

  const manager = ensureManagerExists();
  manager.resetAllTaskQueues();
}

/**
 * 兼容性函数：添加文件到队列
 */
export async function addFilesToQueue(files: string[], options: ProcessOptions = {}): Promise<MultiWorkspaceResult<FileEntityMapping[]>> {
  console.warn('⚠️ addFilesToQueue 已废弃，建议使用 MultiWorkspaceManager 类');

  const manager = ensureManagerExists();
  return await manager.addFilesToQueue(files);
}

/**
 * 兼容性函数：添加文件到队列（包含删除文件）
 */
export async function addFilesToQueueWithDeletion(files: string[], deletedFiles: string[] = [], options: ProcessOptions = {}): Promise<MultiWorkspaceResult<FileEntityMapping[]>> {
  console.warn('⚠️ addFilesToQueueWithDeletion 已废弃，建议使用 MultiWorkspaceManager 类');

  const manager = ensureManagerExists();
  return await manager.addFilesToQueueWithDeletion(files, deletedFiles);
}
