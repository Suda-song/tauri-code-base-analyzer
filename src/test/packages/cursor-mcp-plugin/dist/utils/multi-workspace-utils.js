"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.multiWorkspaceManager = exports.MultiWorkspaceManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const modular_code_analysis_agent_1 = require("@xhs/modular-code-analysis-agent");
const server_config_1 = require("../config/server-config");
const entity_utils_1 = require("./entity-utils");
/**
 * 多workspace管理工具类
 * 负责处理多workspace环境下的实体加载、搜索和管理
 */
class MultiWorkspaceManager {
    constructor() {
        this.ragTools = new Map(); // workspacePath -> RagInlineTool
        this.workspaceIndexMap = new Map(); // workspacePath -> index
        this.initializeWorkspaces();
    }
    /**
     * 初始化所有workspace的RAG工具
     */
    initializeWorkspaces() {
        server_config_1.serverConfig.workspacePaths.forEach((workspacePath, index) => {
            this.workspaceIndexMap.set(workspacePath, index);
            const entitiesFilePath = server_config_1.serverConfig.entitiesFilePaths[index];
            // 检查实体文件是否存在
            if (fs_1.default.existsSync(entitiesFilePath)) {
                try {
                    const ragTool = new modular_code_analysis_agent_1.RagInlineTool(entitiesFilePath, workspacePath);
                    this.ragTools.set(workspacePath, ragTool);
                }
                catch (error) {
                    console.warn(`Failed to initialize RAG tool for workspace ${workspacePath}:`, error);
                }
            }
            else {
                console.warn(`Entities file not found for workspace ${workspacePath}: ${entitiesFilePath}`);
            }
        });
    }
    /**
     * 获取所有有效的workspace路径
     */
    getAvailableWorkspaces() {
        return Array.from(this.ragTools.keys());
    }
    /**
     * 检查是否有任何可用的workspace
     */
    hasAnyWorkspace() {
        return this.ragTools.size > 0;
    }
    /**
     * 获取指定workspace的RAG工具
     */
    getRagTool(workspacePath) {
        return this.ragTools.get(workspacePath);
    }
    /**
     * 为entity添加workspace信息
     */
    addWorkspaceInfo(entity, workspacePath) {
        const enriched = (0, entity_utils_1.enrichedToEntity)(entity);
        const workspaceIndex = this.workspaceIndexMap.get(workspacePath) || 0;
        return {
            ...enriched,
            workspaceIndex,
            workspacePath
        };
    }
    /**
     * 跨所有workspace搜索实体（按workspace分组返回）
     */
    async searchAcrossWorkspaces(query, maxResults = 10) {
        const workspaceResults = new Map();
        // 并行搜索所有workspace
        const searchPromises = Array.from(this.ragTools.entries()).map(async ([workspacePath, ragTool]) => {
            try {
                const result = await ragTool.search(query, maxResults);
                if (result.entities) {
                    // 为每个entity添加workspace信息
                    const entitiesWithWorkspace = result.entities.map(entity => this.addWorkspaceInfo(entity, workspacePath));
                    // 直接按相关度排序，避免后续重复处理
                    const sortedEntities = entitiesWithWorkspace
                        .sort((a, b) => ((result.relevanceScores || {})[b.id] || 0) - ((result.relevanceScores || {})[a.id] || 0));
                    workspaceResults.set(workspacePath, {
                        entities: sortedEntities,
                        relevanceScores: result.relevanceScores || {},
                        workspacePath,
                        workspaceName: path_1.default.basename(workspacePath)
                    });
                }
            }
            catch (error) {
                console.warn(`Search failed for workspace ${workspacePath}:`, error);
            }
        });
        await Promise.all(searchPromises);
        // 计算总实体数
        const totalEntities = Array.from(workspaceResults.values())
            .reduce((sum, ws) => sum + ws.entities.length, 0);
        return {
            workspaceResults,
            totalEntities
        };
    }
    /**
     * 从指定workspace获取实体的相关实体
     */
    async getRelatedEntities(entityId, workspacePath) {
        const ragTool = this.ragTools.get(workspacePath);
        if (!ragTool) {
            throw new Error(`RAG tool not found for workspace: ${workspacePath}`);
        }
        return await ragTool.getRelatedEntities(entityId);
    }
    /**
     * 获取智能相关实体（从指定workspace）
     */
    async getSmartRelatedEntities(entityId, userInput, maxRelated = 3, workspacePath) {
        const ragTool = this.ragTools.get(workspacePath);
        if (!ragTool) {
            throw new Error(`RAG tool not found for workspace: ${workspacePath}`);
        }
        return await ragTool.getSmartRelatedEntities(entityId, userInput, maxRelated);
    }
    /**
     * 获取所有workspace的文件状态
     */
    getAllFileStatus() {
        const statuses = [];
        for (const [workspacePath, ragTool] of this.ragTools) {
            const status = ragTool.getFileStatus();
            statuses.push({ workspacePath, status });
        }
        return statuses;
    }
    /**
     * 重新加载所有workspace的实体
     */
    reloadAllEntities() {
        let allSuccess = true;
        for (const [workspacePath, ragTool] of this.ragTools) {
            try {
                const success = ragTool.reloadEntities();
                if (!success) {
                    console.warn(`Failed to reload entities for workspace: ${workspacePath}`);
                    allSuccess = false;
                }
            }
            catch (error) {
                console.warn(`Error reloading entities for workspace ${workspacePath}:`, error);
                allSuccess = false;
            }
        }
        return allSuccess;
    }
    /**
     * 清理所有workspace的RAG工具
     */
    disposeAll() {
        for (const [workspacePath, ragTool] of this.ragTools) {
            try {
                ragTool.dispose();
            }
            catch (error) {
                console.warn(`Error disposing ragTool for workspace ${workspacePath}:`, error);
            }
        }
        this.ragTools.clear();
    }
    /**
     * 格式化workspace信息用于显示
     */
    formatWorkspaceInfo(entity) {
        if (entity.workspaceIndex !== undefined && entity.workspacePath) {
            const workspaceName = path_1.default.basename(entity.workspacePath);
            return `[WS${entity.workspaceIndex + 1}:${workspaceName}]`;
        }
        return '';
    }
    /**
     * 按workspace分组实体
     */
    groupEntitiesByWorkspace(entities) {
        const grouped = new Map();
        entities.forEach(entity => {
            const workspacePath = entity.workspacePath || server_config_1.serverConfig.workspacePaths[0];
            if (!grouped.has(workspacePath)) {
                grouped.set(workspacePath, []);
            }
            grouped.get(workspacePath).push(entity);
        });
        return grouped;
    }
}
exports.MultiWorkspaceManager = MultiWorkspaceManager;
// 单例实例
exports.multiWorkspaceManager = new MultiWorkspaceManager();
