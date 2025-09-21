# XHS Code Research MCP - 代码研究工具

这是一个支持多轮对话的小红书代码研究 MCP 插件，用于分析代码实体并生成相关代码建议。插件提供交互式的实体选择和确认流程，最终生成优化的代码。

## 功能特点

- 🔍 **智能实体搜索**：根据需求描述搜索相关的代码实体
- 🔄 **多轮对话支持**：交互式的实体选择和确认流程
- 📊 **关系分析**：分析实体间的导入、调用、模板和相似关系
- ✅ **用户确认机制**：允许用户调整实体选择
- 🚀 **AI 代码生成**：最终调用 AI Agent 生成优化代码

## 安装

```bash
npm install @xhs/code-research-mcp
```

## 配置

### 方式一：项目级配置（推荐）

在项目根目录创建 `.cursor/mcp.json` 配置文件：

```json
{
  "mcpServers": {
    "code-research": {
      "command": "npx",
      "args": ["-y", "@xhs/code-research-mcp"],
      "env": {
        "CURSOR_WORKSPACE_PATH": "${workspaceFolder}",
        "MCP_RETURN_DIRECT": "false"
      }
    }
  }
}
```

### 方式二：全局配置

在 Cursor 的 MCP Servers 中配置：

```json
{
  "mcpServers": {
    "code-research": {
      "command": "npx",
      "args": ["-y", "@xhs/code-research-mcp"],
      "env": {
        "CURSOR_WORKSPACE_PATH": "${workspaceFolder}",
        "MCP_RETURN_DIRECT": "false"
      }
    }
  }
}
```

### 🔧 高级配置选项

#### Return Direct 模式

通过设置 `MCP_RETURN_DIRECT` 环境变量控制工具输出模式：

- `MCP_RETURN_DIRECT=false` (默认): 工具结果经过AI优化后返回，更适合最终用户
- `MCP_RETURN_DIRECT=true`: 工具结果直接返回，不经过AI处理，适合调试和开发

```json
{
  "mcpServers": {
    "code-research": {
      "command": "npx",
      "args": ["-y", "@xhs/code-research-mcp"],
      "env": {
        "CURSOR_WORKSPACE_PATH": "${workspaceFolder}",
        "MCP_RETURN_DIRECT": "true"
      }
    }
  }
}
```

**使用场景**：
- ✅ 开发调试：需要查看原始数据和技术细节
- ✅ 性能优化：减少AI处理延迟
- ✅ 数据分析：需要精确的结构化数据
- ❌ 最终用户：希望获得友好的自然语言响应

更多配置详情请参考：[Return Direct 配置指南](./RETURN_DIRECT_CONFIG.md)

## 使用方法

### 前置条件

1. 项目根目录需要存在 `entities.enriched.json` 文件
2. 该文件包含已解析和丰富的实体信息

### 完整工作流程

#### 第一步：开始分析

```
工具：start-analysis
参数：
- input: "我需要实现用户登录功能"
- sessionId: "可选，用于多轮对话"
```

**输出示例**：
```
# 🔍 实体分析结果

## 需求分析
**用户需求**: 我需要实现用户登录功能
**分析结果**: 找到 5 个核心组件，23 个相关实体
**分析耗时**: 0.45秒
**会话ID**: 1703123456789

## 📋 推荐实体列表

### 核心组件 (按相关度排序)
1. **UserService** (相关度: 0.92)
   - 类型: Service
   - 文件: src/services/UserService.ts
   - 摘要: 用户相关业务逻辑处理

2. **AuthController** (相关度: 0.87)
   - 类型: Controller
   - 文件: src/controllers/AuthController.ts
   - 摘要: 认证相关的HTTP接口

### 相关实体汇总
- 导入关系: 8 个实体
- 调用关系: 12 个实体
- 模板关系: 3 个实体
- 相似标签: 15 个实体

## 🎯 下一步操作

**选项 1**: 如果推荐的实体列表满足需求，请使用：
工具: confirm-entities
参数: sessionId="1703123456789", action="confirm"

**选项 2**: 如果需要调整实体选择，请使用：
工具: modify-entities
参数: sessionId="1703123456789", entities="实体ID列表"

**选项 3**: 如果需要重新搜索，请使用：
工具: start-analysis
参数: input="新的需求描述"
```

#### 第二步（可选）：修改实体选择

```
工具：modify-entities
参数：
- sessionId: "1703123456789"
- entities: "UserService,AuthController,JwtUtil"
- operation: "replace" | "add" | "remove"
```

**输出示例**：
```
# 📝 实体选择已更新

## 操作结果
- 操作类型: replace
- 影响实体: UserService, AuthController, JwtUtil
- 当前选中数量: 3

## 当前选中的实体
1. **UserService** (Service) - src/services/UserService.ts
2. **AuthController** (Controller) - src/controllers/AuthController.ts
3. **JwtUtil** (Utility) - src/utils/JwtUtil.ts

## 🎯 下一步操作

**确认当前选择**:
工具: confirm-entities
参数: sessionId="1703123456789", action="confirm"

**继续修改**:
工具: modify-entities
参数: sessionId="1703123456789", entities="实体ID列表", operation="add/remove/replace"
```

#### 第三步：确认并生成代码

```
工具：confirm-entities
参数：
- sessionId: "1703123456789"
- action: "confirm"
```

**输出示例**：
```
# ✅ 实体确认完成

## 确认信息
- 会话ID: 1703123456789
- 用户需求: 我需要实现用户登录功能
- 选中实体数量: 15

## 选中的实体列表
1. **UserService** (Service) - src/services/UserService.ts
2. **AuthController** (Controller) - src/controllers/AuthController.ts
...

## 🚀 代码生成准备就绪

现在将使用以下上下文生成代码：

### 用户需求
我需要实现用户登录功能

### 完整上下文
# 搜索结果
[详细的RAG搜索结果和实体关系分析]

**下一步**: 系统将自动调用代码生成 Agent 来实现您的需求。

⚡ **正在生成代码中...**
```

## 工具说明

### 1. start-analysis
- **功能**: 开始代码实体分析对话
- **参数**: 
  - `input` (必需): 用户需求描述
  - `sessionId` (可选): 会话ID
- **返回**: 推荐的实体列表和后续操作选项

### 2. modify-entities
- **功能**: 修改选中的实体列表
- **参数**: 
  - `sessionId` (必需): 会话ID
  - `entities` (必需): 实体ID列表，逗号分隔
  - `operation` (可选): 操作类型 (replace/add/remove)
- **返回**: 更新后的实体列表

### 3. confirm-entities
- **功能**: 确认实体选择并开始代码生成
- **参数**: 
  - `sessionId` (必需): 会话ID
  - `action` (必需): 操作类型 (confirm/modify)
- **返回**: 确认信息和代码生成状态

## 工作流程图

```
1. 用户输入需求
   ↓
2. 系统分析并推荐实体
   ↓
3. 用户确认或修改实体选择 ←──┐
   ↓                        │
4. 如需修改，返回步骤3 ────────┘
   ↓
5. 确认后生成完整上下文
   ↓
6. 调用AI Agent生成代码
```

## 优势特性

### 🎯 精确控制
用户可以精确控制哪些实体参与代码生成，避免不相关的干扰

### 🔄 交互式体验
支持多轮对话，用户可以随时调整实体选择

### 📊 丰富上下文
提供完整的实体关系分析，确保AI理解项目结构

### ⚡ 高效生成
最终生成的上下文包含了所有必要信息，提高代码生成质量

## 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 启动服务器（开发模式）
pnpm start

# 测试
pnpm test

# 代码检查
pnpm lint
```

## 依赖说明

- `@modelcontextprotocol/sdk`: MCP SDK，用于构建 MCP 服务器
- `@parser-agent/rag-inline-tool`: RAG 工具，用于实体搜索和关系分析
- `zod`: 参数验证库

## 贡献

欢迎提交 Pull Request 或创建 Issue。

## 许可证

MIT 

graph TD
    A[用户运行 cursor mcp analyze] --> B[加载 MCP 配置]
    B --> C[初始化插件]
    C --> D[分析代码结构]
    D --> E[DDD 检测]
    E --> F[实体丰富化]
    F --> G[生成修改建议]
    G --> H[用户确认]
    H --> I[应用修改] 