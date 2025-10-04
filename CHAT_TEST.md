# 🤖 多轮对话测试

## 快速开始

### 方式 1: 一键启动（推荐）

```bash
./scripts/test-agent-chat.sh
```

这会自动：
1. ✅ 检查并编译 Bridge
2. ✅ 检查并启动 claude-code-router
3. ✅ 启动多轮对话程序

### 方式 2: 手动启动

```bash
# 1. 确保 Router 在运行
ccr start

# 2. 运行对话程序
cargo run --example simple_chat_test
```

## 使用说明

### 启动后

程序会先测试连接：
```
🔍 测试连接...
✅ 连接成功!
   模型: claude-sonnet-4-5-20250929
   SDK: 0.1.5

🤖 AI: 收到

============================================================

开始对话 (输入 'exit' 退出):

你 > 
```

### 对话命令

- **普通对话**: 直接输入你的问题
- **查看信息**: 输入 `info`
- **退出**: 输入 `exit` 或 `quit`

### 示例对话

```
你 > 你好，你是谁？

🤖 AI > 我是 Claude，一个由 Anthropic 开发的 AI 助手。

   [Token: 145, 轮数: 1]

你 > 你能做什么？

🤖 AI > 我可以帮助你回答问题、编写代码、分析文本等。

   [Token: 178, 轮数: 2]

你 > info

📊 连接信息:
   工作目录: /tmp/test-workspace
   已对话轮数: 2
   Router: http://localhost:3456
   DeerAPI: https://api.deerapi.com

你 > exit

👋 再见！
```

## 验证代理是否工作

### 1. 检查模型名称

如果看到 `claude-sonnet-4-5-20250929`，说明使用了 DeerAPI（通过 Router 代理）。

### 2. 查看 Router 日志

在另一个终端运行：
```bash
# 如果 Router 是用 ccr start 启动的
ccr stop
ccr start
# 观察日志输出
```

### 3. 测试 Router 直连

```bash
./scripts/verify-router-proxy.sh
```

## 故障排查

### 问题 1: "Bridge 执行失败"

**解决**:
```bash
cd scripts
pnpm install
pnpm run build:mcp
```

### 问题 2: "Router 未运行"

**解决**:
```bash
# 检查安装
ccr --version

# 启动 Router
ccr start

# 测试是否运行
curl http://localhost:3456/health
```

### 问题 3: "连接失败"

**检查清单**:
1. ✅ Router 是否在运行？ `ccr start`
2. ✅ Bridge 是否已编译？ `ls scripts/dist/mcp-agent-bridge.js`
3. ✅ 配置文件是否正确？ `cat ~/.claude-code-router/config.json`

## 技术细节

### 请求链路

```
你的输入
  ↓
Rust 程序 (simple_chat_test.rs)
  ↓ JSON via stdin
Node.js Bridge (mcp-agent-bridge.js)
  ↓ query({ prompt })
@anthropic-ai/claude-agent-sdk
  ↓ HTTP POST (带 ANTHROPIC_API_KEY)
claude-code-router (http://localhost:3456)
  ↓ 根据配置转发
DeerAPI (https://api.deerapi.com)
  ↓ 返回响应
反向返回给你
```

### 验证点

1. **模型名称**: `claude-sonnet-4-5-20250929` = DeerAPI ✅
2. **Token 统计**: 有数字 = 请求成功 ✅
3. **AI 回复**: 有内容 = 链路正常 ✅

## 下一步

测试通过后，你可以：

1. **运行完整示例**: `./scripts/run-mcp-agent.sh`
2. **测试 MCP 工具**: 使用代码分析功能
3. **自定义配置**: 修改 `router-config.json`

---

**提示**: 每次对话都是独立的，不会保留上下文。如果需要上下文，需要在 SDK 配置中启用会话管理。
