# 使用 claude-code-router 转接到 DeerAPI

## 🎯 解决方案

使用 `claude-code-router` 作为中间代理，将官方 Claude Agent SDK 的请求转接到 DeerAPI。

## 📦 架构图

```
┌─────────────────────────────────────────────────────────────┐
│  Tauri Rust 应用                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  RealAgentSdkCodingAgent (Rust)                    │     │
│  │  ↓                                                  │     │
│  │  RealAgentSdkWrapper (Rust)                        │     │
│  │  ↓                                                  │     │
│  │  real-agent-sdk-bridge.ts (Node.js)                │     │
│  │  ↓                                                  │     │
│  │  @anthropic-ai/claude-agent-sdk                    │     │
│  └────────────────────────────────────────────────────┘     │
│                           ↓                                  │
│                  ANTHROPIC_BASE_URL                          │
│                  http://localhost:3456                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  claude-code-router (代理服务器)                             │
│  监听: localhost:3456                                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │  1. 接收标准 Anthropic API 请求                    │     │
│  │  2. 应用 Transformer (可选格式转换)                │     │
│  │  3. 路由到配置的提供商                             │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  DeerAPI (https://api.deerapi.com/v1/messages)              │
│  - 接收请求                                                  │
│  - 返回响应                                                  │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 实施步骤

### 1️⃣ 安装 claude-code-router

```bash
npm install -g @musistudio/claude-code-router
```

### 2️⃣ 配置 DeerAPI 提供商

创建 `~/.claude-code-router/config.json`:

```json
{
  "LOG": true,
  "LOG_LEVEL": "debug",
  "API_TIMEOUT_MS": 600000,
  "Providers": [
    {
      "name": "deerapi",
      "api_base_url": "https://api.deerapi.com/v1/messages",
      "api_key": "sk-iJMVP8lVZW8jG2qlaz2krbFKJOHYzdzKXLa5fUWS10lIl3gb",
      "models": [
        "claude-opus-4-1-20250805",
        "claude-sonnet-4-5-20250929",
        "claude-3-5-sonnet-20241022"
      ],
      "transformer": {
        "use": ["anthropic"]
      }
    }
  ],
  "Router": {
    "default": "deerapi,claude-sonnet-4-5-20250929",
    "background": "deerapi,claude-3-5-sonnet-20241022",
    "think": "deerapi,claude-opus-4-1-20250805"
  }
}
```

**关键配置说明**：

- `api_base_url`: DeerAPI 的端点（直接到 `/v1/messages`）
- `transformer.use: ["anthropic"]`: 保持标准 Anthropic 格式
- `Router.default`: 默认使用的模型

### 3️⃣ 启动 claude-code-router

```bash
ccr start
```

服务会在 `http://localhost:3456` 启动。

### 4️⃣ 配置 Rust 项目使用代理

修改 `real-agent-sdk-bridge.ts`，添加 `ANTHROPIC_BASE_URL` 环境变量支持：

```typescript
// scripts/real-agent-sdk-bridge.ts

import { query, type Options } from "@anthropic-ai/claude-agent-sdk";

// 在执行查询前设置代理
const executeWithSdk = async (prompt: string, options: Options) => {
  // 设置环境变量让 SDK 使用代理
  process.env.ANTHROPIC_BASE_URL =
    process.env.ANTHROPIC_BASE_URL || "http://localhost:3456";

  // 调用 SDK
  const sdkQuery = query({
    prompt: prompt,
    options: options,
  });

  // ... 其他代码
};
```

或者直接在运行时设置环境变量：

```bash
# 在 src-tauri/.env 中添加
ANTHROPIC_BASE_URL=http://localhost:3456
ANTHROPIC_API_KEY=any-string-is-ok
```

### 5️⃣ 运行测试

```bash
cd src-tauri
cargo run --example agent_sdk_example
```

## 🎨 高级配置

### 支持多个提供商

```json
{
  "Providers": [
    {
      "name": "deerapi",
      "api_base_url": "https://api.deerapi.com/v1/messages",
      "api_key": "$DEERAPI_KEY",
      "models": ["claude-sonnet-4-5-20250929"]
    },
    {
      "name": "openai",
      "api_base_url": "https://api.openai.com/v1/chat/completions",
      "api_key": "$OPENAI_API_KEY",
      "models": ["gpt-4"]
    }
  ],
  "Router": {
    "default": "deerapi,claude-sonnet-4-5-20250929",
    "background": "openai,gpt-4"
  }
}
```

### 动态模型切换

在 Rust 代码中可以通过修改 model 字段来切换：

```rust
// 使用 DeerAPI 的 Claude Opus
request.model = "deerapi,claude-opus-4-1-20250805".to_string();
```

## ✅ 优势

1. **✅ 无需修改 SDK 代码** - 只需设置环境变量
2. **✅ 标准 API 格式** - 使用 Anthropic transformer 保持兼容
3. **✅ 灵活路由** - 可以同时配置多个提供商
4. **✅ 日志记录** - 完整的请求/响应日志
5. **✅ 成本优化** - 可以为不同任务路由到不同模型

## 🔧 调试技巧

### 查看日志

```bash
# 服务器日志
tail -f ~/.claude-code-router/logs/ccr-*.log

# 应用日志
tail -f ~/.claude-code-router/claude-code-router.log
```

### UI 管理界面

```bash
ccr ui
```

打开浏览器可视化管理配置。

## 🎯 测试 DeerAPI 连接

创建测试脚本 `test-deerapi.sh`:

```bash
#!/bin/bash

# 测试 claude-code-router 是否正确转发到 DeerAPI

curl -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: any-key" \
  -d '{
    "model": "deerapi,claude-sonnet-4-5-20250929",
    "max_tokens": 1024,
    "messages": [
      {
        "role": "user",
        "content": "Hello, are you working?"
      }
    ]
  }'
```

## 📚 参考资料

- [claude-code-router GitHub](https://github.com/musistudio/claude-code-router)
- [DeerAPI 文档](https://api.deerapi.com/docs)
- [@anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
