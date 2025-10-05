# 🚀 快速开始 - 持久化多轮对话

## ⚡ 一键启动

```bash
# 从项目根目录运行
./scripts/test-persistent-chat.sh
```

就这么简单！脚本会自动：

1. ✅ 编译持久化 Bridge
2. ✅ 编译 MCP 服务器
3. ✅ 启动交互式对话

---

## 🧪 测试 AI 记忆

启动后，试试这个对话：

```
你 > 你好，我叫小明，我是一个前端工程师

🤖 AI > 你好小明！很高兴认识你。作为前端工程师，你有什么我可以帮助的吗？

你 > 我刚才说我叫什么名字？

🤖 AI > 你刚才说你叫小明。

你 > 我是做什么工作的？

🤖 AI > 你是一个前端工程师。
```

**✨ 看到了吗？AI 记住了你的名字和职业！**

---

## 📝 可用命令

| 命令             | 功能                           |
| ---------------- | ------------------------------ |
| 正常输入         | 发送消息给 AI                  |
| `info`           | 查看当前 Session ID 和统计信息 |
| `reset`          | 重置会话（开始新的对话）       |
| `exit` 或 `quit` | 退出程序                       |

---

## 🔑 核心特性

✅ **所有对话都在同一个 Session 中**  
✅ **AI 记住所有历史对话**  
✅ **支持工具调用（文件操作、代码分析等）**  
✅ **更快的响应速度（进程复用）**

---

## 💡 使用建议

### 1. 长时间对话

如果对话轮数太多（>50 轮），可以使用 `reset` 重置会话以提升性能：

```
你 > reset
🔄 会话已重置，下次查询将创建新会话
```

### 2. 查看会话信息

随时输入 `info` 查看当前状态：

```
你 > info

📊 会话信息:
   工作目录: /tmp/test-workspace
   已对话轮数: 5
   Session ID: f8a3c2d1...
   状态: 活跃（AI 记住所有历史对话）
```

### 3. 代码分析任务

AI 可以使用工具分析你的项目：

```
你 > 帮我分析一下 /path/to/my-project 这个项目

🤖 AI > 好的，让我来分析...
     [调用 @codebase/scan 工具]
     [调用 @codebase/analyze 工具]

     分析完成！这个项目包含：
     - 50 个 Vue 组件
     - 30 个 TypeScript 文件
     - ...
```

---

## 🐛 遇到问题？

### 问题：Bridge 未编译

```bash
错误: 找不到 mcp-agent-bridge-persistent.js

解决方案:
cd scripts
pnpm run build:mcp-persistent
```

### 问题：API Key 错误

```bash
错误: 401 Unauthorized

解决方案:
1. 检查 .env 文件中的 ANTHROPIC_API_KEY
2. 或设置环境变量:
   export ANTHROPIC_API_KEY="your-key-here"
```

---

## 📚 详细文档

- 📖 [持久化对话完整指南](./PERSISTENT_CHAT_GUIDE.md)
- 🔄 [代码变更总结](./PERSISTENT_CHAT_CHANGES.md)
- 🏗️ [完整架构文档](./COMPLETE_ARCHITECTURE.md)
- 🤖 [Claude Agent SDK 深度解析](./CLAUDE_AGENT_SDK_DEEP_DIVE.md)

---

## 🎉 开始使用吧！

```bash
./scripts/test-persistent-chat.sh
```

享受你的 AI 助手！🚀
