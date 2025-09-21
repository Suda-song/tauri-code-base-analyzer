/**
 * 图构建器模块
 */
import { FileEntity, EnrichedEntity } from './types';
import { NebulaClient } from '@xhs/nebula-client';
/**
 * 构建代码知识图谱
 * @param files 文件实体列表
 * @param entities 增强实体列表
 * @param client 可选的 Nebula 客户端实例，如果不提供则使用默认客户端
 */
export declare function buildGraph(files: FileEntity[], entities: EnrichedEntity[], client?: NebulaClient): Promise<void>;
