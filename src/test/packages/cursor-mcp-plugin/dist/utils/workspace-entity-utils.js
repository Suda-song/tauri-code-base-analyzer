"use strict";
/**
 * workspace实体格式处理工具函数
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWorkspaceEntities = parseWorkspaceEntities;
exports.buildExampleSelections = buildExampleSelections;
/**
 * 解析workspaceEntities字符串为Map
 * 格式: "workspace1:entity1,entity2;workspace2:entity3,entity4"
 */
function parseWorkspaceEntities(workspaceEntities) {
    const result = new Map();
    if (!workspaceEntities)
        return result;
    const workspaceParts = workspaceEntities.split(';');
    for (const part of workspaceParts) {
        const colonIndex = part.indexOf(':');
        if (colonIndex > 0) {
            const workspaceName = part.substring(0, colonIndex).trim();
            const entitiesStr = part.substring(colonIndex + 1).trim();
            const entityIds = entitiesStr.split(',').map(id => id.trim()).filter(id => id);
            if (entityIds.length > 0) {
                result.set(workspaceName, entityIds);
            }
        }
    }
    return result;
}
/**
 * 构建示例选择（单workspace和跨workspace）
 */
function buildExampleSelections(workspaceResults) {
    const workspaces = Array.from(workspaceResults.entries());
    // 单workspace示例：第一个workspace的前2个实体
    let single = '';
    if (workspaces.length > 0) {
        const [firstWorkspacePath, firstWsResult] = workspaces[0];
        const workspaceName = require('path').basename(firstWorkspacePath);
        const entities = firstWsResult.entities.slice(0, 2);
        if (entities.length > 0) {
            single = `${workspaceName}:${entities.map((e) => e.id).join(',')}`;
        }
    }
    // 跨workspace示例：每个workspace选1个实体
    const crossParts = [];
    for (const [workspacePath, wsResult] of workspaces) {
        const workspaceName = require('path').basename(workspacePath);
        const firstEntity = wsResult.entities[0];
        if (firstEntity) {
            crossParts.push(`${workspaceName}:${firstEntity.id}`);
        }
    }
    const cross = crossParts.join(';');
    return { single, cross };
}
