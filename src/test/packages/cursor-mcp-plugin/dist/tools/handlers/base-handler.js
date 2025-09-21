"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseHandler = void 0;
const multi_workspace_utils_1 = require("../../utils/multi-workspace-utils");
/**
 * 基础处理器类，提供通用功能
 */
class BaseHandler {
    constructor(hasEntitiesFile) {
        this.multiWorkspaceManager = multi_workspace_utils_1.multiWorkspaceManager;
        this.hasEntitiesFile = hasEntitiesFile;
    }
    checkEntitiesFile() {
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
exports.BaseHandler = BaseHandler;
