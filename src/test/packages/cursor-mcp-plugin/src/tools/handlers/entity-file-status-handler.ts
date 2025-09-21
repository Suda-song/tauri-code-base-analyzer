import { BaseHandler, ToolResult } from "./base-handler";

/**
 * 实体文件状态管理处理器
 */
export class EntityFileStatusHandler extends BaseHandler {
  constructor(hasEntitiesFile: boolean) {
    super(hasEntitiesFile);
  }

  /**
   * 处理实体文件状态管理
   * @param action 操作类型：'status' 或 'reload'
   * @returns 处理结果
   */
  async handle(action: string): Promise<ToolResult> {
    // 检查多workspace环境
    if (!this.multiWorkspaceManager.hasAnyWorkspace()) {
      return {
        content: [{
          type: "text" as const,
          text: "⚠️ 没有可用的workspace，请先运行 parser-agent 生成实体文件。"
        }]
      };
    }

    try {
      if (action === "status") {
        return await this.getFileStatus();
      } else if (action === "reload") {
        return await this.reloadEntities();
      } else {
        return {
          content: [{
            type: "text" as const,
            text: `❌ 无效的操作类型: ${action}。支持的操作：'status'（查看状态）、'reload'（重新加载）。`
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: `❌ 执行操作时发生错误: ${(error as Error).message}`
        }]
      };
    }
  }

  /**
   * 获取实体文件状态（多workspace支持）
   */
  private async getFileStatus(): Promise<ToolResult> {
    const allFileStatus = this.multiWorkspaceManager.getAllFileStatus();
    
    let statusText = "📁 **多Workspace实体文件状态**\n\n";
    
    // 总体统计
    const totalEntities = allFileStatus.reduce((sum, ws) => sum + ws.status.entityCount, 0);
    statusText += `📂 **总体概览**\n`;
    statusText += `- 🏢 Workspace数量: ${allFileStatus.length}个\n`;
    statusText += `- 📊 总实体数: ${totalEntities} 个\n\n`;

    // 各workspace详情
    allFileStatus.forEach((ws, index) => {
      const { workspacePath, status: fileStatus } = ws;
      const workspaceName = require('path').basename(workspacePath);
      
      statusText += `## 📂 Workspace ${index + 1}: ${workspaceName}\n`;
      statusText += `**路径**: ${workspacePath}\n\n`;
      
      // 基础状态
      statusText += `✅ 文件存在: ${fileStatus.exists ? '是' : '否'}\n`;
      statusText += `🔍 文件可读: ${fileStatus.readable ? '是' : '否'}\n`;
      statusText += `📊 已加载实体数: ${fileStatus.entityCount} 个\n`;

      if (fileStatus.lastModified) {
        statusText += `⏰ 最后更新时间: ${fileStatus.lastModified.toLocaleString()}\n`;
      }
      
      statusText += '\n';
    });
    
    // 获取第一个可用workspace的统计信息作为示例
    const availableWorkspaces = this.multiWorkspaceManager.getAvailableWorkspaces();
    if (availableWorkspaces.length > 0) {
      const firstWorkspacePath = availableWorkspaces[0];
      const firstRagTool = this.multiWorkspaceManager.getRagTool(firstWorkspacePath);
      if (firstRagTool) {
        const statistics = firstRagTool.getStatistics();

      // 实体类型分布
      if (statistics.totalEntities > 0) {
        statusText += "\n📈 **实体类型分布**\n";
        const typeEntries = Object.entries(statistics.entitiesByType)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10); // 显示前10个类型

        for (const [type, count] of typeEntries) {
          statusText += `- ${type}: ${count} 个\n`;
        }

        // 标签分布（前5个）
        statusText += "\n🏷️ **热门标签**\n";
        const tagEntries = Object.entries(statistics.entitiesByTags)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

        for (const [tag, count] of tagEntries) {
          statusText += `- ${tag}: ${count} 次\n`;
        }
      }
    }
    }

    statusText += "\n🔄 **文件监听状态**: 已启用（文件变化时自动重新加载）\n";
    statusText += "\n💡 **提示**: 如果实体文件已更新但未自动重新加载，可以使用 `reload` 操作手动刷新。";

    return {
      content: [{
        type: "text" as const,
        text: statusText
      }]
    };
  }

  /**
   * 手动重新加载实体文件（多workspace支持）
   */
  private async reloadEntities(): Promise<ToolResult> {
    // 获取重新加载前的状态
    const beforeAllStatus = this.multiWorkspaceManager.getAllFileStatus();
    const beforeTotalEntities = beforeAllStatus.reduce((sum, ws) => sum + ws.status.entityCount, 0);
    
    // 重新加载所有workspace
    const success = this.multiWorkspaceManager.reloadAllEntities();

    if (!success) {
      return {
        content: [{
          type: "text" as const,
          text: "❌ 部分workspace重新加载失败。请检查实体文件是否存在且格式正确。"
        }]
      };
    }

    // 获取重新加载后的状态
    const afterAllStatus = this.multiWorkspaceManager.getAllFileStatus();
    const afterTotalEntities = afterAllStatus.reduce((sum, ws) => sum + ws.status.entityCount, 0);

    let resultText = "✅ **多Workspace实体文件重新加载成功**\n\n";
    resultText += `📊 总实体数量变化: ${beforeTotalEntities} → ${afterTotalEntities}\n\n`;

    // 显示各workspace的变化
    resultText += "## 📂 各Workspace变化详情\n\n";
    beforeAllStatus.forEach((beforeWs, index) => {
      const afterWs = afterAllStatus[index];
      if (afterWs) {
        const workspaceName = require('path').basename(beforeWs.workspacePath);
        const beforeCount = beforeWs.status.entityCount;
        const afterCount = afterWs.status.entityCount;
        const change = afterCount - beforeCount;
        const changeSymbol = change > 0 ? '+' : '';
        
        resultText += `### 📂 ${workspaceName}\n`;
        resultText += `- 实体数量: ${beforeCount} → ${afterCount} (${changeSymbol}${change})\n`;
        
        if (afterWs.status.lastModified) {
          resultText += `- 更新时间: ${afterWs.status.lastModified.toLocaleString()}\n`;
        }
        
        resultText += '\n';
      }
    });

    resultText += "🎉 所有workspace实体数据已更新，可以继续使用其他分析工具。";

    return {
      content: [{
        type: "text" as const,
        text: resultText
      }]
    };
  }
} 