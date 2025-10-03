# 🚀 快速开始 - Real Claude Agent SDK

5 分钟快速上手真正的 Claude Agent SDK！

---

## ⚡ 快速开始

### 1️⃣ 环境准备（2 分钟）

```bash
# 进入项目
cd /Users/songdingan/dev/tauri-code-base-analyzer

# 安装 Node.js 依赖
cd scripts
npm install

# 构建 Real SDK Bridge
npm run build:real-agent

# 验证构建成功
ls -la dist/real-agent-sdk-bridge.js
```

### 2️⃣ 配置 API Key（1 分钟）

```bash
# 设置环境变量
cd ../src-tauri
echo "ANTHROPIC_API_KEY=your-api-key-here" > .env

# 或者编辑 .env 文件
# nano .env
```

### 3️⃣ 运行示例（2 分钟）

```bash
# 运行 Real SDK 示例
cargo run --example real_agent_sdk_example

# 查看生成的文件
ls -la /tmp/real_agent_sdk_demo/
```

---

## 💻 第一个程序

创建 `my_first_agent.rs`:

```rust
use tauri_code_base_analyzer::agent_core::{
    RealAgentSdkCodingAgent, RealAgentSdkMode
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv::dotenv().ok();

    // 1. 创建 Agent
    let mut agent = RealAgentSdkCodingAgent::new(
        "/tmp/my_project".to_string()
    )?;

    // 2. 设置模式
    agent.set_mode(RealAgentSdkMode::Code);

    // 3. 执行任务
    let response = agent.generate_code(
        "创建一个 hello.rs 文件，打印 Hello, World!".to_string()
    ).await?;

    // 4. 查看结果
    println!("✅ 完成!");
    println!("内容: {}", response.content);
    println!("Token: {}", response.agent_info.total_tokens);
    println!("成本: ${:.4}", response.agent_info.total_cost_usd);

    Ok(())
}
```

---

## 🎯 五种模式

### 1. Analysis - 代码分析

```rust
agent.set_mode(RealAgentSdkMode::Analysis);
let result = agent.analyze("分析 main.rs".to_string()).await?;
```

### 2. Code - 代码生成

```rust
agent.set_mode(RealAgentSdkMode::Code);
let result = agent.generate_code("创建一个模块".to_string()).await?;
```

### 3. Edit - 代码编辑

```rust
agent.set_mode(RealAgentSdkMode::Edit);
let result = agent.edit_code(
    "添加错误处理".to_string(),
    vec!["main.rs".to_string()]
).await?;
```

### 4. Debug - 调试

```rust
agent.set_mode(RealAgentSdkMode::Debug);
let result = agent.debug(
    "运行测试".to_string(),
    vec!["tests/".to_string()]
).await?;
```

### 5. Refactor - 重构

```rust
agent.set_mode(RealAgentSdkMode::Refactor);
let result = agent.refactor(
    "优化性能".to_string(),
    vec!["lib.rs".to_string()]
).await?;
```

---

## 📊 查看统计

```rust
let response = agent.generate_code(prompt).await?;

// Agent 信息
println!("SDK 版本: {}", response.agent_info.sdk_version);
println!("模型: {}", response.agent_info.model);
println!("Token: {}", response.agent_info.total_tokens);
println!("成本: ${:.4}", response.agent_info.total_cost_usd);

// 任务信息
println!("对话 ID: {}", response.conversation_id);
println!("轮数: {}", response.turn_count);
println!("修改的文件: {:?}", response.files_modified);
println!("执行的命令: {:?}", response.commands_executed);
```

---

## 🔧 自定义配置

```rust
use tauri_code_base_analyzer::agent_core::RealAgentSdkConfig;

let config = RealAgentSdkConfig {
    max_turns: 15,           // 最大轮数
    max_tokens: 16384,       // 最大 tokens
    save_history: true,      // 保存历史
    auto_permissions: true,  // 自动权限
    sdk_mode: "headless".to_string(), // SDK 模式
};

let agent = RealAgentSdkCodingAgent::with_config(workspace, config)?;
```

---

## ⚠️ 故障排除

### Bridge script not found

```bash
cd scripts
npm install
npm run build:real-agent
```

### API Key 未设置

```bash
echo "ANTHROPIC_API_KEY=your-key" > src-tauri/.env
```

### Node.js 未找到

确保 Node.js 已安装并在 PATH 中。

---

## 📚 更多资源

- **完整架构**: `REAL_AGENT_SDK_ARCHITECTURE.md`
- **集成总结**: `REAL_SDK_INTEGRATION_COMPLETE.md`
- **示例代码**: `src-tauri/examples/real_agent_sdk_example.rs`

---

## ✨ 核心优势

✅ **官方 SDK** - Anthropic 官方  
✅ **Agent 循环** - SDK 内置  
✅ **工具管理** - SDK 自动管理  
✅ **成本追踪** - 自动统计  
✅ **生产就绪** - 完整功能

---

**开始使用 Real Claude Agent SDK！** 🚀
