# 真实 Claude Agent SDK 架构文档

## 📚 概述

本项目现已**真正集成**官方 `@anthropic-ai/claude-agent-sdk@0.1.5`，通过 Rust-Node.js 桥接实现完整的 AI Agent 功能。

## 🎯 关键区别

### ❌ 之前的实现（基于理念）

- 使用 `@anthropic-ai/sdk` (标准 Claude API)
- 手动实现 Agent 工作循环
- 自己管理工具调用和权限
- 模拟 Agent SDK 的理念

### ✅ 现在的实现（真正的 SDK）

- 使用 `@anthropic-ai/claude-agent-sdk@0.1.5` (官方 Agent SDK)
- SDK 内置 Agent 循环
- SDK 管理工具和权限
- 真正的 Claude Code 能力

## 🏗️ 完整架构图

```
┌─────────────────────────────────────────────────────────────┐
│                  Rust Application Layer                      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │     AgentSdkCodingAgent (真正使用 SDK)             │    │
│  │  - 任务管理                                        │    │
│  │  - 模式切换 (Analysis/Code/Edit/Debug/Refactor)   │    │
│  │  - 权限配置                                        │    │
│  └─────────────────┬──────────────────────────────────┘    │
│                    │                                         │
│  ┌─────────────────▼──────────────────────────────────┐    │
│  │     RealAgentSdkWrapper (Rust-Node.js Bridge)      │    │
│  │  - JSON 序列化/反序列化                             │    │
│  │  - 进程管理 (Node.js child process)                │    │
│  │  - 响应流处理                                       │    │
│  └─────────────────┬──────────────────────────────────┘    │
└────────────────────┼──────────────────────────────────────┘
                     │
                     │ IPC (stdin/stdout)
                     │
┌────────────────────▼──────────────────────────────────────┐
│              Node.js Bridge Process                        │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │   RealClaudeAgentSdkBridge                       │    │
│  │  - 配置 SDK Options                               │    │
│  │  - 调用 query() 函数                              │    │
│  │  - 处理响应流 (AsyncGenerator)                    │    │
│  │  - 追踪工具使用                                   │    │
│  └─────────────────┬────────────────────────────────┘    │
│                    │                                       │
│  ┌─────────────────▼────────────────────────────────┐    │
│  │    @anthropic-ai/claude-agent-sdk@0.1.5          │    │
│  │  ✅ 官方 Agent SDK                                │    │
│  │  - query() 函数 (核心 API)                        │    │
│  │  - Agent 自主循环                                  │    │
│  │  - 工具管理 (read_file, write_file, edit_file,   │    │
│  │    bash, 等)                                      │    │
│  │  - 权限系统 (PermissionMode)                      │    │
│  │  - MCP 支持                                       │    │
│  │  - 会话管理                                       │    │
│  └─────────────────┬────────────────────────────────┘    │
└────────────────────┼──────────────────────────────────────┘
                     │
                     │ HTTPS
                     │
┌────────────────────▼──────────────────────────────────────┐
│                  Claude API                                │
│  - claude-3-5-sonnet-20241022                             │
│  - 支持 Tool Use                                          │
│  - Extended Thinking                                       │
└────────────────────────────────────────────────────────────┘
```

## 📊 数据流详解

### 1. 请求流程

```
用户 Rust 代码
  ↓
  调用 AgentSdkCodingAgent::generate_code()
  ↓
  封装为 RealAgentSdkBridgeRequest {
    action: "code",
    prompt: "创建一个计算器",
    workspace: "/path/to/project",
    files: [],
    allowed_tools: ["Read", "Write"],
    permissions: {...},
    max_turns: 10,
    ...
  }
  ↓
  RealAgentSdkWrapper::execute()
  ↓
  启动 Node.js 子进程
  ↓
  通过 stdin 发送 JSON
  ↓
  Node.js: RealClaudeAgentSdkBridge::handleRequest()
  ↓
  配置 SDK Options {
    cwd: workspace,
    maxTurns: 10,
    permissionMode: "bypassPermissions",
    systemPrompt: "你是代码生成专家...",
    allowedTools: ["read_file", "write_file"],
  }
  ↓
  调用 query({ prompt, options })
  ↓
  SDK 内部调用 Claude API
  ↓
  Claude 返回 Tool Use
  ↓
  SDK 自动执行工具
  ↓
  迭代循环...
  ↓
  SDK 返回最终结果
```

### 2. 响应流程

```
SDK query() 返回 AsyncGenerator<SDKMessage>
  ↓
  遍历消息流 for await (const message of query)
  ↓
  处理不同类型的消息:
    - type: "system" → 系统初始化
    - type: "assistant" → Claude 回复
    - type: "user" → 用户消息（可能是合成的）
    - type: "result" → 最终结果
    - type: "stream_event" → 流式事件
  ↓
  提取关键信息:
    - content (文本内容)
    - tool_uses (工具调用记录)
    - files_modified (修改的文件)
    - usage (Token 使用)
    - cost (成本)
  ↓
  构建 RealAgentSdkBridgeResponse
  ↓
  通过 stdout 返回 JSON
  ↓
  Rust: 解析 JSON
  ↓
  返回给用户
```

## 🔧 核心组件

### 1. 官方 SDK 核心 API

#### query() 函数

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const response = query({
  prompt: "你的任务...",
  options: {
    cwd: "/path/to/project",
    maxTurns: 10,
    permissionMode: "default",
    systemPrompt: "自定义系统提示",
    allowedTools: ["read_file", "write_file", "bash"],
    disallowedTools: ["dangerous_tool"],
  },
});

// response 是 AsyncGenerator<SDKMessage>
for await (const message of response) {
  console.log(message);
}
```

#### Options 配置

```typescript
type Options = {
  cwd?: string;                    // 工作目录
  maxTurns?: number;               // 最大轮数
  permissionMode?: PermissionMode; // 权限模式
  systemPrompt?: string;           // 系统提示
  allowedTools?: string[];         // 允许的工具
  disallowedTools?: string[];      // 禁止的工具
  mcpServers?: Record<string, McpServerConfig>; // MCP 服务器
  model?: string;                  // 模型名称
  maxThinkingTokens?: number;      // 思考 tokens
  ...
};
```

#### PermissionMode

```typescript
type PermissionMode =
  | "default" // 默认，需要用户确认
  | "acceptEdits" // 自动接受编辑
  | "bypassPermissions" // 绕过所有权限检查
  | "plan"; // 仅计划，不执行
```

### 2. SDKMessage 类型

```typescript
type SDKMessage =
  | SDKSystemMessage      // 系统消息（初始化）
  | SDKUserMessage        // 用户消息
  | SDKAssistantMessage   // Claude 助手消息
  | SDKResultMessage      // 最终结果
  | SDKPartialAssistantMessage // 流式事件
  | ...;

// 系统初始化消息
type SDKSystemMessage = {
  type: "system";
  subtype: "init";
  model: string;
  cwd: string;
  tools: string[];
  mcp_servers: Array<{name: string; status: string}>;
  permissionMode: PermissionMode;
  ...
};

// 助手消息
type SDKAssistantMessage = {
  type: "assistant";
  message: {
    content: Array<
      | {type: "text"; text: string}
      | {type: "tool_use"; name: string; input: any}
    >;
    ...
  };
  ...
};

// 结果消息
type SDKResultMessage = {
  type: "result";
  subtype: "success" | "error_max_turns" | "error_during_execution";
  num_turns: number;
  duration_ms: number;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    ...
  };
  result?: string; // 仅 success 时有
  permission_denials: Array<{
    tool_name: string;
    tool_use_id: string;
    tool_input: Record<string, unknown>;
  }>;
  ...
};
```

### 3. 内置工具

SDK 内置以下工具：

| 工具名           | 功能     | 输入                                                 |
| ---------------- | -------- | ---------------------------------------------------- |
| `read_file`      | 读取文件 | `{path: string}`                                     |
| `write_file`     | 写入文件 | `{path: string; content: string}`                    |
| `edit_file`      | 编辑文件 | `{path: string; old_text: string; new_text: string}` |
| `bash`           | 执行命令 | `{command: string}`                                  |
| `list_directory` | 列出目录 | `{path: string}`                                     |
| `search_files`   | 搜索文件 | `{pattern: string}`                                  |
| ...等            |          |                                                      |

### 4. MCP (Model Context Protocol) 支持

```typescript
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";

// 创建自定义工具
const customTool = tool(
  "my_tool",
  "工具描述",
  {
    param1: { type: "string" },
  },
  async (args) => {
    // 工具实现
    return { content: "结果" };
  }
);

// 创建 MCP 服务器
const mcpServer = createSdkMcpServer({
  name: "my-server",
  version: "1.0.0",
  tools: [customTool],
});

// 在 options 中使用
const response = query({
  prompt: "...",
  options: {
    mcpServers: {
      "my-server": mcpServer,
    },
  },
});
```

## 🆚 三种实现对比

| 特性       | ClaudeClient                 | Enhanced Bridge      | **Real Agent SDK** ⭐ |
| ---------- | ---------------------------- | -------------------- | --------------------- |
| API        | ❌ 标准 Messages API         | ❌ 标准 Messages API | ✅ Agent SDK API      |
| Agent 循环 | ❌ 无                        | ✅ 手动实现          | ✅ SDK 内置           |
| 工具管理   | ❌ 无                        | ✅ 手动实现          | ✅ SDK 内置           |
| 权限系统   | ❌ 无                        | ✅ 简单实现          | ✅ SDK 完整实现       |
| MCP 支持   | ❌ 无                        | ❌ 无                | ✅ 完整支持           |
| 会话管理   | ❌ 无                        | ✅ 基础              | ✅ SDK 完整           |
| 适用场景   | 简单 API 调用<br/>Enrichment | 中等复杂任务         | **复杂 Agent 任务**   |

## 📂 文件结构

```
scripts/
├── real-agent-sdk-bridge.ts         # ✅ 真正使用 SDK 的 bridge
├── agent-sdk-bridge.ts              # ❌ 基于理念的 bridge (旧)
├── enhanced-claude-bridge.ts        # ❌ 基于理念的 bridge (旧)
├── claude-bridge.ts                 # ❌ 简单 bridge (旧)
├── dist/
│   ├── real-agent-sdk-bridge.js     # ✅ 编译后的真正 SDK bridge
│   ├── agent-sdk-bridge.js
│   ├── enhanced-claude-bridge.js
│   └── claude-bridge.js
└── package.json

src-tauri/src/
├── agent_sdk_wrapper.rs             # ❌ 旧 wrapper (基于理念)
├── real_agent_sdk_wrapper.rs        # ✅ 真正的 SDK wrapper (待创建)
├── enhanced_claude_wrapper.rs       # ❌ 旧 wrapper
├── agent_core/
│   ├── agent_sdk_coding_agent.rs    # ❌ 旧 agent (基于理念)
│   ├── real_agent_sdk_coding_agent.rs # ✅ 真正的 SDK agent (待创建)
│   ├── enhanced_coding_agent.rs     # ❌ 旧 agent
│   └── mod.rs
└── claude_client/                   # ✅ 保留 (用于 enrichment)
    ├── client.rs
    ├── types.rs
    └── error.rs
```

## 🎯 使用示例

### Rust 代码

```rust
use tauri_code_base_analyzer::agent_core::{
    RealAgentSdkCodingAgent, RealAgentSdkMode
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. 创建 Agent (真正使用 SDK)
    let mut agent = RealAgentSdkCodingAgent::new(
        "/path/to/project".to_string()
    )?;

    // 2. 设置模式
    agent.set_mode(RealAgentSdkMode::Code);

    // 3. 执行任务 (SDK 自动管理整个流程)
    let response = agent.generate_code(
        "创建一个 HTTP 客户端模块".to_string()
    ).await?;

    // 4. 查看结果
    println!("✅ 完成!");
    println!("内容: {}", response.content);
    println!("文件: {:?}", response.files_modified);
    println!("Token: {}", response.agent_info.total_tokens);
    println!("成本: ${:.4}", response.agent_info.total_cost_usd);

    Ok(())
}
```

### Node.js Bridge 内部

```typescript
// 真正调用 SDK
const response = query({
  prompt: enhancedPrompt,
  options: {
    cwd: workspace,
    maxTurns: 10,
    permissionMode: "bypassPermissions",
    systemPrompt: "你是代码生成专家...",
    allowedTools: ["read_file", "write_file"],
  },
});

// 处理 SDK 返回的消息流
for await (const message of response) {
  if (message.type === "assistant") {
    // Claude 的回复
    console.log(message.message.content);
  } else if (message.type === "result") {
    // 最终结果
    console.log(`成本: $${message.total_cost_usd}`);
    console.log(
      `Token: ${message.usage.input_tokens + message.usage.output_tokens}`
    );
  }
}
```

## 🔒 权限管理

### Permission Modes

```typescript
// 1. default - 需要用户确认每个工具使用
permissionMode: "default";

// 2. acceptEdits - 自动接受所有编辑操作
permissionMode: "acceptEdits";

// 3. bypassPermissions - 完全绕过权限检查 (我们的默认)
permissionMode: "bypassPermissions";

// 4. plan - 仅规划，不实际执行
permissionMode: "plan";
```

### 工具控制

```typescript
options: {
  // 白名单
  allowedTools: ["read_file", "write_file", "edit_file"],

  // 黑名单
  disallowedTools: ["bash", "dangerous_tool"],
}
```

## 💡 核心优势

### 1. ✅ 真正的 Agent 能力

- SDK 内置的智能循环
- 自主决策和执行
- 上下文感知

### 2. ✅ 生产级功能

- 完善的错误处理
- 会话持久化
- Token 和成本追踪
- 权限系统

### 3. ✅ 可扩展性

- MCP 协议支持
- 自定义工具
- Hooks 系统

### 4. ✅ 官方支持

- 来自 Anthropic
- 持续更新
- 完整文档

## 📊 成本和性能

### Token 追踪

```typescript
{
  usage: {
    input_tokens: 1234,
    output_tokens: 567,
    cache_read_input_tokens: 100,  // 缓存命中
    cache_creation_input_tokens: 50, // 缓存创建
  },
  total_cost_usd: 0.0234,
  modelUsage: {
    "claude-3-5-sonnet-20241022": {
      inputTokens: 1234,
      outputTokens: 567,
      costUSD: 0.0234,
      ...
    }
  }
}
```

### 性能指标

```typescript
{
  duration_ms: 5432,        // 总耗时
  duration_api_ms: 4321,    // API 耗时
  num_turns: 3,             // 对话轮数
}
```

## 🚀 下一步

1. ✅ SDK 安装和构建完成
2. ⏳ 创建 Rust wrapper (`real_agent_sdk_wrapper.rs`)
3. ⏳ 创建 Rust agent (`real_agent_sdk_coding_agent.rs`)
4. ⏳ 更新示例代码
5. ⏳ 完整测试

## 📚 相关资源

- [Claude Agent SDK 官方文档](https://docs.anthropic.com/en/docs/claude-code/sdk)
- [GitHub: anthropics/claude-code](https://github.com/anthropics/claude-code)
- [npm: @anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)

---

**集成时间**: 2025-10-03  
**SDK 版本**: @anthropic-ai/claude-agent-sdk@0.1.5  
**状态**: ✅ Bridge 已完成，Rust 层待实现
