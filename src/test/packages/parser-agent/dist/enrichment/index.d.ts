/**
 * Enrichment Agent 入口模块
 * 导出所有子模块和主要功能
 */
import { EnrichmentConfig } from './interfaces';
import { BaseEntity } from './interfaces';
export * from './interfaces';
export * from './config';
export * from './loader';
export * from './staticAnalyzer';
export * from './llmLabeler';
export * from './persistence';
export * from './orchestrator';
/**
 * 便捷函数：处理指定实体文件
 * @param inputPath 输入文件路径
 * @param outputPath 输出文件路径
 * @param rootDir 项目根目录
 * @param config 自定义配置
 * @param fullEntities 完整的实体列表（可选）
 */
export declare function enrichEntities(inputPath: string, outputPath: string, rootDir?: string, config?: Partial<EnrichmentConfig>, fullEntities?: BaseEntity[]): Promise<string>;
/**
 * 便捷函数：只更新静态分析结果，保留原有的summary和tags
 * @param inputPath 输入文件路径（基础实体）
 * @param outputPath 输出文件路径
 * @param rootDir 项目根目录
 * @param config 自定义配置
 * @param fullEntities 完整的实体列表（可选）
 * @param enrichedInputPath 已有enriched文件路径（可选，默认使用outputPath）
 */
export declare function updateStaticAnalysis(inputPath: string, outputPath: string, rootDir?: string, config?: Partial<EnrichmentConfig>, fullEntities?: BaseEntity[], enrichedInputPath?: string): Promise<string>;
/**
 * 命令行入口
 */
export declare function runCli(args: string[]): Promise<void>;
