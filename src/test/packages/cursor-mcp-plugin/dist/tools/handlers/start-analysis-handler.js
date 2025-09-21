"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartAnalysisHandler = void 0;
const base_handler_1 = require("./base-handler");
const server_config_1 = require("../../config/server-config");
const conversation_service_1 = require("../../services/conversation-service");
const workspace_entity_utils_1 = require("../../utils/workspace-entity-utils");
class StartAnalysisHandler extends base_handler_1.BaseHandler {
    /**
     * 格式化下一步操作选项（支持跨workspace多选）
     */
    formatNextStepsActions(sessionId, workspaceResults, input) {
        if (!server_config_1.serverConfig.returnDirect) {
            // 构建示例实体选择（展示跨workspace能力）
            const exampleSelections = (0, workspace_entity_utils_1.buildExampleSelections)(workspaceResults);
            return `## 🎯 请选择您的操作方式

### ⚡ 方式1: 智能关联模式（推荐）
选择一个或多个组件并智能关联相关实体：

**单workspace选择**:
\`\`\`
select-core-component
sessionId: "${sessionId}"
workspaceEntities: "${exampleSelections.single}"
maxRelated: 1
\`\`\`

**跨workspace选择**:
\`\`\`
select-core-component
sessionId: "${sessionId}"
workspaceEntities: "${exampleSelections.cross}"
maxRelated: 1
\`\`\`

### 🔍 方式2: 手动选择实体模式
选择组件后手动添加/移除实体：

**单workspace开始**:
\`\`\`
modify-entity-selection
sessionId: "${sessionId}"
action: "replace"
workspaceEntities: "${exampleSelections.single}"
maxRelated: 3
\`\`\`

**跨workspace开始**:
\`\`\`
modify-entity-selection
sessionId: "${sessionId}"
action: "replace"
workspaceEntities: "${exampleSelections.cross}"
maxRelated: 3
\`\`\`

### 🚀 方式3: 直接出码
选择组件直接生成代码提示词：

**单workspace出码**:
\`\`\`
generate-code-prompt
sessionId: "${sessionId}"
workspaceEntities: "${exampleSelections.single}"
\`\`\`

**跨workspace出码**:
\`\`\`
generate-code-prompt
sessionId: "${sessionId}"
workspaceEntities: "${exampleSelections.cross}"
\`\`\`

### ⚡ 方式4: 一键分析（跨所有workspace）
\`\`\`
quick-analysis
input: "${input}"
componentIndex: 0
includeRelated: true
\`\`\`

### 🔄 方式5: 重新分析需求
\`\`\`
start-analysis
input: "${input}"
\`\`\`

💡 **使用说明**: 
- workspaceEntities格式: "workspace1:entity1,entity2;workspace2:entity3,entity4"
- 支持单workspace和跨workspace选择
- 复制上面任意一个代码块在 Cursor 中执行`;
        }
        // JSON 格式，用特殊字符包裹 - 支持跨workspace多选
        const exampleSelections = (0, workspace_entity_utils_1.buildExampleSelections)(workspaceResults);
        const actions = {
            type: "next_actions",
            title: "分析完成 - 跨Workspace选择操作",
            sessionId: sessionId,
            workspaceResults: Array.from(workspaceResults.entries()).map(([workspacePath, wsResult]) => ({
                workspacePath,
                workspaceName: require('path').basename(workspacePath),
                totalEntityCount: wsResult.entities.length,
                entities: wsResult.entities.map((entity) => ({
                    id: entity.id,
                    type: entity.type,
                    file: entity.file,
                    relevanceScore: wsResult.relevanceScores[entity.id] || 0,
                    summary: entity.summary || '无摘要',
                    isSelected: true
                }))
            })),
            actions: [
                {
                    id: "select_core_single",
                    title: "智能关联模式（单workspace）",
                    description: "选择单个workspace的组件并智能关联相关实体",
                    tool: "select-core-component",
                    params: {
                        sessionId: sessionId,
                        workspaceEntities: exampleSelections.single,
                        maxRelated: 1
                    },
                    priority: 1,
                    recommended: true
                },
                {
                    id: "select_core_cross",
                    title: "智能关联模式（跨workspace）",
                    description: "选择多个workspace的组件并智能关联相关实体",
                    tool: "select-core-component",
                    params: {
                        sessionId: sessionId,
                        workspaceEntities: exampleSelections.cross,
                        maxRelated: 1
                    },
                    priority: 2,
                    recommended: true
                },
                {
                    id: "modify_selection_single",
                    title: "手动选择模式（单workspace）",
                    description: "手动选择和管理单个workspace的实体",
                    tool: "modify-entity-selection",
                    params: {
                        sessionId: sessionId,
                        action: "replace",
                        workspaceEntities: exampleSelections.single,
                        maxRelated: 3
                    },
                    priority: 3
                },
                {
                    id: "modify_selection_cross",
                    title: "手动选择模式（跨workspace）",
                    description: "手动选择和管理多个workspace的实体",
                    tool: "modify-entity-selection",
                    params: {
                        sessionId: sessionId,
                        action: "replace",
                        workspaceEntities: exampleSelections.cross,
                        maxRelated: 3
                    },
                    priority: 4
                },
                {
                    id: "direct_generate_single",
                    title: "直接生成代码（单workspace）",
                    description: "选择单个workspace的组件直接生成代码提示词",
                    tool: "generate-code-prompt",
                    params: {
                        sessionId: sessionId,
                        workspaceEntities: exampleSelections.single
                    },
                    priority: 5
                },
                {
                    id: "direct_generate_cross",
                    title: "直接生成代码（跨workspace）",
                    description: "选择多个workspace的组件直接生成代码提示词",
                    tool: "generate-code-prompt",
                    params: {
                        sessionId: sessionId,
                        workspaceEntities: exampleSelections.cross
                    },
                    priority: 6
                },
                {
                    id: "quick_analysis",
                    title: "一键分析（跨所有workspace）",
                    description: "自动处理所有workspace",
                    tool: "quick-analysis",
                    params: {
                        input: input,
                        componentIndex: 0,
                        includeRelated: true
                    },
                    priority: 7
                }
            ],
            examples: {
                workspaceEntitiesFormat: "workspace1:entity1,entity2;workspace2:entity3,entity4",
                single: exampleSelections.single,
                cross: exampleSelections.cross
            },
            metadata: {
                mode: "multi_workspace_analysis_complete",
                totalWorkspaces: workspaceResults.size,
                userInput: input
            }
        };
        return `≋≋≋ CLINE_ACTIONS_JSON_START ≋≋≋
${JSON.stringify(actions, null, 2)}
≋≋≋ CLINE_ACTIONS_JSON_END ≋≋≋`;
    }
    async handle(input, sessionId) {
        // 检查实体文件是否存在（多workspace支持）
        const fileCheckResult = this.checkEntitiesFile();
        if (fileCheckResult) {
            return fileCheckResult;
        }
        const currentSessionId = sessionId || Date.now().toString();
        const startTime = Date.now();
        // 1. 使用多workspace搜索相关实体（已排序）
        const searchResult = await this.multiWorkspaceManager.searchAcrossWorkspaces(input, 10);
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
        // 2. 保存会话状态 - 按workspace分组保存（searchResult已排序，无需额外处理）
        conversation_service_1.conversationService.setConversation(currentSessionId, {
            sessionId: currentSessionId,
            step: 'select-core',
            userInput: input,
            workspaceResults: searchResult.workspaceResults,
        });
        const duration = (Date.now() - startTime) / 1000;
        // 3. 构建结果展示（按workspace分组显示）
        let result = `# 🎯 多Workspace需求分析完成

## 📝 需求描述
**您的需求**: ${input}
**分析耗时**: ${duration.toFixed(2)}秒
**会话ID**: ${currentSessionId}
**Workspace数量**: ${searchResult.workspaceResults.size}个

---

`;
        // 为每个workspace展示结果
        for (const [workspacePath, wsResult] of searchResult.workspaceResults) {
            const workspaceName = require('path').basename(workspacePath);
            const topEntities = wsResult.entities;
            result += `## 📂 Workspace: ${workspaceName}

### 🏆 推荐的核心组件

${topEntities.map((entity, index) => {
                const score = wsResult.relevanceScores[entity.id] || 0;
                const isDefault = index === 0;
                return `#### ${index + 1}. ${entity.id} ${isDefault ? '👑 *默认推荐*' : ''}
- 📁 **文件**: ${entity.file}
- 🏷️ **类型**: ${entity.type}
- 📊 **相关度**: ${score.toFixed(2)}
- 📄 **摘要**: ${entity.summary || '无摘要'}`;
            }).join('\n\n')}

---

`;
        }
        result += this.formatNextStepsActions(currentSessionId, searchResult.workspaceResults, input);
        return {
            content: [{ type: "text", text: result }],
        };
    }
}
exports.StartAnalysisHandler = StartAnalysisHandler;
