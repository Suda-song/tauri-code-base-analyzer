# 🔧 Claude Code Router 设置指南

## 📦 快速安装

`claude-code-router` 是一个全局 CLI 工具,需要全局安装:

```bash
# 方式 1: 使用 pnpm 全局安装 (推荐)
pnpm install -g @musistudio/claude-code-router

# 方式 2: 使用 npm 全局安装
npm install -g @musistudio/claude-code-router

# 验证安装
ccr --version
```

## 🚀 一键启动 (推荐)

项目提供了一键启动脚本，会自动检查、安装、配置并运行所有组件：

```bash
# 从项目根目录运行
./start-with-router.sh
```

这个脚本会：

1. ✅ 检查 `claude-code-router` 是否已安装（如未安装则自动全局安装）
2. ✅ 检查并创建配置文件（`~/.claude-code-router/config.json`）
3. ✅ 启动 router 服务器（localhost:3456）
4. ✅ 测试 DeerAPI 连接
5. ✅ 运行 Agent SDK 交互测试
6. ✅ 自动清理进程

## 🔧 手动安装和配置

### 1. 安装 Router

```bash
pnpm install -g @musistudio/claude-code-router
```

### 2. 创建配置文件

```bash
# 复制项目配置到用户目录
mkdir -p ~/.claude-code-router
cp router-config.json ~/.claude-code-router/config.json
```

### 3. 编辑配置 (可选)

编辑 `~/.claude-code-router/config.json`:

```json
{
  "LOG": true,
  "LOG_LEVEL": "debug",
  "API_TIMEOUT_MS": 600000,
  "Providers": [
    {
      "name": "deerapi",
      "api_base_url": "https://api.deerapi.com/v1/messages",
      "api_key": "your-deer-api-key-here",
      "models": [
        "claude-sonnet-4-5-20250929",
        "claude-opus-4-1-20250805",
        "claude-3-5-sonnet-20241022"
      ]
    }
  ],
  "Router": {
    "default": "deerapi,claude-sonnet-4-5-20250929",
    "background": "deerapi,claude-3-5-sonnet-20241022",
    "think": "deerapi,claude-opus-4-1-20250805"
  }
}
```

### 4. 启动 Router

```bash
# 启动服务器
ccr start

# 或者指定配置文件
ccr start --config ~/.claude-code-router/config.json
```

## 🎯 使用场景

### 场景 1: 开发时使用

```bash
# 终端 1: 启动 router
ccr start

# 终端 2: 运行你的应用
cd src-tauri
cargo run --example simple_chat_test
```

### 场景 2: 一键测试

```bash
# 使用提供的脚本
./start-with-router.sh
```

### 场景 3: 仅运行 router (后台)

```bash
# 后台运行
ccr start &

# 或者使用 nohup
nohup ccr start > /tmp/ccr.log 2>&1 &

# 停止
pkill -f "ccr"
```

## 🔍 验证安装

### 检查 Router 是否运行

```bash
# 检查健康状态
curl http://localhost:3456/health

# 应返回类似: {"status":"ok"}
```

### 测试 DeerAPI 连接

```bash
curl -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{
    "model": "deerapi,claude-sonnet-4-5-20250929",
    "max_tokens": 100,
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

## 📂 文件结构

```
tauri-code-base-analyzer/
├── router-config.json            # Router 配置模板
├── start-with-router.sh          # 一键启动脚本
├── scripts/
│   ├── package.json              # Bridge 项目依赖
│   └── mcp-agent-bridge.ts       # Node.js Bridge
└── ~/.claude-code-router/        # 用户配置目录（全局）
    └── config.json               # Router 实际使用的配置
```

## 🛠️ package.json 配置说明

```json
{
  "scripts": {
    "install:router": "pnpm install -g @musistudio/claude-code-router"
  }
}
```

项目中提供了便捷脚本:

```bash
cd scripts
pnpm run install:router  # 全局安装 router
```

## 💡 为什么使用全局安装？

1. ✅ **CLI 工具** - `claude-code-router` 是一个命令行工具，全局安装更合适
2. ✅ **跨项目共享** - 一次安装，多个项目使用
3. ✅ **独立服务** - 作为独立服务运行，不绑定到特定项目
4. ✅ **避免构建问题** - npm 包的构建脚本存在问题，全局安装由 npm 自动处理
5. ✅ **系统工具** - 类似 `pm2`、`nodemon` 等工具的使用方式

## 🔧 故障排查

### Router 未安装

```bash
# 检查是否已安装
ccr --version

# 如果没有，全局安装
pnpm install -g @musistudio/claude-code-router
```

### Router 启动失败

```bash
# 检查日志
cat /tmp/ccr.log

# 检查端口占用
lsof -i :3456

# 杀掉旧进程
pkill -f "ccr"
# 或者
kill $(lsof -t -i:3456)
```

### 配置文件未生效

```bash
# 检查配置文件位置
ls -la ~/.claude-code-router/config.json

# 重新复制配置
cp router-config.json ~/.claude-code-router/config.json

# 指定配置文件启动
ccr start --config ~/.claude-code-router/config.json
```

### API Key 错误

编辑 `~/.claude-code-router/config.json`，更新你的 DeerAPI Key:

```json
{
  "Providers": [
    {
      "name": "deerapi",
      "api_key": "your-actual-deer-api-key",
      ...
    }
  ]
}
```

### Node.js 版本问题

`claude-code-router` 需要 Node.js 20+:

```bash
# 检查版本
node --version

# 如果版本过低，使用 nvm 升级
nvm install 20
nvm use 20
```

## 📚 相关文档

- [Claude Agent SDK 深度解析](./CLAUDE_AGENT_SDK_DEEP_DIVE.md)
- [完整架构文档](./COMPLETE_ARCHITECTURE.md)
- [快速开始指南](./README.md)

## 🎉 完成！

现在你可以：

```bash
# 一键启动所有组件
./start-with-router.sh

# 或者分步执行
ccr start                              # 终端 1
cargo run --example simple_chat_test   # 终端 2
```

享受你的 AI Coding Agent 吧！ 🚀
