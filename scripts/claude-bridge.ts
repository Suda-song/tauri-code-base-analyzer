#!/usr/bin/env node

import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";

interface BridgeRequest {
  action: "query" | "query_with_tools";
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: any;
  }>;
}

interface BridgeResponse {
  success: boolean;
  content?: string;
  toolUses?: Array<{
    id: string;
    name: string;
    input: any;
  }>;
  error?: string;
  stopReason?: string;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const error: BridgeResponse = {
      success: false,
      error: "ANTHROPIC_API_KEY environment variable not set",
    };
    console.log(JSON.stringify(error));
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  // 从 stdin 读取请求
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  let inputData = "";

  rl.on("line", (line) => {
    inputData += line;
  });

  rl.on("close", async () => {
    try {
      const request: BridgeRequest = JSON.parse(inputData);
      const response = await handleRequest(client, request);
      console.log(JSON.stringify(response));
      process.exit(0);
    } catch (error: any) {
      const errorResponse: BridgeResponse = {
        success: false,
        error: error.message || "Unknown error",
      };
      console.log(JSON.stringify(errorResponse));
      process.exit(1);
    }
  });
}

async function handleRequest(
  client: Anthropic,
  request: BridgeRequest
): Promise<BridgeResponse> {
  const { action, prompt, systemPrompt, maxTokens = 4096, tools } = request;

  switch (action) {
    case "query":
      return await simpleQuery(client, prompt, systemPrompt, maxTokens);

    case "query_with_tools":
      return await queryWithTools(
        client,
        prompt,
        systemPrompt,
        maxTokens,
        tools || []
      );

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function simpleQuery(
  client: Anthropic,
  prompt: string,
  systemPrompt?: string,
  maxTokens: number = 4096
): Promise<BridgeResponse> {
  const message = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlocks = message.content.filter((block) => block.type === "text");
  const content = textBlocks
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n");

  return {
    success: true,
    content: content,
    stopReason: message.stop_reason || undefined,
  };
}

async function queryWithTools(
  client: Anthropic,
  prompt: string,
  systemPrompt: string | undefined,
  maxTokens: number,
  tools: Array<any>
): Promise<BridgeResponse> {
  const message = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
    tools: tools,
  });

  // 提取文本内容
  const textBlocks = message.content.filter((block) => block.type === "text");
  const textContent = textBlocks
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n");

  // 提取工具调用
  const toolUseBlocks = message.content.filter(
    (block) => block.type === "tool_use"
  );
  const toolUses = toolUseBlocks
    .map((block) => {
      if (block.type === "tool_use") {
        return {
          id: block.id,
          name: block.name,
          input: block.input,
        };
      }
      return null;
    })
    .filter((item) => item !== null) as Array<{
    id: string;
    name: string;
    input: any;
  }>;

  return {
    success: true,
    content: textContent,
    toolUses: toolUses,
    stopReason: message.stop_reason || undefined,
  };
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      success: false,
      error: error.message,
    })
  );
  process.exit(1);
});
