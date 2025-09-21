import { TaskQueueManager } from "./task-queue-manager";
import { GitChangedFilesProvider } from "./git-provider";
import { EntityFileManager } from "./entity-file-manager";
import { PatchParseProcessor } from "./patch-parse-processor";
import { TaskProgress, ProcessOptions, FileEntityMapping } from "./types";
import { extractAllEntities } from "../fileWalker";
import { BaseEntity } from "../enrichment/interfaces";
import path from 'path';

// 工作空间实例接口
interface WorkspaceInstance {
  taskManager: TaskQueueManager;
  processor: PatchParseProcessor;
  gitProvider: GitChangedFilesProvider;
  entityManager: EntityFileManager;
  rootDir: string;
  currentInitConfig: { rootDir: string; baseFileCount?: number };
}

/**
 * 单个工作空间处理器类
 * 负责管理单个工作空间的所有处理逻辑
 */
export class PatchParseManager {
  private rootDir: string;
  private workspace: WorkspaceInstance;

  /**
   * 构造函数
   * @param callback 进度回调函数
   * @param options 处理选项
   */
  constructor(
    callback: (progress: TaskProgress) => void,
    options: ProcessOptions = {}
  ) {
    this.rootDir = options.rootDir || process.cwd();
    this.workspace = this.initializeWorkspace(callback, options);
  }

  /**
   * 初始化工作空间实例（简化版，无force逻辑）
   */
  private initializeWorkspace(
    callback: (progress: TaskProgress) => void,
    options: ProcessOptions = {}
  ): WorkspaceInstance {
    const rootDir = options.rootDir || process.cwd();
    const newConfig = {
      rootDir,
      baseFileCount: options.baseFileCount,
    };

    console.log(`🚀 初始化工作空间 ${rootDir}`);

    // 创建新的工作空间实例
    const taskManager = new TaskQueueManager(rootDir);
    taskManager.setCallback(callback);

    // 设置基础文件数量
    if (options.baseFileCount !== undefined) {
      taskManager.setBaseFileCount(options.baseFileCount);
    } else {
      const entityManager = new EntityFileManager(rootDir);
      const existingCount = entityManager.getExistingFileCount();
      taskManager.setBaseFileCount(existingCount);
    }

    const workspace: WorkspaceInstance = {
      taskManager,
      processor: new PatchParseProcessor(rootDir, options, taskManager),
      gitProvider: new GitChangedFilesProvider(rootDir),
      entityManager: new EntityFileManager(rootDir),
      rootDir,
      currentInitConfig: newConfig,
    };

    console.log(
      `📊 工作空间 ${rootDir} 已初始化，基础文件数量: ${
        taskManager.getProgress().processedFiles - taskManager.getProgress().pendingFiles
      }`
    );

    return workspace;
  }

  /**
   * 添加文件到处理队列（支持删除文件处理）
   * @param files 变更文件路径列表
   * @param deletedFiles 删除文件路径列表
   * @param options 处理选项
   */
  public async addFilesToQueueWithDeletion(
    files: string[],
    deletedFiles: string[] = [],
    options: ProcessOptions = {}
  ): Promise<FileEntityMapping[]> {
    if (files.length === 0 && deletedFiles.length === 0) {
      console.log("📭 没有文件需要处理");
      return [];
    }

    console.log(
      `📋 添加文件到队列: ${files.length} 个新文件, ${deletedFiles.length} 个删除文件`
    );

    // 先解析更新 entities.json，处理删除文件，然后添加到队列
    const fileEntityMappings = await this.workspace.processor.parseAndEnrichFiles(files, deletedFiles, options);

    // 自动启动任务队列处理（保持与原先逻辑一致）
    if (files.length > 0) {
      console.log("🚀 自动启动任务队列处理");
      await this.workspace.processor.startProcessingQueue(options);
    }
    
    return fileEntityMappings;
  }

  /**
   * 添加文件到处理队列（不支持删除文件）
   * @param files 变更文件路径列表
   * @param options 处理选项
   */
  public async addFilesToQueue(
    files: string[],
    options: ProcessOptions = {}
  ): Promise<FileEntityMapping[]> {
    return this.addFilesToQueueWithDeletion(files, [], options);
  }

  /**
   * 添加git变更文件到处理队列（包含删除文件处理）
   * @param options 处理选项
   */
  public async addGitChangedFilesToQueue(
    options: ProcessOptions = {}
  ): Promise<FileEntityMapping[]> {
    const gitProvider = this.workspace.gitProvider;
    let changedFiles: string[] = [];
    let deletedFiles: string[] = [];

    if (options.commitHash) {
      // 如果提供了commit hash，获取指定commit的变更文件
      console.log(`🔍 获取commit ${options.commitHash} 的变更文件...`);

      const commitChanges = await gitProvider.getCommitChangedFiles(
        options.commitHash
      );
      changedFiles = commitChanges.changedFiles;
      deletedFiles = commitChanges.deletedFiles;
    } else {
      // 否则获取当前git变更文件
      console.log(`🔍 获取git变更文件...`);

      changedFiles = await gitProvider.getGitChangedFiles();
      deletedFiles = gitProvider.getDeletedFiles();
    }

    if (changedFiles.length === 0 && deletedFiles.length === 0) {
      console.log("📭 没有发现git变更文件");
      this.workspace.processor.notifyProgress();
      return [];
    }

    console.log(
      `📋 发现 ${changedFiles.length} 个git变更文件, ${deletedFiles.length} 个删除文件`
    );

    // 处理git变更文件和删除文件
    return await this.addFilesToQueueWithDeletion(changedFiles, deletedFiles, options);
  }

  /**
   * 开始处理任务队列（只做富化处理）
   * @param options 处理选项
   */
  public async startTaskQueue(
    options: ProcessOptions = {}
  ): Promise<void> {
    if (!this.workspace.taskManager.hasWork()) {
      console.log("📭 任务队列为空，无需处理");
      return;
    }

    console.log("🚀 开始处理任务队列");
    await this.workspace.processor.startProcessingQueue(options);
  }

  /**
   * 暂停任务队列
   */
  public pauseTaskQueue(): void {
    this.workspace.taskManager.pause();
  }

  /**
   * 恢复任务队列
   */
  public async resumeTaskQueue(
    options: ProcessOptions = {}
  ): Promise<void> {
    this.workspace.taskManager.resume();

    // 如果有待处理的任务且没有在处理中，重新启动处理队列
    if (
      !this.workspace.taskManager.isProcessingState() &&
      this.workspace.taskManager.hasWork()
    ) {
      console.log("🚀 恢复后检测到待处理任务，重新启动处理队列");
      await this.workspace.processor.startProcessingQueue(options);
    }
  }

  /**
   * 获取当前任务进度
   */
  public getTaskProgress(): TaskProgress {
    return this.workspace.taskManager.getProgress();
  }

  /**
   * 重置任务队列
   */
  public resetTaskQueue(): void {
    this.workspace.taskManager.reset();
    this.workspace.processor.clearFileEntityMappings();
    console.log(`🧹 工作空间 ${this.rootDir} 已重置`);
  }

  /**
   * 获取文件实体映射状态（用于调试）
   */
  public getFileEntityMappings() {
    return this.workspace.processor.getFileEntityMappings();
  }

  /**
   * 获取当前初始化配置
   */
  public getCurrentInitConfig() {
    return this.workspace.currentInitConfig;
  }

  /**
   * 只获取文件对应的变更实体列表（不做enrichment）
   * @param files 要处理的文件列表
   * @param deletedFiles 要删除的文件列表
   * @param options 处理选项
   * @returns 文件实体映射列表
   */
  public async parseFilesOnly(
    files: string[],
    deletedFiles: string[] = [],
    options: ProcessOptions = {}
  ): Promise<FileEntityMapping[]> {
    if (files.length === 0 && deletedFiles.length === 0) {
      console.log('📭 没有文件需要处理');
      return [];
    }

    console.log(`🔍 纯解析处理: ${files.length} 个文件, ${deletedFiles.length} 个删除文件`);

    try {
      // 直接通过 extractAllEntities 获取实体，不做文件操作
      let newEntities: BaseEntity[] = [];
      if (files.length > 0) {
        newEntities = await extractAllEntities(this.rootDir, files);
        console.log(`🔍 从 ${files.length} 个文件中提取到 ${newEntities.length} 个实体`);
      }

      // 创建文件实体映射
      const fileEntityMappings = this.createFileEntityMappings(files, newEntities);

      console.log('✅ 纯解析处理完成');
      return fileEntityMappings;

    } catch (error) {
      console.error(`❌ 纯解析处理失败: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 获取Git变更文件对应的变更实体列表（不做enrichment）
   * @param options 处理选项
   * @returns 文件实体映射列表
   */
  public async parseGitChangedFilesOnly(
    options: ProcessOptions = {}
  ): Promise<FileEntityMapping[]> {
    const gitProvider = this.workspace.gitProvider;
    let changedFiles: string[] = [];
    let deletedFiles: string[] = [];

    if (options.commitHash) {
      // 如果提供了commit hash，获取指定commit的变更文件
      console.log(`🔍 纯解析模式：获取commit ${options.commitHash} 的变更文件...`);

      const commitChanges = await gitProvider.getCommitChangedFiles(
        options.commitHash
      );
      changedFiles = commitChanges.changedFiles;
      deletedFiles = commitChanges.deletedFiles;
    } else {
      // 否则获取当前git变更文件
      console.log(`🔍 纯解析模式：获取git变更文件...`);

      changedFiles = await gitProvider.getGitChangedFiles();
      deletedFiles = gitProvider.getDeletedFiles();
    }

    if (changedFiles.length === 0 && deletedFiles.length === 0) {
      console.log("📭 没有发现git变更文件");
      return [];
    }

    console.log(
      `📋 纯解析模式：发现 ${changedFiles.length} 个git变更文件, ${deletedFiles.length} 个删除文件`
    );

    // 纯解析处理git变更文件
    return await this.parseFilesOnly(changedFiles, deletedFiles, options);
  }

  /**
   * 创建文件实体映射
   */
  private createFileEntityMappings(files: string[], allEntities: BaseEntity[]): FileEntityMapping[] {
    return files.map(file => {
      const relativePath = path.relative(this.rootDir, file);
      const fileEntities = allEntities.filter(entity => entity.file === relativePath);
      
      return {
        file,
        entities: fileEntities,
        relativePath
      };
    });
  }

  /**
   * 获取根目录
   */
  public getRootDir(): string {
    return this.rootDir;
  }
}