import { Entity, SearchResult } from "../types";
import { EnrichedEntity } from "@xhs/modular-code-analysis-agent";
export declare function generateCombinedPrompt(searchResult: any, allResults: SearchResult[]): string;
export declare function collectAllEntities(results: SearchResult[]): Entity[];
export declare function generateEntitySummary(allResults: SearchResult[]): string;
/**
 * 类型转换工具函数：将 EnrichedEntity 转换为 Entity
 */
export declare function enrichedToEntity(enriched: EnrichedEntity): Entity;
/**
 * 判断实体是否来自workspace包
 * 直接使用实体的isWorkspace标识
 */
export declare function isWorkspaceEntity(entity: Entity): boolean;
/**
 * 转换实体文件路径为绝对路径（多workspace支持）
 */
export declare function convertEntityToAbsolutePath(entity: Entity): Entity;
/**
 * 批量转换实体列表的路径
 */
export declare function convertEntitiesToAbsolutePaths(entities: Entity[]): Entity[];
