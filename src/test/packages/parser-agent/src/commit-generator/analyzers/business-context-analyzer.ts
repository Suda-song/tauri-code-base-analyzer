/**
 * 业务上下文分析器
 * 负责分析代码实体的业务上下文，提取summary和tags信息
 */

import {
  BusinessContext,
  CommitEntity,
  ContextAnalyzer,
  FileBusinessContext,
} from "../types";

export interface BusinessContextInput {
  entities: CommitEntity[];
  projectContext?: string;
}

export class BusinessContextAnalyzer
  implements ContextAnalyzer<BusinessContext>
{
  async analyze(input: BusinessContextInput): Promise<BusinessContext> {
    console.log("🏢 开始分析业务上下文...");

    const entities = input.entities || [];
    const entitySummaries = this.extractEntitySummaries(entities);
    const entityTags = this.extractEntityTags(entities);
    const entityTable = this.generateEntityTable(entities);
    const fileBusinessContexts = this.buildFileBusinessContexts(entities);
    const keyEntitySummaries = this.extractKeyEntitySummaries(entities);
    const businessOverview = this.generateBusinessOverview(
      entities,
      entityTags
    );

    const context: BusinessContext = {
      entities,
      entitySummaries,
      entityTags,
      entityTable,

      // AI提交生成专用的结构化上下文
      fileBusinessContexts,
      keyEntitySummaries,
      businessOverview,
    };

    console.log(
      `✅ 业务上下文分析完成，处理了 ${entities.length} 个实体，涵盖 ${fileBusinessContexts.length} 个文件`
    );
    return context;
  }

  /**
   * 提取实体摘要信息
   */
  private extractEntitySummaries(entities: CommitEntity[]): string[] {
    const summaries: string[] = [];

    for (const entity of entities) {
      if (entity.summary) {
        summaries.push(entity.summary);
      }
    }

    return summaries;
  }

  /**
   * 提取实体标签
   */
  private extractEntityTags(entities: CommitEntity[]): string[] {
    const allTags = new Set<string>();

    for (const entity of entities) {
      if (entity.tags) {
        entity.tags.forEach((tag) => allTags.add(tag));
      }
    }

    return Array.from(allTags);
  }

  /**
   * 提取关键实体摘要（过滤并排序）
   */
  private extractKeyEntitySummaries(entities: CommitEntity[]): string[] {
    return entities
      .map((e) => e.summary)
      .filter((summary) => summary && summary.length > 10)
      .slice(0, 3);
  }

  /**
   * 生成业务概览
   */
  private generateBusinessOverview(
    entities: CommitEntity[],
    tags: string[]
  ): string {
    const fileCount = new Set(entities.map((e) => e.file)).size;
    const mainTags = tags.slice(0, 5);

    let overview = `涉及 ${fileCount} 个文件`;
    if (mainTags.length > 0) {
      overview += `，主要业务领域：${mainTags.join("、")}`;
    }

    return overview;
  }

  /**
   * 构建文件业务上下文信息
   */
  private buildFileBusinessContexts(
    entities: CommitEntity[]
  ): FileBusinessContext[] {
    const entitiesByFile = this.groupEntitiesByFile(entities);
    const contexts: FileBusinessContext[] = [];

    entitiesByFile.forEach((fileEntities, filePath) => {
      const businessContext = this.analyzeFileBusinessPurpose(
        filePath,
        fileEntities
      );
      if (businessContext.primaryPurpose) {
        contexts.push({
          filePath,
          ...businessContext,
        });
      }
    });

    return contexts;
  }

  /**
   * 分析文件的业务用途
   */
  private analyzeFileBusinessPurpose(
    filePath: string,
    entities: CommitEntity[]
  ): {
    primaryPurpose: string;
    businessLogic: string;
    keyEntities: string[];
    entityTypes: string[];
  } {
    // 提取文件名和类型
    const fileName = filePath.split("/").pop() || "";
    const fileExtension = fileName.split(".").pop() || "";

    // 收集实体信息
    const entityTypes = [...new Set(entities.map((e) => e.type))];
    const keyEntities = entities.map((e) => e.rawName);

    // 收集业务逻辑相关的摘要
    const businessSummaries = entities
      .map((e) => e.summary)
      .filter((summary) => summary && summary.length > 5);

    // 分析主要用途
    let primaryPurpose = "";
    let businessLogic = "";

    if (businessSummaries.length > 0) {
      // 根据摘要内容推断业务功能
      const summaryText = businessSummaries.join(" ");

      // 根据文件类型和内容推断功能
      if (fileName.includes("Form") || summaryText.includes("表单")) {
        primaryPurpose = "表单组件，负责数据录入和提交";
      } else if (
        fileName.includes("Dashboard") ||
        summaryText.includes("仪表盘")
      ) {
        primaryPurpose = "数据展示面板，提供业务数据可视化";
      } else if (fileName.includes("Service") || fileName.includes("Api")) {
        primaryPurpose = "业务服务层，处理数据交互和业务逻辑";
      } else if (fileName.includes("Store") || fileName.includes("state")) {
        primaryPurpose = "状态管理，维护应用数据状态";
      } else if (fileName.includes("Utils") || fileName.includes("helper")) {
        primaryPurpose = "工具函数集合，提供通用功能支持";
      } else if (entityTypes.includes("component") || fileExtension === "vue") {
        primaryPurpose = "UI组件，负责界面展示和交互";
      } else if (entityTypes.includes("function")) {
        primaryPurpose = "功能模块，提供特定业务能力";
      } else {
        primaryPurpose = businessSummaries[0] || "业务功能模块";
      }

      // 构建业务逻辑描述
      const relevantSummaries = businessSummaries.slice(0, 2);
      businessLogic = relevantSummaries.join("；");
    } else {
      // 基于文件名推断
      if (fileName.includes("test")) {
        primaryPurpose = "测试文件";
      } else if (fileName.includes("config")) {
        primaryPurpose = "配置文件";
      } else {
        primaryPurpose = `${fileExtension}文件`;
      }
    }

    return {
      primaryPurpose,
      businessLogic,
      keyEntities: keyEntities.slice(0, 4),
      entityTypes,
    };
  }

  /**
   * 按文件分组实体
   */
  groupEntitiesByFile(entities: CommitEntity[]): Map<string, CommitEntity[]> {
    const fileMap = new Map<string, CommitEntity[]>();

    for (const entity of entities) {
      if (!fileMap.has(entity.file)) {
        fileMap.set(entity.file, []);
      }
      fileMap.get(entity.file)!.push(entity);
    }

    return fileMap;
  }

  /**
   * 生成详细的实体信息表格
   */
  generateEntityTable(entities: CommitEntity[]): string {
    const fileMap = this.groupEntitiesByFile(entities);
    let table = "| 文件 | 实体 | 类型 | 摘要 | 标签 |\n";
    table += "|------|------|------|------|------|\n";

    for (const [file, fileEntities] of fileMap) {
      for (const entity of fileEntities) {
        const summary = entity.summary || "-";
        const tags = entity.tags?.join(", ") || "-";
        table += `| ${file} | ${entity.rawName} | ${entity.type} | ${summary} | ${tags} |\n`;
      }
    }

    return table;
  }
}
