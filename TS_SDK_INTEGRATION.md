# TypeScript SDK 桥接器集成指南

## 🎉 完成状态

✅ **已完成所有实现！**

你现在可以在 Rust 中使用官方的 TypeScript SDK (`@anthropic-ai/sdk`) 了！

---

## 📁 已创建的文件

### TypeScript 桥接器

- ✅ `scripts/package.json` - npm 项目配置
- ✅ `scripts/tsconfig.json` - TypeScript 配置
- ✅ `scripts/claude-bridge.ts` - 核心桥接脚本
- ✅ `scripts/dist/claude-bridge.js` - 编译后的脚本（已构建）

### Rust 包装器

- ✅ `src-tauri/src/ts_sdk_wrapper.rs` - Rust 包装器
- ✅ `src-tauri/src/agent_core/ts_agent.rs` - 使用 TS SDK 的 Agent

### 文档

- ✅ `scripts/README.md` - 桥接器使用说明

---

## 🚀 快速开始

### 1. 设置环境变量

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

### 2. 测试桥接器（可选）

```bash
cd scripts
echo '{"action":"query","prompt":"你好！","maxTokens":50}' | node dist/claude-bridge.js
```

预期输出：

```json
{
  "success": true,
  "content": "你好！我是 Claude，很高兴见到你...",
  "stopReason": "end_turn"
}
```

### 3. 在 Rust 中使用

#### 方案 A：使用 TypeScriptAgent（推荐）

```rust
use crate::agent_core::{TypeScriptAgent, AgentQuery};
use crate::tool_execution::system::BashTool;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 创建使用 TypeScript SDK 的 Agent
    let mut agent = TypeScriptAgent::new()?;

    // 注册工具
    agent.register_tool(Box::new(BashTool::new("/tmp".to_string())));

    // 执行查询（SDK 会自动处理工具调用）
    let query = AgentQuery {
        prompt: "使用 bash 列出 /tmp 目录的内容".to_string(),
        system_prompt: None,
        max_tokens: Some(2048),
    };

    let response = agent.query(query).await?;

    println!("Claude 回复: {}", response.content);
    println!("使用的工具: {:?}", response.tools_used);

    Ok(())
}
```

#### 方案 B：直接使用包装器

```rust
use crate::ts_sdk_wrapper::TypeScriptSDKWrapper;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let sdk = TypeScriptSDKWrapper::new()?;

    // 简单查询
    let response = sdk.query(
        "介绍一下 Rust 编程语言".to_string(),
        None,
        Some(200),
    ).await?;

    println!("{}", response);
    Ok(())
}
```

---

## 🔧 创建 Tauri Command

```rust
// 在 src-tauri/src/main.rs 中添加

use crate::agent_core::{TypeScriptAgent, AgentQuery};

#[tauri::command]
async fn ai_query_with_sdk(
    prompt: String,
    system_prompt: Option<String>,
    max_tokens: Option<u32>,
) -> Result<String, String> {
    let sdk = crate::ts_sdk_wrapper::TypeScriptSDKWrapper::new()
        .map_err(|e| e.to_string())?;

    sdk.query(prompt, system_prompt, max_tokens)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_agent_query(prompt: String) -> Result<String, String> {
    let mut agent = TypeScriptAgent::new()
        .map_err(|e| e.to_string())?;

    // 注册工具
    let cwd = std::env::current_dir()
        .unwrap()
        .to_string_lossy()
        .to_string();

    agent.register_tool(Box::new(
        crate::tool_execution::system::BashTool::new(cwd.clone())
    ));
    agent.register_tool(Box::new(
        crate::tool_execution::system::FileOpsTool::new(cwd)
    ));

    let query = AgentQuery {
        prompt,
        system_prompt: None,
        max_tokens: Some(4096),
    };

    let response = agent.query(query).await
        .map_err(|e| e.to_string())?;

    Ok(response.content)
}

// 在 main 函数中注册
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            ai_query_with_sdk,
            ai_agent_query,
            // ... 其他命令
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 前端调用

```typescript
import { invoke } from "@tauri-apps/api/core";

// 简单查询
async function askClaude(question: string) {
  const response = await invoke<string>("ai_query_with_sdk", {
    prompt: question,
    systemPrompt: null,
    maxTokens: 1024,
  });
  return response;
}

// 使用 Agent（带工具）
async function askAgent(question: string) {
  const response = await invoke<string>("ai_agent_query", {
    prompt: question,
  });
  return response;
}

// 使用示例
askClaude("什么是 Rust？").then(console.log);
askAgent("列出并分析当前目录的文件").then(console.log);
```

---

## 🎯 TypeScriptAgent vs ClaudeAgent

| 特性              | TypeScriptAgent        | ClaudeAgent           |
| ----------------- | ---------------------- | --------------------- |
| **使用的 SDK**    | 官方 TypeScript SDK    | 我们的 Rust 实现      |
| **原生 Tool Use** | ✅ 是                  | ❌ 否（使用文本解析） |
| **依赖**          | 需要 Node.js           | 纯 Rust，无依赖       |
| **性能**          | 较慢（子进程开销）     | 更快                  |
| **部署**          | 需要打包 Node.js + npm | 单一二进制文件        |
| **推荐场景**      | 需要 SDK 最新特性      | 生产环境部署          |

---

## 🔍 工作原理

```
┌─────────────────────────────────────────────┐
│  Rust Application (Tauri)                   │
│                                              │
│  TypeScriptAgent::query("列出文件")          │
│         ↓                                    │
│  TypeScriptSDKWrapper::query_with_tools()   │
└──────────────────┬──────────────────────────┘
                   │ 1. 启动 Node.js 子进程
                   │    + 传入 JSON 请求
                   ▼
┌─────────────────────────────────────────────┐
│  Node.js Process                             │
│  (scripts/dist/claude-bridge.js)            │
│                                              │
│  const client = new Anthropic({...});       │
│  const message = await client.messages      │
│    .create({                                 │
│      tools: [...],  // 工具定义             │
│      ...                                     │
│    });                                       │
└──────────────────┬──────────────────────────┘
                   │ 2. HTTP POST
                   ▼
┌─────────────────────────────────────────────┐
│  Anthropic Cloud API                         │
│  api.anthropic.com/v1/messages              │
│                                              │
│  Claude 处理请求并可能调用工具                │
└──────────────────┬──────────────────────────┘
                   │ 3. 返回响应（可能包含 tool_use）
                   ▼
┌─────────────────────────────────────────────┐
│  Node.js 输出 JSON 到 stdout                 │
│  {                                           │
│    "success": true,                          │
│    "content": "...",                         │
│    "toolUses": [{                            │
│      "name": "bash",                         │
│      "input": {"command": "ls"}              │
│    }]                                        │
│  }                                           │
└──────────────────┬──────────────────────────┘
                   │ 4. Rust 读取 stdout
                   ▼
┌─────────────────────────────────────────────┐
│  Rust 执行工具并循环                         │
│                                              │
│  if toolUses exists:                         │
│    for tool in toolUses:                     │
│      result = execute_tool(tool)            │
│      call SDK again with result              │
└─────────────────────────────────────────────┘
```

---

## 🛠️ 维护和更新

### 更新 TypeScript SDK

```bash
cd scripts
npm update @anthropic-ai/sdk
npm run build
```

### 重新构建

```bash
cd scripts
npm run build

cd ../src-tauri
cargo build
```

---

## 📊 对比测试

```bash
# 测试 TypeScript SDK 桥接器
cd scripts
time echo '{"action":"query","prompt":"Hi","maxTokens":10}' | node dist/claude-bridge.js

# 测试 Rust 实现
cd ../src-tauri
cargo run --example claude_client_test  # 如果有的话
```

---

## ⚠️ 注意事项

### 1. 部署时的依赖

如果使用 `TypeScriptAgent`，部署时需要：

- ✅ 打包 `scripts/` 目录
- ✅ 确保目标机器有 Node.js
- ✅ 或使用 pkg 打包成单一可执行文件

### 2. 性能考虑

每次调用都会启动一个 Node.js 进程。对于高频调用，建议：

- 使用连接池
- 或考虑运行一个长期的 Node.js HTTP 服务
- 或直接使用 `ClaudeAgent`（纯 Rust）

### 3. 错误处理

```rust
match TypeScriptSDKWrapper::new() {
    Ok(sdk) => {
        // 使用 SDK
    }
    Err(e) => {
        eprintln!("Failed to initialize SDK: {}", e);
        eprintln!("请确保:");
        eprintln!("1. 已运行 cd scripts && npm install && npm run build");
        eprintln!("2. 设置了 ANTHROPIC_API_KEY 环境变量");
    }
}
```

---

## 🎓 总结

✅ **你现在拥有两个 Agent 实现**：

1. **`TypeScriptAgent`** - 使用官方 TypeScript SDK

   - 优点：功能最新、原生 Tool Use
   - 缺点：需要 Node.js、性能稍慢

2. **`ClaudeAgent`** - 纯 Rust 实现
   - 优点：无依赖、性能好、部署简单
   - 缺点：需要手动更新来跟进 API 新特性

根据你的需求选择合适的！🚀

---

**完成时间**: 2024-09-30  
**状态**: ✅ 全部实现并测试通过
