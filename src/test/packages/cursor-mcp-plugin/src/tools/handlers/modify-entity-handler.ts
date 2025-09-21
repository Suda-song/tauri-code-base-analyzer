import { BaseHandler, ToolResult } from "./base-handler";
import { Entity } from "../../types";
import { conversationService } from "../../services/conversation-service";
import { enrichedToEntity } from "../../utils/entity-utils";
import { serverConfig } from "../../config/server-config";
import { parseWorkspaceEntities } from "../../utils/workspace-entity-utils";

export class ModifyEntityHandler extends BaseHandler {
  constructor(hasEntitiesFile: boolean) {
    super(hasEntitiesFile);
  }

  /**
   * 处理workspaceEntities格式的实体选择
   */
  private async handleWorkspaceEntities(sessionId: string, workspaceEntityMap: Map<string, string[]>, maxRelated: number, conversation: any, originalWorkspaceEntities: string): Promise<ToolResult> {
    const selectedComponents: any[] = [];
    const startTime = Date.now();
    
    // 根据workspaceEntityMap查找实体
    for (const [workspaceName, entityIds] of workspaceEntityMap) {
      if (!conversation.workspaceResults) {
        return {
          content: [{ type: "text", text: `❌ 没有workspace结果数据，请重新开始分析` }],
        };
      }
      
      // 查找对应的workspace路径
      let targetWorkspacePath: string | null = null;
      let targetWsResult: any = null;
      
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
        const entity = targetWsResult.entities.find((e: any) => e.id === entityId);
        if (entity) {
          const enrichedEntity = enrichedToEntity(entity);
          enrichedEntity.workspacePath = targetWorkspacePath;
          selectedComponents.push(enrichedEntity);
        } else {
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
    
    // 处理相关实体获取（与core-component-handler类似，但使用getRelatedEntities）
    const relatedPromises = selectedComponents.map(component => {
      const targetWorkspacePath = component.workspacePath;
      if (!targetWorkspacePath) {
        throw new Error(`No workspace path available for component ${component.id}`);
      }
      return this.multiWorkspaceManager.getRelatedEntities(component.id, targetWorkspacePath);
    });
    
    const relatedResults = await Promise.all(relatedPromises);
    
    // 按workspace分组处理结果
    const workspaceRelatedEntitiesMap = new Map<string, any>();
    const workspaceAllRelatedEntitiesMap = new Map<string, Entity[]>();
    const workspaceDefaultSelectionMap = new Map<string, Entity[]>();
    const workspaceAiReasoningMap = new Map<string, string>();

    // 按workspace分组处理relatedResults
    const workspaceComponentMap = new Map<string, any[]>();
    selectedComponents.forEach(component => {
      const workspacePath = component.workspacePath!;
      if (!workspaceComponentMap.has(workspacePath)) {
        workspaceComponentMap.set(workspacePath, []);
      }
      workspaceComponentMap.get(workspacePath)!.push(component);
    });

    let componentIndex = 0;
    for (const [workspacePath, components] of workspaceComponentMap) {
      
      let workspaceRelatedEntities: Entity[] = [];
      let workspaceLimitedRelatedEntities = {
        imports: [] as Entity[],
        calls: [] as Entity[],
        templates: [] as Entity[],
        similar: [] as Entity[]
      };

      for (const _ of components) {
        const relatedResult = relatedResults[componentIndex++];
        if (relatedResult) {
          // 限制每种类型的相关实体数量
          const limitedRelated = {
            imports: relatedResult.relatedEntities.imports.slice(0, maxRelated).map(enrichedToEntity),
            calls: relatedResult.relatedEntities.calls.slice(0, maxRelated).map(enrichedToEntity),
            templates: relatedResult.relatedEntities.templates.slice(0, maxRelated).map(enrichedToEntity),
            similar: relatedResult.relatedEntities.similar.slice(0, maxRelated).map(enrichedToEntity),
          };
          
          workspaceRelatedEntities.push(...limitedRelated.imports, ...limitedRelated.calls, ...limitedRelated.templates, ...limitedRelated.similar);
          
          // 合并候选实体
          workspaceLimitedRelatedEntities.imports.push(...limitedRelated.imports);
          workspaceLimitedRelatedEntities.calls.push(...limitedRelated.calls);
          workspaceLimitedRelatedEntities.templates.push(...limitedRelated.templates);
          workspaceLimitedRelatedEntities.similar.push(...limitedRelated.similar);
        }
      }

      // 去重workspace内的相关实体
      const uniqueWorkspaceRelatedEntities = workspaceRelatedEntities.filter((entity, index, array) => 
        array.findIndex(e => e.id === entity.id) === index
      );

      // 去重workspace内的候选实体
      workspaceLimitedRelatedEntities.imports = workspaceLimitedRelatedEntities.imports.filter((entity, index, array) => 
        array.findIndex(e => e.id === entity.id) === index
      );
      workspaceLimitedRelatedEntities.calls = workspaceLimitedRelatedEntities.calls.filter((entity, index, array) => 
        array.findIndex(e => e.id === entity.id) === index
      );
      workspaceLimitedRelatedEntities.templates = workspaceLimitedRelatedEntities.templates.filter((entity, index, array) => 
        array.findIndex(e => e.id === entity.id) === index
      );
      workspaceLimitedRelatedEntities.similar = workspaceLimitedRelatedEntities.similar.filter((entity, index, array) => 
        array.findIndex(e => e.id === entity.id) === index
      );

      // 保存workspace级别的数据
      workspaceRelatedEntitiesMap.set(workspacePath, workspaceLimitedRelatedEntities);
      workspaceAllRelatedEntitiesMap.set(workspacePath, uniqueWorkspaceRelatedEntities);
      workspaceDefaultSelectionMap.set(workspacePath, [...components]);
      workspaceAiReasoningMap.set(workspacePath, `手动选择了${components.length}个组件，自动关联了${uniqueWorkspaceRelatedEntities.length}个相关实体`);
    }

    // 更新会话状态（只保存workspace级别的数据）
    conversationService.updateConversation(sessionId, { 
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
    
    let result = `# ✅ 跨Workspace实体选择完成

## 📊 选择统计
- 🎯 **选中组件**: ${selectedComponents.length}个 (跨${workspaceGroups.size}个workspace)
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

${components.map((comp: any, i: number) => {
  return `#### ${i + 1}. ${comp.id} 🎯
- 📁 **文件**: ${comp.file}
- 🏷️ **类型**: ${comp.type}
- 📄 **摘要**: ${comp.summary || '无摘要'}`;
}).join('\n\n')}

${workspaceRelatedEntities.length > 0 ? `### 🔗 关联的实体

${workspaceRelatedEntities.map((entity: any, i: number) => {
  return `${i + 1}. **${entity.id}** (${entity.type})
   📁 ${entity.file}
   📄 ${entity.summary || '无摘要'}`;
}).join('\n\n')}` : ''}

### 📝 处理信息

${workspaceAiReasoning}

---

`;
    }

    result += this.formatNextStepsActions(sessionId, originalWorkspaceEntities, workspaceAllRelatedEntitiesMap, workspaceDefaultSelectionMap);

    return {
      content: [{ type: "text", text: result }],
    };
  }

  /**
   * 格式化下一步操作选项
   */
  private formatNextStepsActions(
    sessionId: string, 
    workspaceEntities: string, 
    workspaceAllRelatedEntitiesMap: Map<string, Entity[]>,
    workspaceDefaultSelectionMap: Map<string, Entity[]>
  ): string {
    if (!serverConfig.returnDirect) {
      // 原有的文本格式
      return `---

## 🚀 下一步选择

### ⚡ 选择1: 生成代码提示词
满意当前选择？生成最终的代码提示词：
\`\`\`
generate-code-prompt
sessionId: "${sessionId}"
workspaceEntities: "${workspaceEntities}"
\`\`\`

### 🔧 选择2: 调整实体选择
继续调整实体选择：
\`\`\`
modify-entity-selection
sessionId: "${sessionId}"
workspaceEntities: "${workspaceEntities}"
\`\`\`

💡 **提示**: 
- 复制workspaceEntities参数进行调整
- 格式: "workspace1:entity1,entity2;workspace2:entity3,entity4"`;
    }

    // JSON 格式 - 包含所有可选实体和已选择标示
    const actions = {
      type: "next_actions",
      title: "实体选择管理 - 跨Workspace操作",
      sessionId: sessionId,
      workspaceResults: Array.from(workspaceAllRelatedEntitiesMap.entries()).map(([workspacePath, allEntities]) => {
        const selectedEntities = workspaceDefaultSelectionMap.get(workspacePath) || [];
        const selectedEntityIds = new Set(selectedEntities.map((e: Entity) => e.id));
        
        return {
          workspacePath,
          workspaceName: require('path').basename(workspacePath),
          totalEntityCount: allEntities.length,
          // 所有可选实体（包含选择状态）
          entities: [...selectedEntities, ...allEntities].map((entity: Entity) => ({
            id: entity.id,
            type: entity.type,
            file: entity.file,
            summary: entity.summary || '无摘要',
            ...(entity.projectDesc && { projectDesc: entity.projectDesc }),
            ...(entity.publishTag && { publishTag: entity.publishTag }),
            isSelected: selectedEntityIds.has(entity.id)
          }))
        };
      }),
      actions: [
        {
          id: "generate_code_prompt",
          title: "生成代码提示词",
          description: "满意当前选择？生成最终的代码提示词",
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
          title: "继续调整选择",
          description: "继续调整实体选择",
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
        mode: "manual_entity_selection",
        totalWorkspaces: workspaceAllRelatedEntitiesMap.size,
        totalEntities: Array.from(workspaceAllRelatedEntitiesMap.values()).reduce((sum, entities: Entity[]) => sum + entities.length, 0),
        totalSelectedEntities: Array.from(workspaceDefaultSelectionMap.values()).reduce((sum, entities: Entity[]) => sum + entities.length, 0)
      }
    };

    return `\n\n≋≋≋ CLINE_ACTIONS_JSON_START ≋≋≋
${JSON.stringify(actions, null, 2)}
≋≋≋ CLINE_ACTIONS_JSON_END ≋≋≋`;
  }

  async handle(sessionId: string, maxRelated: number = 3, workspaceEntities?: string): Promise<ToolResult> {
    try {
      const conversation = conversationService.getConversation(sessionId);
      if (!conversation) {
        return {
          content: [{ type: "text", text: `❌ 未找到会话 ${sessionId}，请重新开始分析` }],
        };
      }

      // 处理workspaceEntities参数（统一格式）
      if (!workspaceEntities) {
        return {
          content: [{ type: "text", text: `❌ 请提供workspaceEntities参数` }],
        };
      }

      const workspaceEntityMap = parseWorkspaceEntities(workspaceEntities);
      return this.handleWorkspaceEntities(sessionId, workspaceEntityMap, maxRelated, conversation, workspaceEntities);
    } catch (error) {
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