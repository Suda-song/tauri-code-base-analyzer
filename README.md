# Tauri 代码库分析器

一个基于 Tauri 的前端项目代码分析工具，能够精确提取 Vue、TypeScript、JavaScript 项目中的代码实体信息，生成结构化的 JSON 文档。

## 🚀 功能特性

### 📊 智能代码分析
- **多文件类型支持**：Vue (.vue)、TypeScript (.ts)、TSX (.tsx)、JavaScript (.js)
- **精确实体提取**：函数、类、接口、组件、常量等代码实体
- **工作区识别**：自动检测 monorepo 结构和 workspace 配置
- **DDD 模式检测**：识别领域驱动设计相关的代码模式

### 🏗️ 项目结构分析
- **Workspace 支持**：
  - 自动解析 `pnpm-workspace.yaml` 配置
  - 识别 `package.json` 中的 workspaces 字段
  - 智能查找 workspace 包的实际路径
- **依赖关系映射**：
  - 解析 `workspace:*` 依赖
  - 识别 `dependenciesMeta.injected` 配置
  - 构建包与包之间的关系图

### 📁 智能文件管理
- **自动输出目录**：在项目根目录的 `package.json` 同级创建 `codebase` 文件夹
- **时间戳文件名**：生成 `base_entity_YYYYMMDD_HHMMSS.json` 避免覆盖
- **一键打开位置**：跨平台支持直接打开生成文件所在目录

### 🎨 用户体验
- **分析历史记录**：保存最近 5 次分析的目录，快速切换
- **实时进度反馈**：显示分析统计和详细信息
- **中文界面**：完全中文化的用户界面

## 📦 安装和运行

### 环境要求
- Node.js 16+
- Rust 1.70+
- npm 或 pnpm

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run tauri:dev
```

### 生产构建
```bash
npm run tauri:build
```

## 🔧 使用方法

### 第一步：选择项目目录
1. 点击 **"选择目录"** 按钮
2. 选择要分析的前端项目根目录
3. 或从历史记录中快速选择之前分析过的目录

### 第二步：开始分析
1. 点击 **"Analyze Repository"** 按钮
2. 系统会自动：
   - 扫描项目文件结构
   - 解析 workspace 配置
   - 提取代码实体信息
   - 统计分析结果

### 第三步：查看结果
分析完成后可以查看：
- **统计信息**：总文件数、总实体数、Workspace包数量
- **实体详情**：每个代码实体的详细信息，包括类型标签和位置信息

### 第四步：保存结果
1. 点击 **"Save base_entity.json"** 按钮
2. 文件会自动保存到项目的 `codebase` 目录
3. 文件名包含时间戳，格式：`base_entity_20241201_143022.json`
4. 点击 **"📂 打开文件位置"** 直接访问生成的文件

## 📋 生成的实体格式

```json
{
  "entities": [
    {
      "id": "Function:buildGraphFromFile",
      "type": "function",
      "file": "packages/graph-builder-agent/src/builder.ts",
      "loc": {
        "start": 1008,
        "end": 1015
      },
      "rawName": "buildGraphFromFile",
      "isWorkspace": true,
      "isDDD": false
    }
  ],
  "total_files": 156,
  "total_entities": 342,
  "analysis_timestamp": "2024-12-01T14:30:22Z",
  "workspace_info": {
    "root_directory": "/path/to/project",
    "package_names": ["@company/shared-utils", "@company/core"],
    "package_paths": ["/path/to/packages/shared-utils", "/path/to/packages/core"],
    "is_monorepo": true
  }
}
```

### 实体字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 实体唯一标识符，格式：`类型:名称` |
| `type` | string | 实体类型：function、class、interface、component、const 等 |
| `file` | string | 文件相对路径 |
| `loc` | object | 代码位置信息（起始行号和结束行号）|
| `rawName` | string | 实体原始名称 |
| `isWorkspace` | boolean | 是否属于 workspace 包 |
| `isDDD` | boolean | 是否使用 DDD 模式 |

## 🏗️ 核心分析流程

### 1. 项目发现阶段
```
扫描目录 → 查找 package.json → 解析 workspace 配置 → 构建包映射
```

### 2. 文件收集阶段
```
遍历源码目录 → 过滤文件类型 → 排除无关目录 → 生成文件列表
```

### 3. 代码解析阶段
```
读取文件内容 → 正则表达式匹配 → 提取实体信息 → 标记属性
```

### 4. 结果生成阶段
```
合并实体列表 → 确保ID唯一性 → 生成统计信息 → 保存JSON文件
```

## 🔍 支持的实体类型

### Vue 文件 (.vue)
- **组件**：Vue 组件默认导出
- **Composables**：`use*` 模式的组合式函数
- **Script 内容**：TypeScript/JavaScript 实体

### TypeScript/JavaScript 文件 (.ts, .tsx, .js, .jsx)
- **函数**：`function` 和箭头函数
- **类**：`class` 定义
- **接口**：`interface` 定义
- **类型**：`type` 别名
- **常量**：`const` 声明

### 识别模式
- **导出实体**：`export` 关键字标记的实体
- **工作区包**：位于 packages/、apps/、libs/ 等目录的文件
- **DDD 模式**：导入 `@xhs/di` 的文件

## 📂 目录结构

```
tauri-code-base-analyzer/
├── src/                    # 前端源码 (Next.js)
│   ├── app/
│   │   ├── globals.css    # 全局样式
│   │   └── page.tsx       # 主界面组件
│   └── ...
├── src-tauri/             # Tauri 后端 (Rust)
│   ├── src/
│   │   ├── main.rs        # 主程序入口
│   │   ├── precise_analyzer.rs  # 精确分析器
│   │   ├── analyzer.rs    # 基础分析器
│   │   └── ...
│   ├── Cargo.toml         # Rust 依赖配置
│   └── tauri.conf.json    # Tauri 配置
├── package.json           # Node.js 依赖配置
└── README.md             # 项目文档
```

## 🛠️ 技术栈

### 前端
- **框架**：Next.js 14 + React 18
- **语言**：TypeScript
- **样式**：CSS Modules
- **UI**：原生 HTML/CSS

### 后端
- **框架**：Tauri 2.x
- **语言**：Rust
- **依赖**：
  - `regex` - 正则表达式解析
  - `serde` - JSON 序列化
  - `chrono` - 时间处理
  - `walkdir` - 目录遍历

## 🔧 配置说明

### 权限配置
应用需要以下权限：
- **文件系统**：读取项目文件和写入分析结果
- **对话框**：选择目录的文件选择器
- **Shell**：打开文件管理器

### 自定义配置
可以通过修改 `src-tauri/src/precise_analyzer.rs` 中的正则表达式来：
- 添加新的实体类型识别
- 调整文件过滤规则
- 修改 workspace 检测逻辑

## 🚨 注意事项

1. **大型项目**：对于包含大量文件的项目，分析可能需要较长时间
2. **权限要求**：确保对选择的目录有读取权限
3. **内存使用**：分析大型 monorepo 时可能占用较多内存
4. **文件编码**：仅支持 UTF-8 编码的源文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个工具！

## 📄 许可证

MIT License - 详见 LICENSE 文件