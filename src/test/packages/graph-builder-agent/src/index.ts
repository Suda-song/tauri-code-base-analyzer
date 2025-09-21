/**
 * Graph Builder Agent
 *
 * 将代码实体和关系写入 Nebula Graph 数据库，
 * 构建可查询的代码知识图谱
 */

// 重新导出类型定义
export { FileEntity, EnrichedEntity } from "./types";

// 导出图构建器
export * from "./builder";
export * from "./crud";
export * from "./client-manager";
// 导出RAG检索系统
export { CodeRAG } from "./rag";

// 导出Schema常量
export {
  FILE_TAG,
  ENTITY_TAG,
  REL_CONTAINS,
  REL_IMPORTS,
  REL_CALLS,
} from "./schema";

// 导出Nebula客户端工具
export {
  NebulaClient,
  getDefaultClient,
  executeNgql,
  releaseResources,
  connectNebula,
  isConnected,
  getSessionId,
} from "@xhs/nebula-client";
