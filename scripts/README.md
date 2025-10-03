# Claude TypeScript SDK 桥接器

这个目录包含了 TypeScript SDK 的桥接实现，允许 Rust 代码调用官方的 `@anthropic-ai/sdk`。

## 📦 安装

```bash
cd scripts
npm install
```

## 🔨 构建

```bash
npm run build
```

这会将 `claude-bridge.ts` 编译为 `dist/claude-bridge.js`。

## 🧪 测试

### 测试简单查询

```bash
export ANTHROPIC_API_KEY="your-api-key-here"

echo '{"action":"query","prompt":"Hello!","maxTokens":50}' | node dist/claude-bridge.js
```

### 测试带工具的查询

```bash
echo '{
  "action": "query_with_tools",
  "prompt": "计算 1+1",
  "maxTokens": 1024,
  "tools": [{
    "name": "calculator",
    "description": "执行数学计算",
    "input_schema": {
      "type": "object",
      "properties": {
        "expression": {"type": "string"}
      },
      "required": ["expression"]
    }
  }]
}' | node dist/claude-bridge.js
```

## 📚 API

### 请求格式

```typescript
interface BridgeRequest {
  action: "query" | "query_with_tools";
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: any;
  }>;
}
```

### 响应格式

```typescript
interface BridgeResponse {
  success: boolean;
  content?: string;
  toolUses?: Array<{
    id: string;
    name: string;
    input: any;
  }>;
  error?: string;
  stopReason?: string;
}
```

## 🔄 工作原理

```
Rust 应用
    ↓ 启动 Node.js 子进程
Node.js (claude-bridge.js)
    ↓ 调用 @anthropic-ai/sdk
TypeScript SDK
    ↓ HTTP 请求
Anthropic API (api.anthropic.com)
    ↓ 返回结果
Node.js 输出到 stdout
    ↓ 读取
Rust 应用得到结果
```

## 🛠️ 开发

### 监听模式

```bash
npm run dev
```

这会启动 TypeScript 编译器的监听模式，文件修改时自动重新编译。

## 📝 注意事项

1. **环境变量**: 确保设置 `ANTHROPIC_API_KEY`
2. **构建顺序**: 必须先 `npm run build` 才能在 Rust 中使用
3. **Node.js 版本**: 需要 Node.js 18+

## 🚀 在 Rust 中使用

```rust
use crate::ts_sdk_wrapper::TypeScriptSDKWrapper;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let sdk = TypeScriptSDKWrapper::new()?;

    let response = sdk.query(
        "你好！".to_string(),
        None,
        Some(100),
    ).await?;

    println!("{}", response);
    Ok(())
}
```

## 📖 更多示例

查看 `src-tauri/src/agent_core/ts_agent.rs` 了解如何在 Agent 中使用 TypeScript SDK。
