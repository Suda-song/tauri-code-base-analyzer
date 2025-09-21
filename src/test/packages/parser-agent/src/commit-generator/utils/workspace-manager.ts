/**
 * Workspace管理器 - 负责monorepo多workspace场景的统一管理
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import {
  getWorkspacePackageMappings,
  getWorkspacePath,
  findWorkspaceRoot,
  shouldSkipDirectory,
  isValidWorkspacePackage,
} from "@xhs/shared-utils";

export interface WorkspaceContext {
  /** workspace名称 */
  name: string;
  /** workspace根目录绝对路径 */
  rootPath: string;
  /** workspace相对于monorepo根目录的相对路径 */
  relativePath: string;
  /** workspace的package.json信息 */
  packageInfo?: any;
  /** 实体文件路径 */
  entitiesFilePath: string;
  /** 数据库文件路径 */
  dbPath: string;
  /** 是否有实体文件 */
  hasEntities: boolean;
}

export interface WorkspaceManagerOptions {
  /** 是否包含开发依赖 */
  includeDevDependencies?: boolean;
  /** 是否包含peer依赖 */
  includePeerDependencies?: boolean;
  /** 最大搜索深度 */
  maxDepth?: number;
  /** workspace目录搜索的最大深度 */
  workspaceSearchDepth?: number;
  /** 自定义的monorepo根目录 */
  monorepoRoot?: string;
}

export class WorkspaceManager {
  private monorepoRoot: string;
  private activeWorkspaceContexts: Map<string, WorkspaceContext> = new Map();
  private allWorkspacePaths: Map<string, string> = new Map();
  private isInitialized: boolean = false;
  private workspaceSearchDepth: number;

  constructor(options: WorkspaceManagerOptions = {}) {
    // 多workspace模式：使用原有逻辑但支持多个根路径
    this.monorepoRoot =
      options.monorepoRoot ||
      findWorkspaceRoot(process.cwd()) ||
      getWorkspacePath()[0]; // 取第一个作为根目录

    console.log(`🏠 多workspace模式 - Monorepo根目录: ${this.monorepoRoot}`);
    console.log(`📍 当前工作目录: ${process.cwd()}`);

    this.workspaceSearchDepth = options.workspaceSearchDepth || 2;
    console.log(`🔍 Workspace搜索深度: ${this.workspaceSearchDepth}`);
  }

  /**
   * 初始化workspace管理器
   * 发现所有可能的workspace路径，不创建上下文
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // 发现所有可能的workspace路径（不创建上下文）
    console.log(`🔍 开始发现workspace路径...`);
    await this.discoverWorkspacePaths();

    this.isInitialized = true;
    console.log(
      `✅ WorkspaceManager初始化完成，发现 ${this.allWorkspacePaths.size} 个workspace路径`
    );
  }

  /**
   * 获取git暂存文件并创建相关workspace的上下文
   */
  async buildContextsForStagedFiles(): Promise<WorkspaceContext[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // 1. 获取git暂存文件
    const stagedFiles = this.getStagedFiles();
    console.log(`📄 发现 ${stagedFiles.length} 个暂存文件:`, stagedFiles);

    if (stagedFiles.length === 0) {
      console.log(`⚠️  没有暂存文件，无需创建workspace上下文`);
      return [];
    }

    return this.buildContextsForFiles(stagedFiles);
  }

  /**
   * 根据文件列表创建相关workspace的上下文
   */
  async buildContextsForFiles(files: string[]): Promise<WorkspaceContext[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (files.length === 0) {
      console.log(`⚠️  没有文件，无需创建workspace上下文`);
      return [];
    }

    // 1. 过滤出涉及变更的workspace路径
    const affectedWorkspacePaths = this.getAffectedWorkspacePaths(files);
    console.log(
      `🎯 涉及 ${affectedWorkspacePaths.length} 个workspace:`,
      affectedWorkspacePaths.map((p) => path.relative(this.monorepoRoot, p))
    );

    // TODO: 这里可以添加硬编码的过滤逻辑
    // const filteredWorkspacePaths = this.applyHardcodedFilters(affectedWorkspacePaths);

    // 2. 只为这些workspace创建上下文
    const contexts = this.createWorkspaceContexts(affectedWorkspacePaths);

    return contexts;
  }

  /**
   * 获取git暂存文件
   */
  private getStagedFiles(): string[] {
    try {
      const result = execSync("git diff --cached --name-only", {
        cwd: this.monorepoRoot,
        encoding: "utf-8",
      });

      return result
        .trim()
        .split("\n")
        .filter((file) => file.length > 0)
        .map((file) => file.trim());
    } catch (error) {
      console.warn("⚠️  获取git暂存文件失败:", error);
      return [];
    }
  }

  /**
   * 根据变更文件获取涉及的workspace路径
   */
  private getAffectedWorkspacePaths(changedFiles: string[]): string[] {
    const affectedPaths = new Set<string>();

    for (const file of changedFiles) {
      const workspacePath = this.findWorkspacePathForFile(file);
      if (workspacePath) {
        affectedPaths.add(workspacePath);
      }
    }

    return Array.from(affectedPaths);
  }

  /**
   * 查找文件对应的workspace路径
   */
  private findWorkspacePathForFile(filePath: string): string | null {
    // 转换为绝对路径
    const absoluteFilePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.monorepoRoot, filePath);

    let bestMatch: { path: string; length: number } | null = null;

    // 找到包含该文件的最具体的workspace
    for (const workspacePath of this.allWorkspacePaths.values()) {
      if (
        absoluteFilePath.startsWith(workspacePath + path.sep) ||
        absoluteFilePath === workspacePath
      ) {
        const matchLength = workspacePath.length;
        if (!bestMatch || matchLength > bestMatch.length) {
          bestMatch = { path: workspacePath, length: matchLength };
        }
      }
    }

    return bestMatch?.path || null;
  }

  /**
   * 为指定的workspace路径创建上下文
   */
  private createWorkspaceContexts(
    workspacePaths: string[]
  ): WorkspaceContext[] {
    const contexts: WorkspaceContext[] = [];

    for (const workspacePath of workspacePaths) {
      // 检查是否已经创建过上下文
      if (this.activeWorkspaceContexts.has(workspacePath)) {
        contexts.push(this.activeWorkspaceContexts.get(workspacePath)!);
        continue;
      }

      // 创建新的workspace上下文
      const context = this.createWorkspaceContext(workspacePath);
      if (context) {
        this.activeWorkspaceContexts.set(workspacePath, context);
        contexts.push(context);
        console.log(
          `📦 创建workspace上下文: ${context.name} -> ${
            context.relativePath
          } (实体文件: ${context.hasEntities ? "✅" : "❌"})`
        );
      }
    }

    return contexts;
  }

  /**
   * 发现所有可能的workspace路径（不创建上下文）
   */
  private async discoverWorkspacePaths(): Promise<void> {
    // 清空现有路径
    this.allWorkspacePaths.clear();

    // 1. 添加monorepo根目录
    this.allWorkspacePaths.set(".", this.monorepoRoot);

    // 2. 通过workspace-mapper发现workspace包
    try {
      const workspacePackages = getWorkspacePackageMappings(this.monorepoRoot, {
        includeDevDependencies: true,
        includePeerDependencies: false,
        maxDepth: 3,
      });

      for (const pkg of workspacePackages) {
        const relativePath = path.relative(this.monorepoRoot, pkg.path);
        this.allWorkspacePaths.set(relativePath, pkg.path);
      }
    } catch (error) {
      console.warn(`⚠️  通过workspace-mapper发现workspace失败:`, error);
    }

    // 3. 手动搜索常见的workspace目录结构
    // TODO: 考虑在 shared-utils 中暴露 getAllWorkspacePaths() 函数来统一这个逻辑
    const commonWorkspaceDirs = ["packages", "apps", "libs", "modules"];
    for (const dir of commonWorkspaceDirs) {
      const dirPath = path.join(this.monorepoRoot, dir);
      if (fs.existsSync(dirPath)) {
        console.log(
          `🔍 搜索目录: ${dir}/ (最大深度: ${this.workspaceSearchDepth})`
        );
        const foundPaths = this.searchWorkspacePathsInDirectory(
          dirPath,
          this.workspaceSearchDepth
        );
        foundPaths.forEach(({ relativePath, absolutePath }) => {
          this.allWorkspacePaths.set(relativePath, absolutePath);
        });
      }
    }
  }

  /**
   * 在指定目录中搜索workspace路径（不创建上下文）
   */
  private searchWorkspacePathsInDirectory(
    dirPath: string,
    maxDepth: number = 2,
    currentDepth: number = 0
  ): Array<{ relativePath: string; absolutePath: string }> {
    const paths: Array<{ relativePath: string; absolutePath: string }> = [];

    try {
      const entries = fs.readdirSync(dirPath);
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry);
        const stat = fs.statSync(entryPath);

        if (stat.isDirectory() && !shouldSkipDirectory(entry)) {
          // 检查当前目录是否是有效的workspace
          if (isValidWorkspacePackage(entryPath)) {
            const relativePath = path.relative(this.monorepoRoot, entryPath);
            paths.push({ relativePath, absolutePath: entryPath });
          }

          // 如果没有达到最大深度，继续递归搜索子目录
          if (currentDepth < maxDepth) {
            const subPaths = this.searchWorkspacePathsInDirectory(
              entryPath,
              maxDepth,
              currentDepth + 1
            );
            paths.push(...subPaths);
          }
        }
      }
    } catch (error) {
      console.warn(`读取目录失败: ${dirPath}`);
    }

    return paths;
  }

  /**
   * 创建workspace上下文
   */
  private createWorkspaceContext(
    workspacePath: string
  ): WorkspaceContext | null {
    try {
      // 确保是绝对路径
      const absolutePath = path.isAbsolute(workspacePath)
        ? workspacePath
        : path.resolve(workspacePath);

      // 检查package.json
      const packageJsonPath = path.join(absolutePath, "package.json");
      let packageInfo = null;
      let name = path.basename(absolutePath);

      if (fs.existsSync(packageJsonPath)) {
        try {
          packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
          name = packageInfo.name || name;
        } catch (error) {
          console.warn(`解析package.json失败: ${packageJsonPath}`);
        }
      }

      // 计算相对路径
      const relativePath = path.relative(this.monorepoRoot, absolutePath);

      // 生成实体文件路径
      const entitiesFilePath = path.join(
        absolutePath,
        "data",
        "entities.enriched.json"
      );
      const hasEntities = fs.existsSync(entitiesFilePath);

      // 生成数据库文件路径
      const dbPath = path.join(absolutePath, "data");

      return {
        name,
        rootPath: absolutePath,
        relativePath: relativePath || ".",
        packageInfo,
        entitiesFilePath,
        dbPath,
        hasEntities,
      };
    } catch (error) {
      console.warn(`创建workspace上下文失败: ${workspacePath}`, error);
      return null;
    }
  }

  /**
   * 获取当前活跃的workspace上下文（有变更的）
   */
  getActiveWorkspaces(): WorkspaceContext[] {
    return Array.from(this.activeWorkspaceContexts.values());
  }

  /**
   * 获取包含实体文件的活跃workspace
   */
  getActiveWorkspacesWithEntities(): WorkspaceContext[] {
    return Array.from(this.activeWorkspaceContexts.values()).filter(
      (ws) => ws.hasEntities
    );
  }

  /**
   * 检查是否已初始化
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * 获取所有文件列表（保持向后兼容）
   */
  getFilteredFiles(files: string[]): string[] {
    return files;
  }

  /**
   * 检查文件是否属于指定workspace（支持插件环境）
   */
  static isFileInWorkspace(
    filePath: string,
    workspace: WorkspaceContext
  ): boolean {
    // 优先使用模糊匹配（在插件环境中最有效）
    const workspaceBasename = path.basename(workspace.rootPath);
    if (
      filePath.includes(workspaceBasename) ||
      filePath.includes(workspace.name)
    ) {
      return true;
    }

    // 备用：精确路径匹配
    let absoluteFilePath: string;
    if (path.isAbsolute(filePath)) {
      absoluteFilePath = filePath;
    } else {
      absoluteFilePath = path.resolve(filePath);

      // 尝试基于workspace根目录解析
      if (!absoluteFilePath.startsWith(workspace.rootPath)) {
        const alternativeAbsolutePath = path.resolve(
          workspace.rootPath,
          filePath
        );
        if (fs.existsSync(alternativeAbsolutePath)) {
          absoluteFilePath = alternativeAbsolutePath;
        }
      }
    }

    const normalizedFilePath = path.normalize(absoluteFilePath);
    const normalizedWorkspaceRoot = path.normalize(workspace.rootPath);

    return (
      normalizedFilePath.startsWith(normalizedWorkspaceRoot + path.sep) ||
      normalizedFilePath === normalizedWorkspaceRoot
    );
  }
}
