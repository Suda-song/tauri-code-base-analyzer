# 🤖 AI Coding Agent 完整实现

一个功能强大的 AI 编程助手，基于 Claude SDK 和 TypeScript 桥接器实现。

## ✨ 核心功能

### 1. **多种工作模式**

- **Analysis (分析)** - 只读模式，理解代码结构和逻辑
- **Edit (编辑)** - 修改现有代码
- **Generate (生成)** - 创建新代码
- **Debug (调试)** - 查找和修复问题
- **Refactor (重构)** - 改进代码质量

### 2. **集成的编程工具**

- **FileOpsTool** - 文件读写操作

  - 读取文件内容
  - 写入/创建文件
  - 列出目录
  - 删除文件

- **GrepTool** - 代码搜索

  - 正则表达式搜索
  - 跨文件搜索
  - 支持文件过滤

- **GlobTool** - 文件查找

  - 通配符匹配
  - 递归搜索

- **BashTool** - 命令执行（编辑/生成模式）
  - 运行测试
  - 构建项目
  - Git 操作

### 3. **智能特性**

- ✅ **多轮对话** - 保持上下文，连续交互
- ✅ **工具链调用** - 自动选择和组合工具
- ✅ **对话历史** - 导出/导入会话
- ✅ **文件追踪** - 记录修改的文件
- ✅ **安全限制** - 工作目录沙箱

---

## 🚀 快速开始

### 1. 环境设置

```bash
# 设置 API Key
export ANTHROPIC_API_KEY="your-api-key"

# 或创建 .env 文件
echo 'ANTHROPIC_API_KEY=your-api-key' > src-tauri/.env
```

### 2. 构建 TypeScript 桥接器

```bash
cd scripts
npm install
npm run build
```

### 3. 基本使用

```rust
use tauri_code_base_analyzer::agent_core::coding_agent::{
    CodingAgent, CodingQuery, AgentMode,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 创建 Agent
    let mut agent = CodingAgent::new("/path/to/project".to_string())?;

    // 设置模式
    agent.set_mode(AgentMode::Analysis);

    // 注册工具
    agent.register_coding_tools();

    // 执行任务
    let query = CodingQuery {
        prompt: "分析 src/main.rs 的主要功能".to_string(),
        files: vec!["src/main.rs".to_string()],
        max_tokens: Some(4096),
        verbose: true,
    };

    let response = agent.code(query).await?;
    println!("{}", response.content);

    Ok(())
}
```

---

## 📚 使用示例

### 示例 1: 代码分析

```rust
let mut agent = CodingAgent::new(workspace)?;
agent.set_mode(AgentMode::Analysis);
agent.register_coding_tools();

let query = CodingQuery {
    prompt: "分析这个项目的架构，找出主要模块和它们之间的关系".to_string(),
    files: vec![],
    max_tokens: Some(8192),
    verbose: true,
};

let response = agent.code(query).await?;
```

**Agent 会自动：**

1. 使用 GlobTool 列出项目文件
2. 使用 FileOpsTool 读取关键文件
3. 使用 GrepTool 搜索依赖关系
4. 生成架构分析报告

### 示例 2: 代码生成

```rust
let mut agent = CodingAgent::new("/tmp/new_project".to_string())?;
agent.set_mode(AgentMode::Generate);
agent.register_coding_tools();

let query = CodingQuery {
    prompt: r#"创建一个 REST API 项目：
    - 使用 actix-web 框架
    - 包含用户管理 API
    - 添加数据库配置
    - 包含单元测试"#.to_string(),
    files: vec![],
    max_tokens: Some(12288),
    verbose: true,
};

let response = agent.code(query).await?;
println!("创建的文件: {:?}", response.files_modified);
```

**Agent 会自动：**

1. 创建项目结构
2. 生成 Cargo.toml 配置
3. 实现 API 路由和处理器
4. 添加数据库模块
5. 创建测试文件

### 示例 3: 调试问题

```rust
let mut agent = CodingAgent::new(workspace)?;
agent.set_mode(AgentMode::Debug);
agent.register_coding_tools();

let query = CodingQuery {
    prompt: "程序编译失败，报错 'cannot find type User'，帮我找到问题并修复".to_string(),
    files: vec![],
    max_tokens: Some(6144),
    verbose: true,
};

let response = agent.code(query).await?;
```

**Agent 会自动：**

1. 使用 BashTool 运行 `cargo build` 获取完整错误信息
2. 使用 GrepTool 搜索 `User` 类型的定义
3. 分析导入语句
4. 提供修复建议或直接修复

### 示例 4: 代码重构

```rust
let mut agent = CodingAgent::new(workspace)?;
agent.set_mode(AgentMode::Refactor);
agent.register_coding_tools();

let query = CodingQuery {
    prompt: "重构 src/handlers.rs，将长函数拆分为更小的函数，改进错误处理".to_string(),
    files: vec!["src/handlers.rs".to_string()],
    max_tokens: Some(8192),
    verbose: true,
};

let response = agent.code(query).await?;
```

---

## 🎯 高级功能

### 1. 自定义配置

```rust
use tauri_code_base_analyzer::agent_core::coding_agent::CodingAgentConfig;

let config = CodingAgentConfig {
    workspace: "/path/to/project".to_string(),
    max_tool_iterations: 20,           // 增加迭代次数
    default_max_tokens: 16384,         // 增加 token 限制
    enable_tools: true,
    save_history: true,
    mode: AgentMode::Generate,
};

let mut agent = CodingAgent::with_config(config)?;
```

### 2. 对话历史管理

```rust
// 查看历史
let history = agent.get_history();
for turn in history {
    println!("[{}] {}: {}", turn.timestamp, turn.role, turn.content);
}

// 导出历史（JSON 格式）
let json_history = agent.export_history()?;
std::fs::write("conversation.json", json_history)?;

// 清空历史
agent.clear_history();
```

### 3. 批量处理

```rust
let tasks = vec![
    "分析 src/lib.rs",
    "优化 src/utils.rs 的性能",
    "为 src/api.rs 添加测试",
];

for task in tasks {
    let query = CodingQuery {
        prompt: task.to_string(),
        files: vec![],
        max_tokens: Some(4096),
        verbose: false,
    };

    let response = agent.code(query).await?;
    println!("完成任务: {}", task);
    println!("使用的工具: {:?}", response.tools_used);
}
```

### 4. 自定义工具

```rust
use crate::tool_execution::{AgentTool, ToolResult};
use async_trait::async_trait;

// 实现自定义工具
struct CustomTool;

#[async_trait]
impl AgentTool for CustomTool {
    fn name(&self) -> &str { "custom_tool" }
    fn description(&self) -> &str { "自定义工具描述" }
    fn parameters_schema(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "param": {"type": "string"}
            }
        })
    }

    async fn execute(&self, params: serde_json::Value) -> Result<ToolResult, Box<dyn std::error::Error>> {
        // 实现工具逻辑
        Ok(ToolResult::success("结果".to_string()))
    }
}

// 注册自定义工具
agent.register_tool(Box::new(CustomTool));
```

---

## 🔧 运行示例

### 运行完整示例

```bash
cd src-tauri

# 确保环境变量已设置
export ANTHROPIC_API_KEY="your-api-key"

# 运行示例
cargo run --example coding_agent_example
```

### 运行测试

```bash
cargo test --package tauri-code-base-analyzer --lib agent_core::coding_agent
```

---

## 📊 性能和限制

### 性能特点

| 特性         | 性能                         |
| ------------ | ---------------------------- |
| 启动时间     | ~1-2 秒（Node.js 子进程）    |
| API 调用延迟 | ~2-10 秒（取决于任务复杂度） |
| 工具执行     | ~100ms-5 秒（取决于工具）    |
| 内存占用     | ~200-500MB                   |

### 限制

1. **依赖 Node.js** - 需要安装 Node.js 18+
2. **Token 限制** - 单次最多 200k tokens（Claude Opus）
3. **工作目录限制** - 工具只能操作指定目录内的文件
4. **迭代次数** - 默认最多 10 轮工具调用

### 优化建议

1. **针对大型项目** - 增加 `max_tool_iterations`
2. **复杂任务** - 增加 `default_max_tokens`
3. **频繁调用** - 考虑使用纯 Rust 的 `ClaudeClient`
4. **生产部署** - 编译为单一二进制文件

---

## 🛠️ 故障排除

### 1. API Key 错误

```
Error: ANTHROPIC_API_KEY environment variable not set
```

**解决方案：**

```bash
export ANTHROPIC_API_KEY="your-key"
# 或创建 .env 文件
```

### 2. Bridge Script 未找到

```
Error: Bridge script not found at scripts/dist/claude-bridge.js
```

**解决方案：**

```bash
cd scripts
npm install
npm run build
```

### 3. 工具执行失败

```
Error: 路径超出允许范围
```

**解决方案：**

- 确保工作目录正确
- 检查文件路径是否在工作目录内

### 4. Token 超限

```
Error: maximum context length exceeded
```

**解决方案：**

- 减少 `verbose` 模式
- 限制历史轮数
- 分解大任务为小任务

---

## 📖 API 参考

### CodingAgent

```rust
impl CodingAgent {
    // 创建 Agent
    pub fn new(workspace: String) -> Result<Self, Box<dyn std::error::Error>>;
    pub fn with_config(config: CodingAgentConfig) -> Result<Self, Box<dyn std::error::Error>>;

    // 配置
    pub fn set_mode(&mut self, mode: AgentMode);
    pub fn register_tool(&mut self, tool: Box<dyn AgentTool>);
    pub fn register_coding_tools(&mut self);

    // 执行
    pub async fn code(&mut self, query: CodingQuery) -> Result<CodingResponse, Box<dyn std::error::Error>>;
    pub async fn simple_query(&self, prompt: String) -> Result<String, Box<dyn std::error::Error>>;

    // 历史
    pub fn get_history(&self) -> &[ConversationTurn];
    pub fn clear_history(&mut self);
    pub fn export_history(&self) -> Result<String, Box<dyn std::error::Error>>;
}
```

### CodingQuery

```rust
pub struct CodingQuery {
    pub prompt: String,          // 用户请求
    pub files: Vec<String>,      // 相关文件（可选）
    pub max_tokens: Option<u32>, // Token 限制
    pub verbose: bool,           // 详细模式
}
```

### CodingResponse

```rust
pub struct CodingResponse {
    pub success: bool,              // 是否成功
    pub content: String,            // 响应内容
    pub tools_used: Vec<String>,    // 使用的工具
    pub files_modified: Vec<String>,// 修改的文件
    pub suggestions: Vec<String>,   // 建议
    pub error: Option<String>,      // 错误信息
}
```

---

## 🎉 总结

你现在拥有了一个功能完整的 AI Coding Agent！

**主要优势：**

- 🚀 使用官方 Claude SDK，功能完整
- 🔧 集成常用编程工具
- 💬 支持多轮对话和上下文
- 🎯 多种专业模式
- 📝 完整的历史记录

**开始使用：**

```bash
cargo run --example coding_agent_example
```

**需要帮助？** 查看示例代码或提 Issue！
