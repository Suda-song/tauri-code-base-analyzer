# @xhs/nebula-client

一个轻量级、高性能的 Nebula Graph 数据库客户端 SDK。

## 特性

- ✅ 基于 HTTP Gateway 的连接方式
- ✅ 自动会话管理和重连机制
- ✅ 完整的 TypeScript 类型支持
- ✅ 支持环境变量配置
- ✅ 向后兼容的函数式 API
- ✅ 现代化的类式 API

## 安装

```bash
npm install @xhs/nebula-client
```

## 快速开始

### API

```typescript
import { NebulaClient } from '@xhs/nebula-client';

// 创建客户端实例
const client = new NebulaClient({
  gatewayHost: 'http://localhost:8080',
  nebulaHost: 'localhost',
  nebulaPort: 9669,
  username: 'root',
  password: 'nebula',
  space: 'your_space'
});

// 连接数据库
await client.connect();

// 执行查询
const result = await client.executeNgql('SHOW SPACES');
console.log(result.data);

// 断开连接
await client.disconnect();
```

## 配置

### 环境变量

通过环境变量配置客户端：

```bash
GATEWAY_HOST=http://localhost:8080
NEBULA_HOST=localhost
NEBULA_PORT=9669
NEBULA_USER=root
NEBULA_PASSWORD=nebula
NEBULA_SPACE=your_space
```

### 构造函数选项

```typescript
interface NebulaClientOptions {
  gatewayHost?: string;    // HTTP Gateway 地址
  nebulaHost?: string;     // Nebula Graph 服务器地址
  nebulaPort?: number;     // Nebula Graph 端口
  username?: string;       // 用户名
  password?: string;       // 密码
  space?: string;          // 图空间名称
}
```

## API 参考

### NebulaClient 类

#### 构造函数

```typescript
constructor(options?: NebulaClientOptions)
```

#### 方法

- `connect(): Promise<void>` - 连接到 Nebula Graph
- `executeNgql(query: string): Promise<QueryResult>` - 执行 NGQL 查询
- `disconnect(): Promise<void>` - 断开连接并释放资源
- `isConnected(): boolean` - 检查连接状态
- `getSessionId(): string | null` - 获取当前会话ID
- `getConfig(): ClientConfig` - 获取当前配置信息

### QueryResult 接口

```typescript
interface QueryResult {
  error: null | string;
  data: any[];
  timeCost: number;
}
```

## 错误处理

客户端内置了自动重试机制，会在会话过期时自动重新连接：

```typescript
try {
  const result = await client.executeNgql('MATCH (v) RETURN v LIMIT 10');
  console.log(result.data);
} catch (error) {
  console.error('Query failed:', error);
}
```
