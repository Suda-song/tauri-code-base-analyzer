# 图数据库 CRUD 操作模块

这个模块提供了对代码知识图谱中实体进行增删改查（CRUD）操作的完整功能。支持文件实体和代码实体的操作，以及复杂的关系查询。

## 数据类型

### FileEntity (文件实体)

```typescript
interface FileEntity {
  id: string; // 文件唯一标识
  path: string; // 文件路径
  name: string; // 文件名
  extension: string; // 文件扩展名
}
```

### EnrichedEntity (代码实体)

```typescript
interface EnrichedEntity {
  id: string; // 实体唯一标识
  type: string; // 实体类型 (function, class, variable等)
  file: string; // 所属文件路径
  loc: { start: number; end?: number } | number; // 位置信息
  rawName: string; // 原始名称
  isDDD: boolean; // 是否为DDD相关
  isWorkspace: boolean; // 是否为工作区代码
  IMPORTS: string[]; // 导入的实体ID列表
  CALLS: string[]; // 调用的实体ID列表
  EMITS: string[]; // 发出的事件列表
  TEMPLATE_COMPONENTS?: string[]; // 模板组件列表
  summary: string; // 实体描述
  tags: string[]; // 标签列表
  ANNOTATION: string; // 注解信息
}
```

## 核心 CRUD 功能

### 创建操作 (CREATE)

#### `create(entity, client?)`

创建单个实体（文件或代码实体）

- **入参**:
  - `entity`: `FileEntity | EnrichedEntity` - 要创建的实体
  - `client?`: `NebulaClient` - 可选的数据库客户端
- **返回**: `Promise<void>`

#### `batchCreate(entities, client?)`

批量创建多个实体

- **入参**:
  - `entities`: `(FileEntity | EnrichedEntity)[]` - 实体列表
  - `client?`: `NebulaClient` - 可选的数据库客户端
- **返回**: `Promise<void>`

### 读取操作 (READ)

#### `read(id, entityType?, client?)`

读取单个实体

- **入参**:
  - `id`: `string` - 实体 ID
  - `entityType?`: `EntityType` - 实体类型（可选，不提供则自动识别）
  - `client?`: `NebulaClient` - 可选的数据库客户端
- **返回**: `Promise<FileEntity | EnrichedEntity[] | null>`

#### `readAllSummary(client)`

读取所有实体的摘要信息

- **入参**:
  - `client`: `NebulaClient` - 数据库客户端
- **返回**: `Promise<string[]>` - 摘要信息列表

#### `getEntitiesInFile(fileId, client?)`

查询文件包含的所有代码实体

- **入参**:
  - `fileId`: `string` - 文件 ID
  - `client?`: `NebulaClient` - 可选的数据库客户端
- **返回**: `Promise<EnrichedEntity[]>`

#### `queryEntities(conditions, limit?, client?)`

根据条件查询实体

- **入参**:
  - `conditions`: 查询条件对象
    ```typescript
    {
      entityType?: string;    // 实体类型
      filePattern?: string;   // 文件路径模式
      namePattern?: string;   // 名称模式
      tagPattern?: string;    // 标签模式
    }
    ```
  - `limit?`: `number` - 结果数量限制，默认 100
  - `client?`: `NebulaClient` - 可选的数据库客户端
- **返回**: `Promise<EnrichedEntity[]>`

### 更新操作 (UPDATE)

#### `update(entity, client?)`

更新单个实体

- **入参**:
  - `entity`: `FileEntity | EnrichedEntity` - 要更新的实体
  - `client?`: `NebulaClient` - 可选的数据库客户端
- **返回**: `Promise<void>`

#### `batchUpdate(entities, client?)`

批量更新多个实体

- **入参**:
  - `entities`: `(FileEntity | EnrichedEntity)[]` - 实体列表
  - `client?`: `NebulaClient` - 可选的数据库客户端
- **返回**: `Promise<void>`

### 删除操作 (DELETE)

#### `remove(id, entityType?, client?)`

删除单个实体

- **入参**:
  - `id`: `string` - 实体 ID
  - `entityType?`: `EntityType` - 实体类型（可选）
  - `client?`: `NebulaClient` - 可选的数据库客户端
- **返回**: `Promise<boolean>` - 删除是否成功

#### `batchRemove(ids, entityType?, client?)`

批量删除多个实体

- **入参**:
  - `ids`: `string[]` - 实体 ID 列表
  - `entityType?`: `EntityType` - 实体类型（可选）
  - `client?`: `NebulaClient` - 可选的数据库客户端
- **返回**: `Promise<number>` - 成功删除的实体数量

## 关系查询功能

### `getEntityImports(entityId, client)`

获取实体的导入关系

- **入参**:
  - `entityId`: `string` - 实体 ID
  - `client`: `NebulaClient` - 数据库客户端
- **返回**: `Promise<string[]>` - 导入的实体 ID 列表

### `getEntityCalls(entityId, client)`

获取实体的调用关系

- **入参**:
  - `entityId`: `string` - 实体 ID
  - `client`: `NebulaClient` - 数据库客户端
- **返回**: `Promise<string[]>` - 调用的实体 ID 列表

### `getRelatedEntities(entityId, edgeType?, direction?, client?)`

根据实体 ID 和边类型查询相关实体

- **入参**:
  - `entityId`: `string` - 源实体 ID
  - `edgeType?`: `"IMPORTS" | "CALLS" | "CONTAINS" | "ALL"` - 边类型，默认"ALL"
  - `direction?`: `"OUT" | "IN" | "BOTH"` - 查询方向，默认"OUT"
  - `client?`: `NebulaClient` - 可选的数据库客户端
- **返回**: `Promise<RelatedEntity[]>` - 相关实体列表
  ```typescript
  interface RelatedEntity {
    entityId: string;
    entityType: string;
    rawName: string;
    description: string;
    relationshipType: string;
    direction: "OUT" | "IN";
  }
  ```

### `getEntityDependencyChain(entityId, maxHops?, edgeTypes?, client?)`

查询实体的多跳关系（依赖链分析）

- **入参**:
  - `entityId`: `string` - 源实体 ID
  - `maxHops?`: `number` - 最大跳数，默认 2
  - `edgeTypes?`: `string[]` - 查询的边类型，默认["IMPORTS", "CALLS"]
  - `client?`: `NebulaClient` - 可选的数据库客户端
- **返回**: `Promise<DependencyPath[]>` - 依赖路径列表
  ```typescript
  interface DependencyPath {
    path: string[];
    entities: any[];
  }
  ```

### `findRelationshipPath(sourceId, targetId, maxHops?, client?)`

查询两个实体之间的关系路径

- **入参**:
  - `sourceId`: `string` - 源实体 ID
  - `targetId`: `string` - 目标实体 ID
  - `maxHops?`: `number` - 最大跳数，默认 3
  - `client?`: `NebulaClient` - 可选的数据库客户端
- **返回**: `Promise<PathResult>` - 路径查询结果
  ```typescript
  interface PathResult {
    found: boolean;
    path?: string[];
    length?: number;
  }
  ```

## 使用示例

### 基本 CRUD 操作

```typescript
import { create, read, update, remove } from "./crud";
import { EntityType } from "./types";

// 创建文件实体
const fileEntity = {
  id: "src/App.vue",
  path: "src/App.vue",
  name: "App.vue",
  extension: ".vue",
};
await create(fileEntity);

// 读取实体
const entity = await read("src/App.vue", EntityType.FILE);

// 更新实体
await update(fileEntity);

// 删除实体
await remove("src/App.vue", EntityType.FILE);
```

### 批量操作

```typescript
// 批量创建
const entities = [fileEntity1, codeEntity1, codeEntity2];
await batchCreate(entities);

// 批量删除
const ids = ["entity1", "entity2", "entity3"];
const deletedCount = await batchRemove(ids);
```

### 关系查询

```typescript
// 查询实体的所有关系
const related = await getRelatedEntities("Function:myFunction", "ALL", "BOTH");

// 查询依赖链
const dependencies = await getEntityDependencyChain("Class:MyClass", 3);

// 查找两个实体间的路径
const path = await findRelationshipPath("entity1", "entity2", 5);
```

### 条件查询

```typescript
// 查询特定类型的实体
const functions = await queryEntities(
  {
    entityType: "function",
    filePattern: ".vue",
    namePattern: "handle",
  },
  50
);

// 查询文件中的所有实体
const entitiesInFile = await getEntitiesInFile("src/App.vue");
```

## 注意事项

1. **自动类型识别**: 大部分函数支持自动识别实体类型，无需手动指定
2. **事务处理**: 删除操作会自动处理相关边的删除
3. **客户端管理**: 如果不提供客户端参数，会使用默认的全局客户端实例

## 依赖模块

- `@xhs/nebula-client`: Nebula 图数据库客户端
- `./builder`: 图构建模块
- `./schema`: 图模式定义
- `./types`: 类型定义
