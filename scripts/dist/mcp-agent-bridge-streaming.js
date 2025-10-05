#!/usr/bin/env node
/**
 * 流式会话 MCP Agent Bridge - 使用 AsyncIterable 自动管理会话
 *
 * 核心特性：
 * 1. 使用 SDK 的 AsyncIterable<SDKUserMessage> 模式
 * 2. SDK 自动管理 session，无需手动 resume
 * 3. 一次 query() 调用，支持无限轮对话
 * 4. 真正的持续会话，上下文自动维护
 */
import { query, } from "@anthropic-ai/claude-agent-sdk";
import * as readline from "readline";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
// 解决 ES module 中的 __dirname 问题
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
class StreamingSessionBridge {
    constructor(workspace) {
        this.turnCount = 0;
        this.totalTokens = 0;
        // 消息队列和同步机制
        this.messageQueue = [];
        this.isRunning = false;
        this.mcpServerPath = path.resolve(__dirname, "../../target/release/codebase-mcp-server");
        this.workspace = workspace;
        console.error("🚀 流式会话 Bridge 初始化");
        console.error(`📦 MCP 服务器: ${this.mcpServerPath}`);
        console.error(`📂 工作目录: ${workspace}`);
        console.error(`✨ 模式: AsyncIterable (SDK 自动管理 session)\n`);
    }
    // 启动持续会话
    async start() {
        if (this.isRunning) {
            console.error("⚠️  会话已在运行中");
            return;
        }
        this.isRunning = true;
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.error("🎬 启动流式会话");
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        try {
            // 设置 API 端点
            if (!process.env.ANTHROPIC_BASE_URL) {
                process.env.ANTHROPIC_BASE_URL = "https://api.deerapi.com";
            }
            const apiKey = process.env.ANTHROPIC_API_KEY || "";
            if (apiKey) {
                const maskedKey = apiKey.length > 10
                    ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
                    : "***";
                console.error(`🔑 API Key: ${maskedKey}\n`);
            }
            // 配置 MCP 服务器
            const mcpServers = {
                codebase: {
                    type: "stdio",
                    command: this.mcpServerPath,
                    args: [],
                },
            };
            // 配置 SDK 选项
            const options = {
                cwd: this.workspace,
                mcpServers,
                maxTurns: 50,
                permissionMode: "default",
                // 👇 关键：不使用 resume，让 SDK 通过 AsyncIterable 管理会话
            };
            console.error("🤖 启动 Claude Agent SDK (流式会话模式)...\n");
            // 👇 关键：使用 AsyncIterable<SDKUserMessage>
            const response = query({
                prompt: this.createMessageStream(),
                options,
            });
            // 处理 SDK 响应
            await this.processResponses(response);
        }
        catch (error) {
            console.error("\n❌ 会话失败");
            console.error(`  错误: ${error.message}`);
            this.isRunning = false;
        }
    }
    // 发送消息（会自动在同一 session 中）
    async sendMessage(content) {
        if (!this.isRunning) {
            return {
                success: false,
                content: "",
                session_id: "",
                turn_count: 0,
                total_tokens: 0,
                error: "Session not running",
            };
        }
        return new Promise((resolve) => {
            // 将消息和响应处理器加入队列
            this.messageQueue.push({
                content,
                resolve: () => {
                    // 消息已被 SDK 处理，等待响应
                },
            });
            // 如果 SDK 正在等待消息，立即提供
            if (this.waitingForMessage) {
                const msg = this.messageQueue.shift();
                if (msg) {
                    const userMessage = {
                        type: "user",
                        message: { role: "user", content: msg.content },
                        session_id: this.sessionId || "",
                        parent_tool_use_id: null,
                    };
                    this.waitingForMessage(userMessage);
                    this.waitingForMessage = undefined;
                    msg.resolve();
                }
            }
            // 响应将在 processResponses 中处理
            // 这里我们简化处理，直接返回成功
            setTimeout(() => {
                resolve({
                    success: true,
                    content: "Message queued",
                    session_id: this.sessionId || "",
                    turn_count: this.turnCount,
                    total_tokens: this.totalTokens,
                });
            }, 100);
        });
    }
    // 停止会话
    stop() {
        console.error("\n🛑 停止会话...");
        this.isRunning = false;
    }
    // 👇 关键：创建消息流（AsyncIterable）
    async *createMessageStream() {
        console.error("📨 消息流已就绪，等待用户输入...\n");
        while (this.isRunning) {
            // 等待下一条消息
            const message = await this.getNextMessage();
            yield message;
        }
        console.error("📭 消息流已关闭\n");
    }
    // 获取下一条用户消息
    getNextMessage() {
        // 如果队列中有消息，立即返回
        if (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            msg.resolve();
            const userMessage = {
                type: "user",
                message: { role: "user", content: msg.content },
                session_id: this.sessionId || "",
                parent_tool_use_id: null,
            };
            console.error(`\n📤 发送消息: "${msg.content.substring(0, 50)}..."`);
            return Promise.resolve(userMessage);
        }
        // 否则等待新消息
        return new Promise((resolve) => {
            this.waitingForMessage = resolve;
        });
    }
    // 处理 SDK 响应
    async processResponses(responseStream) {
        let currentResponse = "";
        try {
            for await (const message of responseStream) {
                // 捕获 session_id
                if (message.type === "system" && message.subtype === "init") {
                    this.sessionId = message.session_id;
                    console.error(`\n🆔 会话已创建: ${this.sessionId.substring(0, 8)}...`);
                    console.error(`📂 工作目录: ${message.cwd}`);
                    console.error(`🤖 模型: ${message.model}`);
                    console.error(`🔧 可用工具: ${message.tools.length} 个\n`);
                    // 输出第一条响应（确认会话已启动）
                    this.outputResponse({
                        success: true,
                        content: "",
                        session_id: this.sessionId,
                        turn_count: 0,
                        total_tokens: 0,
                    });
                }
                // 处理 AI 响应
                if (message.type === "assistant") {
                    currentResponse = "";
                    const assistantMsg = message.message;
                    for (const block of assistantMsg.content) {
                        if (block.type === "text") {
                            currentResponse += block.text;
                        }
                        else if (block.type === "tool_use") {
                            console.error(`  🔧 工具调用: ${block.name}`);
                        }
                    }
                    if (currentResponse) {
                        this.turnCount++;
                        console.error(`\n📥 AI 回复 (轮次 ${this.turnCount}):`);
                        console.error(`   ${currentResponse.substring(0, 100)}...`);
                        // 输出响应
                        this.outputResponse({
                            success: true,
                            content: currentResponse,
                            session_id: this.sessionId || "",
                            turn_count: this.turnCount,
                            total_tokens: this.totalTokens,
                        });
                    }
                }
                // 处理结果消息
                if (message.type === "result") {
                    this.totalTokens =
                        message.usage.input_tokens + message.usage.output_tokens;
                    console.error(`\n✅ 轮次完成:`);
                    console.error(`   Token: ${this.totalTokens}`);
                    console.error(`   成本: $${message.total_cost_usd.toFixed(4)}\n`);
                }
            }
        }
        catch (error) {
            console.error("\n❌ 处理响应失败:", error.message);
            this.outputResponse({
                success: false,
                content: "",
                session_id: this.sessionId || "",
                turn_count: this.turnCount,
                total_tokens: this.totalTokens,
                error: error.message,
            });
        }
        finally {
            this.isRunning = false;
            console.error("\n🔚 会话已结束\n");
        }
    }
    // 输出响应到 stdout
    outputResponse(response) {
        console.log(JSON.stringify(response));
    }
}
// 主函数
async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("🚀 流式会话 Bridge 启动");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.error("💡 支持的命令:");
    console.error("  • send <message> - 发送消息");
    console.error("  • stop - 停止会话");
    console.error("\n⏳ 等待命令...\n");
    const workspace = "/tmp/test-workspace";
    const bridge = new StreamingSessionBridge(workspace);
    // 启动会话（异步，不阻塞）
    bridge.start().catch((error) => {
        console.error("Fatal error:", error);
    });
    // 等待会话初始化
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // 监听命令
    for await (const line of rl) {
        try {
            const command = JSON.parse(line);
            if (command.command === "send" && command.content) {
                const response = await bridge.sendMessage(command.content);
                // 响应已在 processResponses 中输出
            }
            else if (command.command === "stop") {
                bridge.stop();
                console.log(JSON.stringify({ success: true, message: "Stopped" }));
                break;
            }
            else {
                console.log(JSON.stringify({
                    success: false,
                    error: `Unknown command: ${command.command}`,
                }));
            }
        }
        catch (error) {
            console.error("❌ 处理命令失败:", error.message);
            console.log(JSON.stringify({ success: false, error: error.message }));
        }
    }
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
