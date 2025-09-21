/**
 * AI智能提交生成器（支持多workspace）
 */

import {
  CommitAnalysisContext,
  CommitGenerationConfig,
  CommitGenerationResult,
  CommitEntity,
  TargetContext,
} from "./types";
import { BranchContextData } from "@xhs/shared-utils";
import { getConfig } from "./utils/config";
import { GitUtils } from "./utils/git-utils";
import { EntityMatcher } from "./utils/entity-matcher";
import {
  WorkspaceManager,
  WorkspaceManagerOptions,
} from "./utils/workspace-manager";
import { AICommitGenerator } from "./generators/ai-commit-generator";
import { TargetContextAnalyzer } from "./analyzers/target-context-analyzer";
import { BusinessContextAnalyzer } from "./analyzers/business-context-analyzer";
import { ChangeContextAnalyzer } from "./analyzers/change-context-analyzer";
import {
  getEntitiesCommitHistory as getEntitiesCommitHistoryFromDB,
  WhereConditions,
  OrderByField,
  OrderDirection,
} from "./db/commit-manager";
import { ContextType } from "@xhs/shared-utils";

/**
 * AI提交生成器类（默认支持多workspace）
 */
export class CommitGenerator {
  private projectPath: string;
  private gitUtils: GitUtils;
  private entityMatcher: EntityMatcher;
  private workspaceManager: WorkspaceManager;
  private targetContextAnalyzer: TargetContextAnalyzer;
  private businessContextAnalyzer: BusinessContextAnalyzer;
  private changeContextAnalyzer: ChangeContextAnalyzer;
  private aiGenerator: AICommitGenerator;

  constructor(
    projectPath: string = process.cwd(),
    workspaceOptions: WorkspaceManagerOptions = {}
  ) {
    this.projectPath = projectPath;
    this.gitUtils = new GitUtils(projectPath);

    // 默认启用workspace管理器（支持单workspace和多workspace）
    this.workspaceManager = new WorkspaceManager({
      monorepoRoot: projectPath,
      ...workspaceOptions,
    });
    this.entityMatcher = new EntityMatcher(this.workspaceManager, projectPath);

    this.targetContextAnalyzer = new TargetContextAnalyzer();
    this.businessContextAnalyzer = new BusinessContextAnalyzer();
    this.changeContextAnalyzer = new ChangeContextAnalyzer();
    this.aiGenerator = new AICommitGenerator();
  }

  /**
   * 生成提交消息 - 核心方法（支持多workspace）
   * @param context 重构后的 BranchContextData，包含 contexts 数组
   */
  async generateCommit(
    context?: BranchContextData,
    config: Partial<CommitGenerationConfig> = {}
  ): Promise<CommitGenerationResult> {
    console.log("🚀 开始生成AI智能提交消息...");

    // 0. 转换上下文数据
    const targetContext = this.extractCommitContext(context);

    // 1. 初始化workspace管理器
    await this.workspaceManager.initialize();

    // 2. 检查Git仓库
    if (!(await this.gitUtils.isGitRepository())) {
      throw new Error("当前目录不是Git仓库");
    }

    // 3. 获取暂存文件和diff内容
    const { files: stagedFiles, diffContent: stagedDiffContent } =
      await this.gitUtils.getStagedInfo();
    if (stagedFiles.length === 0) {
      throw new Error("没有暂存的文件，请先使用 git add 暂存文件");
    }

    console.log(`📁 检测到 ${stagedFiles.length} 个暂存文件`);

    // 4. 分析workspace信息
    let workspaceInfo = "";
    const affectedWorkspaces =
      await this.workspaceManager.buildContextsForStagedFiles();
    if (affectedWorkspaces.length > 0) {
      workspaceInfo = `\n🏠 涉及workspace: ${affectedWorkspaces
        .map((ws) => ws.name)
        .join(", ")}`;
      console.log(
        `🏠 变更涉及 ${
          affectedWorkspaces.length
        } 个workspace: ${affectedWorkspaces.map((ws) => ws.name).join(", ")}`
      );
    }

    // 5. 从暂存文件中提取实体
    const entities = await this.entityMatcher.extractEntitiesFromChangedFiles({
      mode: "staged",
    });
    if (entities.length > 0) {
      console.log(`🔍 从暂存文件中提取了 ${entities.length} 个实体`);
    } else {
      console.log("💡 未提取到实体，使用基础的变更信息生成提交消息");
    }

    // 6. 分析三个上下文
    const analysisContext = await this.analyzeAllContexts(
      targetContext,
      entities,
      stagedFiles,
      stagedDiffContent
    );

    // 7. 在上下文中添加workspace信息（通过修改差异内容）
    if (workspaceInfo) {
      // 将workspace信息添加到diff内容的开头作为上下文
      const workspaceHeader = `## Workspace Context${workspaceInfo}\n\n`;
      analysisContext.changeContext.diffContent =
        workspaceHeader + analysisContext.changeContext.diffContent;
    }

    // 8. 生成提交消息
    const generationConfig = await this.buildGenerationConfig(config);
    const result = await this.aiGenerator.generateCommitMessage(
      analysisContext,
      generationConfig
    );

    console.log("✅ AI智能提交消息生成完成");
    return result;
  }

  /**
   * 分析所有上下文信息
   */
  private async analyzeAllContexts(
    targetContext: TargetContext,
    entities: CommitEntity[],
    changedFiles: string[],
    diffContent: string
  ): Promise<CommitAnalysisContext> {
    console.log("🔍 开始分析提交上下文...");

    // 并行分析目标上下文、业务上下文、变更上下文
    const [processedTargetContext, businessContext, changeContext] =
      await Promise.all([
        this.targetContextAnalyzer.analyze(targetContext),
        this.businessContextAnalyzer.analyze({ entities }),
        this.changeContextAnalyzer.analyze({
          changedFiles,
          diffContent,
          gitUtils: this.gitUtils,
        }),
      ]);

    return {
      targetContext: processedTargetContext,
      businessContext,
      changeContext,
    };
  }

  /**
   * 构建生成配置（从配置文件读取默认值）
   */
  private async buildGenerationConfig(
    config: Partial<CommitGenerationConfig>
  ): Promise<CommitGenerationConfig> {
    // 从配置文件读取默认配置
    const fileConfig = await getConfig({}, true);

    return {
      language: config.language || (fileConfig.locale === "en" ? "en" : "zh"),
      includeBody: config.includeBody ?? true,
      maxCandidates: config.maxCandidates || fileConfig.generate || 1,
      commitTypes: config.commitTypes || [
        "feat",
        "fix",
        "revert",
        "improvement",
        "dep",
        "ci",
        "style",
        "test",
        "docs",
      ],
      maxLength: config.maxLength || fileConfig["max-length"] || 70,
    };
  }

  /**
   * 提取可用于commit生成的上下文信息
   * @param branchContext 分支上下文数据
   * @returns 格式化的目标上下文信息
   */
  private extractCommitContext(
    branchContext?: BranchContextData
  ): TargetContext {
    const targetContext: TargetContext = {
      links: [],
      redDocContexts: [],
    };

    if (!branchContext || !branchContext.contexts) {
      return targetContext;
    }

    // 提取所有链接内容
    branchContext.contexts.forEach((context) => {
      if (context.link) {
        targetContext.links!.push(context.link);
      }
    });

    // 提取RedDoc类型的上下文，只需要title和filePath
    branchContext.contexts
      .filter(
        (context) => context.type === ContextType.REDDOC && context.filePath
      )
      .forEach((context) => {
        targetContext.redDocContexts!.push({
          title: context.title,
          filePath: context.filePath!,
        });
      });

    console.log(
      `📋 提取上下文: ${targetContext.links!.length} 个链接, ${
        targetContext.redDocContexts!.length
      } 个RedDoc文档`
    );

    return targetContext;
  }
}

/**
 * 便捷的导出函数 - 仅生成提交消息
 */
export async function generateCommit(
  projectPath: string,
  context?: BranchContextData,
  config?: Partial<CommitGenerationConfig>
): Promise<CommitGenerationResult> {
  const generator = new CommitGenerator(projectPath);
  try {
    return await generator.generateCommit(context, config);
  } catch (err) {
    console.error("generateCommit error", err);
    throw err;
  }
}

/**
 * 查询实体的变更记录
 */
export async function getEntitiesCommitHistory(
  entityIds: string[],
  groupBy: "commit_hash" | "entity_id" | "none" = "commit_hash",
  orderBy?: OrderByField,
  orderDirection?: OrderDirection,
  where?: WhereConditions
): Promise<Record<string, any[]>> {
  return await getEntitiesCommitHistoryFromDB(
    entityIds,
    groupBy,
    orderBy,
    orderDirection,
    where
  );
}

export * from "./types";
export * from "./hooks/post-commit";
export * from "./db";

// 重新导出从 shared-utils 中导入的类型
export type { BranchContextData, ContextItem } from "@xhs/shared-utils";
