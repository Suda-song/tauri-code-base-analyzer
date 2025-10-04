# Tauri 代码库分析器 (MCP Agent 架构)

基于 **Claude Agent SDK** 和 **MCP 协议** 的代码分析 AI Agent 系统。

## 🎯 核心特性

- ✅ **官方 SDK 驱动**: 使用 `@anthropic-ai/claude-agent-sdk@0.1.5`
- ✅ **MCP 工具扩展**: 通过 MCP 协议提供代码分析工具
- ✅ **DeerAPI 支持**: 通过 `claude-code-router` 代理到 DeerAPI
- ✅ **极简架构**: 总代码量 ~280 行 (相比传统方案节省 73%)

## 📋 项目结构

```
tauri-code-base-analyzer/
├── crates/
│   └── codebase-mcp-server/          # MCP 服务器 (提供代码分析工具)
│       ├── src/main.rs                # MCP 协议实现
│       └── Cargo.toml
│
├── src-tauri/
│   ├── src/
│   │   ├── claude_client/             # Claude API 客户端 (仅用于 enrichment)
│   │   └── tool_execution/            # 代码分析工具
│   │       └── codebase/              # 代码库分析模块
│   │           ├── extractors/        # 代码提取器 (TS/Vue)
│   │           ├── enrichment/        # LLM 增强
│   │           ├── embeddings.rs      # 向量化
│   │           ├── chunking.rs        # 代码分块
│   │           └── file_walker.rs     # 项目扫描
│   ├── examples/
│   │   └── mcp_agent_example.rs       # MCP Agent 示例
│   └── Cargo.toml
│
├── scripts/
│   ├── mcp-agent-bridge.ts            # Node.js Bridge (极简)
│   ├── run-mcp-agent.sh               # 完整运行脚本
│   ├── package.json
│   └── dist/                          # 编译输出
│
├── router-config.json                 # claude-code-router 配置
├── COMPLETE_ARCHITECTURE.md           # 完整架构文档
├── CLAUDE_AGENT_SDK_DEEP_DIVE.md     # SDK 深度解析
└── README.md
```

## 🚀 快速开始

### 前置要求

1. **Rust** (>= 1.70)
2. **Node.js** (>= 18) 和 **pnpm**
3. **claude-code-router**:
   ```bash
   pnpm install -g @musistudio/claude-code-router
   ```

### 步骤 1: 配置 API Key

在 `src-tauri/.env` 文件中设置（可选，router 配置已包含）：

```bash
ANTHROPIC_API_KEY=sk-xxx  # DeerAPI Key
```

### 步骤 2: 一键运行

```bash
./scripts/run-mcp-agent.sh
```

这个脚本会自动：

1. 编译 Rust MCP 服务器
2. 编译 Node.js Bridge
3. 启动 claude-code-router
4. 运行示例

### 手动运行

```bash
# 1. 编译 MCP 服务器
cargo build --release -p codebase-mcp-server

# 2. 编译 Bridge
cd scripts && pnpm install && pnpm run build:mcp && cd ..

# 3. 启动 router
ccr start &

# 4. 运行示例
cargo run --example mcp_agent_example
```

## 🔧 MCP 工具

MCP 服务器提供以下工具：

### 1. `scan_project` - 扫描项目

```json
{
  "project_path": "/path/to/project",
  "extensions": [".ts", ".tsx", ".vue"]
}
```

**功能**: 扫描项目目录，提取所有代码实体（组件、函数、类等）

### 2. `analyze_entity` - 分析实体

```json
{
  "entity_id": "Component:Header",
  "project_path": "/path/to/project"
}
```

**功能**: 分析特定实体的依赖关系、调用关系

### 3. `enrich_code` - 生成摘要

```json
{
  "entities_json_path": "/path/to/entities.json",
  "output_path": "entities.enriched.json",
  "concurrency": 5
}
```

**功能**: 使用 LLM 为代码生成摘要和标签

## 📚 架构说明

### 极简三层架构

```
Rust 应用 (50 行)
  ↓ 调用
Node.js Bridge (30 行)
  ↓ query({ prompt, options: { mcpServers } })
@anthropic-ai/claude-agent-sdk (官方)
  ↓ 自动管理 Agent 循环、工具调用
MCP 服务器 (200 行)
  ↓ 调用
代码分析工具 (FileWalker, Extractors, Enrichment...)
```

### 为什么这么简单？

**官方 SDK 已经提供了**:

- ✅ Agent 自动循环
- ✅ 工具自动调用
- ✅ 权限管理
- ✅ 错误处理
- ✅ 成本追踪
- ✅ 会话管理

**我们只需要**:

- 📦 实现代码分析工具 (作为 MCP 服务器)
- 🔌 配置 MCP 连接

详见: [COMPLETE_ARCHITECTURE.md](./COMPLETE_ARCHITECTURE.md)

## 🔑 DeerAPI 配置

通过 `claude-code-router` 代理到 DeerAPI：

```json
{
  "Providers": [
    {
      "name": "deerapi",
      "api_base_url": "https://api.deerapi.com/v1/messages",
      "api_key": "sk-xxx",
      "models": ["claude-sonnet-4-5-20250929"]
    }
  ],
  "Router": {
    "default": "deerapi,claude-sonnet-4-5-20250929"
  }
}
```

配置文件: `router-config.json`

## 📖 文档

- [COMPLETE_ARCHITECTURE.md](./COMPLETE_ARCHITECTURE.md) - 完整架构设计
- [CLAUDE_AGENT_SDK_DEEP_DIVE.md](./CLAUDE_AGENT_SDK_DEEP_DIVE.md) - SDK 深度解析

## 🎉 示例输出

```
🤖 MCP Agent 代码分析示例
============================================================

📂 项目路径: /path/to/vue-project

📝 任务描述:
   - 扫描项目并提取代码实体
   - 统计各类型实体数量
   - 生成项目概览报告

🚀 启动 MCP Agent Bridge...

📩 消息类型: assistant
  🔧 工具调用: scan_project
📩 消息类型: assistant
  🔧 工具调用: enrich_code

✅ 任务完成
  轮数: 3
  Token: 15420
  成本: $0.0234

============================================================
✅ 分析完成!
============================================================

📊 AI 分析报告:

该项目包含 25 个 Vue 组件：

核心组件:
• Header (src/components/Header.vue) - 页面头部导航组件
  - 依赖: Icon, Menu
  - 事件: onMenuClick, onLogout

• UserCard (src/components/UserCard.vue) - 用户信息卡片
  - 依赖: Avatar, Button
  - Props: userId, showActions

...

============================================================
```

## 🛠️ 开发

### 添加新的 MCP 工具

编辑 `crates/codebase-mcp-server/src/main.rs`:

```rust
Tool {
    name: "your_new_tool".to_string(),
    description: "工具描述".to_string(),
    input_schema: json!({
        "type": "object",
        "properties": {
            "param1": { "type": "string" }
        },
        "required": ["param1"]
    }),
}
```

添加工具执行逻辑：

```rust
"your_new_tool" => {
    // 实现工具逻辑
    Ok(json!({
        "success": true,
        "result": "..."
    }))
}
```

SDK 会自动整合新工具，AI 立即可用！

## 📄 License

MIT

## 🙏 致谢

- [Anthropic](https://www.anthropic.com/) - Claude API 和 Agent SDK
- [DeerAPI](https://deerapi.com/) - Claude API 代理
- [@musistudio/claude-code-router](https://github.com/musilinq/claude-code-router) - API 路由器
