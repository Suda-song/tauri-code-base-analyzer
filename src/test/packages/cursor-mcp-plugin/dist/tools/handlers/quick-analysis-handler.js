"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuickAnalysisHandler = void 0;
const base_handler_1 = require("./base-handler");
const prompt_generator_1 = require("../../utils/prompt-generator");
const entity_utils_1 = require("../../utils/entity-utils");
class QuickAnalysisHandler extends base_handler_1.BaseHandler {
    async handle(input, componentIndex = 0, includeRelated = true, maxRelated = 1, additionalContext) {
        // 检查实体文件是否存在（多workspace支持）
        const fileCheckResult = this.checkEntitiesFile();
        if (fileCheckResult) {
            return fileCheckResult;
        }
        const startTime = Date.now();
        try {
            // 1. 搜索相关实体（多workspace支持）
            const searchResult = await this.multiWorkspaceManager.searchAcrossWorkspaces(input, 5);
            if (searchResult.totalEntities === 0) {
                return {
                    content: [{
                            type: "text",
                            text: `❌ 未找到相关实体，请检查：
1. 确保项目已完成代码解析和丰富
2. 尝试使用更具体的关键词
3. 检查项目代码库是否包含相关内容`
                        }],
                };
            }
            // 2. 按每个workspace处理第componentIndex个组件
            const allWorkspaceEntities = [];
            const allContextInfo = [];
            let totalRelevanceScore = 0;
            for (const [workspacePath, wsResult] of searchResult.workspaceResults) {
                const workspaceName = require('path').basename(workspacePath);
                const sortedEntities = wsResult.entities
                    .sort((a, b) => (wsResult.relevanceScores[b.id] || 0) - (wsResult.relevanceScores[a.id] || 0));
                if (sortedEntities.length === 0)
                    continue;
                // 选择该workspace的第componentIndex个组件
                const selectedIndex = Math.min(componentIndex, sortedEntities.length - 1);
                const coreComponent = sortedEntities[selectedIndex];
                const coreEntity = (0, entity_utils_1.enrichedToEntity)(coreComponent);
                coreEntity.workspacePath = workspacePath; // 确保设置workspace信息
                let workspaceEntities = [coreEntity];
                let workspaceContextInfo = `**${workspaceName}**: 选择核心组件 ${coreComponent.id} (相关度: ${(wsResult.relevanceScores[coreComponent.id] || 0).toFixed(2)})`;
                totalRelevanceScore += wsResult.relevanceScores[coreComponent.id] || 0;
                // 3. 如果需要，为每个workspace加载相关实体
                if (includeRelated) {
                    try {
                        const smartResult = await this.multiWorkspaceManager.getSmartRelatedEntities(coreComponent.id, input, maxRelated, workspacePath);
                        if (smartResult && smartResult.smartSelection.length > 0) {
                            const relatedEntities = smartResult.smartSelection.map((entity) => {
                                const enrichedEntity = (0, entity_utils_1.enrichedToEntity)(entity);
                                enrichedEntity.workspacePath = workspacePath;
                                return enrichedEntity;
                            });
                            workspaceEntities = [coreEntity, ...relatedEntities];
                            workspaceContextInfo += `\n   **智能关联**: ${smartResult.reasoning}`;
                        }
                        else {
                            workspaceContextInfo += `\n   **智能关联**: 未找到相关实体`;
                        }
                    }
                    catch (error) {
                        workspaceContextInfo += `\n   **智能关联**: 处理失败 - ${error instanceof Error ? error.message : '未知错误'}`;
                    }
                }
                allWorkspaceEntities.push(...workspaceEntities);
                allContextInfo.push(workspaceContextInfo);
            }
            if (allWorkspaceEntities.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: `❌ 所有workspace都没有找到有效实体`
                        }],
                };
            }
            // 4. 合并上下文信息
            let contextInfo = allContextInfo.join('\n\n');
            if (additionalContext) {
                contextInfo += `\n\n**用户补充**: ${additionalContext}`;
            }
            // 5. 生成最终提示词（按workspace分段）
            const finalPrompt = (0, prompt_generator_1.generateCodePrompt)(input, allWorkspaceEntities, contextInfo.trim() || undefined);
            const duration = (Date.now() - startTime) / 1000;
            const avgRelevanceScore = totalRelevanceScore / searchResult.workspaceResults.size;
            const result = `# ⚡ 多Workspace快速分析完成

## 📊 分析统计
- ⏱️ **分析耗时**: ${duration.toFixed(2)}秒
- 📂 **Workspace数量**: ${searchResult.workspaceResults.size}个
- 🎯 **平均相关度**: ${avgRelevanceScore.toFixed(2)}
- 🔗 **选中实体**: ${allWorkspaceEntities.length}个
- 📦 **组件索引**: 第${componentIndex + 1}个

## 🧩 按Workspace选中的实体

${Array.from(searchResult.workspaceResults.entries()).map(([workspacePath, _]) => {
                const workspaceName = require('path').basename(workspacePath);
                const workspaceEntities = allWorkspaceEntities.filter((entity) => entity.workspacePath === workspacePath);
                return `### 📂 ${workspaceName}
${workspaceEntities.map((entity, i) => `${i + 1}. **${entity.id}** (${entity.type})
   - 📁 文件: ${entity.file}
   - 📄 摘要: ${entity.summary || '无摘要'}`).join('\n\n')}`;
            }).join('\n\n')}

---

## 🚀 生成的代码提示词

${finalPrompt}

---

## ✅ 快速分析完成

您可以直接复制上面的提示词在 Cursor 中使用！

💡 **如需更精确的分析**，可以使用完整的交互流程：
\`\`\`
start-analysis
input: "${input}"
\`\`\``;
            return {
                content: [{ type: "text", text: result }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `快速分析失败: ${error instanceof Error ? error.message : String(error)}`
                    }],
            };
        }
    }
}
exports.QuickAnalysisHandler = QuickAnalysisHandler;
