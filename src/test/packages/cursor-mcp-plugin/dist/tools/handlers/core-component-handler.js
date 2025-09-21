"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreComponentHandler = void 0;
const base_handler_1 = require("./base-handler");
const entity_utils_1 = require("../../utils/entity-utils");
const conversation_service_1 = require("../../services/conversation-service");
const server_config_1 = require("../../config/server-config");
const workspace_entity_utils_1 = require("../../utils/workspace-entity-utils");
class CoreComponentHandler extends base_handler_1.BaseHandler {
    constructor(hasEntitiesFile) {
        super(hasEntitiesFile);
    }
    /**
     * 处理workspaceEntities格式的实体选择
     */
    async handleWorkspaceEntities(sessionId, workspaceEntityMap, maxRelated, conversation, originalWorkspaceEntities) {
        const selectedComponents = [];
        const startTime = Date.now();
        // 根据workspaceEntityMap查找实体
        for (const [workspaceName, entityIds] of workspaceEntityMap) {
            if (!conversation.workspaceResults) {
                return {
                    content: [{ type: "text", text: `❌ 没有workspace结果数据，请重新开始分析` }],
                };
            }
            // 查找对应的workspace路径
            let targetWorkspacePath = null;
            let targetWsResult = null;
            for (const [workspacePath, wsResult] of conversation.workspaceResults) {
                const currentWorkspaceName = require('path').basename(workspacePath);
                if (currentWorkspaceName === workspaceName) {
                    targetWorkspacePath = workspacePath;
                    targetWsResult = wsResult;
                    break;
                }
            }
            if (!targetWorkspacePath || !targetWsResult) {
                return {
                    content: [{ type: "text", text: `❌ 未找到workspace: ${workspaceName}` }],
                };
            }
            // 查找指定的实体
            for (const entityId of entityIds) {
                const entity = targetWsResult.entities.find((e) => e.id === entityId);
                if (entity) {
                    const enrichedEntity = (0, entity_utils_1.enrichedToEntity)(entity);
                    enrichedEntity.workspacePath = targetWorkspacePath;
                    selectedComponents.push(enrichedEntity);
                }
                else {
                    return {
                        content: [{ type: "text", text: `❌ 在workspace ${workspaceName} 中未找到实体: ${entityId}` }],
                    };
                }
            }
        }
        if (selectedComponents.length === 0) {
            return {
                content: [{ type: "text", text: `❌ 没有找到任何有效的组件` }],
            };
        }
        // 处理智能关联（与原有逻辑类似）
        const smartResultPromises = selectedComponents.map(component => {
            const targetWorkspacePath = component.workspacePath;
            if (!targetWorkspacePath) {
                throw new Error(`No workspace path available for component ${component.id}`);
            }
            return this.multiWorkspaceManager.getSmartRelatedEntities(component.id, conversation.userInput, maxRelated, targetWorkspacePath);
        });
        const smartResults = await Promise.all(smartResultPromises);
        // 按workspace分组处理结果
        const workspaceRelatedEntitiesMap = new Map();
        const workspaceAllRelatedEntitiesMap = new Map();
        const workspaceDefaultSelectionMap = new Map();
        const workspaceAiReasoningMap = new Map();
        // 按workspace分组处理smartResults
        const workspaceComponentMap = new Map();
        selectedComponents.forEach(component => {
            const workspacePath = component.workspacePath;
            if (!workspaceComponentMap.has(workspacePath)) {
                workspaceComponentMap.set(workspacePath, []);
            }
            workspaceComponentMap.get(workspacePath).push(component);
        });
        let componentIndex = 0;
        for (const [workspacePath, components] of workspaceComponentMap) {
            let workspaceRelatedEntities = [];
            let workspaceAiReasoningParts = [];
            let workspaceLimitedRelatedEntities = {
                imports: [],
                calls: [],
                templates: [],
                similar: []
            };
            for (const component of components) {
                const smartResult = smartResults[componentIndex++];
                if (smartResult) {
                    const relatedEntities = smartResult.smartSelection.map(entity_utils_1.enrichedToEntity);
                    workspaceRelatedEntities.push(...relatedEntities);
                    const reasoning = `**${component.id}**: ${smartResult.reasoning}`;
                    workspaceAiReasoningParts.push(reasoning);
                    // 合并候选实体
                    workspaceLimitedRelatedEntities.imports.push(...smartResult.allCandidates.imports.map(entity_utils_1.enrichedToEntity));
                    workspaceLimitedRelatedEntities.calls.push(...smartResult.allCandidates.calls.map(entity_utils_1.enrichedToEntity));
                    workspaceLimitedRelatedEntities.templates.push(...smartResult.allCandidates.templates.map(entity_utils_1.enrichedToEntity));
                    workspaceLimitedRelatedEntities.similar.push(...smartResult.allCandidates.similar.map(entity_utils_1.enrichedToEntity));
                }
            }
            // 去重workspace内的相关实体
            const uniqueWorkspaceRelatedEntities = workspaceRelatedEntities.filter((entity, index, array) => array.findIndex(e => e.id === entity.id) === index);
            // 去重workspace内的候选实体
            workspaceLimitedRelatedEntities.imports = workspaceLimitedRelatedEntities.imports.filter((entity, index, array) => array.findIndex(e => e.id === entity.id) === index);
            workspaceLimitedRelatedEntities.calls = workspaceLimitedRelatedEntities.calls.filter((entity, index, array) => array.findIndex(e => e.id === entity.id) === index);
            workspaceLimitedRelatedEntities.templates = workspaceLimitedRelatedEntities.templates.filter((entity, index, array) => array.findIndex(e => e.id === entity.id) === index);
            workspaceLimitedRelatedEntities.similar = workspaceLimitedRelatedEntities.similar.filter((entity, index, array) => array.findIndex(e => e.id === entity.id) === index);
            // 保存workspace级别的数据
            workspaceRelatedEntitiesMap.set(workspacePath, workspaceLimitedRelatedEntities);
            workspaceAllRelatedEntitiesMap.set(workspacePath, uniqueWorkspaceRelatedEntities);
            workspaceDefaultSelectionMap.set(workspacePath, [...components, ...uniqueWorkspaceRelatedEntities]);
            workspaceAiReasoningMap.set(workspacePath, workspaceAiReasoningParts.join('\n\n'));
        }
        // 更新会话状态（只保存workspace级别的数据）
        conversation_service_1.conversationService.updateConversation(sessionId, {
            workspaceRelatedEntities: workspaceRelatedEntitiesMap,
            workspaceAllRelatedEntities: workspaceAllRelatedEntitiesMap,
            workspaceDefaultSelection: workspaceDefaultSelectionMap,
            workspaceAiReasoning: workspaceAiReasoningMap,
            step: 'ready-generate'
        });
        const duration = (Date.now() - startTime) / 1000;
        // 统计总数
        let totalRelatedEntities = 0;
        let totalDefaultSelection = 0;
        for (const [_, entities] of workspaceAllRelatedEntitiesMap) {
            totalRelatedEntities += entities.length;
        }
        for (const [_, entities] of workspaceDefaultSelectionMap) {
            totalDefaultSelection += entities.length;
        }
        // 构建结果显示（按workspace分段）
        const workspaceGroups = this.multiWorkspaceManager.groupEntitiesByWorkspace(selectedComponents);
        const isMultiWorkspace = workspaceGroups.size > 1;
        let result = `# ✅ 跨Workspace智能关联完成

## 📊 选择统计
- 🎯 **选中组件**: ${selectedComponents.length}个 ${isMultiWorkspace ? `(跨${workspaceGroups.size}个workspace)` : ''}
- 🔗 **关联实体**: ${totalRelatedEntities}个
- 📦 **总实体数**: ${totalDefaultSelection}个
- ⏱️ **分析耗时**: ${duration.toFixed(2)}秒

---

`;
        // 按workspace分段显示结果
        for (const [workspacePath, components] of workspaceComponentMap) {
            const workspaceName = require('path').basename(workspacePath);
            const workspaceRelatedEntities = workspaceAllRelatedEntitiesMap.get(workspacePath) || [];
            const workspaceAiReasoning = workspaceAiReasoningMap.get(workspacePath) || '';
            result += `## 📂 Workspace: ${workspaceName}

### 🧩 选中的组件

${components.map((comp, i) => {
                return `#### ${i + 1}. ${comp.id} 🎯
- 📁 **文件**: ${comp.file}
- 🏷️ **类型**: ${comp.type}
- 📄 **摘要**: ${comp.summary || '无摘要'}`;
            }).join('\n\n')}

${workspaceRelatedEntities.length > 0 ? `### 🔗 智能关联的实体

${workspaceRelatedEntities.map((entity, i) => {
                return `${i + 1}. **${entity.id}** (${entity.type})
   📁 ${entity.file}
   📄 ${entity.summary || '无摘要'}`;
            }).join('\n\n')}` : ''}

${workspaceAiReasoning ? `### 🤖 AI选择推理

${workspaceAiReasoning}` : ''}

---

`;
        }
        result += this.formatNextStepsActions(sessionId, originalWorkspaceEntities, workspaceDefaultSelectionMap);
        return {
            content: [{ type: "text", text: result }],
        };
    }
    /**
     * 格式化下一步操作选项
     */
    formatNextStepsActions(sessionId, workspaceEntities, workspaceDefaultSelectionMap) {
        if (!server_config_1.serverConfig.returnDirect) {
            // 原有的文本格式
            return `---

## 🚀 下一步选择

### ⚡ 选择1: 生成代码提示词
AI已智能选择了最相关的实体，现在生成最终的代码提示词：
\`\`\`
generate-code-prompt
sessionId: "${sessionId}"
workspaceEntities: "${workspaceEntities}"
\`\`\`

### 🔧 选择2: 调整实体选择
如需调整实体选择：
\`\`\`
modify-entity-selection
sessionId: "${sessionId}"
action: "add"
workspaceEntities: "${workspaceEntities}"
\`\`\`

💡 **推荐**: AI选择通常很准确，建议直接生成代码提示词！`;
        }
        // JSON 格式，用特殊字符包裹 - 参考start-analysis格式
        const actions = {
            type: "next_actions",
            title: "智能关联完成 - 跨Workspace操作",
            sessionId: sessionId,
            workspaceResults: Array.from(workspaceDefaultSelectionMap.entries()).map(([workspacePath, entities]) => ({
                workspacePath,
                workspaceName: require('path').basename(workspacePath),
                totalEntityCount: entities.length,
                entities: entities.map(entity => ({
                    id: entity.id,
                    type: entity.type,
                    file: entity.file,
                    summary: entity.summary || '无摘要',
                    isSelected: true
                }))
            })),
            actions: [
                {
                    id: "generate_code_prompt",
                    title: "生成代码提示词",
                    description: "AI已智能选择了最相关的实体，现在生成最终的代码提示词",
                    tool: "generate-code-prompt",
                    params: {
                        sessionId: sessionId,
                        workspaceEntities: workspaceEntities
                    },
                    priority: 1,
                    recommended: true
                },
                {
                    id: "modify_entity_selection",
                    title: "调整实体选择",
                    description: "添加或修改选中的实体",
                    tool: "modify-entity-selection",
                    params: {
                        sessionId: sessionId,
                        workspaceEntities: workspaceEntities
                    },
                    priority: 2
                }
            ],
            examples: {
                workspaceEntitiesFormat: "workspace1:entity1,entity2;workspace2:entity3,entity4",
                current: workspaceEntities
            },
            metadata: {
                mode: "smart_association_complete",
                totalWorkspaces: workspaceDefaultSelectionMap.size,
                totalEntities: Array.from(workspaceDefaultSelectionMap.values()).reduce((sum, entities) => sum + entities.length, 0),
                recommendation: "generate_code_prompt"
            }
        };
        return `\n\n≋≋≋ CLINE_ACTIONS_JSON_START ≋≋≋
${JSON.stringify(actions, null, 2)}
≋≋≋ CLINE_ACTIONS_JSON_END ≋≋≋`;
    }
    async handle(sessionId, maxRelated = 1, workspaceEntities) {
        try {
            const conversation = conversation_service_1.conversationService.getConversation(sessionId);
            if (!conversation || conversation.step !== 'select-core') {
                return {
                    content: [{ type: "text", text: `❌ 会话状态错误，请重新开始分析` }],
                };
            }
            // 处理workspaceEntities参数（统一格式）
            if (!workspaceEntities) {
                return {
                    content: [{ type: "text", text: `❌ 请提供workspaceEntities参数` }],
                };
            }
            const workspaceEntityMap = (0, workspace_entity_utils_1.parseWorkspaceEntities)(workspaceEntities);
            return this.handleWorkspaceEntities(sessionId, workspaceEntityMap, maxRelated, conversation, workspaceEntities);
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `选择失败: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
            };
        }
    }
}
exports.CoreComponentHandler = CoreComponentHandler;
