import { RagInlineTool } from "@xhs/modular-code-analysis-agent";
import { Entity } from "../types";
/**
 * 多workspace管理工具类
 * 负责处理多workspace环境下的实体加载、搜索和管理
 */
export declare class MultiWorkspaceManager {
    private ragTools;
    private workspaceIndexMap;
    constructor();
    /**
     * 初始化所有workspace的RAG工具
     */
    private initializeWorkspaces;
    /**
     * 获取所有有效的workspace路径
     */
    getAvailableWorkspaces(): string[];
    /**
     * 检查是否有任何可用的workspace
     */
    hasAnyWorkspace(): boolean;
    /**
     * 获取指定workspace的RAG工具
     */
    getRagTool(workspacePath: string): RagInlineTool | undefined;
    /**
     * 为entity添加workspace信息
     */
    private addWorkspaceInfo;
    /**
     * 跨所有workspace搜索实体（按workspace分组返回）
     */
    searchAcrossWorkspaces(query: string, maxResults?: number): Promise<{
        workspaceResults: Map<string, {
            entities: Entity[];
            relevanceScores: Record<string, number>;
            workspacePath: string;
            workspaceName: string;
        }>;
        totalEntities: number;
    }>;
    /**
     * 从指定workspace获取实体的相关实体
     */
    getRelatedEntities(entityId: string, workspacePath: string): Promise<any>;
    /**
     * 获取智能相关实体（从指定workspace）
     */
    getSmartRelatedEntities(entityId: string, userInput: string, maxRelated: number | undefined, workspacePath: string): Promise<any>;
    /**
     * 获取所有workspace的文件状态
     */
    getAllFileStatus(): Array<{
        workspacePath: string;
        status: any;
    }>;
    /**
     * 重新加载所有workspace的实体
     */
    reloadAllEntities(): boolean;
    /**
     * 清理所有workspace的RAG工具
     */
    disposeAll(): void;
    /**
     * 格式化workspace信息用于显示
     */
    formatWorkspaceInfo(entity: Entity): string;
    /**
     * 按workspace分组实体
     */
    groupEntitiesByWorkspace(entities: Entity[]): Map<string, Entity[]>;
}
export declare const multiWorkspaceManager: MultiWorkspaceManager;
