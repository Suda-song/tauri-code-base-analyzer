# ⚡ 快速设置指南

## 🎯 一键启动（最简单）

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd tauri-code-base-analyzer

# 2. 安装项目依赖
cd scripts && pnpm install && cd ..

# 3. 一键启动（会自动安装 router）
./start-with-router.sh
```

就这么简单！脚本会自动：

- ✅ 检查并安装 `claude-code-router`
- ✅ 配置 DeerAPI
- ✅ 启动代理服务器
- ✅ 运行交互式 AI Agent

## 📦 依赖说明

### 全局依赖（自动安装）

- **`@musistudio/claude-code-router`** - API 代理服务器
  - 作用：将请求代理到 DeerAPI
  - 安装：脚本会自动全局安装
  - 命令：`ccr`

### 项目依赖（需手动安装）

```bash
# Node.js 依赖（Bridge）
cd scripts
pnpm install
```

主要包含：

- `@anthropic-ai/claude-agent-sdk@0.1.5` - 官方 AI Agent SDK
- `@anthropic-ai/sdk` - Claude API 客户端
- TypeScript 相关依赖

## 🔑 配置 API Key

### 方式 1: 使用项目配置（默认）

项目已包含 `router-config.json`，使用测试 Key：

```json
{
  "Providers": [
    {
      "name": "deerapi",
      "api_key": "sk-iJMVP8lVZW8jG2qlaz2krbFKJOHYzdzKXLa5fUWS10lIl3gb"
    }
  ]
}
```

### 方式 2: 使用你自己的 Key

编辑 `~/.claude-code-router/config.json`：

```bash
# 复制模板
mkdir -p ~/.claude-code-router
cp router-config.json ~/.claude-code-router/config.json

# 编辑配置，替换 API Key
vim ~/.claude-code-router/config.json
```

## 🚀 使用方式

### 方式 1: 一键启动（推荐）

```bash
./start-with-router.sh
```

### 方式 2: 分步执行

```bash
# 终端 1: 启动 Router
ccr start

# 终端 2: 运行 Agent
cd src-tauri
cargo run --example simple_chat_test
```

### 方式 3: 仅测试 Bridge

```bash
cd scripts
./test-agent-chat.sh
```

## 📂 项目结构

```
tauri-code-base-analyzer/
├── scripts/                      # Node.js Bridge
│   ├── package.json              # 项目依赖（Claude SDK）
│   ├── mcp-agent-bridge.ts       # IPC Bridge
│   └── node_modules/             # 本地依赖
│
├── src-tauri/                    # Rust 项目
│   ├── src/
│   │   ├── claude_client/        # 基础设施层（直接 API 调用）
│   │   └── tool_execution/       # 工具层（代码分析）
│   └── examples/
│       └── simple_chat_test.rs   # 交互式测试
│
├── crates/
│   └── codebase-mcp-server/      # MCP 服务器（代码分析工具）
│
├── router-config.json            # Router 配置模板
├── start-with-router.sh          # 一键启动脚本
└── ~/.claude-code-router/        # Router 全局配置（自动创建）
    └── config.json
```

## 🔧 常见问题

### 1. Router 未安装

```bash
# 手动全局安装
pnpm install -g @musistudio/claude-code-router

# 或使用脚本自动安装
./start-with-router.sh
```

### 2. Node.js 版本过低

Router 需要 Node.js 20+:

```bash
# 使用 nvm 升级
nvm install 20
nvm use 20
```

### 3. 端口被占用

```bash
# 检查 3456 端口
lsof -i :3456

# 杀掉占用进程
kill $(lsof -t -i:3456)
```

### 4. pnpm 未安装

```bash
# 安装 pnpm
npm install -g pnpm
```

## 🎓 深入了解

- 📘 [Router 详细设置](./SETUP_ROUTER.md)
- 🏗️ [完整架构文档](./COMPLETE_ARCHITECTURE.md)
- 🤖 [Claude Agent SDK 深度解析](./CLAUDE_AGENT_SDK_DEEP_DIVE.md)

## ✅ 验证安装

### 检查 Router

```bash
ccr --version
curl http://localhost:3456/health
```

### 检查 Bridge

```bash
cd scripts
node dist/mcp-agent-bridge.js
# 应看到 Bridge 等待输入
```

### 完整测试

```bash
./start-with-router.sh
# 应看到完整的启动流程和交互提示
```

## 🎉 完成！

现在你可以开始使用 AI Coding Agent 了：

```bash
你 > 你好
AI > 你好！我是 Claude...

你 > 帮我分析一下 /path/to/your/project
AI > 正在分析项目...
```

祝你使用愉快！ 🚀
