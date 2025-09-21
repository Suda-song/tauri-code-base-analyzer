import {
  getEntityDependencyChain,
  GlobalClientManager,
} from "@xhs/modular-project-graph-builder-agent";
import { createAnthropic } from "@xhs/aws-anthropic";
import { generateText } from "ai";
import fs from "fs";
import path from "path";
import { SimpleLogger } from "@xhs/shared-utils";
import { jsonrepair } from "jsonrepair";
import crypto from "crypto";
import { DB } from "./db";
import { dbConfig } from "./db/config";
import { readLocalConfig } from "./readLocalConfig";

// 导入统一的接口定义
import { BaseEntity, EnrichedEntity } from './enrichment/interfaces';

// 搜索结果接口
export interface RagResult {
  entities: EnrichedEntity[]; // 搜索到的实体列表
  relevanceScores: { [entityId: string]: number }; // 每个实体的相关性得分
  prompt: string; // 生成的提示词
}

// 关系查询结果接口
export interface RelatedEntitiesResult {
  sourceEntity: EnrichedEntity; // 源实体
  relatedEntities: {
    imports: EnrichedEntity[]; // 导入关系的实体
    calls: EnrichedEntity[]; // 调用关系的实体
    templates: EnrichedEntity[]; // 模板关系的实体
    similar: EnrichedEntity[]; // 相似标签的实体
    relationships: { [id: string]: string[] }; // 关系类型映射，如 {"Entity:id": ["IMPORTS", "SIMILAR_TAG"]}
  };
  prompt: string; // 生成的关系分析提示词
}

// 智能关联结果接口
export interface SmartRelatedResult {
  sourceEntity: EnrichedEntity; // 源实体
  smartSelection: EnrichedEntity[]; // 智能选择的相关实体
  reasoning: string; // AI的推理过程
  allCandidates: {
    // 所有候选实体信息
    imports: EnrichedEntity[];
    calls: EnrichedEntity[];
    templates: EnrichedEntity[];
    similar: EnrichedEntity[];
  };
}

/**
 * @description 函数: RagInlineTool
 */
export class RagInlineTool {
  private entities: EnrichedEntity[] = []; // 所有加载的实体
  private projectRoot: string; // 项目根目录
  private anthropic: any; // Anthropic AI 客户端
  private entityMap: Map<string, EnrichedEntity> = new Map(); // 实体ID到实体的快速查找映射
  private logger: SimpleLogger; // 日志记录器
  private entitiesFilePath?: string; // 实体文件路径
  private fileWatcher?: fs.FSWatcher; // 文件监听器
  private lastModifiedTime?: number; // 文件最后修改时间
  private clientManager: GlobalClientManager; // GlobalClientManager实例
  private enableGraphQuery: boolean = true; // 是否启用图查询
  private isBuildingPromise: Promise<void> = Promise.resolve(); // 是否正在构建图
  private isBuilding: boolean = false; // 是否正在构建图
  private isInitialized: Promise<void> = Promise.resolve(); // 是否已初始化
  private maxRetries: number = 3; // 数据库最大重试次数
  private retryCount: number = 0; // 数据库当前重试次数
  private enableGraph: boolean = true; // 是否启用图构建
  private mcpHandler: any;
  private hasBuild: (value: void) => void;

  constructor(entitiesPath?: string, projectRoot?: string, mcpHandler?: any) {
    this.projectRoot = projectRoot || process.cwd();
    this.logger = new SimpleLogger(this.projectRoot);
    this.entitiesFilePath = entitiesPath;
    this.clientManager = new GlobalClientManager();
    this.mcpHandler = mcpHandler;

    if (this.enableGraph) {
      console.log("启用图数据库");
    } else {
      console.log("不启用图数据库");
      this.enableGraphQuery = false;
    }

    // 如果提供了实体文件路径，则立即加载并设置文件监听
    if (entitiesPath) {
      if (this.enableGraph) {
        this.isInitialized = this.initialize();
      }
      this.loadEntities(entitiesPath);
      this.setupFileWatcher(entitiesPath);
    }

    // 初始化Anthropic客户端
    this.anthropic = createAnthropic({});
    process.env.XHS_AWS_BEDROCK_API_KEY =
      process.env.XHS_AWS_BEDROCK_API_KEY || "aa74edef9cb44aab8a03f37f36197ec6";
  }

  /**
   * 显式初始化方法 - 必须在使用前调用
   */
  async initialize(isRetry: boolean = false): Promise<void> {
    try {
      if (!isRetry) {
        this.mcpHandler?.onStatusBarMessage({
          mcpName: "code-research-mcp",
          params: "图构建初始化中...",
          icon: "sync~spin",
        });
      }
      console.log("开始初始化客户端连接...");
      // 1. 先初始化客户端连接
      if (!DB.isDBConnected()) {
        await DB.initDB(dbConfig, true);
      }
      await this.initializeClient();
      this.retryCount = 0;
    } catch (error) {
      this.retryCount++;
      if (this.retryCount < this.maxRetries) {
        console.error(
          `RagInlineTool 初始化失败: ${(error as Error).message}, 重试次数: ${
            this.retryCount
          }`
        );
        this.isInitialized = this.initialize(true);
        // throw error;
      } else {
        this.mcpHandler?.onStatusBarMessage({
          mcpName: "code-research-mcp",
          params: "图构建初始化中...",
          icon: "sync~spin",
        });
      }
    }
  }
  /**
   * 从JSON文件加载实体数据
   * @param entitiesPath 实体JSON文件路径
   */
  async loadEntities(entitiesPath: string): Promise<void> {
    try {
      const stats = fs.statSync(entitiesPath);
      const currentModifiedTime = stats.mtime.getTime();

      if (
        this.lastModifiedTime &&
        this.lastModifiedTime === currentModifiedTime
      ) {
        return;
      }

      const data = fs.readFileSync(entitiesPath, "utf8");
      this.entities = JSON.parse(data);

      this.entityMap.clear();
      this.entities.forEach((entity) => {
        this.entityMap.set(entity.id, entity);
      });

      this.lastModifiedTime = currentModifiedTime;

      this.logger.log(
        `已加载 ${this.entities.length} 个实体 (文件更新时间: ${new Date(
          currentModifiedTime
        ).toLocaleString()})`
      );
      if (this.enableGraph) {
        await this.isInitialized;
        await this.buildKnowledgeGraphAfterEnrichment();
      }
    } catch (error) {
      console.error(`加载实体数据失败: ${(error as Error).message}`);
      this.entities = [];
      this.entityMap.clear();
      throw error; // 重新抛出错误
    }
  }

  private async generateProjectSpaceName(): Promise<string> {
    const workspacePath = this.projectRoot;

    // 提取项目名称（目录名）
    const projectName = path.basename(this.projectRoot);
    const userInfo = await readLocalConfig();
    let userEmail = "";
    if (userInfo) {
      userEmail = userInfo.email.split("@")[0];
    }
    // 生成路径的短哈希值作为唯一标识符
    const pathHash = crypto
      .createHash("md5")
      .update(workspacePath)
      .digest("hex")
      .substring(0, 8);

    const cleanProjectName = projectName
      .replace(/[^a-zA-Z0-9_]/g, "_") // 替换特殊字符为下划线
      .replace(/^[0-9]/, "_$&") // 如果以数字开头，加下划线前缀
      .toLowerCase();

    // 生成格式: code_graph_{项目名}_{哈希}
    return userInfo
      ? `code_graph_${cleanProjectName}_${userEmail}_${pathHash}`
      : `code_graph_${cleanProjectName}_${pathHash}`;
  }

  /**
   * 在实体加载完成后自动构建知识图谱
   * @param entities 加载的实体数据
   */
  private async buildKnowledgeGraphAfterEnrichment(
    entities?: EnrichedEntity[]
  ): Promise<void> {
    try {
      const enableGraphBuild = process.env.AUTO_BUILD_GRAPH !== "false";
      if (!enableGraphBuild) {
        console.log(`图构建已禁用 (AUTO_BUILD_GRAPH=false)`);
        return;
      }
      this.mcpHandler?.onStatusBarMessage({
        mcpName: "code-research-mcp",
        params: `开始自动构建知识图谱...`,
        icon: "sync~spin",
      });
      let client = await this.clientManager.getClient();
      if (!client) {
        console.log(`无法获取 Nebula 客户端连接，尝试重新初始化`);
        try {
          await this.initialize();
          client = await this.clientManager.getClient();
        } catch (error) {
          console.error(`重新初始化失败: ${(error as Error).message}`);
          this.enableGraphQuery = false;
          this.mcpHandler?.onStatusBarMessage({
            mcpName: "code-research-mcp",
            params: `构建失败，请检查重启MCP`,
            icon: "error",
          });
          return;
        }
      }
      // 修复ts报错
      if (!client) {
        console.log(`无法获取 Nebula 客户端连接，图构建失败`);
        this.enableGraphQuery = false;
        return;
      }
      const flows = await DB.searchFlowNode(path.basename(this.projectRoot));
      if (this.entitiesFilePath) {
        this.isBuilding = true;
        this.isBuildingPromise = new Promise((resolve) => {
          this.hasBuild = resolve;
        });
        await this.clientManager.buildGraphFromFile(
          this.entitiesFilePath,
          client,
          flows
        );
        this.enableGraphQuery = true;
        this.isBuilding = false;
        this.hasBuild?.();
      } else {
        this.mcpHandler?.logger({
          level: "error",
          mcpName: "code-research-mcp",
          data: `实体文件路径未设置，无法构建图谱`,
        });
        this.enableGraphQuery = false;
        return;
      }
      const clientConfig = client.getConfig();
      const clientStatus = {
        isConnected: client.isConnected(),
        sessionId: client.getSessionId(),
        config: clientConfig,
      };
      console.log(`知识图谱构建完成！${JSON.stringify(clientStatus)}`);

      this.mcpHandler?.onStatusBarMessage({
        mcpName: "code-research-mcp",
        params: `知识图谱构建完成！`,
        icon: "check",
        duration: 10000,
      });
    } catch (error) {
      console.error(`自动构建知识图谱失败: ${(error as Error).message}`);
      // 简单重试一次
      console.log(`尝试重新构建一次...`);
      try {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待2秒

        const client = await this.clientManager.getClient();
        if (client && this.entitiesFilePath) {
          const flows = await DB.searchFlowNode(
            path.basename(this.projectRoot)
          );
          await this.clientManager.buildGraphFromFile(
            this.entitiesFilePath,
            client,
            flows
          );
          this.mcpHandler?.onStatusBarMessage({
            mcpName: "code-research-mcp",
            params: `构建成功！`,
            icon: "check",
          });
          console.log(`重试构建成功！`);
          this.hasBuild?.();
          this.isBuilding = false;
        }
      } catch (retryError) {
        console.error(`重试构建也失败了: ${(retryError as Error).message}`);
        this.mcpHandler?.onStatusBarMessage({
          mcpName: "code-research-mcp",
          params: `构建失败: ${(retryError as Error).message}`,
          icon: "error",
        });
        this.hasBuild?.();
        this.isBuilding = false;
      }
    }
  }

  /**
   * 设置文件监听器，当实体文件变化时自动重新加载
   * @param entitiesPath 实体JSON文件路径
   */
  private setupFileWatcher(entitiesPath: string): void {
    try {
      // 清理已存在的监听器
      if (this.fileWatcher) {
        this.fileWatcher.close();
      }

      // 设置新的文件监听器
      this.fileWatcher = fs.watch(entitiesPath, (eventType, filename) => {
        if (eventType === "change") {
          this.logger.log(`📁 检测到实体文件变化，正在重新加载...`);

          // 延迟重新加载，避免文件正在写入时读取
          setTimeout(() => {
            this.loadEntities(entitiesPath);
          }, 100);
        }
      });

      this.logger.log(`📁 已启动文件监听: ${entitiesPath}`);
    } catch (error) {
      this.logger.warn(`设置文件监听失败: ${(error as Error).message}`);
    }
  }

  /**
   * 手动重新加载实体数据
   * @returns 是否重新加载成功
   */
  reloadEntities(): boolean {
    if (!this.entitiesFilePath) {
      this.logger.warn("未设置实体文件路径，无法重新加载");
      return false;
    }

    try {
      this.loadEntities(this.entitiesFilePath);
      return true;
    } catch (error) {
      this.logger.error(`手动重新加载失败: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 检查实体文件是否存在且可读
   * @returns 文件状态信息
   */
  getFileStatus(): {
    exists: boolean;
    readable: boolean;
    lastModified?: Date;
    entityCount: number;
  } {
    if (!this.entitiesFilePath) {
      return { exists: false, readable: false, entityCount: 0 };
    }

    try {
      const stats = fs.statSync(this.entitiesFilePath);
      const accessible =
        fs.accessSync(this.entitiesFilePath, fs.constants.R_OK) === undefined;

      return {
        exists: true,
        readable: accessible,
        lastModified: stats.mtime,
        entityCount: this.entities.length,
      };
    } catch (error) {
      return {
        exists: false,
        readable: false,
        entityCount: this.entities.length,
      };
    }
  }

  /**
   * 清理资源（关闭文件监听器）
   */
  dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = undefined;
      this.logger.log("📁 已关闭文件监听器");
    }
  }

  /**
   * 基于自然语言查询搜索相关代码实体
   * @param userQuery 用户的自然语言查询
   * @param topK 返回的实体数量（默认5个）
   * @returns 搜索结果，包含实体列表、相关性得分和生成的提示词
   */
  async search(userQuery: string, topK: number = 5): Promise<RagResult> {
    // 第一步：使用AI识别用户意图
    const intent = await this.identifyIntent(userQuery);

    // 第二步：计算每个实体与查询的相关性得分
    const relevanceScores = await this.calculateRelevanceScores(
      userQuery,
      intent
    );

    // 第三步：根据得分排序并选择前K个实体
    const rankedEntities = this.entities
      .map((entity) => ({
        entity,
        score: relevanceScores[entity.id] || 0,
      }))
      .sort((a, b) => b.score - a.score) // 按得分降序排列
      .slice(0, topK) // 取前K个
      .map((item) => item.entity); // 提取实体对象

    // 第四步：为这些实体构建详细的提示词
    const prompt = this.buildPrompt(userQuery, rankedEntities, relevanceScores);

    return {
      entities: rankedEntities,
      relevanceScores,
      prompt,
    };
  }

  /**
   * 获取与指定实体相关的其他实体（图的二跳查询）
   * 分析四种关系：导入关系、调用关系、模板关系、相似标签关系
   * @param entityId 目标实体的ID
   * @param maxRelated 每种关系类型返回的最大相关实体数
   * @returns 关系分析结果，如果实体不存在则返回null
   */
  async getRelatedEntities(
    entityId: string,
    maxRelated: number = 3
  ): Promise<RelatedEntitiesResult | null> {
    // 查找源实体
    const sourceEntity = this.entityMap.get(entityId);
    if (!sourceEntity) {
      this.logger.error(`未找到ID为 ${entityId} 的实体`);
      return null;
    }

    this.logger.log(
      `开始获取实体 ${entityId} 的相关实体，最大数量: ${maxRelated}, 实体为: ${JSON.stringify(
        sourceEntity
      )}`
    );

    // 初始化各种关系的实体集合
    const importEntities: EnrichedEntity[] = [];
    const callEntities: EnrichedEntity[] = [];
    const templateEntities: EnrichedEntity[] = [];
    const similarEntities: EnrichedEntity[] = [];
    const relationships: { [id: string]: string[] } = {};
    let client = await this.clientManager.getClient();

    if (this.enableGraph) {
      if (!client) {
        console.log(
          `查找相关实体时无法获取 Nebula 客户端连接，准备开始重试...`
        );
        try {
          await this.initialize();
          client = await this.clientManager.getClient();
        } catch (error) {
          console.error(`重新初始化失败: ${(error as Error).message}`);
          this.enableGraphQuery = false;
        }
      }
    }

    if (this.enableGraphQuery) {
      console.log(`启用图查询 ${this.enableGraphQuery}`);
      if (this.isBuilding) {
        this.mcpHandler?.onInformationMessage({
          mcpName: "code-research-mcp",
          params: `等待图构建中...`,
        });
        await this.isBuildingPromise;
      }
      const relatedEntities = await getEntityDependencyChain(
        sourceEntity.id,
        1,
        ["IMPORTS", "CALLS"],
        client || undefined
      );
      console.log("相关实体", JSON.stringify(relatedEntities));
      relatedEntities.forEach((chain) => {
        if (chain.path[1] === "IMPORTS") {
          chain.entities.forEach((entity) => {
            importEntities.push(entity);
          });
        } else {
          chain.entities.forEach((entity) => {
            callEntities.push(entity);
          });
        }
      });
      console.log(
        `通过图查询获取：\n导入关系 ${JSON.stringify(
          importEntities
        )}; \n 调用关系 ${JSON.stringify(callEntities)}`
      );
    } else {
      // 分析1：处理导入关系
      for (const importId of sourceEntity.IMPORTS) {
        const entity = this.entityMap.get(importId);
        if (entity) {
          importEntities.push(entity);
          this.addRelationship(relationships, entity.id, "IMPORTS");
        }
      }
      // 分析2：处理调用关系
      for (const callId of sourceEntity.CALLS) {
        // 从调用ID中提取基本实体ID（去除可能的方法名）
        const baseId = callId.split(".")[0];
        const entity = this.entityMap.get(baseId);
        // 避免重复添加已经在导入关系中的实体
        if (entity && !importEntities.some((e) => e.id === entity.id)) {
          callEntities.push(entity);
          this.addRelationship(relationships, entity.id, "CALLS");
        }
      }
    }

    // 分析3：处理模板组件关系
    if (sourceEntity.TEMPLATE_COMPONENTS) {
      for (const componentName of sourceEntity.TEMPLATE_COMPONENTS) {
        // 查找名称匹配的组件实体
        const matchingEntities = this.entities.filter(
          (e) =>
            e.type === "component" &&
            (e.rawName === componentName || e.id.endsWith(`:${componentName}`))
        );

        for (const entity of matchingEntities) {
          // 确保不重复添加已存在的实体
          if (
            !this.isEntityInLists(entity, [
              importEntities,
              callEntities,
              templateEntities,
            ])
          ) {
            templateEntities.push(entity);
            this.addRelationship(relationships, entity.id, "TEMPLATE");
          }
        }
      }
    }

    // 分析4：查找具有相似标签的实体
    const sourceTags = new Set(sourceEntity.tags);
    const tagMatches = this.entities
      .filter(
        (entity) =>
          entity.id !== sourceEntity.id &&
          !this.isEntityInLists(entity, [
            importEntities,
            callEntities,
            templateEntities,
          ]) &&
          entity.tags.some((tag) => sourceTags.has(tag))
      )
      .map((entity) => {
        // 计算标签匹配得分（共同标签数量）
        const commonTags = entity.tags.filter((tag) => sourceTags.has(tag));
        return { entity, score: commonTags.length };
      })
      .sort((a, b) => b.score - a.score) // 按匹配度排序
      .slice(0, maxRelated); // 限制数量

    // 添加相似标签的实体
    for (const { entity } of tagMatches) {
      similarEntities.push(entity);
      this.addRelationship(relationships, entity.id, "SIMILAR_TAG");
    }

    this.logger.log(
      `获取相关实体成功: 导入${importEntities.length}个, 调用${callEntities.length}个, 模板${templateEntities.length}个, 相似${similarEntities.length}个`
    );
    this.logger.log(`关系: ${JSON.stringify(relationships)}`);

    // 构建关系分析的提示词
    const allRelated = [
      ...importEntities.slice(0, maxRelated),
      ...callEntities.slice(0, maxRelated),
      ...templateEntities.slice(0, maxRelated),
      ...similarEntities,
    ];

    const prompt = this.buildRelatedPrompt(
      sourceEntity,
      allRelated,
      relationships
    );

    return {
      sourceEntity,
      relatedEntities: {
        imports: importEntities.slice(0, maxRelated),
        calls: callEntities.slice(0, maxRelated),
        templates: templateEntities.slice(0, maxRelated),
        similar: similarEntities,
        relationships,
      },
      prompt,
    };
  }

  /**
   * 使用AI识别用户查询的意图
   * @param query 用户查询
   * @returns 识别出的意图关键词
   */
  private async identifyIntent(query: string): Promise<string> {
    try {
      const system = `你是一个代码库查询助手。分析用户的查询，识别他们想要查找的组件或功能类型。
识别以下几个方面：
1. 用户是否在查找特定类型的组件（如按钮、表单、弹窗、选择器等）
2. 用户关注的功能点（如数据加载、状态管理、UI展示等）
3. 用户可能需要的业务场景（如用户管理、订单处理、地址选择等）

以简洁的关键词列表形式返回，每个关键词之间用逗号分隔。
例如：选择器,地址管理,表单组件`;

      const { text } = await generateText({
        // @ts-ignore
        model: this.anthropic("claude-3-7-sonnet-latest"),
        system,
        prompt: query,
      });

      return text || query;
    } catch (error) {
      this.logger.error(`意图识别失败: ${(error as Error).message}`);
      // AI失败时返回原始查询
      return query;
    }
  }

  /**
   * 使用多阶段策略计算每个实体与查询的相关性得分
   * @param query 用户查询
   * @param intent 识别出的意图
   * @returns 实体ID到相关性得分的映射
   */
  private async calculateRelevanceScores(
    query: string,
    intent: string
  ): Promise<{ [entityId: string]: number }> {
    const startTime = Date.now();
    const totalEntities = this.entities.length;

    try {
      // 第一阶段：快速文本匹配预筛选
      const preFilterStart = Date.now();
      const preFilterResults = this.quickTextFilter(query, intent);
      const preFilterTime = Date.now() - preFilterStart;

      // 第二步：根据实体数量选择策略
      let finalScores: { [entityId: string]: number };
      let strategy: string;

      if (totalEntities <= 50) {
        strategy = "小规模直接AI评分";
        finalScores = await this.directAIScoring(query, intent, this.entities);
      } else if (totalEntities <= 200) {
        strategy = "中等规模混合评分";
        finalScores = await this.hybridScoring(query, intent, preFilterResults);
      } else {
        strategy = "大规模分片评分";
        finalScores = await this.multiStageScoring(
          query,
          intent,
          preFilterResults
        );
      }

      // 生成最终统计
      const totalTime = Date.now() - startTime;

      return finalScores;
    } catch (error) {
      const errorTime = Date.now() - startTime;
      this.logger.error(
        `相关性评分失败 (耗时${errorTime}ms): ${(error as Error).message}`
      );
      return this.calculateFallbackRelevanceScores(query, intent);
    }
  }

  /**
   * 第一阶段：快速文本匹配预筛选
   */
  private quickTextFilter(
    query: string,
    intent: string
  ): { [entityId: string]: number } {
    const startTime = Date.now();
    const scores: { [entityId: string]: number } = {};
    const queryWords = this.extractKeywords(query.toLowerCase());
    const intentWords = this.extractKeywords(intent.toLowerCase());
    const allSearchWords = [...queryWords, ...intentWords];

    this.entities.forEach((entity) => {
      let score = 0;
      const entityText = [
        entity.summary || "",
        entity.tags.join(" "),
        entity.projectDesc || "",
        entity.publishTag || "",
        entity.id,
        entity.type,
        entity.ANNOTATION || "",
      ]
        .join(" ")
        .toLowerCase();

      // 计算关键词匹配度
      const matches = allSearchWords.filter((word) =>
        entityText.includes(word)
      );
      score = matches.length / Math.max(allSearchWords.length, 1);

      // 类型权重加成
      const typeBonus = this.getTypeRelevanceBonus(entity.type, query);
      score = score * 0.8 + typeBonus * 0.2;

      const finalScore = Math.min(10, score * 10);
      scores[entity.id] = finalScore;
    });

    const filterTime = Date.now() - startTime;

    return scores;
  }

  /**
   * 获取实体类型相关性加成
   */
  private getTypeRelevanceBonus(entityType: string, query: string): number {
    const queryLower = query.toLowerCase();
    const typeLower = entityType.toLowerCase();

    // 根据查询内容判断类型相关性
    if (queryLower.includes("组件") || queryLower.includes("component")) {
      return typeLower.includes("component") ? 1.0 : 0.5;
    }
    if (queryLower.includes("页面") || queryLower.includes("page")) {
      return typeLower.includes("page") ? 1.0 : 0.5;
    }
    if (queryLower.includes("api") || queryLower.includes("接口")) {
      return typeLower.includes("api") ? 1.0 : 0.5;
    }
    if (queryLower.includes("服务") || queryLower.includes("service")) {
      return typeLower.includes("service") ? 1.0 : 0.5;
    }

    return 0.5; // 默认权重
  }

  /**
   * 小规模：直接AI评分
   */
  private async directAIScoring(
    query: string,
    intent: string,
    entities: EnrichedEntity[]
  ): Promise<{ [entityId: string]: number }> {
    return await this.batchAIScoring(query, intent, entities, "全量AI评分");
  }

  /**
   * 中等规模：混合评分策略
   */
  private async hybridScoring(
    query: string,
    intent: string,
    preFilterResults: { [entityId: string]: number }
  ): Promise<{ [entityId: string]: number }> {
    const startTime = Date.now();

    // 选择预筛选得分较高的实体进行AI评分
    const candidates = this.entities
      // .filter(entity => preFilterResults[entity.id] > 2) // 预筛选阈值
      .sort((a, b) => preFilterResults[b.id] - preFilterResults[a.id])
      .slice(0, 50); // 最多50个候选

    if (candidates.length === 0) {
      return preFilterResults;
    }

    const aiScores = await this.batchAIScoring(
      query,
      intent,
      candidates,
      "混合评分"
    );

    // 合并预筛选结果和AI评分结果
    const finalScores = { ...preFilterResults };
    let aiScoredCount = 0;
    Object.entries(aiScores).forEach(([entityId, score]) => {
      finalScores[entityId] = score;
      aiScoredCount++;
    });

    const hybridTime = Date.now() - startTime;

    return finalScores;
  }

  /**
   * 大规模：多阶段评分策略
   */
  private async multiStageScoring(
    query: string,
    intent: string,
    preFilterResults: { [entityId: string]: number }
  ): Promise<{ [entityId: string]: number }> {
    const startTime = Date.now();

    this.logger.log(`开始大规模评分: ${Object.keys(preFilterResults).length}`);
    // 第一轮：选择预筛选得分较高的实体
    const firstRoundCandidates = this.entities
      // .filter(entity => preFilterResults[entity.id] > 1.5)
      .sort((a, b) => preFilterResults[b.id] - preFilterResults[a.id])
      .slice(0, 80);

    this.logger.log(`第一轮候选实体数量: ${firstRoundCandidates.length}`);
    if (firstRoundCandidates.length === 0) {
      return preFilterResults;
    }

    // 分批AI评分 - 并行处理
    const batchSize = 25;
    const batches = [];
    for (let i = 0; i < firstRoundCandidates.length; i += batchSize) {
      batches.push(firstRoundCandidates.slice(i, i + batchSize));
    }

    this.logger.log(`开始并行批次评分: ${batches.length}个批次`);
    const batchStartTime = Date.now();

    // 并行执行所有批次
    const batchPromises = batches.map(async (batch, index) => {
      const batchStart = Date.now();
      const batchScores = await this.batchAIScoring(
        query,
        intent,
        batch,
        `批次${index + 1}`
      );
      const batchTime = Date.now() - batchStart;
      this.logger.log(
        `✅ 批次${index + 1}完成: 耗时${batchTime}ms 评分${
          Object.keys(batchScores).length
        }个实体`
      );
      return { scores: batchScores, batchIndex: index + 1, batchTime };
    });

    // 使用 allSettled 等待所有批次完成，容错处理
    const batchResults = await Promise.allSettled(batchPromises);
    const totalBatchTime = Date.now() - batchStartTime;

    // 统计结果并合并分数
    const allAIScores: { [entityId: string]: number } = {};
    let successfulBatches = 0;
    let totalScoredEntities = 0;
    let failedBatches = 0;

    batchResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        Object.assign(allAIScores, result.value.scores);
        successfulBatches++;
        totalScoredEntities += Object.keys(result.value.scores).length;
      } else {
        failedBatches++;
        this.logger.error(`❌ 批次${index + 1}失败: ${result.reason}`);
      }
    });

    this.logger.log(
      `🎯 并行批次评分完成: 总耗时${totalBatchTime}ms 成功${successfulBatches}/${batches.length}批次 失败${failedBatches}批次 总评分${totalScoredEntities}个实体`
    );

    // 检查是否所有批次都失败了
    if (successfulBatches === 0) {
      this.logger.error(`所有批次都失败了，回退使用预筛选结果`);
      return preFilterResults;
    }

    this.logger.log(`第二轮开始: ${JSON.stringify(allAIScores)}`);
    // 第二轮：选择高分实体进行精确评分
    const highScoreEntities = Object.entries(allAIScores)
      // .filter(([_, score]) => score > 6)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([entityId]) => this.entityMap.get(entityId))
      .filter((entity): entity is EnrichedEntity => entity !== undefined);

    this.logger.log(`第二轮目标个数: ${highScoreEntities.length}`);
    let precisionScoredCount = 0;
    if (highScoreEntities.length > 0) {
      const precisionScores = await this.precisionAIScoring(
        query,
        intent,
        highScoreEntities
      );
      Object.assign(allAIScores, precisionScores);
      precisionScoredCount = Object.keys(precisionScores).length;
      this.logger.log(`第二轮结束 ${JSON.stringify(precisionScores)}`);
    }
    this.logger.log(`第二轮结束2 ${JSON.stringify(allAIScores)}`);

    // 合并所有结果
    const finalScores = { ...preFilterResults };
    Object.entries(allAIScores).forEach(([entityId, score]) => {
      finalScores[entityId] = score;
    });

    const totalTime = Date.now() - startTime;

    return finalScores;
  }

  /**
   * 批量AI评分
   *
   * 请根据以下因素综合评估：
   * 1. 组件摘要中是否包含查询相关内容
   * 2. 组件标签是否与用户意图匹配
   * 3. 组件类型和功能是否符合用户需求
   * 4. 组件的导入和调用关系是否与查询相关
   * 5. 组件的注释信息是否与查询相关
   */
  private async batchAIScoring(
    query: string,
    intent: string,
    entities: EnrichedEntity[],
    stage: string
  ): Promise<{ [entityId: string]: number }> {
    const startTime = Date.now();

    const system = `你是一个代码组件检索专家。对每个组件与用户查询的相关性评分（0-10分）。

评分标准：
- 9-10分：高度相关，直接满足需求
- 7-8分：很相关，重要的支持组件  
- 5-6分：中等相关，可能有用
- 3-4分：低相关，边缘组件
- 0-2分：基本不相关

只返回JSON格式：{"组件ID": 分数}`;

    // 构建简化的实体信息，减少prompt长度
    const entityInfo = entities.map((entity) => {
      const summary = entity.summary ? entity.summary.substring(0, 80) : "无";
      const tags = entity.tags.slice(0, 3).join(",");
      const annotation = entity.ANNOTATION
        ? entity.ANNOTATION.substring(0, 50)
        : "";
      const projectDesc = entity.projectDesc
        ? entity.projectDesc.substring(0, 50)
        : "";
      const publishTag = entity.publishTag
        ? entity.publishTag.substring(0, 50)
        : "";

      return `
ID: ${entity.id}
类型: ${entity.type} 
摘要: ${summary} 
标签: ${tags}
${projectDesc ? ` 项目描述: ${projectDesc}` : ""}
${publishTag ? ` 需求迭代: ${publishTag}` : ""}
${annotation ? ` 注释: ${annotation}` : ""}`;
    });

    const prompt = `查询: ${query}
意图: ${intent}

组件:
${entityInfo.join("\n")}

评分:`;

    const promptLength = prompt.length;

    try {
      const { text } = await generateText({
        // @ts-ignore
        model: this.anthropic("claude-3-7-sonnet-latest", {
          structuredOutputs: true,
        }),
        system,
        prompt,
        temperature: 0.1,
      });
      this.logger.log(`text = ${JSON.stringify(text)}`);

      const aiTime = Date.now() - startTime;

      if (!text) {
        this.logger.warn(`${stage} AI返回为空 (耗时${aiTime}ms)`);
        return {};
      }

      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        this.logger.warn(`${stage} AI返回格式不正确 (耗时${aiTime}ms)`);
        this.logger.warn(`📄 AI原始返回: ${text.substring(0, 200)}...`);
        return {};
      }

      const scores = JSON.parse(jsonrepair(jsonMatch[0]));
      const scoredCount = Object.keys(scores).length;
      const scoreValues = Object.values(scores).map((s) => Number(s));
      const avgScore = scoreValues.reduce((a, b) => a + b, 0) / scoredCount;

      this.logger.log(
        `✅ ${stage}成功: 耗时${aiTime}ms 评分${scoredCount}/${
          entities.length
        }个实体 平均分${avgScore.toFixed(1)}`
      );

      return scores;
    } catch (error) {
      const errorTime = Date.now() - startTime;
      this.logger.error(`${stage}失败: 耗时${errorTime}ms 错误: ${error}`);
      return {};
    }
  }

  /**
   * 精确AI评分（用于高分实体的二次评分）
   */
  private async precisionAIScoring(
    query: string,
    intent: string,
    entities: EnrichedEntity[]
  ): Promise<{ [entityId: string]: number }> {
    const startTime = Date.now();

    const system = `你是高级代码架构师。对这些预筛选的高相关性组件进行精确评分。

仔细分析每个组件与用户需求的匹配程度：
- 10分：完美匹配，核心实现组件
- 9分：几乎完美，主要组件
- 8分：高度相关，重要支持组件
- 7分：很相关，有用的辅助组件

返回JSON格式：{"组件ID": 分数}`;

    // 构建详细的实体信息用于精确评分
    const detailedInfo = entities.map((entity) => {
      return `
ID: ${entity.id}
文件: ${entity.file}
类型: ${entity.type}
摘要: ${entity.summary || "无"}
标签: ${entity.tags.join(", ")}
${entity.projectDesc ? ` 项目描述: ${entity.projectDesc}` : ""}
${entity.publishTag ? ` 需求迭代: ${entity.publishTag}` : ""}
${entity.ANNOTATION ? `注释: ${entity.ANNOTATION}` : ""}
导入: ${entity.IMPORTS.slice(0, 3).join(", ")}
调用: ${entity.CALLS.slice(0, 3).join(", ")}`;
    });

    const prompt = `查询: ${query}
意图: ${intent}

高相关性组件详情:
${detailedInfo.join("\n\n")}

精确评分:`;

    const promptLength = prompt.length;

    try {
      const { text } = await generateText({
        // @ts-ignore
        model: this.anthropic("claude-3-7-sonnet-latest", {
          structuredOutputs: true,
        }),
        system,
        prompt,
        temperature: 0.05,
      });

      const precisionTime = Date.now() - startTime;

      if (!text) {
        this.logger.warn(`精确评分AI返回为空 (耗时${precisionTime}ms)`);
        return {};
      }

      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        this.logger.warn(`精确评分AI返回格式不正确 (耗时${precisionTime}ms)`);
        return {};
      }

      const scores = JSON.parse(jsonrepair(jsonMatch[0]));
      const scoredCount = Object.keys(scores).length;
      const scoreValues = Object.values(scores).map((s) => Number(s));
      const avgScore = scoreValues.reduce((a, b) => a + b, 0) / scoredCount;
      const maxScore = Math.max(...scoreValues);

      this.logger.log(
        `✨ 精确评分完成: 耗时${precisionTime}ms 评分${scoredCount}个实体 平均分${avgScore.toFixed(
          1
        )} 最高分${maxScore}`
      );

      return scores;
    } catch (error) {
      const errorTime = Date.now() - startTime;
      this.logger.error(`精确评分失败: 耗时${errorTime}ms 错误: ${error}`);
      return {};
    }
  }

  /**
   * 回退机制：使用文本匹配计算相关性得分
   * @param query 用户查询
   * @param intent 识别出的意图
   * @returns 实体ID到相关性得分的映射
   */
  private calculateFallbackRelevanceScores(
    query: string,
    intent: string
  ): { [entityId: string]: number } {
    const scores: { [entityId: string]: number } = {};
    const queryWords = this.extractKeywords(query.toLowerCase());
    const intentWords = this.extractKeywords(intent.toLowerCase());
    const allSearchWords = [...queryWords, ...intentWords];

    this.entities.forEach((entity) => {
      let score = 0;

      // 1. 摘要匹配 (权重: 40%)
      if (entity.summary) {
        const summaryWords = this.extractKeywords(entity.summary.toLowerCase());
        const summaryMatches = allSearchWords.filter((word) =>
          summaryWords.some(
            (summaryWord) =>
              summaryWord.includes(word) || word.includes(summaryWord)
          )
        );
        score += (summaryMatches.length / allSearchWords.length) * 4.0;
      }

      // 2. 标签匹配 (权重: 30%)
      if (entity.tags && entity.tags.length > 0) {
        const tagWords = entity.tags.map((tag) => tag.toLowerCase()).join(" ");
        const tagMatches = allSearchWords.filter((word) =>
          tagWords.includes(word)
        );
        score += (tagMatches.length / allSearchWords.length) * 3.0;
      }

      // 3. ID和类型匹配 (权重: 20%)
      const idWords = this.extractKeywords(entity.id.toLowerCase());
      const typeWords = this.extractKeywords(entity.type.toLowerCase());
      const idTypeWords = [...idWords, ...typeWords];
      const idTypeMatches = allSearchWords.filter((word) =>
        idTypeWords.some(
          (idWord) => idWord.includes(word) || word.includes(idWord)
        )
      );
      score += (idTypeMatches.length / allSearchWords.length) * 2.0;

      // 4. 注释匹配 (权重: 10%)
      if (entity.ANNOTATION) {
        const annotationWords = this.extractKeywords(
          entity.ANNOTATION.toLowerCase()
        );
        const annotationMatches = allSearchWords.filter((word) =>
          annotationWords.some(
            (annWord) => annWord.includes(word) || word.includes(annWord)
          )
        );
        score += (annotationMatches.length / allSearchWords.length) * 1.0;
      }

      // 🆕 5. publishTag匹配 (权重: 15%) - 需求迭代描述权重较高
      if (entity.publishTag && entity.publishTag.trim()) {
        const publishTagWords = this.extractKeywords(entity.publishTag.toLowerCase());
        const publishTagMatches = allSearchWords.filter((word) =>
          publishTagWords.some(
            (tagWord) => tagWord.includes(word) || word.includes(tagWord)
          )
        );
        score += (publishTagMatches.length / allSearchWords.length) * 1.5;
      }

      // 确保分数在0-10范围内
      scores[entity.id] = Math.min(10, Math.max(0.1, score)); // 最低0.1，避免全为0
    });

    // 如果所有分数仍然很低，则提升一些高频类型的分数
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore < 1) {
      this.entities.forEach((entity) => {
        // 对常见组件类型给予基础分数
        if (
          entity.type.includes("component") ||
          entity.type.includes("page") ||
          entity.type.includes("api")
        ) {
          scores[entity.id] = Math.max(scores[entity.id], 1.0);
        }
      });
    }

    return scores;
  }

  /**
   * 提取关键词（去除常见停用词）
   * @param text 输入文本
   * @returns 关键词数组
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "have",
      "has",
      "had",
      "的",
      "是",
      "在",
      "和",
      "或者",
      "但是",
      "对于",
      "关于",
      "使用",
      "通过",
    ]);

    return text
      .split(/\s+|[,，。.!！?？;；:：]/)
      .filter((word) => word.length > 1 && !stopWords.has(word))
      .map((word) => word.trim())
      .filter((word) => word.length > 0);
  }

  /**
   * 为搜索到的实体构建详细的提示词
   * @param query 用户查询
   * @param entities 相关实体列表
   * @param relevanceScores 相关性得分
   * @returns 构建的提示词
   */
  private buildPrompt(
    query: string,
    entities: EnrichedEntity[],
    relevanceScores: { [entityId: string]: number }
  ): string {
    let prompt = `用户查询: "${query}"\n\n根据查询，找到了以下相关的代码组件：\n\n`;

    entities.forEach((entity, index) => {
      const score = relevanceScores[entity.id] || 0;
      prompt += `### 组件 ${index + 1}: ${entity.id} (相关度: ${score})\n`;

      // 使用绝对路径便于定位文件
      const absoluteFilePath = path.join(this.projectRoot, entity.file);
      prompt += `文件路径: ${absoluteFilePath}\n`;
      prompt += `类型: ${entity.type}\n`;
      prompt += `摘要: ${entity.summary}\n`;
      if (entity.projectDesc) {
        prompt += `项目描述: ${entity.projectDesc}\n`;
      }
      prompt += `标签: ${entity.tags.join(", ")}\n`;

      // 🆕 添加可选的publishTag信息
      if (entity.publishTag && entity.publishTag.trim()) {
        prompt += `需求迭代: ${entity.publishTag}\n`;
      }

      // 添加可选的注释信息
      if (entity.ANNOTATION) {
        prompt += `注释: ${entity.ANNOTATION}\n`;
      }

      // 添加关系信息
      if (entity.IMPORTS.length > 0) {
        prompt += `导入: ${entity.IMPORTS.join(", ")}\n`;
      }

      if (entity.CALLS.length > 0) {
        prompt += `调用: ${entity.CALLS.join(", ")}\n`;
      }

      if (entity.EMITS.length > 0) {
        prompt += `事件: ${entity.EMITS.join(", ")}\n`;
      }

      if (entity.TEMPLATE_COMPONENTS && entity.TEMPLATE_COMPONENTS.length > 0) {
        prompt += `使用组件: ${entity.TEMPLATE_COMPONENTS.join(", ")}\n`;
      }

      // 尝试读取并添加实际代码内容
      try {
        const filePath = path.join(this.projectRoot, entity.file);
        if (fs.existsSync(filePath)) {
          const code = fs.readFileSync(filePath, "utf8");
          // 限制代码长度避免提示词过长
          const truncatedCode =
            code.length > 2000
              ? code.substring(0, 2000) + "\n...(代码已截断)"
              : code;
          prompt += `\n代码片段:\n\`\`\`\n${truncatedCode}\n\`\`\`\n`;
        }
      } catch (error) {
        prompt += `\n无法读取代码: ${(error as Error).message}\n`;
      }

      prompt += "\n---\n\n";
    });

    prompt += `请基于以上相关组件信息，回答用户的查询: "${query}"`;

    return prompt;
  }

  /**
   * 为关系分析构建提示词
   * @param sourceEntity 源实体
   * @param relatedEntities 相关实体列表
   * @param relationships 关系映射
   * @returns 构建的关系分析提示词
   */
  private buildRelatedPrompt(
    sourceEntity: EnrichedEntity,
    relatedEntities: EnrichedEntity[],
    relationships: { [id: string]: string[] }
  ): string {
    let prompt = `## 源组件: ${sourceEntity.id}\n`;

    // 添加源组件的基本信息
    const absoluteFilePath = path.join(this.projectRoot, sourceEntity.file);
    prompt += `文件路径: ${absoluteFilePath}\n`;
    prompt += `类型: ${sourceEntity.type}\n`;
    prompt += `摘要: ${sourceEntity.summary}\n`;
    if (sourceEntity.projectDesc) {
      prompt += `项目描述: ${sourceEntity.projectDesc}\n`;
    }
    prompt += `标签: ${sourceEntity.tags.join(", ")}\n`;

    // 🆕 添加源实体的publishTag信息
    if (sourceEntity.publishTag && sourceEntity.publishTag.trim()) {
      prompt += `需求迭代: ${sourceEntity.publishTag}\n`;
    }

    if (sourceEntity.ANNOTATION) {
      prompt += `注释: ${sourceEntity.ANNOTATION}\n`;
    }

    // 添加源组件的关系信息
    if (sourceEntity.IMPORTS.length > 0) {
      prompt += `导入: ${sourceEntity.IMPORTS.join(", ")}\n`;
    }

    if (sourceEntity.CALLS.length > 0) {
      prompt += `调用: ${sourceEntity.CALLS.join(", ")}\n`;
    }

    if (sourceEntity.EMITS.length > 0) {
      prompt += `事件: ${sourceEntity.EMITS.join(", ")}\n`;
    }

    if (
      sourceEntity.TEMPLATE_COMPONENTS &&
      sourceEntity.TEMPLATE_COMPONENTS.length > 0
    ) {
      prompt += `使用组件: ${sourceEntity.TEMPLATE_COMPONENTS.join(", ")}\n`;
    }

    prompt += "\n## 相关组件\n\n";

    // 为每个相关实体添加详细信息
    relatedEntities.forEach((entity, index) => {
      const relationTypes = relationships[entity.id] || [];
      const relationDescription = relationTypes
        .map((type) => {
          switch (type) {
            case "IMPORTS":
              return "被源组件导入";
            case "CALLS":
              return "被源组件调用";
            case "TEMPLATE":
              return "在源组件模板中使用";
            case "SIMILAR_TAG":
              return "具有相似标签";
            default:
              return type;
          }
        })
        .join(", ");

      prompt += `### 相关组件 ${index + 1}: ${
        entity.id
      } (${relationDescription})\n`;

      const entityAbsolutePath = path.join(this.projectRoot, entity.file);
      prompt += `文件路径: ${entityAbsolutePath}\n`;
      prompt += `类型: ${entity.type}\n`;
      prompt += `摘要: ${entity.summary}\n`;
      if (entity.projectDesc) {
        prompt += `项目描述: ${entity.projectDesc}\n`;
      }
      prompt += `标签: ${entity.tags.join(", ")}\n`;

      // 🆕 添加相关实体的publishTag信息
      if (entity.publishTag && entity.publishTag.trim()) {
        prompt += `需求迭代: ${entity.publishTag}\n`;
      }

      if (entity.ANNOTATION) {
        prompt += `注释: ${entity.ANNOTATION}\n`;
      }

      if (entity.IMPORTS.length > 0) {
        prompt += `导入: ${entity.IMPORTS.join(", ")}\n`;
      }

      if (entity.CALLS.length > 0) {
        prompt += `调用: ${entity.CALLS.join(", ")}\n`;
      }

      if (entity.EMITS.length > 0) {
        prompt += `事件: ${entity.EMITS.join(", ")}\n`;
      }

      if (entity.TEMPLATE_COMPONENTS && entity.TEMPLATE_COMPONENTS.length > 0) {
        prompt += `使用组件: ${entity.TEMPLATE_COMPONENTS.join(", ")}\n`;
      }

      // 尝试读取并添加相关组件的代码
      try {
        const filePath = path.join(this.projectRoot, entity.file);
        if (fs.existsSync(filePath)) {
          const code = fs.readFileSync(filePath, "utf8");
          // 限制代码长度避免提示词过长
          const truncatedCode =
            code.length > 1500
              ? code.substring(0, 1500) + "\n...(代码已截断)"
              : code;
          prompt += `\n代码片段:\n\`\`\`\n${truncatedCode}\n\`\`\`\n`;
        }
      } catch (error) {
        prompt += `\n无法读取代码: ${(error as Error).message}\n`;
      }

      prompt += "\n---\n\n";
    });

    // 添加关系分析总结
    prompt += `## 关系分析总结\n\n`;
    prompt += `源组件 \`${sourceEntity.id}\` 与以上 ${relatedEntities.length} 个组件存在关联关系：\n\n`;

    // 按关系类型分组统计
    const relationStats: { [key: string]: string[] } = {};
    Object.entries(relationships).forEach(([entityId, types]) => {
      types.forEach((type) => {
        if (!relationStats[type]) relationStats[type] = [];
        const entity = this.entityMap.get(entityId);
        if (entity) {
          relationStats[type].push(entity.id);
        }
      });
    });

    Object.entries(relationStats).forEach(([relationType, entityIds]) => {
      const typeDescription =
        {
          IMPORTS: "导入关系",
          CALLS: "调用关系",
          TEMPLATE: "模板使用关系",
          SIMILAR_TAG: "相似标签关系",
        }[relationType] || relationType;

      prompt += `- **${typeDescription}** (${
        entityIds.length
      }个): ${entityIds.join(", ")}\n`;
    });

    prompt += `\n基于以上源组件及其相关组件的信息，可以帮助您理解组件之间的依赖关系和使用场景。`;

    return prompt;
  }

  /**
   * 辅助方法：添加关系到关系映射中
   * @param relationships 关系映射对象
   * @param entityId 实体ID
   * @param relationType 关系类型
   */
  private addRelationship(
    relationships: { [id: string]: string[] },
    entityId: string,
    relationType: string
  ): void {
    if (!relationships[entityId]) {
      relationships[entityId] = [];
    }
    relationships[entityId].push(relationType);
  }

  /**
   * 辅助方法：检查实体是否已存在于给定的实体列表中
   * @param entity 要检查的实体
   * @param entityLists 实体列表数组
   * @returns 如果实体已存在则返回true
   */
  private isEntityInLists(
    entity: EnrichedEntity,
    entityLists: EnrichedEntity[][]
  ): boolean {
    return entityLists.some((list) => list.some((e) => e.id === entity.id));
  }

  /**
   * 获取实体统计信息
   * @returns 包含实体数量、类型分布等统计信息的对象
   */
  getStatistics(): {
    totalEntities: number;
    entitiesByType: { [type: string]: number };
    entitiesByTags: { [tag: string]: number };
  } {
    const entitiesByType: { [type: string]: number } = {};
    const entitiesByTags: { [tag: string]: number } = {};

    this.entities.forEach((entity) => {
      // 统计实体类型分布
      entitiesByType[entity.type] = (entitiesByType[entity.type] || 0) + 1;

      // 统计标签分布
      entity.tags.forEach((tag) => {
        entitiesByTags[tag] = (entitiesByTags[tag] || 0) + 1;
      });
    });

    return {
      totalEntities: this.entities.length,
      entitiesByType,
      entitiesByTags,
    };
  }

  /**
   * 智能关联实体方法 - 基于用户需求和大模型能力筛选最相关的实体
   * @param entityId 核心实体ID
   * @param userRequirement 用户需求描述
   * @param maxEntities 返回的最大实体数量（1-3个）
   * @returns 智能筛选结果，如果实体不存在则返回null
   */
  async getSmartRelatedEntities(
    entityId: string,
    userRequirement: string,
    maxEntities: number = 3
  ): Promise<SmartRelatedResult | null> {
    // 查找源实体
    const sourceEntity = this.entityMap.get(entityId);
    if (!sourceEntity) {
      this.logger.error(`未找到ID为 ${entityId} 的实体`);
      return null;
    }

    // 获取所有候选的关联实体
    const relatedResult = await this.getRelatedEntities(entityId, 10); // 获取更多候选
    if (!relatedResult) {
      return null;
    }

    // 收集所有候选实体
    const allCandidates = {
      imports: relatedResult.relatedEntities.imports,
      calls: relatedResult.relatedEntities.calls,
      templates: relatedResult.relatedEntities.templates,
      similar: relatedResult.relatedEntities.similar,
    };

    const candidateEntities = [
      ...allCandidates.imports,
      ...allCandidates.calls,
      ...allCandidates.templates,
      ...allCandidates.similar,
    ];

    // 如果没有候选实体，直接返回
    if (candidateEntities.length === 0) {
      return {
        sourceEntity,
        smartSelection: [],
        reasoning: "没有找到相关的候选实体",
        allCandidates,
      };
    }

    // 使用AI进行智能筛选
    const { smartSelection, reasoning } = await this.selectSmartEntities(
      sourceEntity,
      candidateEntities,
      userRequirement,
      maxEntities
    );

    return {
      sourceEntity,
      smartSelection,
      reasoning,
      allCandidates,
    };
  }

  /**
   * 使用AI智能选择最相关的实体
   * @param sourceEntity 源实体
   * @param candidates 候选实体列表
   * @param userRequirement 用户需求
   * @param maxEntities 最大返回数量
   * @returns 选择结果和推理过程
   */
  private async selectSmartEntities(
    sourceEntity: EnrichedEntity,
    candidates: EnrichedEntity[],
    userRequirement: string,
    maxEntities: number
  ): Promise<{ smartSelection: EnrichedEntity[]; reasoning: string }> {
    try {
      // 根据 maxEntities 调整描述文案
      const selectInstruction =
        maxEntities === 1
          ? "选择与用户需求最相关的 1 个实体"
          : `选择与用户需求最相关的 1-${maxEntities} 个实体`;

      const system = `你是一个代码架构专家，专门分析代码实体之间的关联关系。

你的任务是：
1. 理解用户的具体需求
2. 分析核心组件的功能和作用
3. 从候选实体中${selectInstruction}
4. 提供详细的选择理由

选择标准：
- 实体是否直接支持用户需求的实现
- 实体与核心组件的关系紧密程度
- 实体的功能是否与需求场景匹配
- 优先选择关键依赖和核心功能实体

返回格式（严格JSON）：
{
  "selectedEntities": ["实体ID1", "实体ID2", "实体ID3"],
  "reasoning": "详细的选择理由，解释为什么选择这些实体以及它们如何支持用户需求" // 不要出现括号字符
}`;

      const prompt = `## 用户需求
${userRequirement}

## 核心组件
**ID: ${sourceEntity.id}**
- 类型: ${sourceEntity.type}
- 文件: ${sourceEntity.file}
- 摘要: ${sourceEntity.summary}
- 标签: ${sourceEntity.tags.join(", ")}
${sourceEntity.projectDesc ? `- 项目描述: ${sourceEntity.projectDesc}` : ""}
${sourceEntity.publishTag ? `- 需求迭代: ${sourceEntity.publishTag}` : ""}
${sourceEntity.ANNOTATION ? `- 注释: ${sourceEntity.ANNOTATION}` : ""}

## 候选相关实体

${candidates
  .map(
    (entity) => `
### 候选实体 ID: ${entity.id}
- 类型: ${entity.type}
- 文件: ${entity.file}
- 摘要: ${entity.summary}
- 标签: ${entity.tags.join(", ")}
${entity.projectDesc ? `- 项目描述: ${entity.projectDesc}` : ""}
${entity.publishTag ? `- 需求迭代: ${entity.publishTag}` : ""}
${entity.ANNOTATION ? `- 注释: ${entity.ANNOTATION}` : ""}
- 导入关系: ${entity.IMPORTS.join(", ") || "无"}
- 调用关系: ${entity.CALLS.join(", ") || "无"}
${
  entity.TEMPLATE_COMPONENTS
    ? `- 使用组件: ${entity.TEMPLATE_COMPONENTS.join(", ")}`
    : ""
}
`
  )
  .join("\n")}

请从以上候选实体中${selectInstruction}。`;

      const { text } = await generateText({
        // @ts-ignore
        model: this.anthropic("claude-3-7-sonnet-latest"),
        system,
        prompt,
      });

      if (!text) {
        return {
          smartSelection: candidates.slice(0, maxEntities),
          reasoning: "AI分析失败，使用默认选择",
        };
      }
      this.logger.log(`text: ${text}`);

      // 尝试解析AI返回的JSON
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      this.logger.log(`jsonMatch: ${jsonMatch}`);
      if (!jsonMatch) {
        this.logger.warn("AI返回格式不正确，使用默认选择");
        return {
          smartSelection: candidates.slice(0, maxEntities),
          reasoning: "AI返回格式解析失败，使用默认选择",
        };
      }

      try {
        const result = JSON.parse(jsonrepair(jsonMatch[0]));
        const selectedIds = result.selectedEntities || [];
        const reasoning = result.reasoning || "未提供选择理由";

        // 根据AI选择的ID找到对应的实体
        const smartSelection = selectedIds
          .map((id: string) => candidates.find((entity) => entity.id === id))
          .filter((entity: EnrichedEntity | undefined) => entity !== undefined)
          .slice(0, maxEntities);

        return {
          smartSelection,
          reasoning,
        };
      } catch (parseError) {
        this.logger.warn(`JSON解析失败: ${parseError}`);
        return {
          smartSelection: candidates.slice(0, maxEntities),
          reasoning: "AI返回数据解析失败，使用默认选择",
        };
      }
    } catch (error) {
      this.logger.error(`智能实体选择失败: ${(error as Error).message}`);
      return {
        smartSelection: candidates.slice(0, maxEntities),
        reasoning: `AI分析出错: ${(error as Error).message}，使用默认选择`,
      };
    }
  }

  /**
   * 初始化客户端连接
   */
  private async initializeClient(): Promise<void> {
    try {
      const status = this.clientManager.getStatus();
      if (status.isConnected && status.currentSpace) {
        console.info("客户端已连接且图空间已设置，跳过初始化");
        return;
      }

      const projectSpaceName = await this.generateProjectSpaceName();
      console.info(
        `🔌 初始化图数据库连接，目标空间: ${projectSpaceName} ${new Date().toISOString()}`
      );

      await this.clientManager.initialize({
        defaultSpace: projectSpaceName,
        enableLogging: true,
        autoReconnect: true,
      });

      // 验证初始化结果
      const finalStatus = this.clientManager.getStatus();
      if (!finalStatus.isConnected) {
        throw new Error("客户端连接失败");
      }

      console.info(
        `✅ 客户端初始化成功: ${
          finalStatus.isConnected ? "已连接" : "未连接"
        }, 空间: ${finalStatus.currentSpace}`
      );
    } catch (error) {
      console.info(`❌ 初始化客户端连接失败: ${(error as Error).message}`);
      throw error;
    }
  }
}

/**
 * @description 函数: searchCodeEntities
 */
export async function searchCodeEntities(
  query: string,
  entitiesPath: string,
  projectRoot?: string,
  topK: number = 5
): Promise<RagResult> {
  const tool = new RagInlineTool(entitiesPath, projectRoot);
  return await tool.search(query, topK);
}

/**
 * @description 函数: getRelatedCodeEntities
 */
export async function getRelatedCodeEntities(
  entityId: string,
  entitiesPath: string,
  projectRoot?: string,
  maxRelated: number = 3
): Promise<RelatedEntitiesResult | null> {
  const tool = new RagInlineTool(entitiesPath, projectRoot);
  return await tool.getRelatedEntities(entityId, maxRelated);
}
