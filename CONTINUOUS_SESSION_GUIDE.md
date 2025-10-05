# 🔄 持续会话实现指南

## 📋 核心原理

基于 Claude Agent SDK 源码分析，发现 SDK 支持**两种调用模式**：

### 模式 1: 单次查询（需要 resume）

```typescript
const response = query({
  prompt: "你好", // 字符串
  options: { resume: sessionId }, // 需要手动传递 session
});
```

### 模式 2: 持续会话（自动管理）⭐

```typescript
const response = query({
  prompt: messageGenerator(), // AsyncIterable<SDKUserMessage>
  options: {}, // 无需 resume！
});
```

---

## 🎯 实现方案

### 核心思路

1. **创建一个异步生成器**，yield 用户消息
2. **传递给 query() 作为 prompt**
3. **SDK 自动维护 session**
4. **持续 yield 新消息 = 持续对话**

### 完整实现

```typescript
import {
  query,
  type SDKUserMessage,
  type Options,
} from "@anthropic-ai/claude-agent-sdk";
import * as readline from "readline";

class ContinuousSession {
  private pendingMessages: string[] = [];
  private resolveNext?: (message: SDKUserMessage) => void;
  private isRunning: boolean = false;
  private sessionId?: string;

  constructor(private options: Options) {}

  // 启动持续会话
  async start() {
    this.isRunning = true;

    // 创建消息生成器
    const messageStream = this.createMessageStream();

    // 启动 SDK（只调用一次）
    const response = query({
      prompt: messageStream, // 👈 传入生成器
      options: this.options,
    });

    // 处理响应
    for await (const message of response) {
      if (message.type === "system" && message.subtype === "init") {
        this.sessionId = message.session_id;
        console.log("✅ 会话已创建:", this.sessionId.substring(0, 8));
      }

      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text") {
            console.log("🤖 AI:", block.text);
          }
        }
      }
    }
  }

  // 发送消息（会在同一 session 中）
  sendMessage(content: string) {
    if (!this.isRunning) {
      console.error("Session not running");
      return;
    }

    // 如果 SDK 正在等待消息，立即提供
    if (this.resolveNext) {
      this.resolveNext({
        type: "user",
        message: { role: "user", content },
        session_id: this.sessionId || "",
        parent_tool_use_id: null,
      });
      this.resolveNext = undefined;
    } else {
      // 否则加入队列
      this.pendingMessages.push(content);
    }
  }

  // 停止会话
  stop() {
    this.isRunning = false;
  }

  // 创建消息流（SDK 会持续读取）
  private async *createMessageStream(): AsyncGenerator<SDKUserMessage> {
    while (this.isRunning) {
      const message = await this.getNextMessage();
      yield message;
    }
  }

  // 获取下一条消息
  private getNextMessage(): Promise<SDKUserMessage> {
    // 如果队列有消息，立即返回
    if (this.pendingMessages.length > 0) {
      const content = this.pendingMessages.shift()!;
      return Promise.resolve({
        type: "user",
        message: { role: "user", content },
        session_id: this.sessionId || "",
        parent_tool_use_id: null,
      });
    }

    // 否则等待新消息
    return new Promise((resolve) => {
      this.resolveNext = resolve;
    });
  }
}

// 使用示例
async function main() {
  const session = new ContinuousSession({
    cwd: "/tmp/workspace",
    mcpServers: {
      codebase: {
        type: "stdio",
        command: "/path/to/mcp-server",
      },
    },
    maxTurns: 50,
  });

  // 启动会话（异步，不阻塞）
  session.start();

  // 等待初始化
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 交互式输入
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("💬 开始对话 (输入 exit 退出):\n");

  rl.on("line", (input) => {
    if (input.trim() === "exit") {
      session.stop();
      rl.close();
      return;
    }

    // 发送消息到同一 session
    session.sendMessage(input);
  });
}

main();
```

---

## 🔑 关键点说明

### 1. AsyncGenerator 是核心

```typescript
async function* messageGenerator() {
  while (true) {
    const message = await getNextUserInput();
    yield {
      type: "user",
      message: { role: "user", content: message },
      session_id: "", // SDK 会自动关联
      parent_tool_use_id: null,
    };
  }
}
```

### 2. 一次 query() 调用

```typescript
// ❌ 错误：每次都调用 query
while (true) {
  const input = await getUserInput();
  query({ prompt: input, options: { resume } }); // 新的调用
}

// ✅ 正确：一次 query，持续 yield
const response = query({
  prompt: messageGenerator(), // 持续提供消息
  options: {},
});
```

### 3. SDK 自动管理 session

- 第一条消息：SDK 创建新 session
- 后续消息：SDK 自动关联到同一 session
- 无需手动传递 resume

---

## 🚀 最简单的实现（推荐）

如果你觉得上面太复杂，这里是**最简单的版本**：

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import * as readline from "readline";

async function continuousChat() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // 消息队列
  const messageQueue: string[] = [];
  let resolveNext: any;

  // 消息生成器
  async function* messages() {
    while (true) {
      // 等待下一条消息
      const content: string = await new Promise((resolve) => {
        if (messageQueue.length > 0) {
          resolve(messageQueue.shift()!);
        } else {
          resolveNext = resolve;
        }
      });

      yield {
        type: "user",
        message: { role: "user", content },
        session_id: "",
        parent_tool_use_id: null,
      };
    }
  }

  // 启动 SDK（只调用一次）
  const response = query({
    prompt: messages(),
    options: {
      cwd: "/tmp/workspace",
      maxTurns: 50,
    },
  });

  // 处理响应（后台运行）
  (async () => {
    for await (const message of response) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text") {
            console.log("🤖:", block.text);
          }
        }
      }
    }
  })();

  // 等待初始化
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 交互式输入
  console.log("开始对话:\n");
  rl.on("line", (input) => {
    if (input === "exit") {
      rl.close();
      return;
    }

    // 添加消息
    if (resolveNext) {
      resolveNext(input);
      resolveNext = undefined;
    } else {
      messageQueue.push(input);
    }
  });
}

continuousChat();
```

---

## 📊 工作流程

```
启动：
  创建 messageGenerator()
  调用 query({ prompt: messageGenerator() })
  SDK 开始监听生成器

用户输入第 1 条消息：
  "你好，我叫小明"
  ↓
  messageGenerator() yield 消息
  ↓
  SDK 接收 → 创建新 session (session-abc)
  ↓
  SDK 发送给 Claude API
  ↓
  SDK 返回响应："你好小明！"
  ↓
  messageGenerator() 等待下一条消息...

用户输入第 2 条消息：
  "我叫什么名字？"
  ↓
  messageGenerator() yield 消息
  ↓
  SDK 接收 → 自动关联到 session-abc
  ↓
  SDK 加载历史对话
  ↓
  SDK 发送完整历史给 Claude API
  ↓
  SDK 返回响应："你叫小明。"  ✅ 记住了！
  ↓
  messageGenerator() 继续等待...

用户输入第 3 条消息：
  ...还是在同一个 session-abc 中
```

---

## ✅ 总结

### 你需要做的：

1. **创建一个 AsyncGenerator**，yield 用户消息
2. **传递给 query() 的 prompt 参数**
3. **在后台处理 SDK 响应**
4. **持续 yield 新消息 = 持续对话**

### SDK 会自动：

- ✅ 创建 session
- ✅ 维护完整历史
- ✅ 关联所有消息到同一 session
- ✅ 无需手动 resume

### 关键代码：

```typescript
// 核心：使用 AsyncGenerator
const response = query({
  prompt: messageGenerator(), // 👈 不是字符串！
  options: {},
});

// messageGenerator 持续 yield 消息
async function* messageGenerator() {
  while (true) {
    const userInput = await getNextInput();
    yield {
      type: "user",
      message: { role: "user", content: userInput },
      session_id: "",
      parent_tool_use_id: null,
    };
  }
}
```

---

## 🎯 实现建议

**最简单的方式**：

1. 使用我上面提供的"最简单的实现"代码
2. 它已经包含了所有必要的逻辑
3. 复制粘贴即可使用
4. 完全利用 SDK 的原生能力

需要我帮你实现一个完整的、可运行的版本吗？🚀
