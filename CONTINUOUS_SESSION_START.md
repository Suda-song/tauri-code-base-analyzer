# 🚀 持续会话 - 快速开始

## ✨ 核心特性

- ✅ **一次启动，持续对话** - 启动后 session 一直保持开启
- ✅ **自动管理 session** - SDK 使用 AsyncIterable 自动维护上下文
- ✅ **无需 resume** - 每次输入都在同一个 session 中
- ✅ **AI 完整记忆** - 记住所有历史对话

---

## 🎯 工作原理

```
启动 Bridge:
  创建 AsyncGenerator (消息生成器)
  ↓
  调用 SDK: query({ prompt: generator })
  ↓
  SDK 开始监听 generator

你输入第 1 句话:
  "你好，我叫小明"
  ↓
  generator.yield(消息)
  ↓
  SDK 接收 → 创建 session-abc
  ↓
  AI 回复: "你好小明！"
  ↓
  generator 继续等待...

你输入第 2 句话:
  "我叫什么名字？"
  ↓
  generator.yield(消息)
  ↓
  SDK 接收 → 自动关联到 session-abc
  ↓
  AI 回复: "你叫小明。" ✅ 记住了！
  ↓
  generator 继续等待...

你继续输入...
  还是在同一个 session-abc 中
```

---

## 🚀 快速使用

### 步骤 1: 编译 Bridge

```bash
cd scripts
pnpm run build:continuous
```

### 步骤 2: 直接运行

```bash
node scripts/dist/continuous-session-bridge.js
```

### 步骤 3: 开始对话

```
💬 开始对话 (输入 exit 退出)

你好，我叫小明
📤 [轮次 1] 发送: "你好，我叫小明"

🆔 会话已创建: f8a3c2d1...
📥 [轮次 1] AI 回复:
你好小明！很高兴认识你。

我叫什么名字？
📤 [轮次 2] 发送: "我叫什么名字？"

📥 [轮次 2] AI 回复:
你叫小明。

我是做什么工作的？
📤 [轮次 3] 发送: "我是做什么工作的？"

📥 [轮次 3] AI 回复:
抱歉，你还没有告诉我你是做什么工作的。
```

---

## 💡 可用命令

| 命令             | 功能                           |
| ---------------- | ------------------------------ |
| 正常输入         | 发送消息（自动在同一 session） |
| `info`           | 查看 session 信息              |
| `exit` 或 `quit` | 退出                           |

---

## 🔑 关键代码解析

### 1. 消息生成器

```typescript
async function* messageGenerator() {
  while (true) {
    const content = await getNextInput(); // 等待用户输入

    yield {
      type: "user",
      message: { role: "user", content },
      session_id: "", // SDK 会自动关联
      parent_tool_use_id: null,
    };
  }
}
```

### 2. 传递给 SDK

```typescript
const response = query({
  prompt: messageGenerator(), // 👈 传入生成器
  options: {
    cwd: workspace,
    maxTurns: 50,
  },
});
```

### 3. SDK 自动处理

- SDK 从 generator 读取消息
- 第一条消息创建 session
- 后续消息自动关联到同一 session
- 自动维护完整历史

---

## 📊 对比三种实现

| 方式                      | Session 管理    | 复杂度 | AI 记忆   | 推荐度     |
| ------------------------- | --------------- | ------ | --------- | ---------- |
| **方式 1: 简单模式**      | 每次新 session  | ⭐     | ❌ 不记得 | ⭐         |
| **方式 2: Resume 模式**   | 手动传递 resume | ⭐⭐⭐ | ✅ 记得   | ⭐⭐⭐     |
| **方式 3: AsyncIterable** | SDK 自动管理    | ⭐⭐   | ✅ 记得   | ⭐⭐⭐⭐⭐ |

---

## 🎓 为什么推荐方式 3

### 优势

1. **最符合 SDK 设计** - SDK 原生支持的模式
2. **代码最简洁** - 无需手动管理 session_id
3. **真正的持续会话** - 一次连接，无限轮对话
4. **性能最好** - 无需每次重新建立连接

### 劣势

- 需要理解 AsyncGenerator 概念
- 但我已经帮你封装好了！

---

## 🧪 测试示例

### 测试 AI 记忆

```
你好，我叫小明，我是一个前端工程师

> AI: 你好小明！很高兴认识你。作为前端工程师...

我刚才说我叫什么名字？

> AI: 你叫小明。✅

我是做什么工作的？

> AI: 你是一个前端工程师。✅

帮我分析一下 /path/to/project

> AI: 好的小明，我来帮你分析... ✅ 还记得名字！
```

---

## 🔧 自定义配置

编辑 `scripts/continuous-session-bridge.ts`:

```typescript
const options: Options = {
  cwd: "/your/workspace", // 工作目录

  mcpServers: {
    // 添加你的 MCP 工具
    codebase: {
      type: "stdio",
      command: "/path/to/your/mcp-server",
    },
  },

  maxTurns: 50, // 最大轮数
  permissionMode: "default", // 权限模式

  // 自定义 system prompt
  appendSystemPrompt: `
你是一个专业的代码分析助手。
用户是高级工程师。
  `,
};
```

---

## 📚 相关文档

- [持续会话原理指南](./CONTINUOUS_SESSION_GUIDE.md) - 详细原理
- [持久化对话对比](./PERSISTENT_CHAT_GUIDE.md) - Resume 模式
- [SDK 扩展接口](已创建的 SDK 分析文档) - Hooks 等

---

## 🎉 总结

**这就是你想要的实现方式！**

- ✅ 启动一个 session
- ✅ Session 一直保持开启
- ✅ 输入一句话，在这个 session 中对话
- ✅ 继续输入，继续在同一 session 中对话
- ✅ SDK 自动管理，无需手动干预

立即试用：

```bash
cd scripts
pnpm run build:continuous
node dist/continuous-session-bridge.js
```

享受你的持续对话吧！🚀
