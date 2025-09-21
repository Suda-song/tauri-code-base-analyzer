/**
 * Enrichment Agent 持久化模块
 * 负责将生成的结果保存到文件
 */
import { EnrichedEntity } from './interfaces';
/**
 * 将丰富化后的实体保存到JSON文件
 * @param entities 丰富化后的实体数组
 * @param outputPath 输出文件路径
 * @param rootDir 可选的根目录，用于解析相对路径
 */
export declare function saveEnrichedEntities(entities: EnrichedEntity[], outputPath: string, rootDir?: string): Promise<string>;
