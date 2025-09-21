import { BaseHandler, ToolResult } from "./base-handler";
import { generateCodePrompt } from "../../utils/prompt-generator";
import { conversationService } from "../../services/conversation-service";
import { convertEntitiesToAbsolutePaths } from "../../utils/entity-utils";
import { serverConfig } from "../../config/server-config";
import { parseWorkspaceEntities } from "../../utils/workspace-entity-utils";

export class GeneratePromptHandler extends BaseHandler {
  constructor(hasEntitiesFile: boolean) {
    super(hasEntitiesFile);
  }

  async handle(sessionId: string, additionalContext?: string, workspaceEntities?: string): Promise<ToolResult> {
    try {
      const conversation = conversationService.getConversation(sessionId);
      if (!conversation) {
        return {
          content: [{ type: "text", text: `❌ 未找到会话 ${sessionId}` }],
        };
      }

      let entities = [];
      let mode = '';
      let workspaceInfo = '';
      
      // 处理workspaceEntities参数（统一格式）
      if (workspaceEntities) {
        const workspaceEntityMap = parseWorkspaceEntities(workspaceEntities);
        
        // 从conversation的workspace Map中获取实体
        if (!conversation.workspaceDefaultSelection) {
          return {
            content: [{ type: "text", text: `❌ 没有找到workspace选择数据，请重新进行分析` }],
          };
        }
        
        const selectedEntities: any[] = [];
        for (const [workspaceName, entityIds] of workspaceEntityMap) {
          // 查找对应的workspace路径
          let targetWorkspacePath: string | null = null;
          
          // 先找到对应的workspace路径
          if (conversation.workspaceResults) {
            for (const [workspacePath, _] of conversation.workspaceResults) {
              const currentWorkspaceName = require('path').basename(workspacePath);
              if (currentWorkspaceName === workspaceName) {
                targetWorkspacePath = workspacePath;
                break;
              }
            }
          }
          
          if (!targetWorkspacePath) continue;
          
          // 从多个数据源中查找实体（优先级：workspaceResults > workspaceRelatedEntities > workspaceDefaultSelection）
          for (const entityId of entityIds) {
            let foundEntity: any = null;
            
            // 1. 从workspaceResults中查找（最全的原始数据）
            if (conversation.workspaceResults) {
              const wsResult = conversation.workspaceResults.get(targetWorkspacePath);
              if (wsResult && wsResult.entities) {
                foundEntity = wsResult.entities.find((e: any) => e.id === entityId);
              }
            }
            
            // 2. 如果没找到，从workspaceRelatedEntities中查找
            if (!foundEntity && conversation.workspaceRelatedEntities) {
              const wsRelatedEntities = conversation.workspaceRelatedEntities.get(targetWorkspacePath);
              if (wsRelatedEntities) {
                // 在imports, calls, templates, similar中查找
                const allRelated = [
                  ...(wsRelatedEntities.imports || []),
                  ...(wsRelatedEntities.calls || []),
                  ...(wsRelatedEntities.templates || []),
                  ...(wsRelatedEntities.similar || [])
                ];
                foundEntity = allRelated.find((e: any) => e.id === entityId);
              }
            }
            
            // 3. 如果还没找到，从workspaceDefaultSelection中查找
            if (!foundEntity && conversation.workspaceDefaultSelection) {
              const wsDefaultEntities = conversation.workspaceDefaultSelection.get(targetWorkspacePath);
              if (wsDefaultEntities) {
                foundEntity = wsDefaultEntities.find((e: any) => e.id === entityId);
              }
            }
            
            if (foundEntity) {
              selectedEntities.push(foundEntity);
            }
          }
        }
        
        if (selectedEntities.length === 0) {
          return {
            content: [{ type: "text", text: `❌ 没有找到指定的实体` }],
          };
        }
        
        entities = selectedEntities;
        mode = `跨Workspace实体模式 (${selectedEntities.length}个)`;
        const workspaceGroups = this.multiWorkspaceManager.groupEntitiesByWorkspace(entities);
        workspaceInfo = `涉及 ${workspaceGroups.size} 个workspace`;
      }
      // 从workspace默认选择中获取所有实体（未指定workspaceEntities时）
      else if (conversation.workspaceDefaultSelection) {
        // 获取所有workspace的默认选择实体
        const allEntities: any[] = [];
        for (const [_, workspaceEntities] of conversation.workspaceDefaultSelection) {
          allEntities.push(...workspaceEntities);
        }
        
        if (allEntities.length === 0) {
          return {
            content: [{ type: "text", text: `❌ 没有选中任何实体，请先进行组件选择` }],
          };
        }
        
        entities = allEntities;
        mode = '完整workspace实体模式';
        const workspaceGroups = this.multiWorkspaceManager.groupEntitiesByWorkspace(entities);
        workspaceInfo = workspaceGroups.size > 1 ? `涉及 ${workspaceGroups.size} 个workspace` : '';
      } else {
        return {
          content: [{ type: "text", text: `❌ 没有选中任何实体，请先进行组件选择` }],
        };
      }

      const userInput = conversation.userInput;
      
      // 构建额外上下文信息（基于workspace分组）
      let contextInfo = '';
      if (conversation.workspaceAiReasoning && entities.length > 1) {
        const allReasonings: string[] = [];
        for (const [workspacePath, reasoning] of conversation.workspaceAiReasoning) {
          const workspaceName = require('path').basename(workspacePath);
          allReasonings.push(`**${workspaceName}**: ${reasoning}`);
        }
        contextInfo += `**AI实体选择理由**:\n${allReasonings.join('\n\n')}\n\n`;
      }
      
      if (conversation.workspaceAllRelatedEntities && entities.length > 1) {
        let totalRelatedCount = 0;
        for (const [_, relatedEntities] of conversation.workspaceAllRelatedEntities) {
          totalRelatedCount += relatedEntities.length;
        }
        contextInfo += `**实体筛选**: 从多个workspace总计${totalRelatedCount}个候选实体中选择了${entities.length}个相关实体\n\n`;
      }

      // 如果用户提供了额外上下文，添加到上下文信息中
      if (additionalContext) {
        contextInfo += `**用户补充**: ${additionalContext}\n\n`;
      }

      // 转换workspace实体的路径为绝对路径
      const entitiesWithAbsolutePaths = convertEntitiesToAbsolutePaths(entities);
      
      // 生成最终的代码提示词（使用转换后的实体）
      const finalPrompt = await generateCodePrompt(userInput, entitiesWithAbsolutePaths, contextInfo.trim() || undefined);

      // 更新会话状态为完成
      conversationService.updateConversation(sessionId, {
        step: 'completed',
        generatedPrompt: finalPrompt
      });

      let result = '';
      
      if (serverConfig.returnDirect) {
        // returnDirect 模式：只返回 finalPrompt
        result = finalPrompt;
      } else {
        // 非 returnDirect 模式：返回完整的格式化内容
        // 多workspace信息统计
        const workspaceGroups = this.multiWorkspaceManager.groupEntitiesByWorkspace(entities);
        const isMultiWorkspace = workspaceGroups.size > 1;
        const displayWorkspaceInfo = workspaceInfo || (isMultiWorkspace ? `多Workspace (${workspaceGroups.size}个)` : '');
        
        result = `# 🎉 代码提示词生成完成

## 📊 分析统计
- 👤 **用户需求**: ${userInput}
- 🧩 **核心组件**: 1个
- 🔗 **相关实体**: ${entities.length - 1}个
- 📦 **总实体数**: ${entities.length}个
- 🎯 **生成模式**: ${mode}
- 🕒 **会话ID**: ${sessionId}${displayWorkspaceInfo ? `
- 📂 **Workspace**: ${displayWorkspaceInfo}` : ''}

## 📋 涉及的代码文件
${isMultiWorkspace ? 
  Array.from(workspaceGroups.entries())
    .map(([workspacePath, workspaceEntities]) => {
      const workspaceName = require('path').basename(workspacePath);
      const files = [...new Set(workspaceEntities.map(e => e.file))];
      return `### 📂 ${workspaceName}\n${files.map(file => `- ${file}`).join('\n')}`;
    }).join('\n\n')
  :
  [...new Set(entitiesWithAbsolutePaths.map((e) => e.file))].map((file) => `- ${file}`).join('\n')
}

---

## 🚀 生成的代码提示词

${finalPrompt}

---

## 🚀 选择下一步

### ⚡ 立即开始编码
直接使用上面的提示词开始编码：

\`\`\`
请帮我实现以下需求：

${finalPrompt}
\`\`\`

### ✏️ 修改提示词后编码
如需修改提示词内容，请：
1. 复制上面的"生成的代码提示词"部分
2. 根据需要进行修改
3. 然后输入："请帮我实现以下需求：[修改后的提示词]"

### 🔄 重新分析
如需重新分析，请使用：
\`\`\`
start-analysis
input: "修改后的需求描述"
\`\`\``;
      }

      return {
        content: [{ type: "text", text: result }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `生成失败: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
} 