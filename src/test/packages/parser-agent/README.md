# 🎯 Code Parser Agent

智能代码解析代理，支持多种文件格式的实体提取和分析。

## 📦 支持的文件类型和提取器

### 🔧 公共类型判断工具

所有提取器现在使用统一的 `TypeUtils` 工具类进行类型判断，确保一致性：

- **组件判断**：根据上下文（JSX vs 非JSX）采用不同的判断策略
- **函数识别**：箭头函数、函数表达式的准确识别  
- **常量识别**：命名规范和值类型的双重检查
- **类型推导**：智能的类型和ID前缀生成

### 1. 📄 VueExtractor (.vue)
**提取的实体类型**：
- `component` - Vue 组件

**支持的语法**：
- `<script setup>` 语法 
- `export default` 语法
- `defineComponent()` 调用
- `Vue.defineComponent()` 调用

### 2. 🔧 FunctionExtractor (.ts)  
**提取的实体类型**：
- `component` - TS 组件（基于命名规范判断）
- `function` - 函数声明和函数变量
- `class` - 类声明
- `variable` - 变量声明（常量、普通变量等）

**支持的导出语法**：

#### 默认导出
```typescript
// 函数组件（大写开头）
export default function MyComponent() {
  return new Element();
}

// 普通函数
export default function myFunction() {
  return "hello";
}

// 类组件
export default class MyComponent extends BaseComponent {
  render() {}
}

// 普通类
export default class MyClass {
  method() {}
}

// 箭头函数组件
export default const MyComponent = () => new Element();

// 普通箭头函数
export default const myFunction = () => "hello";

// 普通变量
export default const CONFIG = { api: 'url' };

// CommonJS 风格
const myFunction = () => "hello";
export = myFunction;
```

#### 命名导出
```typescript
// 导出函数组件
export function MyComponent() {
  return new Element();
}

// 导出普通函数
export function myFunction() {
  return "hello";
}

// 导出类组件
export class MyComponent extends BaseComponent {
  render() {}
}

// 导出普通类
export class MyClass {
  method() {}
}

// 导出变量组件
export const MyComponent = () => new Element();

// 导出普通变量函数
export const myFunction = () => "hello";

// 导出常量
export const API_URL = 'https://api.example.com';

// 导出配置对象
export const config = { debug: true };
```

#### 重新导出
```typescript
// 本地重新导出
const Component1 = () => new Element();
const myFunction = () => "hello";
const API_CONFIG = { url: 'xxx' };

export { Component1, myFunction, API_CONFIG };
export { Component1 as RenamedComponent };
```

#### 顶层声明（非导出）
```typescript
// 顶层函数声明
function myFunction() {
  return "hello";
}

// 顶层类声明
class MyClass {
  method() {}
}

// 顶层变量声明
const API_URL = 'https://api.example.com';
let counter = 0;
var globalConfig = { debug: true };

// 函数变量
const helper = () => "utility";

// 组件变量（大写开头）
const ButtonComponent = () => new Element();
```

**类型判断规则**：

**Component 判断规则**：
- 函数/变量名以大写字母开头：`MyComponent`
- 类继承组件相关基类：`extends Component/Base/Widget/Element`
- 包含组件相关注释或装饰器：`@Component`、`// 组件`

**Function 判断规则**：
- 箭头函数：`() => {}`
- 函数表达式：`function() {}`
- 不满足 Component 条件的函数

**Variable 判断规则**：
- 常量命名规范：`API_URL`、`MAX_COUNT`
- 简单常量值：字符串、数字、布尔值
- 配置对象、普通变量等

### 3. ⚛️ TSXExtractor (.tsx)
**提取的实体类型**：
- `component` - React/Vue TSX 组件
- `function` - 普通函数
- `class` - 普通类
- `component-import` - 导入的 Vue 组件

**支持的导出语法**：

#### 默认导出
```tsx
// 函数组件
export default function MyComponent() {
  return <div>Hello</div>;
}

// 类组件  
export default class MyComponent extends React.Component {
  render() { return <div>Hello</div>; }
}

// 箭头函数组件
export default const MyComponent = () => <div>Hello</div>;

// 普通函数
export default function myFunction() {
  return "hello";
}

// 普通类
export default class MyClass {
  method() {}
}

// CommonJS 风格
const MyComponent = () => <div>Hello</div>;
export = MyComponent;
```

#### 命名导出
```tsx
// 导出函数组件
export function MyComponent() {
  return <div>Hello</div>;
}

// 导出普通函数
export function myFunction() {
  return "hello";
}

// 导出类组件
export class MyComponent extends React.Component {
  render() { return <div>Hello</div>; }
}

// 导出普通类
export class MyClass {
  method() {}
}

// 导出变量组件
export const MyComponent = () => <div>Hello</div>;

// 导出普通变量函数
export const myFunction = () => "hello";
```

#### 重新导出
```tsx
// 本地重新导出
const Component1 = () => <div>1</div>;
const myFunction = () => "hello";

export { Component1, myFunction };
export { Component1 as RenamedComponent };
```

#### 导入 Vue 组件
```tsx
// 导入 Vue 组件（标记为 component-import）
import { VueComponent } from './MyComponent.vue';
```

## 🔍 实体类型判断规则

### Component 判断规则
**函数/变量**：
- 返回 JSX：`return <div>` 或 `=> <div>`
- 函数名以大写字母开头：`MyComponent`

**类**：
- 继承 React.Component：`extends React.Component`
- 包含 render 方法：`render() {}`  
- 类名以大写字母开头：`MyComponent`

### Function 判断规则
- 箭头函数：`() => {}`
- 函数表达式：`function() {}`
- 不满足 Component 条件的函数

### Class 判断规则
- 类声明：`class MyClass {}`
- 不满足 Component 条件的类

## 📊 实体结构

```typescript
interface Entity {
  id: string;           // 实体ID，格式：Type:Name
  type: string;         // 实体类型：component | function | class | component-import
  file: string;         // 相对文件路径
  loc: number;          // 代码行号
  rawName: string;      // 原始名称
}
```

## 🎯 使用示例

```typescript
import { VueExtractor, FunctionExtractor, TSXExtractor } from './extractors';

// 提取 Vue 组件
const vueEntities = VueExtractor.extract('./Component.vue', './src');

// 提取 TS 函数和类  
const tsEntities = FunctionExtractor.extract('./utils.ts', './src');

// 提取 TSX 组件
const tsxEntities = TSXExtractor.extract('./Component.tsx', './src');
```

## 📋 提取示例

### TSX 文件示例

**TSX 文件示例**：
```tsx
// MyComponent.tsx
import React from 'react';
import { VueComp } from './VueComp.vue';

export default function MyComponent() {
  return <div>主组件</div>;
}

export function HelperComponent() {
  return <span>辅助组件</span>;
}

export function utilFunction() {
  return "工具函数";
}

export class UtilClass {
  method() {}
}

const LocalComponent = () => <div>本地组件</div>;
const localFunction = () => "本地函数";

export { LocalComponent, localFunction };
```

**TSX 提取结果**：
```json
[
  {
    "id": "Component:MyComponent",
    "type": "component", 
    "rawName": "MyComponent",
    "loc": 4
  },
  {
    "id": "Component:HelperComponent", 
    "type": "component",
    "rawName": "HelperComponent",
    "loc": 8
  },
  {
    "id": "Function:utilFunction",
    "type": "function", 
    "rawName": "utilFunction",
    "loc": 12
  },
  {
    "id": "Class:UtilClass",
    "type": "class",
    "rawName": "UtilClass", 
    "loc": 16
  },
  {
    "id": "Component:LocalComponent",
    "type": "component",
    "rawName": "LocalComponent",
    "loc": 23
  },
  {
    "id": "Function:localFunction", 
    "type": "function",
    "rawName": "localFunction",
    "loc": 23
  },
  {
    "id": "Component:VueComp",
    "type": "component-import",
    "rawName": "VueComp",
    "loc": 2
  }
]
```

### TS 文件示例

**TS 文件示例**：
```typescript
// utils.ts
export default function MyComponent() {
  return new Element();
}

export function utilFunction() {
  return "工具函数";
}

export class DataProcessor {
  process() {}
}

export const API_URL = 'https://api.example.com';

export const ButtonComponent = () => new Element();

// 顶层声明
function helperFunction() {
  return "helper";
}

class LocalClass {
  method() {}
}

const CONFIG = { debug: true };
let counter = 0;

const localHelper = () => "local";

// 重新导出
export { helperFunction, CONFIG };
```

**TS 提取结果**：
```json
[
  {
    "id": "Component:utils",
    "type": "component",
    "rawName": "MyComponent",
    "loc": { "start": 2, "end": 4 }
  },
  {
    "id": "Function:utilFunction",
    "type": "function",
    "rawName": "utilFunction",
    "loc": { "start": 6, "end": 8 }
  },
  {
    "id": "Class:DataProcessor",
    "type": "class",
    "rawName": "DataProcessor",
    "loc": { "start": 10, "end": 12 }
  },
  {
    "id": "Variable:API_URL",
    "type": "variable",
    "rawName": "API_URL",
    "loc": { "start": 14, "end": 14 }
  },
  {
    "id": "Component:ButtonComponent",
    "type": "component",
    "rawName": "ButtonComponent",
    "loc": { "start": 16, "end": 16 }
  },
  {
    "id": "Function:helperFunction",
    "type": "function",
    "rawName": "helperFunction",
    "loc": { "start": 19, "end": 21 }
  },
  {
    "id": "Class:LocalClass",
    "type": "class",
    "rawName": "LocalClass",
    "loc": { "start": 23, "end": 25 }
  },
  {
    "id": "Variable:CONFIG",
    "type": "variable",
    "rawName": "CONFIG",
    "loc": { "start": 27, "end": 27 }
  },
  {
    "id": "Variable:counter",
    "type": "variable",
    "rawName": "counter",
    "loc": { "start": 28, "end": 28 }
  },
  {
    "id": "Function:localHelper",
    "type": "function",
    "rawName": "localHelper",
    "loc": { "start": 30, "end": 30 }
  }
]
```

## 🎨 特色功能

- ✅ **智能类型判断**：自动识别组件、函数、类、变量
- ✅ **多种导出语法**：支持 ES6 和 CommonJS 导出
- ✅ **Vue 集成**：特殊处理 Vue 组件导入
- ✅ **重新导出**：支持本地重新导出语法
- ✅ **顶层声明**：提取所有顶层变量声明
- ✅ **一致性**：三个提取器使用统一的实体结构和类型判断逻辑

## 🏗️ 架构改进

### TypeUtils 公共工具类

为了确保三个提取器（VueExtractor、FunctionExtractor、TSXExtractor）的类型判断逻辑完全一致，我们提取了公共的 `TypeUtils` 工具类：

```typescript
// src/extractors/TypeUtils.ts
export class TypeUtils {
  // 统一的组件判断逻辑（支持JSX和非JSX上下文）
  static isComponentFunction(funcNode: FunctionDeclaration, isJSXContext = false): boolean
  static isComponentClass(classNode: ClassDeclaration, isJSXContext = false): boolean  
  static isComponentVariable(declaration: any, isJSXContext = false): boolean
  
  // 统一的类型识别方法
  static isFunctionVariable(declaration: any): boolean
  static isConstantVariable(declaration: any): boolean
  
  // 统一的类型信息生成
  static getEntityTypeInfo(isComponent: boolean, isFunction: boolean, isConstant: boolean)
  static getClassTypeInfo(isComponent: boolean)
}
```

### 上下文感知的类型判断

- **JSX上下文（TSXExtractor）**：
  - 组件：检查JSX返回值、React.Component继承、render方法
  - 更宽松的组件识别策略（大写开头 + JSX特征）

- **非JSX上下文（FunctionExtractor）**：
  - 组件：依赖明确的组件关键字、装饰器、继承关系
  - 更严格的组件识别策略

### 一致的实体类型

所有提取器现在都支持相同的实体类型：
- `component` - 组件（函数组件、类组件）
- `function` - 普通函数
- `class` - 普通类  
- `variable` - 变量（常量、配置等）
- `component-import` - 导入的组件（仅TSX）

### 完整的语法支持

三个提取器都支持：
- ✅ 默认导出：`export default`
- ✅ 命名导出：`export function/class/const`
- ✅ 重新导出：`export { ... }`
- ✅ 顶层声明：无export关键字的声明
- ✅ CommonJS：`export = xxx`

## 主要功能

该模块包含两个主要功能模块：

### 1. 代码实体提取器

- 支持从Vue, TS, TSX文件中提取组件和函数
- 识别script setup组件、默认导出组件和defineComponent调用
- 支持递归扫描项目目录结构

### 2. Enrichment Agent (丰富化处理)

- **静态分析:** 提取代码中的IMPORTS, CALLS, EMITS和TEMPLATE_COMPONENTS
- **跨文件分析:** 识别模块依赖关系和跨文件调用
- **LLM标签生成:** 使用Claude模型分析代码生成摘要和标签
- **工具支持:** 提供读取文件等工具供LLM使用
- **持久化:** 将丰富化后的实体保存为JSON文件

## 安装

```bash
# 在项目根目录执行
npm install
# 或者在packages/parser-agent目录执行
npm install
```

## 使用方法

### 提取代码实体

```bash
# 提取指定目录下的代码实体
npm run extract -- --path=/path/to/project
```

### 丰富化处理

```bash
# 对已提取的实体进行丰富化处理
npm run enrich -- --input=/path/to/entities.json --output=/path/to/output.json
```

## 开发

### 项目结构

```
src/
├── extractors/           # 提取器实现
│   ├── TypeUtils.ts      # 公共类型判断工具
│   ├── VueExtractor.ts   # Vue文件提取器
│   ├── TSXExtractor.ts   # TSX文件提取器
│   └── FunctionExtractor.ts # TS函数提取器
├── fileWalker.ts         # 文件扫描和实体提取
├── enrichment/           # 丰富化处理模块
│   ├── config.ts         # 配置
│   ├── interfaces.ts     # 类型定义
│   ├── loader.ts         # 实体加载
│   ├── staticAnalyzer.ts # 静态分析
│   ├── llmLabeler.ts     # LLM标签生成
│   ├── tools.ts          # 工具定义
│   ├── persistence.ts    # 持久化
│   ├── orchestrator.ts   # 流程编排
│   ├── cli.ts            # 命令行入口
│   └── index.ts          # 模块导出
└── index.ts              # 主入口
```

### 测试

项目使用vitest进行测试。测试文件主要有：

- `src/index.test.ts` - 测试实体提取功能
- `src/enrichment.test.ts` - 测试丰富化处理功能

运行测试：

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm run test src/index.test.ts

# 运行特定测试用例
npm run test -- -t "StaticAnalyzer"

# 使用详细输出运行测试
npm run test -- --silent=false
```

### 调试

为了便于调试，可以添加日志输出，或使用以下命令：

```bash
# 使用Node调试器运行
node --inspect-brk node_modules/.bin/vitest run src/index.test.ts
```

## 类型和接口

主要类型定义位于 `src/enrichment/interfaces.ts`，包括：

- `BaseEntity` - 基本代码实体
- `StaticAnalysisResult` - 静态分析结果
- `EnrichedEntity` - 丰富化后的实体
- `LLMResponse` - LLM响应结果

## 技术实现细节

### 静态分析器

静态分析器(`StaticAnalyzer`)是Parser Agent的核心组件之一，负责：

1. 解析Vue/TSX/TS文件中的：
   - 导入语句(IMPORTS)
   - 函数调用(CALLS)
   - 事件发送(EMITS)
   - 模板组件(TEMPLATE_COMPONENTS)

2. 跨文件关系分析：
   - 追踪导入来源，建立调用关系图
   - 只捕获项目内部实体的调用，过滤通用方法
   - 缓存文件分析结果，提高性能

## 搜索代码组件相关能力例子

# 搜索相关代码组件
pnpm rag:search "我需要一个地址选择组件" -e ./entities.json -o prompt.txt

# 获取与特定组件相关的其他组件（二跳查询）
pnpm rag:related "Component:AddressSelect" -e ./entities.json -o related-prompt.txt

## 日志功能

### 启用日志记录

设置环境变量来启用RAG工具的详细日志记录：

```bash
export RAG_TOOL_DEBUG=true
```

### 日志文件位置

日志文件会保存在以下目录中，按日期命名：

1. 如果设置了 `CURSOR_WORKSPACE_PATH` 环境变量（Cursor编辑器中自动设置）：
   ```
   $CURSOR_WORKSPACE_PATH/logs/rag-tool/rag-tool-2024-01-15.log
   ```

2. 如果没有设置 `CURSOR_WORKSPACE_PATH`，则使用项目根目录：
   ```
   {projectRoot}/logs/rag-tool/rag-tool-2024-01-15.log
   ```

3. 如果都没有，则使用当前工作目录：
   ```
   logs/rag-tool/rag-tool-2024-01-15.log
   ```

### 日志级别

- **INFO**: 一般信息，如实体加载成功、评分完成等
- **WARN**: 警告信息，如AI返回格式不正确等
- **ERROR**: 错误信息，如文件加载失败、实体未找到等

### 日志格式

```
[2024-01-15T10:30:45.123Z] [INFO] 已加载 150 个实体
[2024-01-15T10:30:50.456Z] [WARN] 批次1 AI返回格式不正确 (耗时1200ms)
[2024-01-15T10:30:55.789Z] [ERROR] 未找到ID为 Component:Button 的实体
```

### 注意事项

- 如果未设置 `RAG_TOOL_DEBUG=true`，不会产生任何日志文件
- 日志写入失败不会影响工具的正常功能
- MCP服务器不会再受到console输出的干扰

> **注意**: 日志功能现在由 `@xhs/shared-utils` 包提供的 `SimpleLogger` 类实现。详细使用方法请参考 [shared-utils 文档](../shared-utils/README.md)。