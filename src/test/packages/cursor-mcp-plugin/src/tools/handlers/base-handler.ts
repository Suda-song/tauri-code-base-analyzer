import { multiWorkspaceManager } from "../../utils/multi-workspace-utils";

// 工具结果接口，兼容 MCP SDK
export interface ToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  [key: string]: any; // 添加索引签名以兼容 MCP 要求
}

/**
 * 基础处理器类，提供通用功能
 */
export abstract class BaseHandler {
  protected hasEntitiesFile: boolean;
  protected multiWorkspaceManager = multiWorkspaceManager;

  constructor(hasEntitiesFile: boolean) {
    this.hasEntitiesFile = hasEntitiesFile;
  }

  protected checkEntitiesFile(): ToolResult | null {
    // 检查多workspace是否有任何可用的
    if (!this.multiWorkspaceManager.hasAnyWorkspace()) {
      return {
        content: [{
          type: "text",
          text: `❌ 错误: 未找到任何可用的workspace实体文件

请执行以下步骤：
1. 确保在项目根目录运行 MCP 服务器
2. 或先执行 parser-agent 生成实体文件：
   \`\`\`
   pnpm run parser-agent extract
   \`\`\`
3. 然后执行 enrichment-agent 丰富实体信息：
   \`\`\`
   pnpm run enrichment-agent
   \`\`\`

**多workspace配置**: 如果需要配置多个workspace，请设置环境变量：
\`\`\`
export CODE_RESEARCH_WORKSPACE_PATH="/path/to/workspace1,/path/to/workspace2"
\`\`\``
        }]
      };
    }
    
    return null;
  }
} 