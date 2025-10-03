# 🚀 增强型 AI Coding Agent 快速开始

> 3 分钟快速上手指南

---

## ⚡ 快速开始（3 步）

### 1️⃣ **设置 API Key**

```bash
export ANTHROPIC_API_KEY="your-anthropic-api-key"
```

### 2️⃣ **构建桥接器**

```bash
cd /Users/songdingan/dev/tauri-code-base-analyzer/scripts
npm install
npm run build:enhanced
```

### 3️⃣ **运行示例**

```bash
cd /Users/songdingan/dev/tauri-code-base-analyzer/src-tauri
cargo run --example enhanced_agent_example
```

---

## 💡 基本使用

### 代码分析

```rust
use tauri_code_base_analyzer::agent_core::enhanced_coding_agent::{
    EnhancedCodingAgent, AgentMode,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv::dotenv().ok();

    let mut agent = EnhancedCodingAgent::new(".".to_string())?;
    agent.set_mode(AgentMode::Analysis);

    let result = agent.analyze(
        "分析 src/main.rs 的主要功能".to_string()
    ).await?;

    println!("{}", result);
    Ok(())
}
```

### 代码生成

```rust
let mut agent = EnhancedCodingAgent::new("/tmp/test".to_string())?;
agent.set_mode(AgentMode::Generate);

let response = agent.generate(
    "创建一个 hello.txt 文件".to_string()
).await?;

println!("创建的文件: {:?}", response.files_modified);
```

---

## 📖 完整文档

- **使用指南**: `ENHANCED_AGENT_GUIDE.md`
- **实施报告**: `IMPLEMENTATION_COMPLETE.md`
- **实施计划**: `CLAUDE_CODE_SDK_IMPLEMENTATION_PLAN.md`

---

## 🆘 常见问题

### API Key 错误

```bash
# 确保正确设置
export ANTHROPIC_API_KEY="sk-ant-..."

# 或使用 .env 文件
echo 'ANTHROPIC_API_KEY=sk-ant-...' > src-tauri/.env
```

### Bridge Script 未找到

```bash
cd scripts
npm install
npm run build:enhanced

# 验证
ls -la dist/enhanced-claude-bridge.js
```

### 权限被拒绝

检查你的权限配置是否允许该操作。分析模式默认只有读取权限。

---

## ✨ 5 种专业模式

| 模式         | 用途     | 允许工具          |
| ------------ | -------- | ----------------- |
| **Analysis** | 分析代码 | Read              |
| **Edit**     | 修改代码 | Read, Write, Edit |
| **Generate** | 创建代码 | Read, Write       |
| **Debug**    | 调试问题 | Read, Bash        |
| **Refactor** | 重构代码 | Read, Edit, Write |

---

## 🎯 下一步

1. ✅ 运行示例熟悉功能
2. ✅ 阅读完整文档了解细节
3. ✅ 在你的项目中集成使用
4. ✅ 根据需求自定义配置

**Happy Coding! 🚀**
