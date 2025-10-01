# 使用示例文档

本文档展示如何使用新实现的三层架构系统。

## 📋 目录

1. [基础设施层使用](#1-基础设施层-claude_client)
2. [工具层使用](#2-工具层-tool_execution)
3. [应用层使用](#3-应用层-agent_core)

---

## 1. 基础设施层 (claude_client)

### 基本使用

```rust
use crate::claude_client::ClaudeClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 创建客户端（需要设置 ANTHROPIC_API_KEY 环境变量）
    let client = ClaudeClient::new()?;

    // 简单查询
    let response = client.query(
        "请用一句话介绍 Rust 编程语言".to_string()
    ).await?;

    println!("Response: {}", response);
    Ok(())
}
```

### 带系统提示词的查询

```rust
let client = ClaudeClient::new()?;

let response = client.query_with_system(
    "分析这段代码的时间复杂度：fn sum(n: i32) -> i32 { (1..=n).sum() }".to_string(),
    "你是一个算法专家，专注于分析代码的性能".to_string(),
).await?;

println!("{}", response);
```

### 使用自定义模型

```rust
let client = ClaudeClient::with_model(
    "claude-3-opus-20240229".to_string()
)?;

let response = client.query("...".to_string()).await?;
```

---

## 2. 工具层 (tool_execution)

### 2.1 Bash 工具

```rust
use crate::tool_execution::system::BashTool;
use crate::tool_execution::AgentTool;
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let bash = BashTool::new("/tmp".to_string());

    let result = bash.execute(json!({
        "command": "ls -la"
    })).await?;

    if result.success {
        println!("Output:\n{}", result.output);
    }
    Ok(())
}
```

### 2.2 文件操作工具

```rust
use crate::tool_execution::system::FileOpsTool;
use crate::tool_execution::AgentTool;
use serde_json::json;

async fn file_operations_example() -> Result<(), Box<dyn std::error::Error>> {
    let file_tool = FileOpsTool::new("/tmp".to_string());

    // 写入文件
    file_tool.execute(json!({
        "operation": "write",
        "path": "test.txt",
        "content": "Hello, World!"
    })).await?;

    // 读取文件
    let result = file_tool.execute(json!({
        "operation": "read",
        "path": "test.txt"
    })).await?;

    println!("File content: {}", result.output);

    // 列出目录
    let result = file_tool.execute(json!({
        "operation": "list",
        "path": "."
    })).await?;

    println!("Files:\n{}", result.output);

    Ok(())
}
```

### 2.3 Grep 搜索工具

```rust
use crate::tool_execution::search::GrepTool;
use crate::tool_execution::AgentTool;
use serde_json::json;

async fn search_code() -> Result<(), Box<dyn std::error::Error>> {
    let grep = GrepTool::new(".".to_string())
        .with_max_results(100);

    let result = grep.execute(json!({
        "pattern": "fn main",
        "file_pattern": ".*\\.rs$",
        "case_sensitive": true
    })).await?;

    println!("Search results:\n{}", result.output);
    Ok(())
}
```

### 2.4 Glob 文件搜索

```rust
use crate::tool_execution::search::GlobTool;
use crate::tool_execution::AgentTool;
use serde_json::json;

async fn find_files() -> Result<(), Box<dyn std::error::Error>> {
    let glob = GlobTool::new(".".to_string());

    let result = glob.execute(json!({
        "pattern": "**/*.rs"
    })).await?;

    println!("Found Rust files:\n{}", result.output);
    Ok(())
}
```

### 2.5 Web 抓取工具（需要 AI）

```rust
use crate::tool_execution::web::WebFetchTool;
use crate::tool_execution::AgentTool;
use serde_json::json;

async fn fetch_webpage() -> Result<(), Box<dyn std::error::Error>> {
    let web_tool = WebFetchTool::new()?;

    let result = web_tool.execute(json!({
        "url": "https://doc.rust-lang.org/book/",
        "analysis_prompt": "这个网站是关于什么的？请提取主要章节。"
    })).await?;

    println!("Analysis:\n{}", result.output);
    Ok(())
}
```

### 2.6 Vue 代码提取器

```rust
use crate::tool_execution::codebase::VueExtractor;

fn extract_vue_entities() -> Result<(), Box<dyn std::error::Error>> {
    let extractor = VueExtractor::new();

    let entities = extractor.extract(
        "/path/to/Component.vue",
        "/path/to/project"
    )?;

    for entity in entities {
        println!("Found: {:?} at line {}", entity.entity_type, entity.loc);
    }

    Ok(())
}
```

---

## 3. 应用层 (agent_core)

### 3.1 创建和使用 Agent

```rust
use crate::agent_core::{ClaudeAgent, AgentQuery};
use crate::tool_execution::system::{BashTool, FileOpsTool};
use crate::tool_execution::search::{GrepTool, GlobTool};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 创建 Agent
    let mut agent = ClaudeAgent::new()?;

    // 注册工具
    agent.register_tool(Box::new(BashTool::new("/tmp".to_string())));
    agent.register_tool(Box::new(FileOpsTool::new("/tmp".to_string())));
    agent.register_tool(Box::new(GrepTool::new(".".to_string())));
    agent.register_tool(Box::new(GlobTool::new(".".to_string())));

    // 执行查询
    let query = AgentQuery {
        prompt: "列出当前目录的所有 Rust 文件".to_string(),
        system_prompt: None,
        max_tokens: None,
    };

    let response = agent.query(query).await?;

    println!("Agent Response:");
    println!("{}", response.content);
    println!("\nTools used: {:?}", response.tools_used);

    Ok(())
}
```

### 3.2 使用自定义系统提示词

```rust
use crate::agent_core::{ClaudeAgent, AgentQuery, CODE_ANALYSIS_SYSTEM_PROMPT};

async fn code_analysis_agent() -> Result<(), Box<dyn std::error::Error>> {
    let mut agent = ClaudeAgent::new()?;

    // 注册代码分析相关工具
    agent.register_tool(Box::new(FileOpsTool::new(".".to_string())));
    agent.register_tool(Box::new(GrepTool::new(".".to_string())));

    let query = AgentQuery {
        prompt: "分析项目中的主要模块和它们的依赖关系".to_string(),
        system_prompt: Some(CODE_ANALYSIS_SYSTEM_PROMPT.to_string()),
        max_tokens: Some(8192),
    };

    let response = agent.query(query).await?;
    println!("{}", response.content);

    Ok(())
}
```

### 3.3 多轮对话

```rust
async fn conversation_example() -> Result<(), Box<dyn std::error::Error>> {
    let mut agent = ClaudeAgent::new()?;

    // 第一轮对话
    let query1 = AgentQuery {
        prompt: "请介绍 Rust 的所有权系统".to_string(),
        system_prompt: None,
        max_tokens: None,
    };
    let response1 = agent.query(query1).await?;
    println!("Round 1: {}", response1.content);

    // 第二轮对话（Agent 会记住前面的对话）
    let query2 = AgentQuery {
        prompt: "那借用检查器是如何工作的？".to_string(),
        system_prompt: None,
        max_tokens: None,
    };
    let response2 = agent.query(query2).await?;
    println!("Round 2: {}", response2.content);

    // 查看对话历史
    let history = agent.get_history();
    println!("Conversation has {} messages", history.len());

    Ok(())
}
```

### 3.4 使用自定义配置

```rust
use crate::agent_core::{ClaudeAgent, AgentConfig};

async fn custom_agent() -> Result<(), Box<dyn std::error::Error>> {
    let config = AgentConfig {
        model: "claude-3-5-sonnet-20241022".to_string(),
        default_max_tokens: 8192,
        temperature: 0.5,
        enable_tools: true,
        max_tool_iterations: 5,
    };

    let agent = ClaudeAgent::with_config(config)?;

    // ... 使用 agent

    Ok(())
}
```

---

## 4. 完整示例：代码分析助手

这是一个完整的示例，展示如何创建一个代码分析助手：

```rust
use crate::agent_core::{ClaudeAgent, AgentQuery, CODE_ANALYSIS_SYSTEM_PROMPT};
use crate::tool_execution::system::FileOpsTool;
use crate::tool_execution::search::{GrepTool, GlobTool};

async fn code_analysis_assistant() -> Result<(), Box<dyn std::error::Error>> {
    // 1. 创建 Agent
    let mut agent = ClaudeAgent::new()?;

    // 2. 注册代码分析相关工具
    let project_root = std::env::current_dir()?.to_string_lossy().to_string();

    agent.register_tool(Box::new(
        FileOpsTool::new(project_root.clone())
    ));
    agent.register_tool(Box::new(
        GrepTool::new(project_root.clone()).with_max_results(500)
    ));
    agent.register_tool(Box::new(
        GlobTool::new(project_root.clone())
    ));

    // 3. 执行代码分析任务
    let tasks = vec![
        "找出项目中所有的 Rust 源文件",
        "分析 main.rs 的主要功能",
        "找出项目中定义的所有公共 API",
    ];

    for task in tasks {
        println!("\n=== Task: {} ===\n", task);

        let query = AgentQuery {
            prompt: task.to_string(),
            system_prompt: Some(CODE_ANALYSIS_SYSTEM_PROMPT.to_string()),
            max_tokens: Some(4096),
        };

        let response = agent.query(query).await?;

        println!("Response: {}", response.content);
        println!("Tools used: {:?}", response.tools_used);
    }

    Ok(())
}
```

---

## 5. 在 Tauri 中集成

### 5.1 创建 Tauri Command

```rust
use crate::agent_core::{ClaudeAgent, AgentQuery, AgentResponse};

#[tauri::command]
async fn ai_assistant_query(
    prompt: String,
    system_prompt: Option<String>,
) -> Result<AgentResponse, String> {
    let mut agent = ClaudeAgent::new()
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
        crate::tool_execution::system::FileOpsTool::new(cwd.clone())
    ));

    let query = AgentQuery {
        prompt,
        system_prompt,
        max_tokens: Some(4096),
    };

    agent.query(query).await
        .map_err(|e| e.to_string())
}

// 在 main 函数中注册
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            ai_assistant_query,
            // ... 其他命令
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 5.2 前端调用

```typescript
import { invoke } from "@tauri-apps/api/core";

async function askAI(question: string) {
  const response = await invoke("ai_assistant_query", {
    prompt: question,
    systemPrompt: null,
  });

  console.log("AI Response:", response);
  return response;
}

// 使用
askAI("分析当前项目的代码结构").then((response) => {
  console.log(response.content);
  console.log("Used tools:", response.tools_used);
});
```

---

## 6. 环境变量配置

在使用 Claude API 之前，需要设置环境变量：

```bash
# Linux/macOS
export ANTHROPIC_API_KEY="your-api-key-here"

# Windows (PowerShell)
$env:ANTHROPIC_API_KEY="your-api-key-here"

# Windows (CMD)
set ANTHROPIC_API_KEY=your-api-key-here
```

或者在 `.env` 文件中：

```env
ANTHROPIC_API_KEY=your-api-key-here
```

---

## 7. 测试

运行测试：

```bash
cd src-tauri
cargo test
```

运行特定测试：

```bash
cargo test test_agent_simple_query -- --ignored
```

---

## 📚 相关文档

- [架构设计](./ARCHITECTURE.md) - 详细的架构说明
- [Agent 实现](./src/agent_core/mod.rs) - Agent 核心实现
- [工具系统](./src/tool_execution/mod.rs) - 工具执行层
- [Claude 客户端](./src/claude_client/mod.rs) - API 客户端

---

**更新日期**: 2024-09-30  
**版本**: v1.0
