/**
 * Enrichment Agent 实体加载器
 * 从JSON文件加载实体数据
 */
import { BaseEntity } from './interfaces';
/**
 * 从JSON文件加载实体列表
 * @param filePath 实体JSON文件路径
 * @param rootDir 可选的根目录，用于解析相对路径
 * @returns 实体列表
 */
export declare function loadEntities(filePath: string, rootDir?: string): Promise<BaseEntity[]>;
/**
 * 验证实体列表，确保包含所有必要的字段
 * @param entities 要验证的实体列表
 * @returns 过滤后的有效实体列表
 */
export declare function validateEntities(entities: BaseEntity[]): BaseEntity[];
