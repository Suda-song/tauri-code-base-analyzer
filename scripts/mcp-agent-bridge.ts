#!/usr/bin/env node
/**
 * MCP Agent Bridge - 使用官方 SDK + MCP 工具
 *
 * 通过 claude-code-router 代理到 DeerAPI
 */

import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import * as readline from "readline";
import { spawn } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// 解决 ES module 中的 __dirname 问题
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface BridgeRequest {
  prompt: string;
  workspace: string;
  max_turns?: number;
  permission_mode?: "default" | "acceptEdits" | "bypassPermissions" | "plan";
}

interface BridgeResponse {
  success: boolean;
  content: string;
  conversation_id: string;
  turn_count: number;
  files_modified: string[];
  tool_uses: Array<{ tool: string; input: any }>;
  agent_info: {
    sdk_version: string;
    model: string;
    total_tokens: number;
  };
  error?: string;
}

class McpAgentBridge {
  private mcpServerPath: string;

  constructor() {
    // MCP 服务器路径（相对于项目根目录）
    this.mcpServerPath = path.resolve(
      __dirname,
      "../../target/release/codebase-mcp-server"
    );

    console.error("🚀 MCP Agent Bridge 初始化");
    console.error(`📦 MCP 服务器路径: ${this.mcpServerPath}`);
  }

  async execute(request: BridgeRequest): Promise<BridgeResponse> {
    console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("📨 收到请求");
    console.error(`  Workspace: ${request.workspace}`);
    console.error(`  Max Turns: ${request.max_turns || 20}`);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    try {
      // 直接连接 DeerAPI（不使用 Router，因为 DeerAPI 已经是标准 Anthropic 格式）
      if (!process.env.ANTHROPIC_BASE_URL) {
        process.env.ANTHROPIC_BASE_URL = "https://api.deerapi.com";
        console.error(
          "🔗 设置 API 端点: https://api.deerapi.com (DeerAPI - 直连)"
        );
      } else {
        console.error(`🔗 使用 API 端点: ${process.env.ANTHROPIC_BASE_URL}`);
      }

      // 显示正在使用的 API Key（脱敏）
      const apiKey = process.env.ANTHROPIC_API_KEY || "";
      if (apiKey) {
        const maskedKey =
          apiKey.length > 10
            ? `${apiKey.substring(0, 8)}...${apiKey.substring(
                apiKey.length - 4
              )}`
            : "***";
        console.error(`🔑 使用 API Key: ${maskedKey}`);
        console.error(`   完整 Key: ${apiKey}`); // 调试用，显示完整 Key
      } else {
        console.error("⚠️  未设置 ANTHROPIC_API_KEY 环境变量");
      }

      console.error();
      // 配置 MCP 服务器
      const mcpServers = {
        codebase: {
          type: "stdio" as const,
          command: this.mcpServerPath,
          args: [],
        },
      };

      console.error("🔧 配置 MCP 服务器");
      console.error(`  - codebase: ${this.mcpServerPath}\n`);

      // 配置 SDK 选项
      // 注意: SDK 会自动从环境变量 ANTHROPIC_API_KEY 读取
      // claude-code-router 会拦截并代理到 DeerAPI
      const options: Options = {
        cwd: request.workspace,
        mcpServers,
        maxTurns: request.max_turns || 20,
        permissionMode: request.permission_mode || "default",
      };

      console.error("🤖 调用 Claude Agent SDK...\n");

      // 调用 SDK
      const response = query({
        prompt: request.prompt,
        options,
      });

      // 收集响应
      let finalContent = "";
      let turnCount = 0;
      let totalTokens = 0;
      const filesModified: string[] = [];
      const toolUses: Array<{ tool: string; input: any }> = [];

      for await (const message of response) {
        console.error(`📩 消息类型: ${message.type}`);

        // 打印原始消息用于调试
        console.error(
          `   原始消息: ${JSON.stringify(message).substring(0, 200)}...`
        );

        if (message.type === "assistant") {
          const assistantMsg = message.message;
          for (const block of assistantMsg.content) {
            if (block.type === "text") {
              finalContent += block.text;
              console.error(
                `  📝 文本内容: ${block.text.substring(0, 100)}...`
              );
            } else if (block.type === "tool_use") {
              console.error(`  🔧 工具调用: ${block.name}`);
              toolUses.push({
                tool: block.name,
                input: block.input,
              });
            }
          }
          turnCount++;
        } else if (message.type === "result") {
          console.error("\n✅ 任务完成");
          console.error(`  轮数: ${message.num_turns}`);
          console.error(
            `  Token: ${
              message.usage.input_tokens + message.usage.output_tokens
            }`
          );
          console.error(`  成本: $${message.total_cost_usd.toFixed(4)}`);

          totalTokens =
            message.usage.input_tokens + message.usage.output_tokens;
          turnCount = message.num_turns;
        } else {
          // 其他消息类型（可能包含错误）
          console.error(
            `  ℹ️  其他消息: ${JSON.stringify(message).substring(0, 200)}...`
          );
        }
      }

      const result: BridgeResponse = {
        success: true,
        content: finalContent || "任务完成",
        conversation_id: "mcp-session-" + Date.now(),
        turn_count: turnCount,
        files_modified: filesModified,
        tool_uses: toolUses,
        agent_info: {
          sdk_version: "0.1.5",
          model: "claude-sonnet-4-5-20250929",
          total_tokens: totalTokens,
        },
      };

      console.error("\n🎉 Bridge 执行成功\n");
      return result;
    } catch (error: any) {
      console.error("\n❌ Bridge 执行失败");
      console.error(`  错误类型: ${error.constructor.name}`);
      console.error(`  错误消息: ${error.message}`);
      console.error(`  错误堆栈:\n${error.stack}`);

      // 如果有更详细的错误信息
      if (error.cause) {
        console.error(`  原因: ${JSON.stringify(error.cause, null, 2)}`);
      }

      // 如果是 SDK 特定错误
      if (error.response) {
        console.error(
          `  HTTP 响应: ${JSON.stringify(error.response, null, 2)}`
        );
      }

      return {
        success: false,
        content: "",
        conversation_id: "",
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
}

async function main() {
  // 读取 stdin
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let inputData = "";
  for await (const line of rl) {
    inputData += line;
  }

  try {
    const request: BridgeRequest = JSON.parse(inputData);
    const bridge = new McpAgentBridge();
    const response = await bridge.execute(request);

    // 输出结果到 stdout
    console.log(JSON.stringify(response));
  } catch (error: any) {
    console.error("❌ 处理失败:", error.message);
    console.log(
      JSON.stringify({
        success: false,
        error: error.message,
      })
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
