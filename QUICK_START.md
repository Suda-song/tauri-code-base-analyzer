# 🚀 快速开始

## 前置要求

1. **Rust** (已安装 ✅)
2. **Node.js + pnpm** (已安装 ✅)
3. **claude-code-router**:
   ```bash
   pnpm install -g @musistudio/claude-code-router
   ```

## 一键运行

```bash
./scripts/run-mcp-agent.sh
```

这个脚本会自动：

1. ✅ 编译 Rust MCP 服务器
2. ✅ 编译 Node.js Bridge
3. ✅ 启动 claude-code-router (代理到 DeerAPI)
4. ✅ 运行示例

## 手动运行

### Step 1: 编译

```bash
# 1. 编译 MCP 服务器
cargo build --release -p codebase-mcp-server

# 2. 编译 Bridge
cd scripts && pnpm install && pnpm run build:mcp && cd ..
```

### Step 2: 启动 Router

```bash
# 配置并启动 claude-code-router
ccr start
```

### Step 3: 运行示例

```bash
# 运行 MCP Agent 示例
cargo run --example mcp_agent_example
```

## 配置说明

### DeerAPI Key

在 `router-config.json` 中已配置：

```json
{
  "Providers": [
    {
      "name": "deerapi",
      "api_base_url": "https://api.deerapi.com/v1/messages",
      "api_key": "sk-iJMVP8lVZW8jG2qlaz2krbFKJOHYzdzKXLa5fUWS10lIl3gb"
    }
  ]
}
```

### 环境变量 (可选)

在 `src-tauri/.env` 中可以设置：

```bash
ANTHROPIC_API_KEY=sk-xxx  # SDK 会读取，router 会拦截并代理
```

## 架构说明

```
Rust 应用 (mcp_agent_example.rs)
  ↓ 调用
Node.js Bridge (mcp-agent-bridge.ts)
  ↓ query({ prompt, mcpServers })
@anthropic-ai/claude-agent-sdk
  ↓ 自动管理
MCP 服务器 (codebase-mcp-server)
  ↓ 使用
代码分析工具 (FileWalker, Extractors...)
```

## 示例输出

```
🤖 MCP Agent 代码分析示例
============================================================

📂 项目路径: /path/to/project

🚀 启动 MCP Agent Bridge...

📩 消息类型: assistant
  🔧 工具调用: scan_project
📩 消息类型: assistant

✅ 任务完成
  轮数: 2
  Token: 8520
  成本: $0.0128

============================================================
✅ 分析完成!
============================================================

📊 AI 分析报告:

该项目包含 25 个 Vue 组件...
```

## 故障排查

### 1. MCP 服务器编译失败

```bash
# 清理并重新编译
cargo clean
cargo build --release -p codebase-mcp-server
```

### 2. Bridge 编译失败

```bash
# 重新安装依赖
cd scripts
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm run build:mcp
```

### 3. Router 无法启动

```bash
# 检查是否已安装
ccr --version

# 停止旧进程
ccr stop
pkill -f "ccr start"

# 重新启动
ccr start
```

### 4. 测试 Router 是否工作

```bash
curl -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-sonnet-4-5-20250929","messages":[{"role":"user","content":"Hello"}],"max_tokens":100}'
```

## 文档

- [README.md](./README.md) - 项目说明
- [COMPLETE_ARCHITECTURE.md](./COMPLETE_ARCHITECTURE.md) - 完整架构
- [MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md) - 迁移总结

## 下一步

### 添加新的 MCP 工具

编辑 `crates/codebase-mcp-server/src/main.rs`：

```rust
// 1. 添加工具定义
Tool {
    name: "your_tool".to_string(),
    description: "...".to_string(),
    input_schema: json!({...}),
}

// 2. 添加工具执行逻辑
"your_tool" => {
    // 实现逻辑
    Ok(json!({ "result": "..." }))
}
```

重新编译后，AI 自动可用！

## 成功标志

如果你看到以下输出，说明一切正常：

```
✅ MCP 服务器编译完成
✅ Bridge 编译完成
✅ Router 就绪
✅ 分析完成!
```

🎉 恭喜！你已经成功运行了基于官方 Claude Agent SDK 的代码分析系统！
