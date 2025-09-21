/**
 * 插件专用的Git post-commit hook
 * 在提交完成后自动处理文件变更，提取实体，并更新数据库
 */

import fs from "fs";
import path from "path";
import { GitUtils } from "../utils/git-utils";
import { saveCommitRecord } from "../db/commit-manager";
import { MultiWorkspaceManager } from "../../patch-parse/index";
import { BaseEntity } from "../../enrichment/interfaces";
import {
  WorkspaceManager,
  WorkspaceManagerOptions,
  WorkspaceContext,
} from "../utils/workspace-manager";
import { CommitStatisticsService } from "../utils/commit-statistics";

/**
 * 数据库提交消息常量
 */
export const UPDATE_DATA_COMMIT_MESSAGE =
  "chore: Automatically Update Entity, Executed by ai-commit";

export interface PostCommitOptions {
  projectPath?: string;
  skipEntityExtraction?: boolean;
  skipDatabaseCommit?: boolean;
  workspaceOptions?: WorkspaceManagerOptions;
  dataCommitMode?: "amend" | "separate";
}

export interface PostCommitResult {
  commitHash: string;
  modifiedFiles: string[];
  deletedFiles: string[];
  entities: BaseEntity[];
  databaseUpdated: boolean;
  affectedWorkspaces: string[];
}

/**
 * Post-Commit 处理器类
 */
export class PostCommitProcessor {
  private projectPath: string;
  private gitUtils: GitUtils;
  private workspaceManager: WorkspaceManager;
  private multiWorkspaceManager: MultiWorkspaceManager;

  constructor(
    projectPath?: string,
    workspaceOptions: WorkspaceManagerOptions = {}
  ) {
    this.projectPath = projectPath || process.cwd();
    this.gitUtils = new GitUtils(this.projectPath);

    this.workspaceManager = new WorkspaceManager({
      monorepoRoot: projectPath,
      ...workspaceOptions,
    });

    // 初始化多工作区管理器
    this.multiWorkspaceManager = MultiWorkspaceManager.getInstance(
      (progress) => {
        console.log(
          `📊 处理进度: ${progress.percentage}% (${progress.processedFiles}/${progress.totalFiles})`
        );
      },
      { rootDir: process.cwd() }
    );

    console.log(`🔧 项目路径: ${this.projectPath}`);
  }

  /**
   * 处理多个工作区的package.json信息
   * 返回聚合信息和详细映射
   */
  async processMultiWorkspacePackageInfo(
    workspaceContexts: WorkspaceContext[]
  ): Promise<{
    aggregated: { version: string; name: string };
    workspaceNameMapping: Map<string, string>;
    workspaceVersionMapping: Map<string, string>;
  }> {
    const versions: string[] = [];
    const names: string[] = [];
    const workspaceNameMap = new Map<string, string>();
    const workspaceVersionMap = new Map<string, string>();

    for (const context of workspaceContexts) {
      try {
        const packageJsonPath = path.join(context.rootPath, "package.json");
        let workspaceName = context.name; // 默认使用目录名
        let workspaceVersion = "1.0.0"; // 默认版本

        if (fs.existsSync(packageJsonPath)) {
          const packageContent = fs.readFileSync(packageJsonPath, "utf-8");
          const packageJson = JSON.parse(packageContent);

          // 处理版本信息
          if (packageJson.version) {
            versions.push(packageJson.version);
            workspaceVersion = packageJson.version;
          }

          // 处理名称信息
          if (packageJson.name) {
            names.push(packageJson.name);
            workspaceName = packageJson.name; // 优先使用 package.json 中的 name
          } else {
            names.push(context.name);
          }
        } else {
          console.log(`💡 工作区 ${context.name} 未找到package.json文件`);
          names.push(context.name);
        }

        // 创建映射关系
        workspaceNameMap.set(context.rootPath, workspaceName);
        workspaceVersionMap.set(context.rootPath, workspaceVersion);

        console.log(
          `🏷️ 工作区映射: ${context.rootPath} -> ${workspaceName} (v${workspaceVersion})`
        );
      } catch (error) {
        console.warn(
          `💔 处理工作区 ${context.name} 的package.json信息失败:`,
          error
        );
        // 失败时使用默认名称和版本
        names.push(context.name);
        workspaceNameMap.set(context.rootPath, context.name);
        workspaceVersionMap.set(context.rootPath, "1.0.0");
      }
    }

    return {
      // 聚合信息
      aggregated: {
        version: versions.length > 0 ? versions.join(",") : "1.0.0",
        name: names.length > 0 ? names.join(",") : "unknown",
      },
      // 详细映射信息
      workspaceNameMapping: workspaceNameMap,
      workspaceVersionMapping: workspaceVersionMap,
    };
  }

  /**
   * 处理post-commit操作
   */
  async processPostCommit(
    commitHash: string,
    options: PostCommitOptions = {}
  ): Promise<PostCommitResult> {
    console.log(
      `🚀 开始处理post-commit (多工作区): ${commitHash}`
    );

    try {
      // 1. 初始化workspace管理器
      console.log("🏠 初始化多工作区管理器...");
      await this.workspaceManager.initialize();

      // 2. 获取当前分支
      console.log("📋 获取当前分支...");
      const { branch: currentBranch } = await this.gitUtils.getBasicInfo();

      // 3. 使用MultiWorkspaceManager处理指定commit的文件变更
      console.log(`📁 处理commit ${commitHash} 的文件变更...`);
      const workspaceResults =
        await this.multiWorkspaceManager.addGitChangedFilesToQueue(commitHash);
      console.log(
        `✅ 文件队列处理完成，涉及 ${workspaceResults.totalWorkspaces} 个工作区`
      );

      // 4. 先收集基本的工作区和文件信息
      const affectedWorkspaces: string[] = [];
      const allEntities: BaseEntity[] = [];
      const allModifiedFiles: string[] = [];
      const allDeletedFiles: string[] = [];

      // 先处理workspaceResults，收集基本信息
      for (const [workspacePath, entityMappings] of workspaceResults) {
        if (entityMappings.length > 0) {
          affectedWorkspaces.push(workspacePath);

          // 从FileEntityMapping提取实体信息
          entityMappings.forEach((mapping) => {
            if (mapping.entities) {
              allEntities.push(...mapping.entities);
            }
            // 收集文件信息
            if (mapping.file) {
              allModifiedFiles.push(mapping.file);
            }
          });
        }
      }

      // 从 git 获取删除的文件
      const fullInfo = await this.gitUtils.getCommitFullInfo(commitHash);
      allDeletedFiles.push(...fullInfo.files.deletedFiles);

      console.log(
        `📋 多工作区检测到变更: ${allModifiedFiles.length} 个修改文件, ${allDeletedFiles.length} 个删除文件`
      );
      console.log(`🏠 涉及工作区: ${affectedWorkspaces.join(", ")}`);
      console.log(`📦 提取到 ${allEntities.length} 个相关实体`);

      // 5. 获取涉及工作区的上下文信息
      const workspaceContexts =
        await this.workspaceManager.buildContextsForFiles([
          ...allModifiedFiles,
          ...allDeletedFiles,
        ]);

      // 6. 获取工作区名称映射
      const workspacePackageInfo = await this.processMultiWorkspacePackageInfo(
        workspaceContexts
      );
      const { aggregated: packageInfo, workspaceNameMapping } =
        workspacePackageInfo;

      // 7. 建立实体ID到工作区名称的直接映射
      const entityWorkspaceMapping = new Map<string, string>();
      for (const [workspacePath, entityMappings] of workspaceResults) {
        if (entityMappings.length > 0) {
          // 获取该工作区的名称
          const workspaceName =
            workspaceNameMapping.get(workspacePath) || workspacePath;

          // 从FileEntityMapping建立实体映射
          entityMappings.forEach((mapping) => {
            if (mapping.entities) {
              mapping.entities.forEach((entity) => {
                entityWorkspaceMapping.set(entity.id, workspaceName);
                console.log(
                  `📍 建立实体映射: ${entity.id} -> ${workspaceName}`
                );
              });
            }
          });
        }
      }

      // 8. 保存提交数据到数据库
      let databaseUpdated = false;
      // if (!options.skipDatabaseCommit && allEntities.length > 0) {
        if (!options.skipDatabaseCommit) {
        console.log("💾 保存提交数据到云端数据库...");
        try {
          const fullInfo = await this.gitUtils.getCommitFullInfo(commitHash);
          console.log("🚀🚀🚀 ~ PostCommitProcessor ~ processPostCommit ~ fullInfo=====>", fullInfo)
          const {
            author: { email: authorEmail, name: authorName },
            info: { type: commitType, summary: commitSummary },
            parsedDiff,
            stats: {
              linesAdded: codeLinesAdded,
              linesDeleted: codeLinesDeleted,
            },
          } = fullInfo;

          console.log(`📧 作者邮箱: ${authorEmail}`);
          console.log(`👤 作者姓名: ${authorName}`);
          console.log(`📝 提交类型: ${commitType}`);
          console.log(`📄 提交描述: ${commitSummary}`);
          console.log(`📦 项目版本: ${packageInfo.version}`);
          console.log(`🏷️ 项目名称: ${packageInfo.name}`);
          console.log(`➕ 新增行数: ${codeLinesAdded}`);
          console.log(`➖ 删除行数: ${codeLinesDeleted}`);
          console.log(`📊 结构化Diff: ${parsedDiff.summary.totalFiles} 个文件`);
          console.log(
            `🎯 实体工作区映射: ${entityWorkspaceMapping.size} 个实体`
          );

          // 计算代码统计数据
          console.log(`🔢 开始计算代码统计数据...`);
          // 使用fullInfo.files中的完整文件列表，而非经过过滤的文件列表
          const allCommitFiles = [...fullInfo.files.modifiedFiles, ...fullInfo.files.deletedFiles];
          console.log(`📊 使用完整commit文件列表进行统计，总文件数: ${allCommitFiles.length}`);
          
          const statistics = await CommitStatisticsService.calculateCommitStatistics(
            commitHash,
            currentBranch,
            allCommitFiles,
            codeLinesAdded,
            codeLinesDeleted,
            this.projectPath
          );
          console.log(`✅ 代码统计数据计算完成`);
          console.log(`📊 文件级采纳率: ${statistics.fileAcceptanceRate}%`);
          console.log(`📊 代码行级采纳率: ${statistics.codeAcceptanceRate}%`);

          const commitData = {
            commitHash,
            branchName: currentBranch || "unknown-branch",
            authorEmail: authorEmail || "unknown-email",
            authorName: authorName || "unknown-author",
            commitSummary: commitSummary || "No summary provided",
            commitType: commitType || "unknown",
            commitVersion: packageInfo.version || "0.0.0",
            commitWorkspaceName: packageInfo.name || "unknown-workspace",
            commitEntities: allEntities.map((e) => e.id),
            commitAt: new Date().toISOString(),
            filesChanged: allCommitFiles.length > 0 ? allCommitFiles : ["no-files"],
            codeLinesAdded: typeof codeLinesAdded === 'number' ? codeLinesAdded : 0,
            codeLinesDeleted: typeof codeLinesDeleted === 'number' ? codeLinesDeleted : 0,
            linkedDocsUrls: [],
            linkedContext: "",
            entities: allEntities,
            parsedDiff, // 保留结构化diff数据用于实体关联
            entityWorkspaceMapping, // 实体ID到工作区名称的直接映射
            
            // 添加统计数据字段
            totalFiles: typeof statistics.totalFiles === 'number' && statistics.totalFiles >= 0 ? statistics.totalFiles : 0,
            includeAiCodeFiles: typeof statistics.includeAiCodeFiles === 'number' && statistics.includeAiCodeFiles >= 0 ? statistics.includeAiCodeFiles : 0,
            aiCodeFiles: typeof statistics.aiCodeFiles === 'number' && statistics.aiCodeFiles >= 0 ? statistics.aiCodeFiles : 0,
            fileAcceptanceRate: typeof statistics.fileAcceptanceRate === 'number' && statistics.fileAcceptanceRate >= 0 ? statistics.fileAcceptanceRate : 0,
            totalCodeLines: typeof statistics.totalCodeLines === 'number' && statistics.totalCodeLines >= 0 ? statistics.totalCodeLines : 0,
            includeAiCodeLines: typeof statistics.includeAiCodeLines === 'number' && statistics.includeAiCodeLines >= 0 ? statistics.includeAiCodeLines : 0,
            aiCodeLines: typeof statistics.aiCodeLines === 'number' && statistics.aiCodeLines >= 0 ? statistics.aiCodeLines : 0,
            codeAcceptanceRate: typeof statistics.codeAcceptanceRate === 'number' && statistics.codeAcceptanceRate >= 0 ? statistics.codeAcceptanceRate : 0,
            lastCommitHash: statistics.lastCommitHash || "",
          };
          console.log("🚀🚀🚀 ~ PostCommitProcessor ~ processPostCommit ~ commitData=====>", commitData)

          await saveCommitRecord(commitData);
          databaseUpdated = true;
          console.log("✅ 提交数据已保存到云端数据库");
        } catch (error) {
          console.warn("⚠️ 数据库保存失败:", error);
          databaseUpdated = false;
        }
      }

      // 9. 处理多工作区数据库文件更新并提交
      if (!options.skipDatabaseCommit) {
        console.log("💾 检查多工作区数据库文件变更...");
        try {
          const commitMode = options.dataCommitMode || "separate";
          // 构建要提交的文件列表：包含多工作区的data/目录和修改过的文件
          const filesToCommit = [
            ...workspaceContexts
              .map((context) =>
                path.relative(
                  this.projectPath,
                  path.join(context.rootPath, "data/")
                )
              )
              .filter((p) => p !== "data/"), // 过滤掉根目录本身
            ...allModifiedFiles, // 添加修改过的文件（可能包含自动注释）
          ].filter(
            (file, index, arr) =>
              arr.indexOf(file) === index && file.trim() !== ""
          ); // 去重并过滤空值

          if (commitMode === "separate") {
            await this.gitUtils.commitDataChanges(
              "separate",
              undefined,
              UPDATE_DATA_COMMIT_MESSAGE,
              filesToCommit
            );
          } else {
            await this.gitUtils.commitDataChanges(
              "amend",
              commitHash,
              UPDATE_DATA_COMMIT_MESSAGE,
              filesToCommit
            );
          }
        } catch (error) {
          console.warn("⚠️ 多工作区数据库文件提交失败:", error);
        }
      }

      const result: PostCommitResult = {
        commitHash,
        modifiedFiles: allModifiedFiles,
        deletedFiles: allDeletedFiles,
        entities: allEntities,
        databaseUpdated,
        affectedWorkspaces,
      };

      console.log("✅ Post-commit处理完成\n");
      return result;
    } catch (error) {
      console.error("❌ Post-commit处理失败:", error);
      throw error;
    }
  }
}

/**
 * 便捷的处理函数
 */
export async function processPostCommit(
  commitHash: string,
  projectPath?: string,
  options?: PostCommitOptions
): Promise<PostCommitResult> {
  const processor = new PostCommitProcessor(
    projectPath,
    options?.workspaceOptions
  );
  return processor.processPostCommit(commitHash, options);
}

async function main() {
  const args = process.argv.slice(2);

  const commitHash = args[0];
  let projectPath: string | undefined;
  const options: PostCommitOptions = {};

  try {
    console.log(`🚀 开始执行 post-commit 处理...`);
    console.log(`📋 Commit Hash: ${commitHash}`);
    console.log(`📁 项目路径: ${projectPath || process.cwd()}`);
    console.log(`⚙️ 选项:`, JSON.stringify(options, null, 2));

    const result = await processPostCommit(commitHash, projectPath, options);

    console.log(`\n✅ 处理完成！`);
    console.log(`📊 结果统计:`);
    console.log(`  - 影响的工作区: ${result.affectedWorkspaces.length}`);
    console.log(`  - 修改的文件: ${result.modifiedFiles.length}`);
    console.log(`  - 删除的文件: ${result.deletedFiles.length}`);
    console.log(`  - 提取的实体: ${result.entities.length}`);
    console.log(`  - 数据库已更新: ${result.databaseUpdated ? "是" : "否"}`);

    if (result.affectedWorkspaces.length > 0) {
      console.log(`  - 涉及工作区: ${result.affectedWorkspaces.join(", ")}`);
    }

    process.exit(0);
  } catch (error) {
    console.error(`❌ 处理失败:`, error);
    process.exit(1);
  }
}
if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ 程序异常:`, error);
    process.exit(1);
  });
}
