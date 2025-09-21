import { BaseHandler, ToolResult } from "./base-handler";
import { serverConfig } from "../../config/server-config";
import { conversationService } from "../../services/conversation-service";
import { EnrichedEntity } from "@xhs/modular-code-analysis-agent";

export class StartAnalysisHandler extends BaseHandler {
  /**
   * 格式化下一步操作选项
   */
  private formatNextStepsActions(sessionId: string, entities: EnrichedEntity[], input: string, relevanceScores: Record<string, number> = {}): string {
    if (!serverConfig.returnDirect) {
      // 原有的文本格式
      return `## 🎯 请选择您的操作方式

### ⚡ 方式1: 智能关联模式（推荐）
使用最相关的组件 **${entities[0]?.id}** 并智能关联相关实体：
\`\`\`
select-core-component
sessionId: "${sessionId}"
maxRelated: 1
\`\`\`

### 🎯 方式2: 选择特定组件（智能关联）
选择其他组件并智能关联实体：

**选择第2个组件**: ${entities[1]?.id || '无'}
\`\`\`
select-core-component
sessionId: "${sessionId}"
componentId: "${entities[1]?.id || ''}"
maxRelated: 1
\`\`\`

**选择第3个组件**: ${entities[2]?.id || '无'}
\`\`\`
select-core-component
sessionId: "${sessionId}"
componentId: "${entities[2]?.id || ''}"
maxRelated: 1
\`\`\`

**🆕 选择多个组件（新功能）**:
\`\`\`
select-core-component
sessionId: "${sessionId}"
componentId: "${entities.slice(0, 2).map(e => e.id).join(',')}"
maxRelated: 1
\`\`\`

### 🔍 方式3: 手动选择实体模式
选择组件后手动添加/移除实体：

**选择单个组件开始**:
\`\`\`
modify-entity-selection
sessionId: "${sessionId}"
action: "replace"
entityIds: "${entities[0]?.id || ''}"
maxRelated: 3
\`\`\`

**🆕 选择多个组件开始（新功能）**:
\`\`\`
modify-entity-selection
sessionId: "${sessionId}"
action: "replace"
entityIds: "${entities.slice(0, 3).map(e => e.id).join(',')}"
maxRelated: 3
\`\`\`

### 🚀 方式4: 直接出码（仅核心组件）
选择核心组件直接生成代码提示词：

**单个组件出码**:
\`\`\`
generate-code-prompt
sessionId: "${sessionId}"
entityIds: "${entities[0]?.id || ''}"
\`\`\`

**选择其他组件出码**:
\`\`\`
generate-code-prompt
sessionId: "${sessionId}"
entityIds: "${entities[1]?.id || ''}"
\`\`\`

**🆕 多个组件出码（新功能）**:
\`\`\`
generate-code-prompt
sessionId: "${sessionId}"
entityIds: "${entities.slice(0, 2).map(e => e.id).join(',')}"
\`\`\`

### ⚡ 方式5: 一键分析（跳过所有交互）
\`\`\`
quick-analysis
input: "${input}"
componentIndex: 0
includeRelated: true
\`\`\`

### 🔄 方式6: 重新分析需求
如果推荐的组件相关度不高，可以重新分析：
\`\`\`
start-analysis
input: "${input}"
\`\`\`

💡 **使用说明**: 
1. 复制上面任意一个代码块在 Cursor 中执行
2. 方式1-2: 智能关联相关实体（推荐）
3. 方式3: 手动控制实体选择（精确控制）
4. 方式4: 仅用核心组件直接出码（快速）
5. 方式5: 完全自动化（最快）
6. 方式6: 重新分析（相关度不满意时使用）

🎯 **推荐**: 新手使用方式1，老手使用方式4获得最佳效率！
✨ **新功能**: 现在支持多选组件，用逗号分隔多个ID即可！`;
    }

    // JSON 格式，用特殊字符包裹 - 简化为三个核心选项
    const workspaceGroups = this.multiWorkspaceManager.groupEntitiesByWorkspace(entities);
    const actions = {
      type: "next_actions",
      title: "分析完成 - 请选择操作方式",
      sessionId: sessionId,
      workspaceInfo: {
        totalWorkspaces: workspaceGroups.size,
        workspaceDistribution: Array.from(workspaceGroups.entries()).map(([workspacePath, workspaceEntities]) => ({
          workspacePath,
          workspaceName: require('path').basename(workspacePath),
          entityCount: workspaceEntities.length,
          entityIds: workspaceEntities.map(e => e.id),
          relevantEntities: workspaceEntities.slice(0, 5).map(e => ({
            id: e.id,
            type: e.type,
            file: e.file,
            relevanceScore: relevanceScores[e.id] || 0
          }))
        }))
      },
      actions: [
        {
          id: "select_core",
          title: "智能关联模式",
          description: "选择核心组件并智能关联相关实体",
          tool: "select-core-component",
          params: {
            sessionId: sessionId,
            maxRelated: 1
          },
          priority: 1,
          recommended: true,
          // entities: entities.map(entity => ({
          //   id: entity.id,
          //   file: entity.file,
          //   type: entity.type,
          //   summary: entity.summary || '无摘要',
          //   relevanceScore: relevanceScores[entity.id] || 0
          // }))
        },
        {
          id: "modify_selection",
          title: "手动选择模式",
          description: "手动选择和管理实体",
          tool: "modify-entity-selection",
          params: {
            sessionId: sessionId,
            action: "replace",
            maxRelated: 3
          },
          priority: 2,
          // entities: entities.map(entity => ({
          //   id: entity.id,
          //   file: entity.file,
          //   type: entity.type,
          //   summary: entity.summary || '无摘要',
          //   relevanceScore: relevanceScores[entity.id] || 0
          // }))
        },
        {
          id: "direct_generate",
          title: "直接生成代码",
          description: "选择核心组件直接生成代码提示词",
          tool: "generate-code-prompt",
          params: {
            sessionId: sessionId
          },
          priority: 3,
          // entities: entities.map(entity => ({
          //   id: entity.id,
          //   file: entity.file,
          //   type: entity.type,
          //   summary: entity.summary || '无摘要',
          //   relevanceScore: relevanceScores[entity.id] || 0
          // }))
        }
      ],
      entities: entities.map(entity => ({
        id: entity.id,
        file: entity.file,
        type: entity.type,
        summary: entity.summary || '无摘要',
        relevanceScore: relevanceScores[entity.id] || 0
      })),
      metadata: {
        mode: "analysis_complete",
        totalComponents: entities.length,
        userInput: input
      }
    };

    return `≋≋≋ CLINE_ACTIONS_JSON_START ≋≋≋
${JSON.stringify(actions, null, 2)}
≋≋≋ CLINE_ACTIONS_JSON_END ≋≋≋`;
  }

  async handle(input: string, sessionId?: string): Promise<ToolResult> {
    // 检查实体文件是否存在（多workspace支持）
    const fileCheckResult = this.checkEntitiesFile();
    if (fileCheckResult) {
      return fileCheckResult;
    }

    const currentSessionId = sessionId || Date.now().toString();
    const startTime = Date.now();

    // 1. 使用多workspace搜索相关实体，限制为5个核心组件
    const searchResult = await this.multiWorkspaceManager.searchAcrossWorkspaces(input, 10);
    
    // 2. 从分组结果中提取所有实体并按相关度排序
    const allEntities: any[] = [];
    const allRelevanceScores: Record<string, number> = {};
    
    for (const [_, wsResult] of searchResult.workspaceResults) {
      allEntities.push(...wsResult.entities);
      Object.assign(allRelevanceScores, wsResult.relevanceScores);
    }
    
    // 按相关度排序
    const sortedEntities = allEntities
      .sort((a, b) => (allRelevanceScores[b.id] || 0) - (allRelevanceScores[a.id] || 0))
      .slice(0, 10);
    
    // 3. 保存会话状态 - 只保存核心组件信息
    conversationService.setConversation(currentSessionId, {
      sessionId: currentSessionId,
      step: 'select-core',
      userInput: input,
      coreComponents: sortedEntities,
      relevanceScores: allRelevanceScores,
      selectedCoreIndex: 0, // 默认选择第一个
    });

    const duration = (Date.now() - startTime) / 1000;

    // 3. 返回核心组件列表供用户选择（包含workspace信息）
    const workspaceInfo = this.multiWorkspaceManager.getAvailableWorkspaces().length > 1 
      ? `\n**📂 多Workspace模式**: ${this.multiWorkspaceManager.getAvailableWorkspaces().length}个workspace` 
      : '';
    
    const result = `# 🎯 需求分析完成

## 📝 需求描述
**您的需求**: ${input}
**分析耗时**: ${duration.toFixed(2)}秒
**会话ID**: ${currentSessionId}${workspaceInfo}

---

## 🏆 推荐的5个核心组件

${sortedEntities.slice(0, 5).map((entity: any, index: number) => {
  const score = allRelevanceScores[entity.id] || 0;
  const isDefault = index === 0;
  const workspaceLabel = this.multiWorkspaceManager.formatWorkspaceInfo(entity);
  return `### ${index + 1}. ${entity.id} ${isDefault ? '👑 *默认推荐*' : ''} ${workspaceLabel}
- 📁 **文件**: ${entity.file}
- 🏷️ **类型**: ${entity.type}
- 📊 **相关度**: ${score.toFixed(2)}
- 📄 **摘要**: ${entity.summary || '无摘要'}`;
}).join('\n\n')}

---

    ${this.formatNextStepsActions(currentSessionId, sortedEntities, input, allRelevanceScores)}`;

    return {
      content: [{ type: "text", text: result }],
    };
  }
} 