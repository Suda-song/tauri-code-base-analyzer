#!/usr/bin/env node
/**
 * 持久化 MCP Agent Bridge - 支持多轮对话（同一 Session）
 *
 * 核心特性：
 * 1. Node.js 进程常驻，不会每次都重启
 * 2. 保存 session_id，使用 SDK 的 resume 功能
 * 3. SDK 自动维护完整的对话历史
 * 4. AI 可以记住之前的所有对话内容
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import * as readline from "readline";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
// 解决 ES module 中的 __dirname 问题
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
class PersistentMcpAgentBridge {
    constructor() {
        // MCP 服务器路径（相对于项目根目录）
        this.mcpServerPath = path.resolve(__dirname, "../../target/release/codebase-mcp-server");
        this.workspace = "/tmp/test-workspace";
        console.error("🚀 持久化 MCP Agent Bridge 初始化");
        console.error(`📦 MCP 服务器路径: ${this.mcpServerPath}`);
        console.error(`🔑 关键特性: 支持多轮对话（同一 Session）\n`);
    }
    async executeQuery(request) {
        console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.error("📨 收到查询请求");
        console.error(`  Workspace: ${request.workspace}`);
        // 确定使用哪个 session_id
        const sessionToResume = request.session_id || this.currentSessionId;
        if (sessionToResume) {
            console.error(`  🔁 继续会话: ${sessionToResume.substring(0, 8)}...`);
        }
        else {
            console.error(`  🆕 创建新会话`);
        }
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        this.workspace = request.workspace;
        try {
            // 设置 API 端点
            if (!process.env.ANTHROPIC_BASE_URL) {
                process.env.ANTHROPIC_BASE_URL = "https://api.deerapi.com";
                console.error("🔗 设置 API 端点: https://api.deerapi.com (DeerAPI - 直连)");
            }
            else {
                console.error(`🔗 使用 API 端点: ${process.env.ANTHROPIC_BASE_URL}`);
            }
            // 显示正在使用的 API Key（脱敏）
            const apiKey = process.env.ANTHROPIC_API_KEY || "";
            if (apiKey) {
                const maskedKey = apiKey.length > 10
                    ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
                    : "***";
                console.error(`🔑 使用 API Key: ${maskedKey}`);
            }
            else {
                console.error("⚠️  未设置 ANTHROPIC_API_KEY 环境变量");
            }
            console.error();
            // 配置 MCP 服务器
            const mcpServers = {
                codebase: {
                    type: "stdio",
                    command: this.mcpServerPath,
                    args: [],
                },
            };
            console.error("🔧 配置 MCP 服务器");
            console.error(`  - codebase: ${this.mcpServerPath}\n`);
            // 配置 SDK 选项 - 关键：使用 resume 恢复会话
            const options = {
                cwd: request.workspace,
                mcpServers,
                maxTurns: request.max_turns || 20,
                permissionMode: request.permission_mode || "default",
                resume: sessionToResume, // 👈 关键：传递 session_id 恢复会话
            };
            if (sessionToResume) {
                console.error(`🔄 使用 resume 功能恢复会话: ${sessionToResume.substring(0, 8)}...\n`);
            }
            console.error("🤖 调用 Claude Agent SDK...\n");
            // 调用 SDK
            const response = query({
                prompt: request.prompt || "",
                options,
            });
            // 收集响应
            let finalContent = "";
            let turnCount = 0;
            let totalTokens = 0;
            let sessionId = this.currentSessionId || "";
            const filesModified = [];
            const toolUses = [];
            for await (const message of response) {
                console.error(`📩 消息类型: ${message.type}`);
                // 捕获 session_id（只有新会话或恢复会话时才会有 init 消息）
                if (message.type === "system" && message.subtype === "init") {
                    sessionId = message.session_id;
                    // 判断是新会话还是恢复会话
                    if (this.currentSessionId && this.currentSessionId === sessionId) {
                        console.error(`  ♻️  会话已恢复: ${sessionId.substring(0, 8)}...`);
                    }
                    else {
                        console.error(`  🆔 新会话已创建: ${sessionId.substring(0, 8)}...`);
                        this.currentSessionId = sessionId; // 保存到实例
                    }
                    console.error(`  📂 工作目录: ${message.cwd}`);
                    console.error(`  🤖 模型: ${message.model}`);
                    console.error(`  🔧 可用工具数: ${message.tools.length}`);
                }
                if (message.type === "assistant") {
                    const assistantMsg = message.message;
                    for (const block of assistantMsg.content) {
                        if (block.type === "text") {
                            finalContent += block.text;
                            const preview = block.text.length > 50
                                ? block.text.substring(0, 50) + "..."
                                : block.text;
                            console.error(`  📝 文本: ${preview}`);
                        }
                        else if (block.type === "tool_use") {
                            console.error(`  🔧 工具调用: ${block.name}`);
                            toolUses.push({
                                tool: block.name,
                                input: block.input,
                            });
                        }
                    }
                    turnCount++;
                }
                else if (message.type === "result") {
                    console.error("\n✅ 任务完成");
                    console.error(`  轮数: ${message.num_turns}`);
                    console.error(`  Token: ${message.usage.input_tokens + message.usage.output_tokens}`);
                    console.error(`  成本: $${message.total_cost_usd.toFixed(4)}`);
                    totalTokens =
                        message.usage.input_tokens + message.usage.output_tokens;
                    turnCount = message.num_turns;
                }
            }
            const result = {
                success: true,
                content: finalContent || "任务完成",
                session_id: sessionId, // 返回 session_id
                turn_count: turnCount,
                files_modified: filesModified,
                tool_uses: toolUses,
                agent_info: {
                    sdk_version: "0.1.5",
                    model: "claude-sonnet-4-5-20250929",
                    total_tokens: totalTokens,
                },
            };
            console.error("\n🎉 Bridge 执行成功");
            console.error(`  💾 Session ID: ${sessionId.substring(0, 8)}...\n`);
            return result;
        }
        catch (error) {
            console.error("\n❌ Bridge 执行失败");
            console.error(`  错误类型: ${error.constructor.name}`);
            console.error(`  错误消息: ${error.message}`);
            console.error(`  错误堆栈:\n${error.stack}`);
            if (error.cause) {
                console.error(`  原因: ${JSON.stringify(error.cause, null, 2)}`);
            }
            if (error.response) {
                console.error(`  HTTP 响应: ${JSON.stringify(error.response, null, 2)}`);
            }
            return {
                success: false,
                content: "",
                session_id: this.currentSessionId || "",
                turn_count: 0,
                files_modified: [],
                tool_uses: [],
                agent_info: {
                    sdk_version: "0.1.5",
                    model: "",
                    total_tokens: 0,
                },
                error: `${error.constructor.name}: ${error.message}`,
            };
        }
    }
    resetSession() {
        console.error("🔄 重置会话");
        if (this.currentSessionId) {
            console.error(`   旧 Session ID: ${this.currentSessionId.substring(0, 8)}...`);
        }
        this.currentSessionId = undefined;
        console.error("   ✅ 会话已清空，下次查询将创建新会话\n");
    }
    getSessionInfo() {
        return {
            session_id: this.currentSessionId,
            workspace: this.workspace,
            has_session: !!this.currentSessionId,
        };
    }
}
async function main() {
    const bridge = new PersistentMcpAgentBridge();
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("🚀 持久化 Agent Bridge 已启动");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("\n💡 支持的命令:");
    console.error("  • query  - 发送查询（自动在同一会话中）");
    console.error("  • reset  - 重置会话");
    console.error("  • info   - 查看会话信息");
    console.error("\n⏳ 等待命令输入...\n");
    // 持续监听输入（每行一个 JSON 请求）
    for await (const line of rl) {
        try {
            const request = JSON.parse(line);
            if (request.command === "query") {
                const response = await bridge.executeQuery(request);
                console.log(JSON.stringify(response));
            }
            else if (request.command === "reset") {
                bridge.resetSession();
                console.log(JSON.stringify({ success: true, message: "Session reset" }));
            }
            else if (request.command === "info") {
                const info = bridge.getSessionInfo();
                console.log(JSON.stringify({ success: true, info }));
            }
            else {
                console.log(JSON.stringify({
                    success: false,
                    error: `Unknown command: ${request.command}`,
                }));
            }
        }
        catch (error) {
            console.error("❌ 处理失败:", error.message);
            console.log(JSON.stringify({ success: false, error: error.message }));
        }
    }
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
