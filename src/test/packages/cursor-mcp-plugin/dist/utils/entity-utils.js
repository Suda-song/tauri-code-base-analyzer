"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCombinedPrompt = generateCombinedPrompt;
exports.collectAllEntities = collectAllEntities;
exports.generateEntitySummary = generateEntitySummary;
exports.enrichedToEntity = enrichedToEntity;
exports.isWorkspaceEntity = isWorkspaceEntity;
exports.convertEntityToAbsolutePath = convertEntityToAbsolutePath;
exports.convertEntitiesToAbsolutePaths = convertEntitiesToAbsolutePaths;
const server_config_1 = require("../config/server-config");
const path_1 = __importDefault(require("path"));
function generateCombinedPrompt(searchResult, allResults) {
    let combinedPrompt = `# 搜索结果\n\n`;
    combinedPrompt += searchResult.prompt;
    combinedPrompt += `\n\n# 二跳查询结果\n\n`;
    for (const result of allResults) {
        const { searchEntity, relevanceScore, relatedEntities } = result;
        combinedPrompt += `## 源组件: ${searchEntity.id} (相关度: ${relevanceScore.toFixed(2)})\n`;
        combinedPrompt += relatedEntities.prompt;
        combinedPrompt += '\n---\n\n';
    }
    return combinedPrompt;
}
function collectAllEntities(results) {
    const allEntities = new Set();
    results.forEach(result => {
        allEntities.add(result.searchEntity);
        const { imports, calls, templates, similar } = result.relatedEntities.relatedEntities;
        [...imports, ...calls, ...templates, ...similar].forEach(e => allEntities.add(e));
    });
    return Array.from(allEntities);
}
function generateEntitySummary(allResults) {
    let summary = '';
    // 收集所有关联实体按类型分组
    const categorizedEntities = {
        imports: new Set(),
        calls: new Set(),
        templates: new Set(),
        similar: new Set(),
    };
    allResults.forEach(result => {
        const { imports, calls, templates, similar } = result.relatedEntities.relatedEntities;
        imports.forEach(e => categorizedEntities.imports.add(e));
        calls.forEach(e => categorizedEntities.calls.add(e));
        templates.forEach(e => categorizedEntities.templates.add(e));
        similar.forEach(e => categorizedEntities.similar.add(e));
    });
    // 生成详细的实体列表
    if (categorizedEntities.imports.size > 0) {
        summary += `#### 📥 导入关系 (${categorizedEntities.imports.size} 个)\n`;
        Array.from(categorizedEntities.imports).forEach(entity => {
            summary += `- \`${entity.id}\` (${entity.type}) - ${entity.file}\n`;
        });
        summary += '\n';
    }
    if (categorizedEntities.calls.size > 0) {
        summary += `#### 🔗 调用关系 (${categorizedEntities.calls.size} 个)\n`;
        Array.from(categorizedEntities.calls).forEach(entity => {
            summary += `- \`${entity.id}\` (${entity.type}) - ${entity.file}\n`;
        });
        summary += '\n';
    }
    if (categorizedEntities.templates.size > 0) {
        summary += `#### 🎨 模板关系 (${categorizedEntities.templates.size} 个)\n`;
        Array.from(categorizedEntities.templates).forEach(entity => {
            summary += `- \`${entity.id}\` (${entity.type}) - ${entity.file}\n`;
        });
        summary += '\n';
    }
    if (categorizedEntities.similar.size > 0) {
        summary += `#### 🏷️ 相似标签 (${categorizedEntities.similar.size} 个)\n`;
        Array.from(categorizedEntities.similar).forEach(entity => {
            summary += `- \`${entity.id}\` (${entity.type}) - ${entity.file}\n`;
        });
        summary += '\n';
    }
    // 添加总计统计
    const totalCount = categorizedEntities.imports.size + categorizedEntities.calls.size +
        categorizedEntities.templates.size + categorizedEntities.similar.size;
    if (summary === '') {
        summary = '**暂无相关实体**\n';
    }
    else {
        summary = `**总计**: ${totalCount} 个相关实体\n\n` + summary;
    }
    return summary;
}
/**
 * 类型转换工具函数：将 EnrichedEntity 转换为 Entity
 */
function enrichedToEntity(enriched) {
    return enriched;
}
/**
 * 判断实体是否来自workspace包
 * 直接使用实体的isWorkspace标识
 */
function isWorkspaceEntity(entity) {
    return entity.isWorkspace === true;
}
/**
 * 转换实体文件路径为绝对路径（多workspace支持）
 */
function convertEntityToAbsolutePath(entity) {
    // 优先使用实体自身的workspacePath，否则使用第一个配置的workspace
    const workspacePath = entity.workspacePath || server_config_1.serverConfig.workspacePaths[0];
    if (!workspacePath) {
        return entity;
    }
    // 如果文件路径已经是绝对路径，直接返回
    if (entity.file.startsWith('/') || entity.file.match(/^[A-Z]:/)) {
        return entity;
    }
    // 构建绝对路径
    const absolutePath = path_1.default.join(workspacePath, entity.file);
    return {
        ...entity,
        file: absolutePath
    };
}
/**
 * 批量转换实体列表的路径
 */
function convertEntitiesToAbsolutePaths(entities) {
    return entities.map(entity => convertEntityToAbsolutePath(entity));
}
