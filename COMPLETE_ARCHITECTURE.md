# 完整系统架构文档

## 1. 系统概述

这是一个基于 **Claude Code (官方 Agent SDK)** 的**代码分析 AI Agent 系统**。

### 核心定位

- **主方案**: 使用官方 `@anthropic-ai/claude-agent-sdk@0.1.5` 作为 AI Agent 引擎
- **核心功能**: 通过 MCP (Model Context Protocol) 扩展 SDK，提供代码分析工具
- **技术栈**: Rust (工具实现) + TypeScript (SDK 集成) + MCP (工具协议)

### 🔑 核心架构理念

```
┌─────────────────────────────────────────────────────────────┐
│  官方 SDK 已经提供了完整的 Agent 能力                       │
│  ✅ 内置 17 种工具 (read_file, write_file, bash...)       │
│  ✅ 自动工具调用和循环                                     │
│  ✅ 权限管理                                               │
│  ✅ MCP 协议支持                                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  我们只需要做一件事：                                       │
│  📦 实现代码分析工具 (作为 MCP 服务器)                     │
│     - @codebase/scan (扫描项目)                            │
│     - @codebase/analyze (分析代码)                         │
│     - @codebase/enrich (生成摘要)                          │
│     - @codebase/search (语义搜索)                          │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  SDK 自动整合所有工具                                       │
│  AI 可以同时使用：                                          │
│    • 内置工具: read_file, write_file, bash...             │
│    • 我们的工具: @codebase/scan, @codebase/analyze...     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 简化后的架构图

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Tauri 桌面应用 (可选)                              │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Rust 应用层 (简单包装)                               │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │ 应用入口: main.rs / agent_app.rs                                │  │
│   │                                                                  │  │
│   │  • 启动 MCP 服务器 (代码分析工具)                               │  │
│   │  • 调用 Node.js Bridge                                          │  │
│   │  • 处理用户请求和响应                                           │  │
│   └─────────────────────────┬────────────────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────────────────┘
                              │
                              │ 1. 启动 MCP 服务器
                              │ 2. 调用 SDK
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Node.js Bridge (极简)                              │
│                                                                          │
│   scripts/claude-agent-bridge.ts                                        │
│                                                                          │
│   import { query, createSdkMcpServer, tool }                            │
│           from '@anthropic-ai/claude-agent-sdk';                        │
│                                                                          │
│   // 1. 配置 MCP 服务器 (连接到 Rust 工具)                             │
│   const mcpServers = {                                                  │
│       codebase: {                                                       │
│           type: 'stdio',                                                │
│           command: 'path/to/codebase-mcp-server',  ← Rust 二进制       │
│           args: []                                                      │
│       }                                                                 │
│   };                                                                    │
│                                                                          │
│   // 2. 调用 SDK (一行代码)                                             │
│   const response = query({                                              │
│       prompt: userInput,                                                │
│       options: {                                                        │
│           cwd: workspace,                                               │
│           mcpServers,  ← 传入 MCP 配置                                  │
│           maxTurns: 20                                                  │
│       }                                                                 │
│   });                                                                   │
│                                                                          │
│   // 3. SDK 自动处理一切！                                              │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│ SDK 内置工具    │  │ MCP 外部工具    │  │ Claude API          │
│                 │  │                 │  │                     │
│ • read_file     │  │ • @codebase/    │  │ DeerAPI 代理到      │
│ • write_file    │  │   scan          │  │ Claude API          │
│ • edit_file     │  │ • @codebase/    │  │                     │
│ • bash          │  │   analyze       │  │ models:             │
│ • grep          │  │ • @codebase/    │  │ • claude-sonnet     │
│ • glob          │  │   enrich        │  │ • claude-opus       │
│ • web_search    │  │ • @codebase/    │  │ • claude-haiku      │
│ • web_fetch     │  │   search        │  │                     │
│                 │  │                 │  │                     │
│ (SDK 自动调用)  │  │ (通过 MCP 调用  │  │ (SDK 自动调用)      │
│                 │  │  Rust 工具)     │  │                     │
└─────────────────┘  └────────┬────────┘  └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Rust MCP 服务器     │
                    │                     │
                    │ codebase-mcp-server │
                    │                     │
                    │ 提供的工具:         │
                    │ • scan_project()    │
                    │ • analyze_entity()  │
                    │ • enrich_code()     │
                    │ • semantic_search() │
                    │                     │
                    │ 使用现有模块:       │
                    │ • FileWalker        │
                    │ • Extractors        │
                    │ • Enrichment        │
                    │ • Embeddings        │
                    └─────────────────────┘
```

### 2.2 调用流程

```
用户请求: "分析这个项目的代码结构"
    ↓
Rust 应用: 启动 MCP 服务器 + 调用 Node.js Bridge
    ↓
Node.js Bridge: 
    const response = query({
        prompt: "分析这个项目的代码结构",
        options: {
            cwd: "/path/to/project",
            mcpServers: { codebase: {...} }
        }
    });
    ↓
SDK 内部 (完全自动):
    ├─> Claude API: "分析项目结构"
    │   ↓
    ├─> Claude 决定: 需要 @codebase/scan 工具
    │   ↓
    ├─> SDK 自动调用: MCP 服务器的 scan_project()
    │   ↓
    ├─> MCP 服务器: 执行 FileWalker::scan_and_extract()
    │   ↓ 返回结果
    ├─> SDK 自动发送: tool_result 回 Claude
    │   ↓
    ├─> Claude 继续思考: "现在我知道有 150 个文件"
    │   ↓
    ├─> Claude 决定: 需要 @codebase/analyze 工具
    │   ↓
    ├─> SDK 自动调用: analyze_entity()
    │   ↓
    ├─> MCP 服务器: 执行分析逻辑
    │   ↓ 返回分析结果
    ├─> SDK 自动发送: tool_result 回 Claude
    │   ↓
    └─> Claude 最终输出: "项目包含 15 个组件，主要功能是..."
    ↓
返回给用户: 完整的分析报告
```

---

## 3. 🎯 核心问题解答

### ❓ 问题：是不是只要实现 @codebase/ 工具，然后发送给 SDK 就行了？

**答案：完全正确！** ✅✅✅

你的理解**非常准确**，我们需要做的就是：

### 第 1 步：实现 Rust MCP 服务器

```rust
// codebase-mcp-server/src/main.rs

use mcp_sdk::{McpServer, Tool, tool};
use serde_json::{json, Value};

#[tokio::main]
async fn main() {
    let server = McpServer::new("codebase-analyzer", "1.0.0");
    
    // 注册工具 1: 扫描项目
    server.add_tool(tool(
        "scan_project",
        "扫描项目目录，提取所有代码实体",
        json!({
            "type": "object",
            "properties": {
                "project_path": {
                    "type": "string",
                    "description": "项目根目录路径"
                },
                "extensions": {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "要扫描的文件扩展名",
                    "default": [".ts", ".tsx", ".vue"]
                }
            },
            "required": ["project_path"]
        }),
        |args: Value| async move {
            let project_path = args["project_path"].as_str().unwrap();
            
            // 使用现有的 FileWalker
            let walker = FileWalker::with_default();
            let (entities, stats) = walker.extract_all_entities(project_path)?;
            
            Ok(json!({
                "entities": entities,
                "stats": stats
            }))
        }
    ));
    
    // 注册工具 2: 分析实体
    server.add_tool(tool(
        "analyze_entity",
        "分析特定代码实体的依赖关系和用途",
        json!({
            "type": "object",
            "properties": {
                "entity_id": { "type": "string" },
                "project_path": { "type": "string" }
            },
            "required": ["entity_id", "project_path"]
        }),
        |args: Value| async move {
            // 使用现有的 StaticAnalyzer
            let analyzer = StaticAnalyzer::new(...);
            let result = analyzer.analyze_entity(...).await?;
            
            Ok(json!({
                "imports": result.imports,
                "calls": result.calls,
                "emits": result.emits
            }))
        }
    ));
    
    // 注册工具 3: 生成摘要
    server.add_tool(tool(
        "enrich_code",
        "使用 LLM 为代码生成摘要和标签",
        json!({
            "type": "object",
            "properties": {
                "code": { "type": "string" },
                "entity_type": { "type": "string" }
            },
            "required": ["code"]
        }),
        |args: Value| async move {
            // 使用现有的 EnrichmentOrchestrator
            let orchestrator = EnrichmentOrchestrator::new(...);
            let enriched = orchestrator.enrich_entity(...).await?;
            
            Ok(json!({
                "summary": enriched.summary,
                "tags": enriched.tags
            }))
        }
    ));
    
    // 注册工具 4: 语义搜索 (如果实现了向量化)
    server.add_tool(tool(
        "semantic_search",
        "在代码库中进行语义搜索",
        json!({
            "type": "object",
            "properties": {
                "query": { "type": "string" },
                "limit": { "type": "number", "default": 10 }
            },
            "required": ["query"]
        }),
        |args: Value| async move {
            // 使用向量搜索
            let results = search_embeddings(...).await?;
            Ok(json!(results))
        }
    ));
    
    // 启动 stdio 服务器
    server.run_stdio().await?;
}
```

### 第 2 步：Node.js Bridge (极简)

```typescript
// scripts/claude-agent-bridge.ts

import { query } from '@anthropic-ai/claude-agent-sdk';
import * as readline from 'readline';

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    // 读取用户输入
    const input = await new Promise<string>(resolve => {
        let data = '';
        rl.on('line', line => data += line + '\n');
        rl.on('close', () => resolve(data));
    });
    
    const request = JSON.parse(input);
    
    // 配置 MCP 服务器
    const mcpServers = {
        codebase: {
            type: 'stdio',
            command: './target/release/codebase-mcp-server',
            args: []
        }
    };
    
    // 调用 SDK (就这一行！)
    const response = query({
        prompt: request.prompt,
        options: {
            cwd: request.workspace,
            mcpServers,  // ← 传入 MCP 配置
            maxTurns: request.max_turns || 20,
            permissionMode: request.permission_mode || 'default'
        }
    });
    
    // 处理响应流
    for await (const message of response) {
        console.log(JSON.stringify(message));
    }
}

main().catch(console.error);
```

### 第 3 步：Rust 应用层 (调用 Bridge)

```rust
// src/main.rs

use std::process::{Command, Stdio};
use std::io::Write;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. 启动 MCP 服务器 (后台进程)
    let _mcp_server = Command::new("./target/release/codebase-mcp-server")
        .spawn()?;
    
    // 2. 准备请求
    let request = serde_json::json!({
        "prompt": "分析这个项目的代码结构，找出所有的 Vue 组件",
        "workspace": "/path/to/project",
        "max_turns": 20
    });
    
    // 3. 调用 Node.js Bridge
    let mut child = Command::new("node")
        .arg("scripts/dist/claude-agent-bridge.js")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()?;
    
    // 4. 发送请求
    child.stdin.as_mut().unwrap()
        .write_all(serde_json::to_string(&request)?.as_bytes())?;
    
    // 5. 读取响应
    let output = child.wait_with_output()?;
    let response: serde_json::Value = serde_json::from_slice(&output.stdout)?;
    
    println!("AI 回复: {}", response);
    
    Ok(())
}
```

---

## 4. 工作流程示例

### 示例 1: 用户请求分析项目

```
用户: "分析这个 Vue 项目，告诉我有哪些组件和它们的依赖关系"

  ↓ Rust 应用

Rust 应用: 调用 Node.js Bridge
{
    "prompt": "分析这个 Vue 项目...",
    "workspace": "/path/to/vue-project"
}

  ↓ Node.js Bridge

Bridge: query({ prompt, options: { mcpServers: {...} } })

  ↓ SDK 自动执行

SDK 内部流程:
1. Claude: "我需要先扫描项目"
   ↓
2. SDK 调用: @codebase/scan_project({ project_path: "/path/to/vue-project" })
   ↓
3. MCP 服务器: FileWalker::extract_all_entities()
   ↓ 返回: { entities: [...], stats: {...} }
   ↓
4. SDK 发送: tool_result 回 Claude
   ↓
5. Claude: "找到 25 个组件，现在分析它们的依赖"
   ↓
6. SDK 调用: @codebase/analyze_entity({ entity_id: "Component:Header" })
   ↓
7. MCP 服务器: StaticAnalyzer::analyze_entity()
   ↓ 返回: { imports: [...], calls: [...] }
   ↓
8. SDK 发送: tool_result 回 Claude
   ↓
9. Claude: "现在生成每个组件的摘要"
   ↓
10. SDK 调用: @codebase/enrich_code({ code: "...", entity_type: "component" })
    ↓
11. MCP 服务器: EnrichmentOrchestrator::enrich_entity()
    ↓ 返回: { summary: "...", tags: [...] }
    ↓
12. Claude 最终输出:
    "该项目包含 25 个 Vue 组件：
     
     核心组件:
     • Header (src/components/Header.vue) - 页面头部导航组件
       - 依赖: Icon, Menu
       - 事件: onMenuClick, onLogout
     
     • UserCard (src/components/UserCard.vue) - 用户信息卡片
       - 依赖: Avatar, Button
       - Props: userId, showActions
     
     ..."

  ↓ 返回给用户

用户看到完整的分析报告 ✅
```

---

## 5. 优势分析

### 🎯 这种架构的核心优势

#### 1. **极简代码量**

```
传统方案 (手动实现 Agent):
- Agent 循环逻辑: ~200 行
- 工具管理系统: ~150 行
- 权限控制: ~100 行
- 错误处理: ~80 行
- 工具实现: ~500 行
━━━━━━━━━━━━━━━━━━━━━━━━━━━
总计: ~1030 行

使用 SDK + MCP:
- MCP 服务器: ~200 行 (纯工具实现)
- Node.js Bridge: ~30 行 (调用 SDK)
- Rust 应用层: ~50 行 (调用 Bridge)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
总计: ~280 行 (节省 73%)

而且 SDK 提供的功能更强大！
```

#### 2. **功能更强大**

| 功能 | 手动实现 | 使用 SDK |
|------|---------|---------|
| Agent 循环 | 需要手动实现 | ✅ 自动 |
| 工具管理 | 需要手动管理 | ✅ 自动 |
| 权限控制 | 需要手动实现 | ✅ 内置 4 种模式 |
| 错误重试 | 需要手动实现 | ✅ 自动 |
| 成本追踪 | 需要手动计算 | ✅ 自动统计 |
| 会话管理 | 需要手动实现 | ✅ 自动持久化 |
| CLAUDE.md | 需要手动实现 | ✅ 自动生成和读取 |
| MCP 支持 | 不支持 | ✅ 原生支持 |
| 钩子系统 | 需要手动实现 | ✅ 9 种钩子 |
| Prompt Caching | 需要手动优化 | ✅ 自动缓存 |

#### 3. **维护成本低**

- SDK 由 Anthropic 官方维护，自动更新
- 我们只需要维护 MCP 工具实现
- 工具实现可以复用现有的 Rust 模块

#### 4. **扩展性强**

```rust
// 新增工具非常简单
server.add_tool(tool(
    "refactor_code",
    "重构代码，应用最佳实践",
    schema,
    |args| async move {
        // 实现重构逻辑
        Ok(result)
    }
));

// SDK 自动整合新工具，AI 立即可用
```

---

## 6. 现有模块复用

### 6.1 完全复用的模块

```
src-tauri/src/tool_execution/codebase/
├── extractors/              ✅ 完全复用
│   ├── typescript.rs        → MCP 工具使用
│   ├── vue.rs               → MCP 工具使用
│   └── type_utils.rs        → MCP 工具使用
│
├── enrichment/              ✅ 完全复用
│   ├── orchestrator.rs      → MCP 工具使用
│   ├── static_analyzer.rs   → MCP 工具使用
│   └── ...
│
├── chunking.rs              ✅ 完全复用
├── embeddings.rs            ✅ 完全复用
└── file_walker.rs           ✅ 完全复用
```

### 6.2 废弃的模块

```
src-tauri/src/agent_core/
├── agent.rs                 ❌ 废弃 (SDK 替代)
├── coding_agent.rs          ❌ 废弃 (SDK 替代)
├── enhanced_coding_agent.rs ❌ 废弃 (SDK 替代)
└── agent_sdk_coding_agent.rs ❌ 废弃 (已被真正的 SDK 替代)

src-tauri/src/
├── enhanced_claude_wrapper.rs ❌ 废弃
├── agent_sdk_wrapper.rs     ❌ 废弃
└── ts_sdk_wrapper.rs        ❌ 废弃 (保留 real_agent_sdk_wrapper 即可)
```

### 6.3 保留并简化的模块

```
src-tauri/src/
├── claude_client/           ⚠️  仅 enrichment 使用
│   └── client.rs            (如果 enrichment 也改用 SDK，可完全废弃)
│
└── real_agent_sdk_wrapper.rs ✅ 简化为调用 MCP Bridge
```

---

## 7. 实施计划

### Phase 1: MCP 服务器开发 (3-5 天)

```
1. 创建 Rust MCP 服务器项目
   crates/codebase-mcp-server/
   
2. 实现 4 个核心工具:
   - scan_project
   - analyze_entity
   - enrich_code
   - semantic_search
   
3. 复用现有模块:
   - FileWalker
   - Extractors (TypeScript/Vue)
   - StaticAnalyzer
   - EnrichmentOrchestrator
   - EmbeddingsClient
```

### Phase 2: Node.js Bridge 简化 (1 天)

```
1. 简化 real-agent-sdk-bridge.ts
   - 移除手动工具实现
   - 配置 MCP 服务器
   - 调用 SDK query()
   
2. 配置 MCP 连接:
   mcpServers: {
       codebase: {
           type: 'stdio',
           command: './codebase-mcp-server'
       }
   }
```

### Phase 3: Rust 应用层简化 (1-2 天)

```
1. 简化 real_agent_sdk_wrapper.rs
   - 启动 MCP 服务器
   - 调用 Node.js Bridge
   - 处理响应
   
2. 移除废弃的 Agent 实现
   - agent.rs
   - coding_agent.rs
   - enhanced_coding_agent.rs
   等等
```

### Phase 4: 测试和优化 (2-3 天)

```
1. 端到端测试
2. 性能优化
3. 错误处理完善
4. 文档更新
```

---

## 8. 最终架构总结

```
┌─────────────────────────────────────────────────────────────────┐
│                      极简架构                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Rust 应用层 (50 行)                                            │
│    ↓ 启动 MCP + 调用 Bridge                                     │
│                                                                  │
│  Node.js Bridge (30 行)                                         │
│    query({ prompt, options: { mcpServers } })                   │
│    ↓ 一行代码调用 SDK                                           │
│                                                                  │
│  @anthropic-ai/claude-agent-sdk (官方)                          │
│    ↓ 自动管理一切                                               │
│    ├─> 内置 17 种工具                                           │
│    ├─> MCP 协议连接外部工具                                     │
│    ├─> Agent 循环                                               │
│    └─> 权限、错误、成本管理                                     │
│                                                                  │
│  Rust MCP 服务器 (200 行)                                       │
│    ├─> @codebase/scan_project                                   │
│    ├─> @codebase/analyze_entity                                 │
│    ├─> @codebase/enrich_code                                    │
│    └─> @codebase/semantic_search                                │
│         ↓ 复用现有模块                                          │
│    FileWalker, Extractors, EnrichmentOrchestrator, etc.         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

总代码量: ~280 行 (相比原来 ~1030 行)
功能: 更强大 (得益于 SDK)
维护: 更简单 (官方维护 SDK)
扩展: 更容易 (只需添加 MCP 工具)
```

---

## 9. 关键要点

### ✅ 你的理解完全正确

1. **SDK 已经提供了完整的 Agent 能力**
   - 工具调用、循环、权限、错误处理
   - 我们不需要重新实现

2. **我们只需要实现代码分析工具**
   - 作为 MCP 服务器
   - 使用 MCP 协议

3. **SDK 自动整合所有工具**
   - 内置工具 + 我们的 MCP 工具
   - AI 可以自由组合使用

### 🎯 核心工作

```
实现 4 个 MCP 工具:
├─ @codebase/scan_project      (扫描项目)
├─ @codebase/analyze_entity    (分析实体)
├─ @codebase/enrich_code       (生成摘要)
└─ @codebase/semantic_search   (语义搜索)

配置 Node.js Bridge:
└─ 传入 mcpServers 配置给 SDK

完成！
```

### 📚 参考文档

- **SDK 详解**: `CLAUDE_AGENT_SDK_DEEP_DIVE.md`
- **MCP 协议**: SDK 文档第 7 章
- **工具定义**: SDK 文档第 4 章

---

**文档版本**: v2.0 (基于 SDK 深度理解)
**最后更新**: 2025-10-03
**核心理念**: 极简架构，最大复用，官方 SDK 驱动
