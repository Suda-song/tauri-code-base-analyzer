# 项目架构设计

## 📐 核心问题

> **问题**：工具（如 WebFetch、AI 代码分析器）也需要调用 Claude API，如何避免循环依赖？

## 🎯 解决方案：三层架构

### 架构图

```
┌─────────────────────────────────────────────────────────┐
│                     应用层                               │
│                   agent-core/                            │
│  • Agent 逻辑   • 对话管理   • Hooks                      │
│  • Prompt 工程  • 会话状态                                │
└──────────────────┬────────────────────┬──────────────────┘
                   │                    │
        depends on │                    │ depends on
                   ▼                    ▼
┌──────────────────────────┐  ┌─────────────────────────┐
│       工具层              │  │    基础设施层             │
│   tool-execution/        │  │   claude_client/         │
│  • 系统工具（Bash等）     │  │  • Claude API 封装       │
│  • 文件工具               │  │  • HTTP 客户端           │
│  • AI 辅助工具 ◄─────────────┤  • 类型定义              │
│    (需要调用 AI)          │  │  • 错误处理              │
└──────────────────────────┘  └─────────────────────────┘
                   │
        optionally │ depends on
                   │
                   └────────────────────┘
```

---

## 📂 详细模块结构

```
src-tauri/src/
├── claude_client/          # 第 1 层：基础设施层
│   ├── mod.rs
│   ├── client.rs           # Claude API 客户端
│   ├── types.rs            # API 请求/响应类型
│   └── error.rs            # 错误处理
│
├── tool-execution/         # 第 2 层：工具层
│   ├── mod.rs
│   ├── trait.rs            # AgentTool trait
│   │
│   ├── system/             # 系统工具（无需 AI）
│   │   ├── bash.rs
│   │   └── file_ops.rs
│   │
│   ├── search/             # 搜索工具（无需 AI）
│   │   ├── grep.rs
│   │   └── glob.rs
│   │
│   ├── web/                # Web 工具（需要 AI）
│   │   ├── fetch.rs        # 使用 claude_client
│   │   └── search.rs
│   │
│   └── codebase/           # 代码分析工具
│       ├── mod.rs
│       ├── extractors/     # 基础提取器（正则）
│       │   ├── vue.rs
│       │   └── typescript.rs
│       └── ai_assisted/    # AI 辅助分析（使用 claude_client）
│           ├── semantic.rs
│           └── understanding.rs
│
└── agent-core/             # 第 3 层：应用层
    ├── mod.rs
    ├── agent.rs            # 核心 Agent
    ├── types.rs
    ├── prompts.rs
    └── hooks/
        ├── mod.rs
        └── types.rs
```

---

## 🔄 依赖关系

### 清晰的依赖流

```
agent-core
    ↓ 依赖
    ├──> claude_client  (用于 Agent 对话)
    └──> tool-execution (注册和调用工具)
            ↓ 可选依赖
            └──> claude_client  (某些工具需要 AI)
```

### 没有循环依赖！

✅ **正确**：

- `tool-execution/web/fetch.rs` → 依赖 `claude_client`
- `agent-core/agent.rs` → 依赖 `claude_client` 和 `tool-execution`

❌ **避免**：

- `claude_client` 不依赖任何上层模块
- `tool-execution` 不依赖 `agent-core`

---

## 💡 实际代码示例

### 1. 基础设施层 (`claude_client/client.rs`)

```rust
// src-tauri/src/claude_client/client.rs

use reqwest::Client;
use serde::{Deserialize, Serialize};

pub struct ClaudeClient {
    client: Client,
    api_key: String,
    model: String,
}

impl ClaudeClient {
    pub fn new() -> Result<Self, anyhow::Error> {
        // 初始化逻辑
        Ok(Self {
            client: Client::new(),
            api_key: std::env::var("ANTHROPIC_API_KEY")?,
            model: "claude-3-5-sonnet-20241022".to_string(),
        })
    }

    /// 发送消息到 Claude API
    pub async fn send_message(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        max_tokens: u32,
    ) -> Result<String, anyhow::Error> {
        // API 调用实现
        todo!()
    }
}
```

### 2. 工具层 - 简单工具（无需 AI）

```rust
// src-tauri/src/tool-execution/system/bash.rs

use crate::tool_execution::trait::AgentTool;
use std::process::Command;

pub struct BashTool {
    cwd: String,
}

#[async_trait]
impl AgentTool for BashTool {
    fn name(&self) -> &str {
        "bash"
    }

    async fn execute(&self, input: JsonValue) -> Result<ToolResult, anyhow::Error> {
        // 直接执行，不需要 AI
        let output = Command::new("sh")
            .arg("-c")
            .arg(command)
            .output()?;

        Ok(ToolResult {
            success: output.status.success(),
            output: String::from_utf8_lossy(&output.stdout).to_string(),
        })
    }
}
```

### 3. 工具层 - AI 辅助工具（需要 AI）

```rust
// src-tauri/src/tool-execution/web/fetch.rs

use crate::claude_client::ClaudeClient;  // 依赖基础设施层
use crate::tool_execution::trait::AgentTool;

pub struct WebFetchTool {
    claude: ClaudeClient,  // 内部持有 Claude 客户端
}

impl WebFetchTool {
    pub fn new() -> Result<Self, anyhow::Error> {
        Ok(Self {
            claude: ClaudeClient::new()?,
        })
    }
}

#[async_trait]
impl AgentTool for WebFetchTool {
    fn name(&self) -> &str {
        "web_fetch"
    }

    async fn execute(&self, input: JsonValue) -> Result<ToolResult, anyhow::Error> {
        let url = input["url"].as_str().unwrap();

        // 1. 获取网页内容
        let content = reqwest::get(url).await?.text().await?;

        // 2. 使用 Claude 分析内容
        let prompt = format!(
            "分析以下网页内容并提取关键信息：\n\n{}",
            content
        );

        let analysis = self.claude.send_message(
            vec![Message {
                role: "user".to_string(),
                content: prompt,
            }],
            None,
            2048,
        ).await?;

        Ok(ToolResult {
            success: true,
            output: analysis,
        })
    }
}
```

### 4. 应用层 - Agent 使用工具

```rust
// src-tauri/src/agent-core/agent.rs

use crate::claude_client::ClaudeClient;
use crate::tool_execution::AgentTool;
use crate::tool_execution::system::BashTool;
use crate::tool_execution::web::WebFetchTool;

pub struct ClaudeAgent {
    claude: ClaudeClient,  // Agent 自己的 Claude 客户端
    tools: HashMap<String, Box<dyn AgentTool>>,
}

impl ClaudeAgent {
    pub fn new() -> Result<Self, anyhow::Error> {
        let mut agent = Self {
            claude: ClaudeClient::new()?,
            tools: HashMap::new(),
        };

        // 注册工具
        agent.register_tool(BashTool::new(cwd)?);
        agent.register_tool(WebFetchTool::new()?);  // 这个工具内部也有 Claude 客户端

        Ok(agent)
    }

    pub async fn query(&self, prompt: String) -> Result<AgentQueryStream, anyhow::Error> {
        // Agent 使用自己的 claude 客户端进行对话
        let response = self.claude.send_message(...).await?;

        // 如果需要调用工具，工具会使用它们自己的 claude 实例
        if needs_tool {
            let tool = self.tools.get("web_fetch").unwrap();
            let result = tool.execute(tool_input).await?;
        }

        Ok(stream)
    }
}
```

---

## 🎯 关键设计决策

### Q1: 为什么不把 `claude_client` 放在 `agent-core` 中？

**A**: 因为 `tool-execution` 中的某些工具也需要调用 AI：

- ✅ `WebFetchTool` - 需要 AI 分析网页内容
- ✅ `CodeUnderstandingTool` - 需要 AI 理解代码语义
- ✅ `SemanticSearchTool` - 需要 AI 进行语义搜索

如果 `claude_client` 在 `agent-core`，会导致：

```
tool-execution → 依赖 → agent-core  ❌ 循环依赖！
agent-core → 依赖 → tool-execution
```

### Q2: 工具是否共享同一个 Claude 客户端实例？

**A**: 不共享，每个需要的地方都创建自己的实例。

**理由**：

1. **隔离性**: Agent 的对话和工具的 AI 调用是独立的
2. **配置灵活**: 不同工具可能需要不同的模型或参数
3. **并发安全**: 避免共享状态的并发问题

**示例**：

```rust
// Agent 的 Claude 实例 - 用于对话
let agent = ClaudeAgent::new()?;  // 内部创建 claude_client

// WebFetchTool 的 Claude 实例 - 用于分析网页
let web_fetch = WebFetchTool::new()?;  // 内部也创建 claude_client

// 它们是独立的实例，互不影响
```

### Q3: 如何避免重复创建 HTTP 连接？

**A**: 使用连接池（`reqwest::Client` 内部已经实现）

```rust
pub struct ClaudeClient {
    client: Client,  // reqwest::Client 内部有连接池
    api_key: String,
}

// 即使创建多个 ClaudeClient 实例，
// reqwest 也会复用底层的 HTTP 连接
```

---

## 📋 实现清单

### Phase 1: 重构基础设施层

- [ ] 创建 `claude_client/` 模块
- [ ] 将 `agent-core/client.rs` 移动到 `claude_client/client.rs`
- [ ] 更新所有导入路径

### Phase 2: 实现基础工具

- [ ] `tool-execution/system/` - Bash, FileOps（无需 AI）
- [ ] `tool-execution/search/` - Grep, Glob（无需 AI）

### Phase 3: 实现 AI 辅助工具

- [ ] `tool-execution/web/fetch.rs` - 使用 `claude_client`
- [ ] `tool-execution/codebase/ai_assisted/` - 使用 `claude_client`

### Phase 4: Agent 集成

- [ ] 更新 `agent-core/agent.rs` 导入路径
- [ ] 测试 Agent 和工具的 AI 调用互不干扰

---

## 🔗 模块导入示例

```rust
// src-tauri/src/main.rs

mod claude_client;   // 第 1 层：基础设施
mod tool_execution;  // 第 2 层：工具
mod agent_core;      // 第 3 层：应用

// Agent 使用
use agent_core::agent::ClaudeAgent;
let agent = ClaudeAgent::new()?;

// 直接使用工具
use tool_execution::web::WebFetchTool;
let web_tool = WebFetchTool::new()?;
let result = web_tool.execute(json!({"url": "..."})).await?;

// 直接使用 Claude 客户端
use claude_client::ClaudeClient;
let claude = ClaudeClient::new()?;
let response = claude.send_message(...).await?;
```

---

## 🎓 总结

### 核心原则

1. **分层清晰**: 基础设施 → 工具 → 应用
2. **单向依赖**: 只能向下依赖，不能向上依赖
3. **职责明确**: 每层只做自己该做的事

### 优势

✅ **无循环依赖**: 依赖关系清晰
✅ **高度解耦**: 每层可独立测试
✅ **灵活扩展**: 新工具可自由选择是否使用 AI
✅ **性能优化**: 连接池复用，避免重复创建

---

**文档版本**: v1.0  
**更新日期**: 2024-09-30  
**维护者**: @team
