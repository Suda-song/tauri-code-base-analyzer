# 🔄 持久化多轮对话实现指南

## 📋 概述

我们实现了两种多轮对话模式：

| 模式           | 文件                                                         | Session 管理      | 对话历史    | 适用场景 |
| -------------- | ------------------------------------------------------------ | ----------------- | ----------- | -------- |
| **独立模式**   | `simple_chat_test.rs` + `mcp-agent-bridge.ts`                | ❌ 每次都是新的   | ❌ 不记得   | 单次任务 |
| **持久化模式** | `persistent_chat_test.rs` + `mcp-agent-bridge-persistent.ts` | ✅ 同一个 Session | ✅ 完整记忆 | 多轮对话 |

---

## 🆕 新增文件

### 1. `scripts/mcp-agent-bridge-persistent.ts`

**核心特性：**

- 🔄 **常驻进程** - 不会每次都重启
- 💾 **保存 session_id** - 维护当前会话状态
- 🔁 **使用 SDK resume** - 自动恢复对话历史
- 📝 **三种命令支持**：
  - `query` - 发送查询（自动在同一会话中）
  - `reset` - 重置会话
  - `info` - 查看会话信息

**关键实现：**

```typescript
class PersistentMcpAgentBridge {
  private currentSessionId: string | undefined; // 保存当前 session_id

  async executeQuery(request: BridgeRequest) {
    const options: Options = {
      // ...
      resume: request.session_id || this.currentSessionId, // 👈 传递 session_id
    };

    for await (const message of response) {
      if (message.type === "system" && message.subtype === "init") {
        this.currentSessionId = message.session_id; // 👈 保存返回的 session_id
      }
    }
  }
}
```

### 2. `src-tauri/examples/persistent_chat_test.rs`

**核心特性：**

- 🚀 **启动常驻 Bridge** - 只启动一次
- 💬 **多次查询** - 复用同一个进程
- 🆔 **维护 session_id** - 每次查询都传递
- 📊 **会话信息查看** - 随时查看 Session 状态

**关键实现：**

```rust
struct PersistentAgentBridge {
    child: Child,                    // Node.js 子进程
    session_id: Option<String>,      // 当前 session_id
}

impl PersistentAgentBridge {
    fn send_message(&mut self, prompt: &str, workspace: &str) -> Result<...> {
        let request = serde_json::json!({
            "command": "query",
            "session_id": self.session_id,  // 👈 传递 session_id
            // ...
        });

        // 发送到 Bridge（复用同一个进程）
        writeln!(stdin, "{}", serde_json::to_string(&request)?)?;

        // 更新 session_id
        if let Some(sid) = response["session_id"].as_str() {
            self.session_id = Some(sid.to_string());  // 👈 保存返回的 session_id
        }
    }
}
```

### 3. `scripts/test-persistent-chat.sh`

一键启动脚本，自动完成：

1. 编译持久化 Bridge
2. 编译 MCP 服务器
3. 运行测试

---

## 🔄 工作流程对比

### ❌ 旧实现（独立模式）

```
第 1 轮对话：
你 > 你好，我叫小明
    ↓
启动新的 Node.js 进程 → 创建新 Session (sid-1)
    ↓
AI > 你好小明！
    ↓
进程结束，Session 丢失

第 2 轮对话：
你 > 我叫什么名字？
    ↓
启动新的 Node.js 进程 → 创建新 Session (sid-2)  ⚠️ 又是新的！
    ↓
AI > 我不知道你叫什么名字。❌ 不记得了！
    ↓
进程结束
```

**问题：**

- ❌ 每次都启动新进程
- ❌ 每次都是新 Session
- ❌ AI 不记得之前的对话

---

### ✅ 新实现（持久化模式）

```
启动：
Node.js Bridge 启动（常驻）→ 等待命令

第 1 轮对话：
你 > 你好，我叫小明
    ↓
发送 query 命令（session_id: None）
    ↓
SDK 创建 Session (sid-abc123)
    ↓
AI > 你好小明！
    ↓
保存 session_id: "sid-abc123"
    ↓
进程继续运行 ✅

第 2 轮对话：
你 > 我叫什么名字？
    ↓
发送 query 命令（session_id: "sid-abc123"）👈 传递之前的 session_id
    ↓
SDK 加载 Session "sid-abc123" 的历史：
  - User: "你好，我叫小明"
  - Assistant: "你好小明！"
  - User: "我叫什么名字？"
    ↓
AI > 你叫小明。✅ 记住了！
    ↓
进程继续运行 ✅

第 3 轮对话：
你 > 帮我分析 /path/to/project
    ↓
发送 query 命令（session_id: "sid-abc123"）👈 还是同一个
    ↓
SDK 加载完整历史（包括之前的所有对话）
    ↓
AI > 好的小明，我来帮你分析...✅ 还记得你叫小明！
    [调用 @codebase/scan 工具]
    [调用 @codebase/analyze 工具]
    ↓
进程继续运行 ✅

退出：
进程正常关闭
```

**优势：**

- ✅ 一个进程，多次查询
- ✅ 同一个 Session
- ✅ AI 记住所有历史
- ✅ 支持工具调用历史

---

## 🚀 快速开始

### 方式 1: 使用测试脚本（推荐）

```bash
# 一键启动
./scripts/test-persistent-chat.sh
```

### 方式 2: 手动步骤

```bash
# 1. 编译持久化 Bridge
cd scripts
pnpm run build:mcp-persistent
cd ..

# 2. 编译 MCP 服务器（如果需要）
cd src-tauri
cargo build --release --bin codebase-mcp-server
cd ..

# 3. 运行测试
cd src-tauri
cargo run --example persistent_chat_test
```

---

## 💬 使用示例

### 测试 AI 记忆

```
你 > 你好，我叫小明，我是一个前端工程师

🤖 AI > 你好小明！很高兴认识你。作为前端工程师，你有什么我可以帮助的吗？

你 > 我刚才说我叫什么名字？

🤖 AI > 你刚才说你叫小明。

你 > 我是做什么工作的？

🤖 AI > 你是一个前端工程师。

你 > info

📊 会话信息:
   工作目录: /tmp/test-workspace
   已对话轮数: 3
   Session ID: f8a3c2d1...
   状态: 活跃（AI 记住所有历史对话）
```

### 使用工具

```
你 > 帮我分析一下 /Users/xxx/my-project 这个项目

🤖 AI > 好的小明，让我来分析这个项目...
     [调用 @codebase/scan 工具]
     正在扫描项目...
     [调用 @codebase/analyze 工具]
     分析完成！

     这个项目包含：
     - 50 个 Vue 组件
     - 30 个 TypeScript 文件
     - ...

     [Token: 1523, 工具调用: 2次, 轮数: 4]
```

### 重置会话

```
你 > reset

🔄 会话已重置，下次查询将创建新会话

你 > 我叫什么名字？

🤖 AI > 我不知道你叫什么名字，请告诉我。
```

---

## 🔧 配置说明

### API Key 配置

持久化模式会自动从以下位置读取 API Key（按优先级）：

1. 环境变量 `ANTHROPIC_API_KEY`
2. `.env` 文件（`src-tauri/.env` 或 `.env`）
3. 默认值（router-config.json 中的 key）

### 工作目录

默认工作目录：`/tmp/test-workspace`

可以在代码中修改：

```rust
let workspace = "/path/to/your/workspace";
```

---

## 📊 技术细节

### SDK 的 resume 机制

```typescript
// 第一次查询（创建新会话）
const response1 = query({
  prompt: "你好",
  options: {
    // resume 未设置，SDK 创建新 Session
  },
});

// 后续查询（恢复会话）
const response2 = query({
  prompt: "我刚才说了什么？",
  options: {
    resume: "session-id-from-previous-call", // 👈 传递 session_id
    // SDK 会：
    // 1. 查找这个 Session 的 transcript 文件
    // 2. 加载完整的对话历史
    // 3. 将新消息追加到历史后面
    // 4. 发送完整历史给 Claude API
  },
});
```

### Session 存储位置

SDK 会将对话历史保存在：

```
~/.claude-agent-sdk/sessions/
  └── {session_id}/
      └── transcript.jsonl  # 完整的对话历史
```

每条消息都会追加到 transcript 文件中，格式为 JSON Lines。

---

## 🆚 对比总结

| 特性             | 独立模式         | 持久化模式         |
| ---------------- | ---------------- | ------------------ |
| **进程管理**     | 每次启动新进程   | 常驻进程           |
| **Session**      | 每次都是新的     | 同一个 Session     |
| **AI 记忆**      | 不记得之前的对话 | 记住所有历史       |
| **工具调用历史** | 不保留           | 完整保留           |
| **适用场景**     | 单次任务         | 多轮对话、复杂任务 |
| **性能**         | 每次启动有延迟   | 响应更快           |
| **实现复杂度**   | 简单             | 中等               |

---

## 🎯 最佳实践

### 1. 何时使用持久化模式

✅ **推荐场景：**

- 需要 AI 记住上下文的多轮对话
- 复杂的代码分析任务
- 交互式开发辅助
- 需要连续执行多个相关任务

❌ **不推荐场景：**

- 单次独立的查询
- 不需要历史上下文
- 批处理脚本

### 2. Session 管理建议

```rust
// 长时间对话后，可以重置 Session
if turn_count > 50 {
    bridge.reset_session()?;
    println!("对话太长了，已重置会话以提升性能");
}
```

### 3. 错误处理

```rust
match bridge.send_message(user_input, workspace) {
    Ok(response) => {
        if !response["success"].as_bool().unwrap_or(false) {
            // 处理 API 错误
            eprintln!("API 错误: {:?}", response["error"]);

            // 可以选择重置会话
            bridge.reset_session()?;
        }
    }
    Err(e) => {
        // 处理通信错误
        eprintln!("通信错误: {}", e);

        // 可能需要重启 Bridge
        bridge = PersistentAgentBridge::new()?;
    }
}
```

---

## 🐛 故障排查

### 问题 1: Bridge 未编译

```bash
错误: 找不到 mcp-agent-bridge-persistent.js

解决:
cd scripts
pnpm run build:mcp-persistent
```

### 问题 2: MCP 服务器未编译

```bash
错误: 找不到 codebase-mcp-server

解决:
cd src-tauri
cargo build --release --bin codebase-mcp-server
```

### 问题 3: Session 丢失

```bash
现象: AI 不记得之前的对话

可能原因:
1. session_id 未正确保存
2. Bridge 进程意外重启
3. transcript 文件被删除

解决:
- 检查 session_id 是否一致（使用 'info' 命令）
- 确保 Bridge 进程没有重启
```

### 问题 4: API Key 错误

```bash
错误: 401 Unauthorized

解决:
1. 检查 .env 文件中的 ANTHROPIC_API_KEY
2. 或设置环境变量:
   export ANTHROPIC_API_KEY="your-key-here"
```

---

## 📚 相关文档

- [Claude Agent SDK 深度解析](./CLAUDE_AGENT_SDK_DEEP_DIVE.md)
- [完整架构文档](./COMPLETE_ARCHITECTURE.md)
- [快速设置指南](./QUICK_SETUP.md)
- [Router 设置指南](./SETUP_ROUTER.md)

---

## 🎉 总结

通过使用 SDK 的 `resume` 功能，我们实现了真正的持久化多轮对话：

✅ **所有对话都在同一个 Session 中**  
✅ **AI 完整记住所有历史对话**  
✅ **支持工具调用历史追踪**  
✅ **更快的响应速度（进程复用）**

享受你的 AI 助手吧！🚀
