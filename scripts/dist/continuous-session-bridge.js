#!/usr/bin/env node
/**
 * 持续会话 Bridge - 基于 AsyncIterable 的真正持续对话
 *
 * 核心原理：
 * 1. 创建 AsyncGenerator 作为消息流
 * 2. 传递给 SDK 的 query({ prompt: generator })
 * 3. SDK 自动管理 session，持续从 generator 读取消息
 * 4. 一次 query() 调用，无限轮对话
 */
import { query, } from "@anthropic-ai/claude-agent-sdk";
import * as readline from "readline";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// 消息队列管理
class MessageQueue {
    constructor() {
        this.queue = [];
    }
    // 添加消息
    push(message) {
        if (this.waiting) {
            this.waiting(message);
            this.waiting = undefined;
        }
        else {
            this.queue.push(message);
        }
    }
    // 获取下一条消息（可能需要等待）
    async next() {
        if (this.queue.length > 0) {
            return Promise.resolve(this.queue.shift());
        }
        return new Promise((resolve) => {
            this.waiting = resolve;
        });
    }
}
async function main() {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("🚀 持续会话 Bridge 启动");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    // 配置
    const workspace = "/tmp/test-workspace";
    const mcpServerPath = path.resolve(__dirname, "../../target/release/codebase-mcp-server");
    // API 配置
    if (!process.env.ANTHROPIC_BASE_URL) {
        process.env.ANTHROPIC_BASE_URL = "https://api.deerapi.com";
    }
    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    if (apiKey) {
        const masked = apiKey.length > 10
            ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
            : "***";
        console.error(`🔑 API Key: ${masked}\n`);
    }
    // 消息队列
    const messageQueue = new MessageQueue();
    let sessionId;
    let turnCount = 0;
    // 👇 核心：消息生成器
    async function* messageGenerator() {
        console.error("📨 消息流已就绪，等待输入...\n");
        while (true) {
            // 等待下一条用户消息
            const content = await messageQueue.next();
            console.error(`\n📤 [轮次 ${turnCount + 1}] 发送: "${content}"`);
            // yield 给 SDK
            yield {
                type: "user",
                message: { role: "user", content },
                session_id: sessionId || "",
                parent_tool_use_id: null,
            };
        }
    }
    // SDK 配置
    const options = {
        cwd: workspace,
        mcpServers: {
            codebase: {
                type: "stdio",
                command: mcpServerPath,
                args: [],
            },
        },
        maxTurns: 50,
        permissionMode: "default",
    };
    console.error("🤖 启动 Claude Agent SDK (持续会话模式)...\n");
    // 👇 关键：使用 AsyncGenerator 作为 prompt
    const response = query({
        prompt: messageGenerator(),
        options,
    });
    // 后台处理响应
    (async () => {
        try {
            for await (const message of response) {
                // 捕获 session
                if (message.type === "system" && message.subtype === "init") {
                    sessionId = message.session_id;
                    console.error(`\n🆔 会话已创建: ${sessionId.substring(0, 8)}...`);
                    console.error(`🤖 模型: ${message.model}`);
                    console.error(`🔧 工具数: ${message.tools.length}\n`);
                }
                // AI 响应
                if (message.type === "assistant") {
                    let fullResponse = "";
                    for (const block of message.message.content) {
                        if (block.type === "text") {
                            fullResponse += block.text;
                        }
                        else if (block.type === "tool_use") {
                            console.error(`  🔧 调用工具: ${block.name}`);
                        }
                    }
                    if (fullResponse) {
                        turnCount++;
                        console.error(`\n📥 [轮次 ${turnCount}] AI 回复:`);
                        console.error(`${fullResponse}\n`);
                    }
                }
                // 结果统计
                if (message.type === "result") {
                    const tokens = message.usage.input_tokens + message.usage.output_tokens;
                    console.error(`✅ 完成 | Token: ${tokens} | 成本: $${message.total_cost_usd.toFixed(4)}\n`);
                }
            }
        }
        catch (error) {
            console.error("\n❌ SDK 错误:", error.message);
        }
    })();
    // 等待初始化
    await new Promise((resolve) => setTimeout(resolve, 1500));
    // 交互式输入
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("💬 开始对话 (输入 exit 退出)");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    rl.on("line", (input) => {
        const trimmed = input.trim();
        if (trimmed === "exit" || trimmed === "quit") {
            console.error("\n👋 再见！\n");
            rl.close();
            process.exit(0);
        }
        if (trimmed === "info") {
            console.error("\n📊 会话信息:");
            console.error(`   Session ID: ${sessionId ? sessionId.substring(0, 8) + "..." : "未创建"}`);
            console.error(`   已对话轮数: ${turnCount}`);
            console.error(`   模式: AsyncIterable (SDK 自动管理)`);
            console.error(`   特点: 无需 resume，SDK 自动维护上下文\n`);
            return;
        }
        if (trimmed) {
            // 将消息加入队列（messageGenerator 会自动读取）
            messageQueue.push(trimmed);
        }
    });
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
