# 🚀 交互式 Claude Agent 快速开始

## 🎯 功能说明

现在你有了一个**交互式命令行对话系统**：
- ✅ 实时看到服务器日志
- ✅ 命令行中与 AI 对话
- ✅ 输入一句，AI 回复一句
- ✅ 支持多轮对话
- ✅ 支持工具调用（如 Bash）

## 🚀 快速开始（2 个终端）

### 终端 1: 启动代理服务器（可以看到日志）

```bash
cd /Users/songdingan/dev/tauri-code-base-analyzer
./setup-router.sh
```

**你会看到**：
```
==========================================
✅ 启动 claude-code-router (前台模式)
==========================================

💡 提示:
   - 服务器日志将显示在下方
   - 按 Ctrl+C 停止服务
   - 在另一个终端运行测试

==========================================

Server listening on http://127.0.0.1:3456
[日志会实时显示在这里...]
```

**保持这个终端运行！** 你可以看到所有 API 请求的日志。

### 终端 2: 运行交互式对话

打开**新的终端窗口**：

```bash
cd /Users/songdingan/dev/tauri-code-base-analyzer/src-tauri
cargo run --example agent_example
```

**你会看到**：
```
╔══════════════════════════════════════════════════════╗
║  🤖 Claude Agent 交互式对话                          ║
╚══════════════════════════════════════════════════════╝

🔍 检查代理服务器... ✅
📝 初始化 Agent... ✅
�� 注册 Bash 工具... ✅

╔══════════════════════════════════════════════════════╗
║  ✨ Agent 已准备就绪！                               ║
╚══════════════════════════════════════════════════════╝

💡 使用说明:
   - 输入你的问题，按回车发送
   - 输入 'exit' 或 'quit' 退出
   - 输入 'clear' 清空对话历史
   - 输入 'help' 查看帮助

你 > 
```

## 💬 对话示例

### 示例 1: 简单问答

```
你 > 用一句话介绍 Rust

AI > Rust 是一种系统编程语言，专注于安全性、并发性和性能，
     通过所有权系统在编译时防止内存错误。

   📊 对话轮数: 1
```

### 示例 2: 使用工具

```
你 > 使用 bash 列出 /tmp 目录的内容

AI > 我已经列出了 /tmp 目录的内容。目录中包含以下文件和文件夹:
     [显示目录列表...]

   🔧 使用的工具: ["bash"]
   📊 对话轮数: 2
```

### 示例 3: 代码生成

```
你 > 帮我写一个 Python 的 hello world

AI > 当然！这是一个简单的 Python Hello World 程序：

     ```python
     print("Hello, World!")
     ```

   📊 对话轮数: 3
```

## 🎮 可用命令

在对话中可以使用以下命令：

| 命令 | 功能 |
|------|------|
| `exit` 或 `quit` | 退出程序 |
| `clear` | 清空对话历史 |
| `help` | 显示帮助信息 |

## 🔍 实时查看日志

### 终端 1（代理服务器）

你会看到每次 API 请求的日志：

```
[INFO] POST /v1/messages - 200 OK
[DEBUG] Model: deerapi,claude-sonnet-4-5-20250929
[DEBUG] Tokens: 150
[INFO] Request completed in 1.2s
```

### 额外日志文件

如果需要更详细的日志：

```bash
# 在第三个终端
tail -f /tmp/ccr.log
```

## ⚠️ 停止服务

### 停止代理服务器

在**终端 1**（运行 `setup-router.sh` 的终端）：
- 按 `Ctrl+C`

### 退出对话程序

在**终端 2**（运行 Agent 的终端）：
- 输入 `exit` 或 `quit`
- 或按 `Ctrl+C`

## 🎨 高级用法

### 修改系统提示词

编辑 `src-tauri/examples/agent_example.rs`：

```rust
let query = AgentQuery {
    prompt: input.to_string(),
    system_prompt: Some("你是一个专业的 Rust 编程助手...".to_string()), // 修改这里
    max_tokens: Some(4096),
};
```

### 调整日志级别

编辑 `router-config.json`：

```json
{
  "LOG_LEVEL": "info"  // 可选: "debug", "info", "warn", "error"
}
```

然后重启服务器。

## 🐛 故障排查

### 问题 1: "代理服务器未运行"

**解决**: 确保终端 1 中 `setup-router.sh` 正在运行

```bash
# 检查服务器状态
curl http://localhost:3456/health
```

### 问题 2: AI 回复很慢

**原因**: 可能是 DeerAPI 响应慢或网络问题

**查看**: 终端 1 的日志会显示请求耗时

### 问题 3: "错误: Invalid API key"

**解决**: 检查 `router-config.json` 中的 `api_key` 是否正确

```bash
vim router-config.json
# 修改 api_key 后重启服务器
```

## 📝 完整工作流

```bash
# 1. 终端 1 - 启动服务器（可以看到日志）
./setup-router.sh

# 2. 终端 2 - 运行交互式对话
cd src-tauri
cargo run --example agent_example

# 3. 对话...
你 > 你好
AI > 你好！我是 Claude，有什么可以帮助你的吗？

# 4. 完成后
你 > exit
👋 再见！

# 5. 终端 1 - 停止服务器
[Ctrl+C]
```

## 🎉 享受对话！

现在你可以：
- ✅ 实时看到服务器处理请求
- ✅ 在命令行中自然对话
- ✅ 使用工具完成复杂任务
- ✅ 保持多轮对话上下文

**开始对话吧！** 🚀
