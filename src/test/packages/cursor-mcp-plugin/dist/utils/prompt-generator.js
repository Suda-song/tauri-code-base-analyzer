"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCodePrompt = generateCodePrompt;
const multi_workspace_utils_1 = require("./multi-workspace-utils");
/**
 * 生成代码提示词的辅助函数（支持多workspace）
 * @param userInput 用户输入
 * @param entities 实体列表
 * @param additionalContext 额外上下文
 * @returns 生成的代码提示词
 */
function generateCodePrompt(userInput, entities, additionalContext) {
    // 按workspace分组显示实体
    const workspaceGroups = multi_workspace_utils_1.multiWorkspaceManager.groupEntitiesByWorkspace(entities);
    let prompt = `# 代码实现需求

## 用户需求
${userInput}

${additionalContext ? `## 额外上下文
${additionalContext}

` : ''}## 📋 涉及的代码实体

${Array.from(workspaceGroups.entries())
        .map(([workspacePath, workspaceEntities]) => {
        const workspaceName = require('path').basename(workspacePath);
        // 分离核心组件和相关实体
        const coreComponents = workspaceEntities.filter((entity) => workspaceEntities.indexOf(entity) === 0);
        const relatedEntities = workspaceEntities.filter((entity) => !coreComponents.includes(entity));
        let workspaceSection = `### 📂 workspace: ${workspaceName}

#### 核心组件
${coreComponents.map((entity, index) => `${index + 1}. **${entity.id}** (${entity.type})
   - 文件: ${entity.file}
   - 摘要: ${entity.summary || '无摘要'}
   - 标签: ${entity.tags?.join(', ') || '无标签'}
   ${entity.ANNOTATION ? `- 注释: ${entity.ANNOTATION}` : ''}`).join('\n\n')}`;
        if (relatedEntities.length > 0) {
            workspaceSection += `

#### 相关实体
${relatedEntities.map((entity, index) => `${index + 1}. **${entity.id}** (${entity.type})
   - 文件: ${entity.file}
   - 摘要: ${entity.summary || '无摘要'}
   - 标签: ${entity.tags?.join(', ') || '无标签'}
   ${entity.ANNOTATION ? `- 注释: ${entity.ANNOTATION}` : ''}`).join('\n\n')}`;
        }
        return workspaceSection;
    }).join('\n\n')}

## 实现要求

请基于以上核心组件${entities.length > 1 ? '和相关代码实体' : ''}，实现用户需求。

要求：
1. 充分理解现有代码结构和业务逻辑
2. 确保新代码与现有代码风格保持一致
3. 考虑代码的可维护性和扩展性
4. **多项目协同**: 基于上述涉及的不同项目及其实体，需要：
   - 分析需求在各项目中的功能分工和实现边界
   - 识别哪些功能应在哪个项目中实现，避免重复开发
   - 考虑项目间的数据流转和调用关系
   - 确保各项目中相关实体的修改保持逻辑一致性
   - 如涉及共享代码或通用逻辑，合理规划代码复用策略
5. 提供清晰的实现思路和关键代码
6. 如需修改现有文件，请明确指出修改点

请开始实现...`;
    return prompt;
}
