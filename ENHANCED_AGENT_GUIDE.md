# 🤖 增强型 AI Coding Agent 使用指南

> 基于 Claude API 实现的完整 AI 编程助手，提供类似 Claude Code SDK 的功能

---

## ✨ 核心功能

### 🎯 **五种专业模式**

1. **Analysis (分析)** - 只读模式，深入理解代码

   - 分析代码结构和逻辑
   - 识别潜在问题
   - 提供改进建议

2. **Edit (编辑)** - 修改现有代码

   - 局部代码优化
   - Bug 修复
   - 功能增强

3. **Generate (生成)** - 创建新代码

   - 从零创建文件
   - 实现新功能
   - 生成模板代码

4. **Debug (调试)** - 查找和修复问题

   - 运行测试命令
   - 分析错误信息
   - 定位问题根源

5. **Refactor (重构)** - 改进代码质量
   - 优化代码结构
   - 消除代码重复
   - 应用设计模式

### 🔧 **内置工具**

- **Read** - 读取文件内容
- **Write** - 创建或覆盖文件
- **Edit** - 搜索替换编辑文件
- **Bash** - 执行系统命令

### 🔒 **安全特性**

- ✅ 细粒度权限控制
- ✅ 工作空间沙箱隔离
- ✅ 危险命令拦截
- ✅ 完整的操作日志

---

## 🚀 快速开始

### 1. 环境设置

```bash
# 1. 设置 API Key
export ANTHROPIC_API_KEY="your-api-key"

# 或创建 .env 文件
echo 'ANTHROPIC_API_KEY=your-api-key' > src-tauri/.env
```

### 2. 构建桥接器

```bash
cd scripts
npm install
npm run build:enhanced
```

### 3. 运行示例

```bash
cd src-tauri
cargo run --example enhanced_agent_example
```

---

## 📖 使用示例

### 示例 1: 代码分析

```rust
use tauri_code_base_analyzer::agent_core::enhanced_coding_agent::{
    EnhancedCodingAgent, AgentMode, CodingTask,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv::dotenv().ok();

    // 创建 Agent
    let workspace = std::env::current_dir()?.to_string_lossy().to_string();
    let mut agent = EnhancedCodingAgent::new(workspace)?;
    agent.set_mode(AgentMode::Analysis);

    // 分析代码
    let task = CodingTask {
        prompt: "分析 src/main.rs 的主要功能".to_string(),
        files: vec!["src/main.rs".to_string()],
        verbose: true,
    };

    let response = agent.execute(task).await?;

    println!("分析结果: {}", response.content);
    println!("工具使用: {:?}", response.tool_uses);

    Ok(())
}
```

### 示例 2: 代码生成

```rust
let mut agent = EnhancedCodingAgent::new("/path/to/project".to_string())?;
agent.set_mode(AgentMode::Generate);

let response = agent.generate(
    "创建一个 REST API 服务，使用 actix-web".to_string()
).await?;

println!("创建的文件: {:?}", response.files_modified);
```

### 示例 3: 调试

```rust
let mut agent = EnhancedCodingAgent::new(workspace)?;
agent.set_mode(AgentMode::Debug);

let response = agent.debug(
    "项目无法编译，请帮我找出问题".to_string(),
    vec!["Cargo.toml".to_string(), "src/main.rs".to_string()],
).await?;

println!("调试结果: {}", response.content);
println!("执行的命令: {:?}", response.commands_executed);
```

### 示例 4: 重构

```rust
let mut agent = EnhancedCodingAgent::new(workspace)?;
agent.set_mode(AgentMode::Refactor);

let response = agent.refactor(
    "重构这个文件，提高代码可读性".to_string(),
    vec!["src/handlers.rs".to_string()],
).await?;

println!("代码变更: {} 处", response.code_changes.len());
```

---

## 🎛️ 高级配置

### 自定义 Agent 配置

```rust
use tauri_code_base_analyzer::agent_core::enhanced_coding_agent::{
    EnhancedCodingAgent, AgentConfig,
};

let config = AgentConfig {
    max_turns: 15,           // 最大工具调用轮数
    max_tokens: 16384,       // 最大 token 数
    save_history: true,      // 保存对话历史
    auto_permissions: true,  // 自动配置权限
};

let agent = EnhancedCodingAgent::with_config(workspace, config)?;
```

### 自定义权限配置

```rust
use tauri_code_base_analyzer::enhanced_claude_wrapper::PermissionConfig;

let permissions = PermissionConfig {
    allow_all: false,
    allow_patterns: vec![
        "Read(*)".to_string(),
        "Write(src/*)".to_string(),
        "Bash(cargo test)".to_string(),
    ],
    deny_patterns: vec![
        "Bash(rm -rf)".to_string(),
        "Write(/etc/*)".to_string(),
    ],
};
```

### 项目上下文 (CLAUDE.md)

在项目根目录创建 `CLAUDE.md` 文件：

```markdown
# 项目信息

- 项目名称: My Awesome Project
- 技术栈: Rust + Actix-web
- 数据库: PostgreSQL

## 代码规范

- 使用 4 空格缩进
- 函数命名: snake_case
- 类型命名: PascalCase
- 必须添加文档注释

## 测试要求

- 单元测试覆盖率 > 80%
- 集成测试所有 API 端点
- 使用 cargo test 运行测试

## Git 工作流

- 分支命名: feature/功能名
- 提交信息: 中文描述
- 必须通过 CI 检查
```

Agent 会自动读取此文件作为上下文。

---

## 📊 响应结构

```rust
pub struct EnhancedClaudeResponse {
    pub success: bool,                  // 是否成功
    pub content: String,                // AI 的回复内容
    pub code_changes: Vec<CodeChange>,  // 代码变更列表
    pub tool_uses: Vec<ToolUse>,        // 工具使用记录
    pub files_modified: Vec<String>,    // 修改的文件列表
    pub commands_executed: Vec<String>, // 执行的命令列表
    pub conversation_id: String,        // 对话 ID
    pub turn_count: u32,                // 对话轮数
    pub is_complete: bool,              // 是否完成
    pub error: Option<String>,          // 错误信息
    pub warnings: Vec<String>,          // 警告信息
    pub suggestions: Vec<String>,       // 建议
}
```

---

## 🔍 工作原理

```
┌─────────────────────────────────────────────┐
│  Rust Application                            │
│                                              │
│  EnhancedCodingAgent                        │
│  ↓                                          │
│  EnhancedClaudeWrapper                      │
└──────────────┬──────────────────────────────┘
               │ stdin/stdout (JSON)
┌──────────────▼──────────────────────────────┐
│  Node.js Bridge                              │
│                                              │
│  enhanced-claude-bridge.ts                  │
│  ↓                                          │
│  @anthropic-ai/sdk                          │
│  ↓                                          │
│  - 读取 CLAUDE.md                           │
│  - 配置权限                                  │
│  - 构建专业提示词                            │
│  - 执行工具调用                              │
│  - 追踪代码变更                              │
└──────────────┬──────────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────────┐
│  Anthropic Claude API                       │
└─────────────────────────────────────────────┘
```

---

## 🛠️ 开发和测试

### 运行测试

```bash
# 运行所有测试
cargo test --lib agent_core::enhanced_coding_agent

# 运行单个测试
cargo test test_enhanced_agent_analyze -- --ignored --nocapture

# 运行示例
cargo run --example enhanced_agent_example
```

### 调试模式

设置环境变量启用详细日志：

```bash
export RUST_LOG=debug
cargo run --example enhanced_agent_example
```

---

## 📈 性能优化

### 1. 减少 Token 使用

```rust
let config = AgentConfig {
    max_tokens: 4096,  // 降低 token 限制
    ..Default::default()
};
```

### 2. 限制工具调用轮数

```rust
let config = AgentConfig {
    max_turns: 5,  // 减少轮数
    ..Default::default()
};
```

### 3. 只包含必要文件

```rust
let task = CodingTask {
    prompt: "分析代码".to_string(),
    files: vec!["src/main.rs".to_string()],  // 只包含相关文件
    verbose: false,  // 禁用详细模式
};
```

---

## ⚠️ 常见问题

### 1. Bridge Script 未找到

**错误:**

```
Enhanced Claude bridge script not found
```

**解决方案:**

```bash
cd scripts
npm install
npm run build:enhanced
```

### 2. API Key 错误

**错误:**

```
ANTHROPIC_API_KEY not set
```

**解决方案:**

```bash
export ANTHROPIC_API_KEY="your-key"
# 或创建 .env 文件
```

### 3. 权限被拒绝

**错误:**

```
权限拒绝: 不允许写入此文件
```

**解决方案:**
检查权限配置，确保允许该操作：

```rust
PermissionConfig {
    allow_patterns: vec!["Write(your/path/*)".to_string()],
    ..Default::default()
}
```

### 4. 工具调用超限

**错误:**

```
达到最大工具调用次数
```

**解决方案:**

- 简化任务描述
- 增加 `max_turns`
- 分解为多个小任务

---

## 🎯 最佳实践

### 1. 明确的任务描述

❌ **不好:**

```rust
agent.execute(CodingTask {
    prompt: "改进代码".to_string(),
    ..
});
```

✅ **好:**

```rust
agent.execute(CodingTask {
    prompt: "重构 src/handlers.rs 中的 handle_request 函数，\
             提取重复的验证逻辑到单独的函数".to_string(),
    files: vec!["src/handlers.rs".to_string()],
    ..
});
```

### 2. 选择合适的模式

- 📊 只需要理解代码 → `Analysis`
- ✏️ 修改现有代码 → `Edit`
- ⚡ 创建新代码 → `Generate`
- 🐛 解决问题 → `Debug`
- 🔨 改进结构 → `Refactor`

### 3. 提供相关文件

```rust
let task = CodingTask {
    prompt: "优化用户认证逻辑".to_string(),
    files: vec![
        "src/auth/mod.rs".to_string(),
        "src/auth/middleware.rs".to_string(),
        "src/models/user.rs".to_string(),
    ],
    verbose: true,
};
```

### 4. 检查响应

```rust
let response = agent.execute(task).await?;

if response.success {
    // 检查代码变更
    for change in &response.code_changes {
        println!("修改: {} ({})", change.file_path, change.change_type);
    }

    // 查看建议
    for suggestion in &response.suggestions {
        println!("建议: {}", suggestion);
    }

    // 注意警告
    for warning in &response.warnings {
        eprintln!("警告: {}", warning);
    }
} else {
    eprintln!("错误: {:?}", response.error);
}
```

---

## 📚 API 参考

### EnhancedCodingAgent

```rust
impl EnhancedCodingAgent {
    // 创建
    pub fn new(workspace: String) -> Result<Self, Box<dyn std::error::Error>>;
    pub fn with_config(workspace: String, config: AgentConfig) -> Result<Self, Box<dyn std::error::Error>>;

    // 配置
    pub fn set_mode(&mut self, mode: AgentMode);

    // 执行任务
    pub async fn execute(&self, task: CodingTask) -> Result<EnhancedClaudeResponse, Box<dyn std::error::Error>>;

    // 便捷方法
    pub async fn analyze(&self, prompt: String) -> Result<String, Box<dyn std::error::Error>>;
    pub async fn generate(&self, prompt: String) -> Result<EnhancedClaudeResponse, Box<dyn std::error::Error>>;
    pub async fn debug(&self, prompt: String, files: Vec<String>) -> Result<EnhancedClaudeResponse, Box<dyn std::error::Error>>;
    pub async fn refactor(&self, prompt: String, files: Vec<String>) -> Result<EnhancedClaudeResponse, Box<dyn std::error::Error>>;

    // 查询
    pub fn config(&self) -> &AgentConfig;
    pub fn mode(&self) -> &AgentMode;
    pub fn workspace(&self) -> &str;
}
```

---

## 🎉 总结

增强型 AI Coding Agent 为你提供：

- ✅ **专业模式** - 5 种针对不同场景优化的模式
- ✅ **智能工具** - 自动化的工具调用和管理
- ✅ **安全可控** - 细粒度权限和沙箱隔离
- ✅ **完整追踪** - 详细的操作日志和变更记录
- ✅ **易于使用** - 简洁的 Rust API
- ✅ **生产就绪** - 完善的错误处理和测试

**开始使用:**

```bash
cargo run --example enhanced_agent_example
```

**需要帮助?** 查看示例代码或提 Issue！🚀
