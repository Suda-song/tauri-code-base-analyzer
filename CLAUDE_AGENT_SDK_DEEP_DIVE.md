# @anthropic-ai/claude-agent-sdk 深度解析文档

## 📖 文档概述

本文档基于 `@anthropic-ai/claude-agent-sdk@0.1.5` 的本地源码分析和官方文档研究，详细解析这个由 Anthropic 官方提供的 AI Agent 开发工具包的核心架构、功能模块和设计理念。

---

## 1. SDK 基本信息

### 1.1 包信息

- **包名**: `@anthropic-ai/claude-agent-sdk`
- **版本**: 0.1.5
- **主入口**: `sdk.mjs` (ES Module)
- **类型定义**: `sdk.d.ts`
- **Node.js 要求**: >= 18.0.0
- **开源地址**: https://github.com/anthropics/claude-code
- **官方文档**: https://docs.claude.com/en/api/agent-sdk/overview

### 1.2 核心定位

这是一个**生产级 AI Agent 开发框架**，它将 Claude Code（Anthropic 的 AI 编程助手产品）的核心能力封装为可编程的 SDK，让开发者能够：

1. **无需 UI**：以代码方式调用 Claude Code 的所有功能
2. **自动化工作流**：构建自主的 AI Agent 执行复杂任务
3. **完整控制**：通过钩子和权限系统精细控制 Agent 行为
4. **生产就绪**：内置错误处理、会话管理、成本追踪

---

## 2. SDK 核心架构

### 2.1 整体架构设计

SDK 采用**分层架构**，从底层到上层依次为：

```
┌─────────────────────────────────────────────────────┐
│           用户代码 (User Code)                      │
│           const response = query(...)               │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│         SDK 核心层 (sdk.mjs)                        │
│  • query() - 主入口函数                             │
│  • AsyncGenerator 流式接口                          │
│  • 控制命令 (interrupt/setModel...)                 │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│      Claude Code 可执行文件                         │
│      (内置的 Claude Code CLI)                       │
│  • 工具执行引擎                                     │
│  • Agent 自主循环                                   │
│  • 权限系统                                         │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│        Claude API (Anthropic)                       │
│        通过 Messages API 与模型交互                 │
└─────────────────────────────────────────────────────┘
```

**关键设计理念**：

1. **CLI 包装**：SDK 本质上是对 Claude Code CLI 的可编程包装
2. **流式通信**：使用 AsyncGenerator 实现流式消息传递
3. **进程隔离**：Claude Code 在独立进程中运行，SDK 通过进程间通信控制
4. **工具自动化**：所有工具执行都在 Claude Code 进程内自动完成

### 2.2 文件结构

```
@anthropic-ai/claude-agent-sdk/
├── sdk.mjs                    # 主入口，核心逻辑
├── sdk.d.ts                   # TypeScript 类型定义
├── sdkTypes.d.ts              # 详细的类型系统
├── sdk-tools.d.ts             # 工具相关类型
├── cli.js                     # CLI 工具（可选）
├── vendor/                    # 内置依赖
│   ├── claude-code-jetbrains-plugin/  # JetBrains 插件
│   └── ripgrep/               # 高性能文本搜索工具
│       ├── arm64-darwin/      # 各平台的 ripgrep 二进制
│       ├── x64-darwin/
│       ├── arm64-linux/
│       └── x64-win32/
└── yoga.wasm                  # 布局引擎（UI 相关）
```

**重要发现**：

- **内置 ripgrep**：为 grep 工具提供高性能支持
- **JetBrains 插件**：表明 SDK 可能与 IDE 集成共享核心逻辑
- **yoga.wasm**：布局引擎，可能用于渲染终端 UI 或代码编辑器界面
- **无 dependencies**：零依赖设计，所有功能自包含

---

## 3. 核心功能模块

### 3.1 主入口函数：query()

这是 SDK 的**唯一公开 API**，设计极其简洁：

**函数签名**：
```typescript
function query({
    prompt: string | AsyncIterable<SDKUserMessage>,
    options?: Options
}): Query
```

**返回值**：`Query` - 一个 AsyncGenerator，可以流式接收消息

**核心特点**：

1. **流式接口**：不是返回单个结果，而是返回一个异步生成器
2. **灵活输入**：支持简单字符串或复杂的消息流
3. **丰富配置**：通过 options 控制 Agent 的所有行为

### 3.2 消息系统 (SDKMessage)

SDK 定义了 **8 种消息类型**，覆盖 Agent 生命周期的所有阶段：

#### 1. **SDKSystemMessage** - 系统初始化
```typescript
{
    type: 'system',
    subtype: 'init',
    apiKeySource: 'user' | 'project' | 'org',
    cwd: string,              // 工作目录
    tools: string[],          // 可用工具列表
    mcp_servers: {...},       // MCP 服务器状态
    model: string,            // 使用的模型
    permissionMode: string,   // 权限模式
    slash_commands: string[]  // 斜杠命令
}
```
**作用**：告知 Agent 的初始配置和环境

#### 2. **SDKUserMessage** - 用户消息
```typescript
{
    type: 'user',
    message: APIUserMessage,  // 用户输入
    parent_tool_use_id: string | null,  // 父工具调用 ID
    isSynthetic?: boolean     // 是否为系统合成消息
}
```
**作用**：表示用户输入或工具执行结果（tool_result）

#### 3. **SDKAssistantMessage** - AI 响应
```typescript
{
    type: 'assistant',
    message: {
        content: [
            { type: 'text', text: '...' },
            { type: 'tool_use', name: 'bash', input: {...} }
        ]
    },
    parent_tool_use_id: string | null
}
```
**作用**：AI 的文本响应或工具调用请求

#### 4. **SDKPartialAssistantMessage** - 流式片段
```typescript
{
    type: 'stream_event',
    event: RawMessageStreamEvent  // 原始流式事件
}
```
**作用**：实时流式输出，可以获得部分响应

#### 5. **SDKResultMessage** - 最终结果
```typescript
{
    type: 'result',
    subtype: 'success' | 'error_max_turns' | 'error_during_execution',
    duration_ms: number,         // 总耗时
    duration_api_ms: number,     // API 耗时
    num_turns: number,           // 对话轮数
    total_cost_usd: number,      // 总成本
    usage: {
        input_tokens: number,
        output_tokens: number,
        cache_read_input_tokens: number,
        cache_creation_input_tokens: number
    },
    modelUsage: {
        [modelName: string]: {
            inputTokens: number,
            outputTokens: number,
            costUSD: number,
            webSearchRequests: number
        }
    },
    permission_denials: [...]    // 被拒绝的权限请求
}
```
**作用**：任务完成时的统计信息

#### 6. **SDKUserMessageReplay** - 消息确认
```typescript
{
    type: 'user',
    isReplay: true  // 标记为重放消息
}
```
**作用**：防止重复处理已添加的用户消息

#### 7. **SDKCompactBoundaryMessage** - 压缩边界
```typescript
{
    type: 'system',
    subtype: 'compact_boundary',
    compact_metadata: {
        trigger: 'manual' | 'auto',
        pre_tokens: number  // 压缩前的 token 数
    }
}
```
**作用**：当对话历史被压缩时的标记

#### 8. **SDKPermissionDenial** - 权限拒绝
```typescript
{
    tool_name: string,
    tool_use_id: string,
    tool_input: Record<string, unknown>
}
```
**作用**：记录被用户拒绝的工具调用

---

## 4. 内置工具系统

SDK 内置了 **17 种工具**，完全自动执行，无需开发者实现：

### 4.1 文件操作工具 (File Tools)

#### 1. **file_read** - 读取文件
- **能力**：支持大文件的分页读取（offset/limit）
- **路径要求**：必须是绝对路径

#### 2. **file_write** - 写入文件
- **能力**：创建新文件或覆盖现有文件
- **路径要求**：必须是绝对路径
- **自动处理**：自动创建父目录

#### 3. **file_edit** - 编辑文件
- **能力**：字符串搜索替换
- **选项**：支持替换首个或全部匹配
- **精确性**：要求 `old_string` 必须在文件中唯一匹配

#### 4. **notebook_edit** - 编辑 Jupyter Notebook
- **能力**：编辑、插入、删除 notebook 单元格
- **支持类型**：code 和 markdown 单元格
- **灵活性**：基于 cell_id 定位

### 4.2 代码执行工具 (Execution Tools)

#### 5. **bash** - 执行命令
- **能力**：
  - 同步执行（默认）
  - 后台执行（`run_in_background: true`）
  - 超时控制（最大 600 秒）
- **必需参数**：`description` - 命令的简短描述
- **安全性**：通过权限系统控制

#### 6. **bash_output** - 读取后台任务输出
- **能力**：读取后台 bash 任务的输出
- **过滤**：支持正则表达式过滤
- **实时性**：可以多次读取同一任务的输出

#### 7. **kill_shell** - 终止后台任务
- **能力**：强制终止指定的后台 bash 进程

### 4.3 搜索工具 (Search Tools)

#### 8. **grep** - 文本搜索
- **底层实现**：基于 ripgrep（高性能 Rust 实现）
- **能力**：
  - 正则表达式搜索
  - Glob 模式过滤文件
  - 上下文行控制（-A/-B/-C）
  - 大小写不敏感（-i）
  - 多行模式（multiline）
- **输出模式**：
  - `content` - 匹配的行内容
  - `files_with_matches` - 仅文件路径
  - `count` - 匹配计数
- **性能优化**：内置 `head_limit` 限制输出量

#### 9. **glob** - 文件名匹配
- **能力**：基于 glob 模式查找文件
- **模式支持**：
  - `*.js` - 所有 JS 文件
  - `**/*.ts` - 递归所有 TS 文件
  - `src/**/*.{js,ts}` - 多扩展名
- **性能**：基于修改时间排序

### 4.4 网络工具 (Web Tools)

#### 10. **web_search** - 网络搜索
- **能力**：
  - 使用搜索引擎查询
  - 域名白名单/黑名单
- **集成**：与 Claude 的搜索能力深度整合

#### 11. **web_fetch** - 抓取网页
- **能力**：
  - 获取网页内容
  - 对内容执行 prompt（如提取摘要）
- **智能处理**：自动解析 HTML 为可读文本

### 4.5 MCP 工具 (Model Context Protocol)

#### 12. **mcp** - MCP 工具调用
- **能力**：调用通过 MCP 协议连接的外部工具
- **灵活性**：输入格式由 MCP 服务器定义

#### 13. **list_mcp_resources** - 列出 MCP 资源
- **能力**：查询可用的 MCP 资源

#### 14. **read_mcp_resource** - 读取 MCP 资源
- **能力**：通过 URI 读取 MCP 资源内容

### 4.6 任务管理工具

#### 15. **todo_write** - 管理待办事项
- **能力**：
  - 创建、更新待办列表
  - 跟踪任务状态（pending/in_progress/completed）
- **用途**：Agent 自主管理复杂任务的拆解

#### 16. **agent** - 子 Agent 调用
- **能力**：创建专门的子 Agent 执行特定任务
- **参数**：
  - `subagent_type` - Agent 类型
  - `description` - 任务描述（3-5 词）
  - `prompt` - 具体任务
- **用途**：实现任务委派和并行处理

#### 17. **exit_plan_mode** - 退出计划模式
- **能力**：在计划模式下提交计划供用户审批
- **参数**：`plan` - Markdown 格式的计划

---

## 5. 权限系统 (Permission System)

这是 SDK 最精妙的设计之一，提供了**多层次的安全控制**。

### 5.1 权限模式 (PermissionMode)

SDK 定义了 **4 种权限模式**：

#### 1. **default** - 默认模式
- **行为**：根据用户配置的权限规则决定
- **交互**：可能提示用户批准工具调用
- **适用**：日常开发场景

#### 2. **acceptEdits** - 自动接受编辑
- **行为**：自动批准所有文件编辑操作
- **限制**：bash 命令仍需批准
- **适用**：代码重构、批量修改

#### 3. **bypassPermissions** - 完全绕过
- **行为**：无需任何批准，自动执行所有工具
- **风险**：高风险，仅用于完全可信环境
- **适用**：自动化脚本、CI/CD

#### 4. **plan** - 计划模式
- **行为**：Agent 先生成计划，等待用户批准后再执行
- **安全**：最安全的模式
- **适用**：敏感操作、生产环境

### 5.2 权限规则 (Permission Rules)

权限规则由**工具名称 + 内容匹配**组成：

```typescript
{
    toolName: "bash",
    ruleContent: "git push"  // 匹配命令中的特定字符串
}
```

**规则类型**：

1. **allow** - 白名单：自动批准匹配的工具调用
2. **deny** - 黑名单：自动拒绝匹配的工具调用
3. **ask** - 询问：提示用户决定

**规则存储位置** (PermissionUpdateDestination)：

- `session` - 仅当前会话
- `localSettings` - 当前项目（.claude/settings.local.json）
- `projectSettings` - 项目共享（.claude/settings.project.json）
- `userSettings` - 用户全局（~/.claude/settings.json）

### 5.3 动态权限控制：canUseTool 回调

开发者可以通过 `canUseTool` 回调函数实现**运行时权限控制**：

```typescript
options: {
    canUseTool: async (toolName, input, options) => {
        // 自定义逻辑判断是否允许
        if (toolName === 'bash' && input.command.includes('rm -rf')) {
            return {
                behavior: 'deny',
                message: '危险命令已被拒绝',
                interrupt: true
            };
        }
        
        return {
            behavior: 'allow',
            updatedInput: input,  // 可以修改工具输入
            updatedPermissions: [...]  // 可以更新权限规则
        };
    }
}
```

**关键能力**：

1. **动态判断**：基于上下文决定权限
2. **输入修改**：在执行前修改工具参数
3. **规则更新**：动态添加/删除权限规则
4. **中断执行**：拒绝后可选择中断整个任务

### 5.4 权限拒绝追踪

所有被拒绝的工具调用都会被记录在最终结果中：

```typescript
{
    type: 'result',
    permission_denials: [
        {
            tool_name: 'bash',
            tool_use_id: 'toolu_123',
            tool_input: { command: 'rm -rf /' }
        }
    ]
}
```

---

## 6. 钩子系统 (Hooks System)

钩子系统允许开发者**监听和干预** Agent 执行的各个阶段。

### 6.1 支持的钩子事件

SDK 定义了 **9 种钩子事件**：

#### 1. **PreToolUse** - 工具调用前
- **时机**：工具即将执行前
- **用途**：
  - 记录工具调用日志
  - 修改工具输入
  - 实施额外的权限检查
- **可返回**：
  - `permissionDecision` - 覆盖权限决策
  - `systemMessage` - 向 AI 发送系统消息

#### 2. **PostToolUse** - 工具调用后
- **时机**：工具执行完成后
- **用途**：
  - 记录执行结果
  - 添加额外上下文
  - 错误处理和重试逻辑
- **可返回**：
  - `additionalContext` - 补充信息给 AI

#### 3. **Notification** - 通知事件
- **时机**：Agent 发送通知时
- **用途**：
  - 捕获 Agent 的通知消息
  - 实现自定义通知系统
- **数据**：
  - `message` - 通知内容
  - `title` - 通知标题

#### 4. **UserPromptSubmit** - 用户输入提交
- **时机**：用户消息提交给 Agent 前
- **用途**：
  - 增强用户输入
  - 添加上下文信息
- **可返回**：
  - `additionalContext` - 补充给 AI 的上下文

#### 5. **SessionStart** - 会话开始
- **时机**：Agent 会话启动时
- **用途**：
  - 初始化日志系统
  - 加载历史上下文
- **数据**：
  - `source` - 启动来源（startup/resume/clear/compact）

#### 6. **SessionEnd** - 会话结束
- **时机**：Agent 会话终止时
- **用途**：
  - 清理资源
  - 保存会话日志
- **数据**：
  - `reason` - 结束原因（success/error/timeout...）

#### 7. **Stop** - 停止请求
- **时机**：用户请求停止 Agent 时
- **用途**：
  - 实现优雅关闭
  - 保存中间状态

#### 8. **SubagentStop** - 子 Agent 停止
- **时机**：子 Agent 停止时
- **用途**：跟踪子任务状态

#### 9. **PreCompact** - 压缩前
- **时机**：对话历史即将被压缩时
- **用途**：
  - 保存完整历史
  - 自定义压缩逻辑
- **数据**：
  - `trigger` - 触发方式（manual/auto）
  - `pre_tokens` - 压缩前的 token 数

### 6.2 钩子回调格式

钩子回调函数签名：

```typescript
type HookCallback = (
    input: HookInput,           // 事件数据
    toolUseID: string | undefined,  // 工具调用 ID（如适用）
    options: {
        signal: AbortSignal     // 可用于中断
    }
) => Promise<HookJSONOutput>
```

**返回值类型**：

1. **同步钩子** (SyncHookJSONOutput)：
```typescript
{
    continue?: boolean,         // 是否继续执行
    suppressOutput?: boolean,   // 是否抑制输出
    stopReason?: string,        // 停止原因
    decision?: 'approve' | 'block',  // 决策
    systemMessage?: string,     // 发送给 AI 的消息
    hookSpecificOutput?: {...}  // 特定钩子的输出
}
```

2. **异步钩子** (AsyncHookJSONOutput)：
```typescript
{
    async: true,
    asyncTimeout?: number  // 异步超时（毫秒）
}
```

### 6.3 钩子匹配器 (Hook Matchers)

可以为特定工具设置钩子：

```typescript
options: {
    hooks: {
        PreToolUse: [
            {
                matcher: 'bash',  // 仅匹配 bash 工具
                hooks: [bashPreHook]
            },
            {
                matcher: 'file_write',
                hooks: [fileWritePreHook]
            },
            {
                // 无 matcher，匹配所有工具
                hooks: [globalPreHook]
            }
        ]
    }
}
```

---

## 7. MCP (Model Context Protocol) 支持

### 7.1 MCP 简介

MCP 是 Anthropic 定义的一个开放协议，用于**扩展 AI Agent 的能力**。通过 MCP，Agent 可以：

- 连接到外部数据源（数据库、API、文件系统）
- 调用外部工具和服务
- 获取动态上下文信息

### 7.2 MCP 服务器类型

SDK 支持 **4 种 MCP 服务器连接方式**：

#### 1. **stdio** - 标准输入输出
```typescript
{
    type: 'stdio',
    command: 'path/to/mcp-server',
    args: ['--option', 'value'],
    env: { KEY: 'value' }
}
```
- **用途**：本地二进制 MCP 服务器
- **通信**：通过进程的 stdin/stdout

#### 2. **sse** - Server-Sent Events
```typescript
{
    type: 'sse',
    url: 'https://api.example.com/mcp/sse',
    headers: { 'Authorization': 'Bearer token' }
}
```
- **用途**：远程 HTTP MCP 服务器
- **通信**：通过 SSE 流

#### 3. **http** - HTTP 轮询
```typescript
{
    type: 'http',
    url: 'https://api.example.com/mcp',
    headers: { 'Authorization': 'Bearer token' }
}
```
- **用途**：标准 HTTP API
- **通信**：请求/响应模式

#### 4. **sdk** - SDK 内嵌
```typescript
{
    type: 'sdk',
    name: 'my-mcp-server',
    instance: mcpServerInstance
}
```
- **用途**：在同一进程中运行的 MCP 服务器
- **通信**：直接函数调用

### 7.3 创建自定义 MCP 服务器

SDK 提供了 `createSdkMcpServer()` 和 `tool()` 辅助函数：

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// 定义工具
const weatherTool = tool(
    'get_weather',
    '获取指定城市的天气',
    {
        city: z.string().describe('城市名称'),
        unit: z.enum(['celsius', 'fahrenheit']).optional()
    },
    async (args) => {
        // 实现工具逻辑
        const weather = await fetchWeather(args.city, args.unit);
        return {
            content: [{ 
                type: 'text', 
                text: `${args.city}的天气是：${weather}` 
            }]
        };
    }
);

// 创建 MCP 服务器
const weatherMcp = createSdkMcpServer({
    name: 'weather-server',
    version: '1.0.0',
    tools: [weatherTool]
});

// 使用
const response = query({
    prompt: '查询北京的天气',
    options: {
        mcpServers: {
            weather: weatherMcp
        }
    }
});
```

**优势**：

- **类型安全**：基于 Zod 的输入验证
- **进程内**：无需额外进程，性能最优
- **灵活**：可以访问 Node.js 的所有能力

### 7.4 MCP 服务器状态查询

可以通过 `mcpServerStatus()` 查询 MCP 服务器状态：

```typescript
const statuses = await response.mcpServerStatus();
// [
//     {
//         name: 'weather',
//         status: 'connected',
//         serverInfo: {
//             name: 'weather-server',
//             version: '1.0.0'
//         }
//     },
//     {
//         name: 'database',
//         status: 'failed'
//     }
// ]
```

---

## 8. 高级特性

### 8.1 会话管理 (Session Management)

#### 会话持久化

每个会话都有唯一的 `session_id`，可以通过以下方式恢复：

```typescript
options: {
    resume: 'session_abc123',  // 恢复指定会话
    resumeSessionAt: 'msg_xyz', // 恢复到特定消息
    forkSession: true          // 创建会话分支
}
```

**用途**：

- **长时间任务**：中断后恢复
- **会话分支**：在特定点创建不同的执行路径
- **调试**：重放历史会话

#### 会话压缩 (Compaction)

当对话历史过长时，SDK 会自动触发压缩：

- **触发条件**：Token 数接近上下文窗口限制
- **压缩方式**：使用 AI 总结历史，保留关键信息
- **边界标记**：通过 `SDKCompactBoundaryMessage` 标识

可以通过 `PreCompact` 钩子自定义压缩行为。

### 8.2 流式输出控制

#### 部分消息

通过 `includePartialMessages: true` 可以接收流式片段：

```typescript
for await (const message of response) {
    if (message.type === 'stream_event') {
        // 实时显示 AI 的部分输出
        console.log(message.event);
    }
}
```

**用途**：实现打字机效果、实时反馈

#### 中断执行

可以通过 `interrupt()` 方法中断正在执行的任务：

```typescript
const response = query({ prompt: '...', options });

// 5 秒后中断
setTimeout(() => {
    response.interrupt();
}, 5000);

for await (const message of response) {
    // 处理消息
}
```

### 8.3 动态模型切换

可以在执行过程中动态切换模型：

```typescript
const response = query({ prompt: '...', options });

// 切换到更强大的模型
await response.setModel('claude-opus-4');

for await (const message of response) {
    // ...
}
```

### 8.4 自定义可执行文件

可以指定不同的 JavaScript 运行时：

```typescript
options: {
    executable: 'bun',  // 或 'deno' / 'node'
    executableArgs: ['--experimental-feature']
}
```

### 8.5 Thinking Tokens

支持控制 AI 的"思考"过程：

```typescript
options: {
    maxThinkingTokens: 5000  // 允许 AI 使用最多 5000 token 思考
}
```

**用途**：

- **复杂推理**：给 AI 更多"思考空间"
- **成本控制**：限制思考 token 降低成本

### 8.6 Agent 系统

通过 `agents` 选项可以定义专门的子 Agent：

```typescript
options: {
    agents: {
        'code-reviewer': {
            description: '代码审查专家',
            tools: ['file_read', 'grep'],  // 限制工具
            prompt: '你是一个代码审查专家，关注...',
            model: 'sonnet'  // 可以使用不同模型
        },
        'test-writer': {
            description: '测试用例编写专家',
            tools: ['file_read', 'file_write'],
            prompt: '你擅长编写全面的测试用例...',
            model: 'haiku'  // 更便宜的模型
        }
    }
}
```

**调用子 Agent**：

```typescript
// AI 会自动调用 agent 工具
"请使用 code-reviewer agent 审查这个文件"
```

### 8.7 配置源控制

可以控制从哪些配置源加载设置：

```typescript
options: {
    settingSources: ['user', 'project', 'local']
    // 优先级：local > project > user
}
```

---

## 9. 成本和性能追踪

### 9.1 Token 使用统计

SDK 提供详细的 Token 使用统计：

```typescript
{
    usage: {
        input_tokens: 1500,           // 输入 token
        output_tokens: 500,           // 输出 token
        cache_read_input_tokens: 200, // 缓存命中 token
        cache_creation_input_tokens: 100  // 缓存创建 token
    }
}
```

**Prompt Caching**：

- SDK 自动利用 Anthropic 的 Prompt Caching 功能
- `cache_read_input_tokens` 可以显著降低成本
- 长期会话和重复任务受益最大

### 9.2 成本追踪

提供美元成本估算：

```typescript
{
    total_cost_usd: 0.0245,  // 总成本
    modelUsage: {
        'claude-3-5-sonnet-20241022': {
            inputTokens: 1500,
            outputTokens: 500,
            costUSD: 0.0200,
            webSearchRequests: 2
        },
        'claude-3-opus-20240229': {
            inputTokens: 300,
            outputTokens: 100,
            costUSD: 0.0045,
            webSearchRequests: 0
        }
    }
}
```

**多模型支持**：

- 可以在一个会话中使用多个模型
- 每个模型的成本单独统计
- 便于成本归因和优化

### 9.3 性能指标

提供详细的性能数据：

```typescript
{
    duration_ms: 15234,         // 总耗时
    duration_api_ms: 12000,     // API 调用耗时
    num_turns: 5                // 对话轮数
}
```

**优化建议**：

- `duration_api_ms` 占比过高：考虑使用缓存或更快的模型
- `num_turns` 过多：优化 prompt 提高效率
- 总耗时过长：考虑并行化或增加超时

---

## 10. 错误处理和调试

### 10.1 错误类型

SDK 定义了清晰的错误类型：

#### AbortError
```typescript
class AbortError extends Error {}
```

**触发场景**：

- 用户调用 `interrupt()`
- 设置了 `abortController` 并调用 `abort()`
- 超时

**处理方式**：

```typescript
try {
    for await (const message of response) {
        // ...
    }
} catch (error) {
    if (error instanceof AbortError) {
        console.log('任务被中断');
    }
}
```

#### 其他错误

- **配置错误**：options 参数不合法
- **API 错误**：Claude API 调用失败
- **工具错误**：工具执行失败（会重试）

### 10.2 调试支持

#### 标准错误输出

可以捕获 stderr 输出：

```typescript
options: {
    stderr: (data: string) => {
        console.error('[SDK]', data);
    }
}
```

**输出内容**：

- 工具执行日志
- 权限检查信息
- MCP 服务器连接状态
- 内部错误和警告

#### 会话转录

每个会话都会生成 transcript 文件：

- **位置**：`~/.claude/transcripts/{session_id}/`
- **格式**：JSON Lines（每行一个 JSON 对象）
- **内容**：完整的消息历史

通过 `PreToolUse` 等钩子可以获取 `transcript_path`，便于调试和审计。

---

## 11. 与 Claude Code 产品的关系

### 11.1 共享核心

SDK 和 Claude Code 桌面应用/CLI/编辑器插件**共享相同的核心引擎**：

```
┌─────────────────────────────────────────────────┐
│         Claude Code Core Engine                 │
│  • Agent 循环                                   │
│  • 工具执行                                     │
│  • 权限系统                                     │
│  • MCP 协议                                     │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┼─────────┬─────────────┐
        │         │         │             │
    ┌───▼───┐ ┌──▼──┐  ┌───▼────┐  ┌────▼────┐
    │  SDK  │ │ CLI │  │ VSCode │  │JetBrains│
    │       │ │     │  │ Plugin │  │  Plugin │
    └───────┘ └─────┘  └────────┘  └─────────┘
```

**这意味着**：

- SDK 的行为与 Claude Code 桌面版完全一致
- 在 SDK 中测试的 Agent 可以直接在 Claude Code 中运行
- 共享配置文件（.claude/ 目录）

### 11.2 SDK 独有特性

相比桌面版，SDK 提供了额外的编程能力：

1. **完全自动化**：无需人工交互
2. **自定义钩子**：拦截和修改 Agent 行为
3. **嵌入集成**：作为库集成到任意 Node.js 应用
4. **批量处理**：并发运行多个 Agent 会话
5. **CI/CD 集成**：在自动化流程中使用 AI

---

## 12. 最佳实践

### 12.1 权限配置

**开发环境**：
```typescript
options: {
    permissionMode: 'default',  // 保持交互
    allowedTools: ['file_read', 'grep', 'glob']  // 只读工具
}
```

**自动化脚本**：
```typescript
options: {
    permissionMode: 'bypassPermissions',  // 全自动
    // 但通过 canUseTool 实现关键检查
    canUseTool: async (toolName, input) => {
        if (toolName === 'bash' && isDangerousCommand(input.command)) {
            return { behavior: 'deny', message: '危险命令', interrupt: true };
        }
        return { behavior: 'allow', updatedInput: input };
    }
}
```

### 12.2 成本优化

1. **使用 Prompt Caching**：
   - 将不变的上下文（如代码库说明）放在 system prompt
   - 利用自动缓存降低成本

2. **选择合适的模型**：
   - 简单任务：`haiku`（最便宜）
   - 日常编程：`sonnet`（性价比高）
   - 复杂推理：`opus`（最强大）

3. **限制对话轮数**：
```typescript
options: {
    maxTurns: 10  // 防止无限循环
}
```

### 12.3 错误恢复

实现自动重试和恢复：

```typescript
async function robustQuery(prompt: string, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = query({ prompt, options });
            const result = await collectMessages(response);
            return result;
        } catch (error) {
            if (error instanceof AbortError) {
                throw error;  // 用户中断，不重试
            }
            if (i === maxRetries - 1) throw error;
            
            console.log(`重试 ${i + 1}/${maxRetries}...`);
            await sleep(1000 * (i + 1));  // 指数退避
        }
    }
}
```

### 12.4 日志和监控

通过钩子实现全面的日志记录：

```typescript
options: {
    hooks: {
        PreToolUse: [{
            hooks: [async (input) => {
                logger.info('工具调用', {
                    tool: input.tool_name,
                    input: input.tool_input,
                    sessionId: input.session_id
                });
                return {};
            }]
        }],
        PostToolUse: [{
            hooks: [async (input) => {
                logger.info('工具执行完成', {
                    tool: input.tool_name,
                    response: input.tool_response
                });
                return {};
            }]
        }],
        SessionEnd: [{
            hooks: [async (input) => {
                logger.info('会话结束', {
                    reason: input.reason,
                    sessionId: input.session_id
                });
                return {};
            }]
        }]
    }
}
```

---

## 13. 局限性和注意事项

### 13.1 平台限制

- **Node.js 18+**：需要现代 Node.js 版本
- **本地文件系统**：工具只能访问本地文件
- **网络访问**：需要网络连接到 Anthropic API

### 13.2 性能考量

- **进程开销**：每次调用 `query()` 都会启动新的 Claude Code 进程
- **内存使用**：长会话会占用大量内存（历史消息累积）
- **并发限制**：并发会话数受 API 速率限制

### 13.3 安全考虑

- **代码执行风险**：bash 工具可以执行任意命令
- **文件访问**：file_write 可以修改任意文件
- **API Key 保护**：务必妥善保管 API Key

**建议**：

- 生产环境使用 `plan` 模式
- 实施严格的 `canUseTool` 检查
- 使用权限规则限制工具能力
- 定期审计会话转录

---

## 14. 总结

### 14.1 核心价值

`@anthropic-ai/claude-agent-sdk` 的核心价值在于：

1. **零实现负担**：所有工具由 SDK 自动执行
2. **生产级质量**：与 Claude Code 产品共享核心引擎
3. **极致灵活**：通过钩子和权限系统完全可控
4. **简洁 API**：仅一个 `query()` 函数
5. **开放扩展**：通过 MCP 协议连接任意工具

### 14.2 适用场景

**理想场景**：

- 自动化代码审查和重构
- CI/CD 中的智能修复
- 批量代码迁移和升级
- 文档生成和维护
- 复杂的代码分析任务

**不适合场景**：

- 需要亚秒级响应的实时应用
- 高度受限的沙箱环境
- 离线环境（需要 API 连接）

### 14.3 技术亮点

1. **流式架构**：AsyncGenerator 实现高效的流式通信
2. **权限系统**：多层次的安全控制
3. **钩子机制**：可编程的生命周期管理
4. **MCP 协议**：开放的工具扩展标准
5. **自动缓存**：Prompt Caching 自动优化成本

---

**文档版本**: v1.0 (基于 @anthropic-ai/claude-agent-sdk@0.1.5)

**最后更新**: 2025-10-03

**作者**: AI 架构分析

**参考资料**:
- 本地 SDK 源码分析
- Anthropic 官方文档
- Claude Code 产品文档
- MCP 协议规范
