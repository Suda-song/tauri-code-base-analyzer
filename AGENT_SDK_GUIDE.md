# Claude Agent SDK 使用指南

本项目已集成官方 `@anthropic-ai/claude-agent-sdk`，提供强大的 AI 编程助手功能。

## 📚 目录

- [什么是 Claude Agent SDK](#什么是-claude-agent-sdk)
- [快速开始](#快速开始)
- [架构说明](#架构说明)
- [核心概念](#核心概念)
- [使用示例](#使用示例)
- [API 参考](#api-参考)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)

## 什么是 Claude Agent SDK

`@anthropic-ai/claude-agent-sdk` 是 Anthropic 官方提供的 AI Agent 开发工具包，具有以下特点：

### 🌟 核心特性

1. **优化的 Claude 集成**

   - 自动提示缓存
   - 性能优化
   - 智能 token 管理

2. **丰富的工具生态系统**

   - 文件操作（Read/Write/Edit）
   - Bash 命令执行
   - 可扩展的工具系统

3. **Agent 自主工作循环**

   - 收集上下文
   - 执行操作
   - 验证工作
   - 迭代改进

4. **细粒度权限控制**

   - 工具白名单/黑名单
   - 路径权限管理
   - 命令执行限制

5. **生产环境就绪**
   - 完善的错误处理
   - 会话管理
   - 监控和日志

## 快速开始

### 1. 环境准备

```bash
# 1. 设置 API Key
export ANTHROPIC_API_KEY="your-api-key-here"

# 或者在 .env 文件中设置（推荐）
echo "ANTHROPIC_API_KEY=your-api-key-here" > src-tauri/.env

# 2. 安装 Node.js 依赖
cd scripts
npm install

# 3. 构建 TypeScript bridge
npm run build:agent
```

### 2. 运行示例

```bash
# 运行 Agent SDK 示例
cd src-tauri
cargo run --example agent_sdk_example
```

### 3. 基础使用

```rust
use tauri_code_base_analyzer::agent_core::{
    AgentSdkCodingAgent, AgentSdkMode
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. 创建 Agent
    let workspace = "/path/to/your/project".to_string();
    let mut agent = AgentSdkCodingAgent::new(workspace)?;

    // 2. 设置工作模式
    agent.set_mode(AgentSdkMode::Code);

    // 3. 执行任务
    let response = agent
        .generate_code("创建一个 hello.rs 文件".to_string())
        .await?;

    println!("结果: {}", response.content);
    Ok(())
}
```

## 架构说明

### 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                   Rust Application                       │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         AgentSdkCodingAgent                    │    │
│  │  - 任务管理                                     │    │
│  │  - 模式切换                                     │    │
│  │  - 权限配置                                     │    │
│  └─────────────────┬──────────────────────────────┘    │
│                    │                                     │
│  ┌─────────────────▼──────────────────────────────┐    │
│  │         AgentSdkWrapper                        │    │
│  │  - Rust-Node.js 桥接                           │    │
│  │  - JSON 序列化                                  │    │
│  │  - 进程管理                                     │    │
│  └─────────────────┬──────────────────────────────┘    │
└────────────────────┼──────────────────────────────────┘
                     │
                     │ IPC (stdin/stdout)
                     │
┌────────────────────▼──────────────────────────────────┐
│              Node.js Bridge Process                    │
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │    ClaudeAgentSdkBridge                      │    │
│  │  - Agent 工作循环                             │    │
│  │  - 工具管理                                   │    │
│  │  - 权限检查                                   │    │
│  └─────────────────┬────────────────────────────┘    │
│                    │                                   │
│  ┌─────────────────▼────────────────────────────┐    │
│  │    @anthropic-ai/sdk (实际调用)              │    │
│  │  - Claude API 通信                            │    │
│  │  - Tool Use 处理                              │    │
│  │  - 消息管理                                   │    │
│  └──────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

### 数据流

```
用户请求 → Rust Agent → JSON 序列化 → Node.js Bridge
                                          ↓
                                    Claude API
                                          ↓
                                    工具执行
                                          ↓
                                    响应返回 → Rust
```

## 核心概念

### 1. Agent 工作模式

| 模式       | 说明     | 允许的工具        | 使用场景           |
| ---------- | -------- | ----------------- | ------------------ |
| `Analysis` | 代码分析 | Read              | 理解代码、分析架构 |
| `Code`     | 代码生成 | Read, Write       | 创建新文件和代码   |
| `Edit`     | 代码编辑 | Read, Write, Edit | 修改现有代码       |
| `Debug`    | 调试     | Read, Bash        | 查找问题、运行测试 |
| `Refactor` | 重构     | Read, Edit, Write | 改进代码结构       |

### 2. Agent 工作循环

基于 Claude Agent SDK 理念，Agent 按照以下循环工作：

```
1. 收集上下文
   ↓
2. 执行操作
   ↓
3. 验证工作
   ↓
4. 迭代改进
   ↓
   (循环直到完成)
```

### 3. 权限控制

```rust
use tauri_code_base_analyzer::agent_sdk_wrapper::PermissionConfig;

let permissions = PermissionConfig {
    allow_all: false,
    allow_patterns: vec![
        "Read(*)".to_string(),                    // 允许读取所有文件
        "Write(/tmp/*)".to_string(),              // 允许写入 /tmp
        "Bash(cargo test)".to_string(),           // 允许运行测试
    ],
    deny_patterns: vec![
        "Bash(rm -rf)".to_string(),               // 禁止危险命令
        "Write(/etc/*)".to_string(),              // 禁止写入系统目录
    ],
};
```

### 4. CLAUDE.md 项目上下文

Agent 会自动读取或生成 `CLAUDE.md` 文件，包含：

- 项目信息和结构
- 代码规范
- Agent 工作原则
- 安全要求
- 最佳实践

## 使用示例

### 示例 1: 代码分析

```rust
let mut agent = AgentSdkCodingAgent::new(workspace)?;
agent.set_mode(AgentSdkMode::Analysis);

let response = agent.analyze_files(
    "分析 main.rs 的架构和设计模式".to_string(),
    vec!["main.rs".to_string()],
).await?;

println!("分析结果: {}", response.content);
```

### 示例 2: 代码生成

```rust
agent.set_mode(AgentSdkMode::Code);

let response = agent.generate_code(
    "创建一个 HTTP 客户端模块，使用 reqwest".to_string(),
).await?;

println!("生成的文件: {:?}", response.files_modified);
```

### 示例 3: 代码编辑

```rust
agent.set_mode(AgentSdkMode::Edit);

let response = agent.edit_code(
    "在 main.rs 中添加错误处理".to_string(),
    vec!["main.rs".to_string()],
).await?;

println!("代码变更: {}", response.code_changes.len());
```

### 示例 4: 调试

```rust
agent.set_mode(AgentSdkMode::Debug);

let response = agent.debug(
    "运行测试并修复失败的测试用例".to_string(),
    vec!["tests/".to_string()],
).await?;

println!("执行的命令: {:?}", response.commands_executed);
```

### 示例 5: 重构

```rust
agent.set_mode(AgentSdkMode::Refactor);

let response = agent.refactor(
    "重构 utils.rs，提取重复代码".to_string(),
    vec!["utils.rs".to_string()],
).await?;

println!("重构完成: {:?}", response.files_modified);
```

### 示例 6: 自定义配置

```rust
use tauri_code_base_analyzer::agent_core::AgentSdkConfig;

let config = AgentSdkConfig {
    max_turns: 15,                      // 最大轮数
    max_tokens: 16384,                  // 最大 tokens
    save_history: true,                 // 保存历史
    auto_permissions: true,             // 自动权限
    sdk_mode: "headless".to_string(),   // SDK 模式
};

let agent = AgentSdkCodingAgent::with_config(workspace, config)?;
```

## API 参考

### AgentSdkCodingAgent

#### 创建方法

```rust
// 默认配置
pub fn new(workspace: String) -> Result<Self, Box<dyn std::error::Error>>

// 自定义配置
pub fn with_config(
    workspace: String,
    config: AgentConfig,
) -> Result<Self, Box<dyn std::error::Error>>
```

#### 模式设置

```rust
pub fn set_mode(&mut self, mode: AgentMode)
```

#### 执行方法

```rust
// 通用执行
pub async fn execute(&self, task: CodingTask)
    -> Result<AgentSdkResponse, Box<dyn std::error::Error>>

// 代码分析
pub async fn analyze(&self, prompt: String)
    -> Result<String, Box<dyn std::error::Error>>

pub async fn analyze_files(&self, prompt: String, files: Vec<String>)
    -> Result<AgentSdkResponse, Box<dyn std::error::Error>>

// 代码生成
pub async fn generate_code(&self, prompt: String)
    -> Result<AgentSdkResponse, Box<dyn std::error::Error>>

// 代码编辑
pub async fn edit_code(&self, prompt: String, files: Vec<String>)
    -> Result<AgentSdkResponse, Box<dyn std::error::Error>>

// 调试
pub async fn debug(&self, prompt: String, files: Vec<String>)
    -> Result<AgentSdkResponse, Box<dyn std::error::Error>>

// 重构
pub async fn refactor(&self, prompt: String, files: Vec<String>)
    -> Result<AgentSdkResponse, Box<dyn std::error::Error>>
```

### AgentSdkResponse

```rust
pub struct AgentSdkResponse {
    pub success: bool,                      // 是否成功
    pub content: String,                    // Agent 返回内容
    pub code_changes: Vec<CodeChange>,      // 代码变更列表
    pub tool_uses: Vec<ToolUse>,            // 工具使用记录
    pub files_modified: Vec<String>,        // 修改的文件
    pub commands_executed: Vec<String>,     // 执行的命令
    pub conversation_id: String,            // 对话 ID
    pub turn_count: u32,                    // 对话轮数
    pub is_complete: bool,                  // 是否完成
    pub error: Option<String>,              // 错误信息
    pub warnings: Vec<String>,              // 警告
    pub suggestions: Vec<String>,           // 建议
    pub agent_info: AgentInfo,              // Agent 信息
}
```

## 最佳实践

### 1. 提示词编写

✅ **好的提示词：**

```rust
"分析 user_service.rs 中的认证逻辑，检查是否有安全漏洞，\
 特别关注密码处理和 token 验证部分"
```

❌ **不好的提示词：**

```rust
"看一下代码"
```

### 2. 文件列表

✅ **指定相关文件：**

```rust
let files = vec![
    "src/auth/user_service.rs".to_string(),
    "src/auth/token.rs".to_string(),
];
agent.analyze_files(prompt, files).await?;
```

❌ **不指定文件（Agent 需要自己查找）：**

```rust
agent.analyze(prompt).await?;  // 可能找不到正确的文件
```

### 3. 模式选择

根据任务选择合适的模式：

- 📖 **Analysis** - 需要理解代码时
- ✏️ **Edit** - 修改现有代码时
- 📝 **Code** - 创建新代码时
- 🐛 **Debug** - 需要运行和测试时
- 🔄 **Refactor** - 优化代码结构时

### 4. 权限配置

```rust
// 生产环境推荐配置
let permissions = PermissionConfig {
    allow_all: false,
    allow_patterns: vec![
        format!("Read(*)"),
        format!("Write({}/*)", workspace),
        format!("Edit({}/*)", workspace),
    ],
    deny_patterns: vec![
        "Bash(rm -rf)".to_string(),
        "Bash(sudo *)".to_string(),
        "Write(/etc/*)".to_string(),
        "Write(/sys/*)".to_string(),
    ],
};
```

### 5. 错误处理

```rust
match agent.generate_code(prompt).await {
    Ok(response) => {
        if response.success {
            println!("✅ 成功: {}", response.content);
        } else {
            eprintln!("❌ 失败: {:?}", response.error);
        }
    }
    Err(e) => {
        eprintln!("❌ 错误: {}", e);
    }
}
```

### 6. Token 管理

```rust
// 监控 token 使用
let response = agent.execute(task).await?;
println!("Token 使用: {}", response.agent_info.total_tokens);

// 调整 max_tokens
let mut config = AgentSdkConfig::default();
config.max_tokens = 4096;  // 减少 token 使用
agent.set_config(config);
```

## 故障排除

### 问题 1: Bridge script not found

**错误：**

```
Agent SDK bridge script not found at scripts/dist/agent-sdk-bridge.js
```

**解决：**

```bash
cd scripts
npm install
npm run build:agent
```

### 问题 2: ANTHROPIC_API_KEY not set

**错误：**

```
ANTHROPIC_API_KEY not set
```

**解决：**

```bash
# 在 src-tauri/.env 中设置
echo "ANTHROPIC_API_KEY=your-key-here" > src-tauri/.env
```

### 问题 3: Permission denied

**错误：**

```
权限拒绝: 不允许写入此文件
```

**解决：**

- 检查权限配置
- 确保路径在允许列表中
- 或设置 `allow_all: true`（不推荐生产环境）

### 问题 4: Tool execution failed

**错误：**

```
工具执行错误: 文件不存在
```

**解决：**

- 检查文件路径是否正确（相对于 workspace）
- 确保文件存在
- 检查权限

### 问题 5: Token limit exceeded

**错误：**

```
使用了过多 tokens
```

**解决：**

- 减少 `max_tokens`
- 减少 `max_turns`
- 限制文件内容长度
- 使用更精确的提示词

## 与原有 ClaudeClient 的关系

本项目保留了原有的 `claude_client` 模块，因为：

1. **Enrichment 功能** - `enrichment` 模块直接使用 `ClaudeClient` 进行代码实体的 LLM 标注
2. **简单 API 调用** - 某些场景只需要简单的 Claude API 调用，不需要完整的 Agent 功能
3. **向后兼容** - 保持现有代码正常工作

### 选择指南

| 场景                   | 推荐使用              |
| ---------------------- | --------------------- |
| 复杂编程任务（多步骤） | `AgentSdkCodingAgent` |
| 代码生成、编辑、重构   | `AgentSdkCodingAgent` |
| 需要工具调用           | `AgentSdkCodingAgent` |
| 简单文本生成           | `ClaudeClient`        |
| 代码实体标注           | `ClaudeClient`        |
| 单次 API 调用          | `ClaudeClient`        |

## 相关资源

- [Anthropic Agent SDK 官方文档](https://docs.anthropic.com/en/docs/claude-code/sdk)
- [Claude API 文档](https://docs.anthropic.com/en/api)
- [项目示例代码](./src-tauri/examples/agent_sdk_example.rs)

## 总结

Claude Agent SDK 为本项目提供了强大的 AI 编程助手能力，通过：

✅ 自主的工作循环
✅ 丰富的工具集成
✅ 细粒度的权限控制
✅ 生产级的错误处理

可以安全、高效地完成各种编程任务。
