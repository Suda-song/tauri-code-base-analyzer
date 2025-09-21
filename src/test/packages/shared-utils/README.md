# @xhs/shared-utils

这是一个共享工具包，提供各个子包通用的工具函数和实用工具。

## 功能特性

### SimpleLogger

简单的文件日志工具类，支持：

- 按日期分文件存储日志
- 支持不同日志级别 (INFO, WARN, ERROR)
- 可通过环境变量控制是否启用日志
- 自动处理日志目录创建
- 优雅处理写入失败，不影响主功能

## 安装

在workspace中的其他包中使用：

```bash
# 在需要使用的包的 package.json 中添加依赖
{
  "dependencies": {
    "@xhs/shared-utils": "workspace:*"
  }
}
```

## 使用方法

### SimpleLogger

```typescript
import { SimpleLogger } from '@xhs/shared-utils';

// 创建日志实例
const logger = new SimpleLogger('/path/to/project/root');

// 记录不同级别的日志
logger.log('这是一个信息日志');
logger.warn('这是一个警告日志');
logger.error('这是一个错误日志');
```

### 环境变量配置

设置 `RAG_TOOL_DEBUG=true` 来启用日志记录：

```bash
export RAG_TOOL_DEBUG=true
```

## 日志文件位置

日志文件会保存在以下目录中：

1. 优先使用 `CURSOR_WORKSPACE_PATH` 环境变量指定的目录
2. 其次使用构造函数传入的 `projectRoot` 参数
3. 最后fallback到当前工作目录

日志文件格式：`logs/rag-tool/rag-tool-YYYY-MM-DD.log`

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 开发模式（监听文件变化）
npm run dev

# 清理构建产物
npm run clean
```

## 新增工具函数

要添加新的共享工具函数：

1. 在 `src/` 目录下创建对应的工具文件
2. 在 `src/index.ts` 中导出新的工具
3. 运行 `npm run build` 构建
4. 在需要使用的包中更新依赖并导入

## 许可证

ISC 