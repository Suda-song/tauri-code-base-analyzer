# Graph Builder Agent

将代码实体和关系写入 Nebula Graph 数据库，构建可查询的代码知识图谱。

## 配置

创建 `.env` 文件或设置环境变量：

```bash
# Nebula Graph HTTP Gateway 配置
GATEWAY_HOST=http://192.168.132.44:8080

# Nebula Graph 数据库连接配置  
NEBULA_HOST=redgraph-http-gateway
NEBULA_PORT=9669
NEBULA_USER=root
NEBULA_PASSWORD=nebula

# 图空间名称
NEBULA_SPACE=code_graph
```

## 安装依赖

```bash
pnpm install
```

## 运行测试

### 真实数据库测试

```bash
# 确保数据库服务运行正常
pnpm test

# 监视模式
pnpm test:watch
```

**注意**: 测试会使用真实的 Nebula Graph 数据库，请确保：
1. HTTP Gateway 服务正在运行
2. 数据库连接配置正确
3. 有足够的权限创建图空间和执行查询

## 使用方法

```typescript
import { buildGraph } from '@xhs/modular-project-graph-builder-agent';
import { FileEntity, EnrichedEntity } from '@xhs/modular-project-graph-builder-agent';

// 准备数据
const files: FileEntity[] = [/* ... */];
const entities: EnrichedEntity[] = [/* ... */];

// 构建图谱
await buildGraph(files, entities);
```

## API

### buildGraph(files, entities)

构建代码知识图谱

- `files`: 文件实体列表
- `entities`: 增强实体列表

### executeNgql(query)

执行 NGQL 查询

### releaseResources()

释放数据库连接资源 