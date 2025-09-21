/**
 * Enrichment Agent 编排器
 * 协调实体加载、静态分析、LLM标注和结果持久化
 */
import { BaseEntity, EnrichedEntity, EnrichmentConfig } from './interfaces';
export declare class EnrichmentOrchestrator {
    private config;
    private staticAnalyzer;
    private llmLabeler;
    private rootDir;
    private fullEntities;
    constructor(rootDir: string, config?: Partial<EnrichmentConfig>, fullEntities?: BaseEntity[]);
    /**
     * 初始化分析器实例（预初始化模式）
     */
    private initializeAnalyzers;
    /**
     * 更新分析器的实体上下文
     * @param fullEntities 完整的实体列表
     */
    private updateAnalyzersEntities;
    /**
     * 直接处理实体数组（无需文件I/O）
     * @param entitiesToEnrich 要富化的实体列表
     * @param fullEntities 完整的实体列表（用于上下文）
     * @returns 富化后的实体列表
     */
    enrichEntitiesDirectly(entitiesToEnrich: BaseEntity[], fullEntities: BaseEntity[]): Promise<EnrichedEntity[]>;
    /**
     * 运行完整的丰富化流程
     */
    run(customInputPath?: string, customOutputPath?: string): Promise<string>;
    /**
     * 运行静态分析更新流程（保留原有的summary和tags）
     */
    runStaticAnalysisUpdate(customInputPath?: string, customOutputPath?: string, enrichedInputPath?: string): Promise<string>;
    /**
     * 加载已有的enriched实体
     */
    private loadExistingEnrichedEntities;
    /**
     * 批量更新静态分析结果
     */
    private updateStaticAnalysis;
    /**
     * 更新单个实体的静态分析结果
     */
    private updateEntityStaticAnalysis;
    /**
     * 加载并验证实体
     */
    private loadAndValidateEntities;
    /**
     * 批量丰富实体，支持并发限制和重试
     */
    private enrichEntities;
    /**
     * 丰富单个实体，支持重试
     */
    private enrichEntityWithRetry;
    /**
     * 丰富单个实体
     */
    private enrichEntity;
}
