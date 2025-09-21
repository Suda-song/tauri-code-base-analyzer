import fs from "fs";
import path from "path";
import { RagInlineTool } from "@xhs/modular-code-analysis-agent";
import { Entity } from "../types";
import { serverConfig } from "../config/server-config";
import { enrichedToEntity } from "./entity-utils";
import { createMcpNotificationHandler } from "../services/mcpHub";

/**
 * 多workspace管理工具类
 * 负责处理多workspace环境下的实体加载、搜索和管理
 */
export class MultiWorkspaceManager {
  private ragTools: Map<string, RagInlineTool> = new Map(); // workspacePath -> RagInlineTool
  private workspaceIndexMap: Map<string, number> = new Map(); // workspacePath -> index

  constructor(mcpHandler?: createMcpNotificationHandler) {
    this.initializeWorkspaces(mcpHandler);
  }

  /**
   * 初始化所有workspace的RAG工具
   */
  private initializeWorkspaces(mcpHandler?: createMcpNotificationHandler) {
    serverConfig.workspacePaths.forEach((workspacePath, index) => {
      this.workspaceIndexMap.set(workspacePath, index);

      const entitiesFilePath = serverConfig.entitiesFilePaths[index];

      // 检查实体文件是否存在
      if (fs.existsSync(entitiesFilePath)) {
        try {
          const ragTool = new RagInlineTool(
            entitiesFilePath,
            workspacePath,
            mcpHandler
          );
          this.ragTools.set(workspacePath, ragTool);
        } catch (error) {
          console.error(
            `Failed to initialize RAG tool for workspace ${workspacePath}:`,
            error
          );
        }
      } else {
        console.warn(
          `Entities file not found for workspace ${workspacePath}: ${entitiesFilePath}`
        );
      }
    });
  }

  /**
   * 获取所有有效的workspace路径
   */
  getAvailableWorkspaces(): string[] {
    return Array.from(this.ragTools.keys());
  }

  /**
   * 检查是否有任何可用的workspace
   */
  hasAnyWorkspace(): boolean {
    return this.ragTools.size > 0;
  }

  /**
   * 获取指定workspace的RAG工具
   */
  getRagTool(workspacePath: string): RagInlineTool | undefined {
    return this.ragTools.get(workspacePath);
  }

  /**
   * 为entity添加workspace信息
   */
  private addWorkspaceInfo(entity: any, workspacePath: string): Entity {
    const enriched = enrichedToEntity(entity);
    const workspaceIndex = this.workspaceIndexMap.get(workspacePath) || 0;

    return {
      ...enriched,
      workspaceIndex,
      workspacePath,
    };
  }

  /**
   * 跨所有workspace搜索实体（按workspace分组返回）
   */
  async searchAcrossWorkspaces(
    query: string,
    maxResults: number = 10
  ): Promise<{
    workspaceResults: Map<
      string,
      {
        entities: Entity[];
        relevanceScores: Record<string, number>;
        workspacePath: string;
        workspaceName: string;
      }
    >;
    totalEntities: number;
  }> {
    const workspaceResults = new Map();

    // 并行搜索所有workspace
    const searchPromises = Array.from(this.ragTools.entries()).map(
      async ([workspacePath, ragTool]) => {
        try {
          const result = await ragTool.search(query, maxResults);

          if (result.entities) {
            // 为每个entity添加workspace信息
            const entitiesWithWorkspace = result.entities.map((entity) =>
              this.addWorkspaceInfo(entity, workspacePath)
            );

            // 直接按相关度排序，避免后续重复处理
            const sortedEntities = entitiesWithWorkspace.sort(
              (a, b) =>
                ((result.relevanceScores || {})[b.id] || 0) -
                ((result.relevanceScores || {})[a.id] || 0)
            );

            workspaceResults.set(workspacePath, {
              entities: sortedEntities,
              relevanceScores: result.relevanceScores || {},
              workspacePath,
              workspaceName: path.basename(workspacePath),
            });
          }
        } catch (error) {
          console.warn(`Search failed for workspace ${workspacePath}:`, error);
        }
      }
    );

    await Promise.all(searchPromises);

    // 计算总实体数
    const totalEntities = Array.from(workspaceResults.values()).reduce(
      (sum, ws) => sum + ws.entities.length,
      0
    );

    return {
      workspaceResults,
      totalEntities,
    };
  }

  /**
   * 从指定workspace获取实体的相关实体
   */
  async getRelatedEntities(
    entityId: string,
    workspacePath: string
  ): Promise<any> {
    const ragTool = this.ragTools.get(workspacePath);
    if (!ragTool) {
      throw new Error(`RAG tool not found for workspace: ${workspacePath}`);
    }

    return await ragTool.getRelatedEntities(entityId);
  }

  /**
   * 获取智能相关实体（从指定workspace）
   */
  async getSmartRelatedEntities(
    entityId: string,
    userInput: string,
    maxRelated: number = 3,
    workspacePath: string
  ): Promise<any> {
    const ragTool = this.ragTools.get(workspacePath);
    if (!ragTool) {
      throw new Error(`RAG tool not found for workspace: ${workspacePath}`);
    }

    return await ragTool.getSmartRelatedEntities(
      entityId,
      userInput,
      maxRelated
    );
  }

  /**
   * 获取所有workspace的文件状态
   */
  getAllFileStatus(): Array<{ workspacePath: string; status: any }> {
    const statuses: Array<{ workspacePath: string; status: any }> = [];

    for (const [workspacePath, ragTool] of this.ragTools) {
      const status = ragTool.getFileStatus();
      statuses.push({ workspacePath, status });
    }

    return statuses;
  }

  /**
   * 重新加载所有workspace的实体
   */
  reloadAllEntities(): boolean {
    let allSuccess = true;

    for (const [workspacePath, ragTool] of this.ragTools) {
      try {
        const success = ragTool.reloadEntities();
        if (!success) {
          console.warn(
            `Failed to reload entities for workspace: ${workspacePath}`
          );
          allSuccess = false;
        }
      } catch (error) {
        console.warn(
          `Error reloading entities for workspace ${workspacePath}:`,
          error
        );
        allSuccess = false;
      }
    }

    return allSuccess;
  }

  /**
   * 清理所有workspace的RAG工具
   */
  disposeAll(): void {
    for (const [workspacePath, ragTool] of this.ragTools) {
      try {
        ragTool.dispose();
      } catch (error) {
        console.warn(
          `Error disposing ragTool for workspace ${workspacePath}:`,
          error
        );
      }
    }
    this.ragTools.clear();
  }

  /**
   * 格式化workspace信息用于显示
   */
  formatWorkspaceInfo(entity: Entity): string {
    if (entity.workspaceIndex !== undefined && entity.workspacePath) {
      const workspaceName = path.basename(entity.workspacePath);
      return `[WS${entity.workspaceIndex + 1}:${workspaceName}]`;
    }
    return "";
  }

  /**
   * 按workspace分组实体
   */
  groupEntitiesByWorkspace(entities: Entity[]): Map<string, Entity[]> {
    const grouped = new Map<string, Entity[]>();

    entities.forEach((entity) => {
      const workspacePath =
        entity.workspacePath || serverConfig.workspacePaths[0];
      if (!grouped.has(workspacePath)) {
        grouped.set(workspacePath, []);
      }
      grouped.get(workspacePath)!.push(entity);
    });

    return grouped;
  }
}
// 单例实例
// export const multiWorkspaceManager = new MultiWorkspaceManager();

export let multiWorkspaceManager: MultiWorkspaceManager;

// 设置实例的函数
export function setMultiWorkspaceManager(instance: MultiWorkspaceManager) {
  multiWorkspaceManager = instance;
}
