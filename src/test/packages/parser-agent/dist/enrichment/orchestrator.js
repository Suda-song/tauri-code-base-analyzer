"use strict";
/**
 * Enrichment Agent 编排器
 * 协调实体加载、静态分析、LLM标注和结果持久化
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnrichmentOrchestrator = void 0;
const p_limit_1 = __importDefault(require("p-limit"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("./config");
const loader_1 = require("./loader");
const staticAnalyzer_1 = require("./staticAnalyzer");
const llmLabeler_1 = require("./llmLabeler");
const persistence_1 = require("./persistence");
class EnrichmentOrchestrator {
    constructor(rootDir, config, fullEntities) {
        this.staticAnalyzer = null;
        this.llmLabeler = null;
        this.fullEntities = null;
        this.rootDir = rootDir;
        this.config = (0, config_1.getEnrichmentConfig)(config);
        this.fullEntities = fullEntities || null;
        // 如果启用了预初始化，则在构造时创建实例
        if (this.config.preInitialize) {
            this.initializeAnalyzers();
        }
    }
    /**
     * 初始化分析器实例（预初始化模式）
     */
    initializeAnalyzers() {
        const entitiesToUse = this.fullEntities || [];
        this.staticAnalyzer = new staticAnalyzer_1.StaticAnalyzer(this.rootDir, entitiesToUse);
        // 将EnrichmentConfig的concurrency传递给LLMLabeler
        const llmConfig = {
            ...(0, config_1.getLLMConfig)(),
            maxConcurrency: this.config.concurrency
        };
        this.llmLabeler = new llmLabeler_1.LLMLabeler(llmConfig, this.rootDir, entitiesToUse);
        console.log('🔧 预初始化了 StaticAnalyzer 和 LLMLabeler 实例');
    }
    /**
     * 更新分析器的实体上下文
     * @param fullEntities 完整的实体列表
     */
    async updateAnalyzersEntities(fullEntities) {
        if (this.staticAnalyzer) {
            this.staticAnalyzer.setEntities(fullEntities);
        }
        if (this.llmLabeler) {
            this.llmLabeler.setEntities(fullEntities);
        }
    }
    /**
     * 直接处理实体数组（无需文件I/O）
     * @param entitiesToEnrich 要富化的实体列表
     * @param fullEntities 完整的实体列表（用于上下文）
     * @returns 富化后的实体列表
     */
    async enrichEntitiesDirectly(entitiesToEnrich, fullEntities) {
        if (entitiesToEnrich.length === 0) {
            console.warn('没有实体需要富化');
            return [];
        }
        console.log(`🚀 开始直接富化 ${entitiesToEnrich.length} 个实体，上下文包含 ${fullEntities.length} 个实体`);
        // 确保分析器实例存在
        if (!this.staticAnalyzer || !this.llmLabeler) {
            this.staticAnalyzer = new staticAnalyzer_1.StaticAnalyzer(this.rootDir, fullEntities);
            // 将EnrichmentConfig的concurrency传递给LLMLabeler
            const llmConfig = {
                ...(0, config_1.getLLMConfig)(),
                maxConcurrency: this.config.concurrency
            };
            this.llmLabeler = new llmLabeler_1.LLMLabeler(llmConfig, this.rootDir, fullEntities);
            console.log('🔧 动态创建了 StaticAnalyzer 和 LLMLabeler 实例');
        }
        else {
            // 更新实体上下文
            await this.updateAnalyzersEntities(fullEntities);
            console.log('🔄 更新了分析器的实体上下文');
        }
        // 执行富化处理
        const enrichedEntities = await this.enrichEntities(entitiesToEnrich);
        console.log(`✅ 直接富化完成，处理了 ${enrichedEntities.length} 个实体`);
        return enrichedEntities;
    }
    /**
     * 运行完整的丰富化流程
     */
    async run(customInputPath, customOutputPath) {
        console.log('开始实体丰富化流程...');
        // 步骤1: 加载实体
        const inputPath = customInputPath || this.config.inputPath;
        const entities = await this.loadAndValidateEntities(inputPath);
        if (entities.length === 0) {
            console.warn('没有有效实体可处理，流程终止');
            return '';
        }
        // 创建StaticAnalyzer和LLMLabeler实例，传入完整的entities（如果有）
        const entitiesToUse = this.fullEntities || entities;
        this.staticAnalyzer = new staticAnalyzer_1.StaticAnalyzer(this.rootDir, entitiesToUse);
        // 将EnrichmentConfig的concurrency传递给LLMLabeler
        const llmConfig = {
            ...(0, config_1.getLLMConfig)(),
            maxConcurrency: this.config.concurrency
        };
        this.llmLabeler = new llmLabeler_1.LLMLabeler(llmConfig, this.rootDir, entitiesToUse);
        // 步骤2: 为每个实体执行丰富化
        const enrichedEntities = await this.enrichEntities(entities);
        // 步骤3: 保存结果
        const outputPath = customOutputPath || this.config.outputPath;
        return await (0, persistence_1.saveEnrichedEntities)(enrichedEntities, outputPath, this.rootDir);
    }
    /**
     * 运行静态分析更新流程（保留原有的summary和tags）
     */
    async runStaticAnalysisUpdate(customInputPath, customOutputPath, enrichedInputPath) {
        console.log('开始静态分析更新流程...');
        // 步骤1: 加载基础实体
        const inputPath = customInputPath || this.config.inputPath;
        const entities = await this.loadAndValidateEntities(inputPath);
        if (entities.length === 0) {
            console.warn('没有有效实体可处理，流程终止');
            return '';
        }
        // 步骤2: 加载已有的enriched实体（如果存在）
        const existingEnrichedPath = enrichedInputPath || this.config.outputPath;
        const existingEnrichedEntities = await this.loadExistingEnrichedEntities(existingEnrichedPath);
        // 创建StaticAnalyzer实例
        const entitiesToUse = this.fullEntities || entities;
        this.staticAnalyzer = new staticAnalyzer_1.StaticAnalyzer(this.rootDir, entitiesToUse);
        // 步骤3: 为每个实体执行静态分析更新
        const updatedEntities = await this.updateStaticAnalysis(entities, existingEnrichedEntities);
        // 步骤4: 保存结果
        const outputPath = customOutputPath || this.config.outputPath;
        return await (0, persistence_1.saveEnrichedEntities)(updatedEntities, outputPath, this.rootDir);
    }
    /**
     * 加载已有的enriched实体
     */
    async loadExistingEnrichedEntities(enrichedPath) {
        const enrichedMap = new Map();
        try {
            const fullPath = path_1.default.isAbsolute(enrichedPath) ? enrichedPath : path_1.default.join(this.rootDir, enrichedPath);
            if (fs_1.default.existsSync(fullPath)) {
                console.log(`加载已有的enriched实体: ${fullPath}`);
                const enrichedData = JSON.parse(fs_1.default.readFileSync(fullPath, 'utf-8'));
                if (Array.isArray(enrichedData)) {
                    for (const entity of enrichedData) {
                        if (entity.id) {
                            enrichedMap.set(entity.id, entity);
                        }
                    }
                    console.log(`成功加载 ${enrichedMap.size} 个已有的enriched实体`);
                }
            }
            else {
                console.log(`enriched文件不存在: ${fullPath}，将创建新的enriched实体`);
            }
        }
        catch (error) {
            console.warn(`加载enriched实体失败: ${error.message}`);
        }
        return enrichedMap;
    }
    /**
     * 批量更新静态分析结果
     */
    async updateStaticAnalysis(entities, existingEnrichedEntities) {
        console.log(`开始更新 ${entities.length} 个实体的静态分析结果...`);
        // 创建并发限制器
        const limit = (0, p_limit_1.default)(this.config.concurrency);
        // 并发执行静态分析更新
        const tasks = entities.map(entity => limit(() => this.updateEntityStaticAnalysis(entity, existingEnrichedEntities.get(entity.id))));
        const results = await Promise.all(tasks);
        console.log(`完成 ${results.length} 个实体的静态分析更新`);
        return results;
    }
    /**
     * 更新单个实体的静态分析结果
     */
    async updateEntityStaticAnalysis(entity, existingEnrichedEntity) {
        console.log(`更新实体静态分析: ${entity.id}`);
        try {
            // 执行静态分析
            const analysisResult = await this.staticAnalyzer.analyzeEntity(entity);
            // 如果有已存在的enriched实体，保留其summary和tags
            if (existingEnrichedEntity) {
                console.log(`保留实体 ${entity.id} 的已有summary和tags`);
                return {
                    ...entity,
                    ...analysisResult,
                    summary: existingEnrichedEntity.summary,
                    tags: existingEnrichedEntity.tags
                };
            }
            else {
                // 如果没有已存在的enriched实体，创建新的但不包含summary和tags
                console.log(`实体 ${entity.id} 没有已有的enriched数据，创建新的静态分析结果`);
                return {
                    ...entity,
                    ...analysisResult,
                    summary: '',
                    tags: []
                };
            }
        }
        catch (error) {
            console.error(`处理实体 ${entity.id} 的静态分析失败: ${error.message}`);
            // 如果有已存在的enriched实体，至少保留其summary和tags
            if (existingEnrichedEntity) {
                return {
                    ...entity,
                    IMPORTS: existingEnrichedEntity.IMPORTS || [],
                    CALLS: existingEnrichedEntity.CALLS || [],
                    EMITS: existingEnrichedEntity.EMITS || [],
                    TEMPLATE_COMPONENTS: existingEnrichedEntity.TEMPLATE_COMPONENTS,
                    ANNOTATION: existingEnrichedEntity.ANNOTATION,
                    summary: existingEnrichedEntity.summary,
                    tags: existingEnrichedEntity.tags
                };
            }
            else {
                // 返回带有错误信息的基础实体
                return {
                    ...entity,
                    IMPORTS: [],
                    CALLS: [],
                    EMITS: [],
                    summary: `静态分析失败: ${error.message}`,
                    tags: ['静态分析失败']
                };
            }
        }
    }
    /**
     * 加载并验证实体
     */
    async loadAndValidateEntities(inputPath) {
        try {
            const entities = await (0, loader_1.loadEntities)(inputPath, this.rootDir);
            return (0, loader_1.validateEntities)(entities);
        }
        catch (error) {
            console.error(`加载实体失败: ${error.message}`);
            return [];
        }
    }
    /**
     * 批量丰富实体，支持并发限制和重试
     */
    async enrichEntities(entities) {
        console.log(`开始处理 ${entities.length} 个实体...`);
        // 创建并发限制器
        const limit = (0, p_limit_1.default)(this.config.concurrency);
        // 并发执行丰富化
        const tasks = entities.map(entity => limit(() => this.enrichEntityWithRetry(entity, this.config.maxRetries)));
        const results = await Promise.all(tasks);
        console.log(`完成 ${results.length} 个实体的丰富化`);
        return results;
    }
    /**
     * 丰富单个实体，支持重试
     */
    async enrichEntityWithRetry(entity, retriesLeft) {
        try {
            return await this.enrichEntity(entity);
        }
        catch (error) {
            if (retriesLeft > 0) {
                console.warn(`处理实体 ${entity.id} 失败，剩余重试次数: ${retriesLeft}`);
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
                return this.enrichEntityWithRetry(entity, retriesLeft - 1);
            }
            else {
                console.error(`处理实体 ${entity.id} 最终失败: ${error.message}`);
                // 返回带有错误信息的部分丰富化实体
                return {
                    ...entity,
                    IMPORTS: [],
                    CALLS: [],
                    EMITS: [],
                    summary: `处理失败: ${error.message}`,
                    tags: ['处理失败']
                };
            }
        }
    }
    /**
     * 丰富单个实体
     */
    async enrichEntity(entity) {
        console.log(`处理实体: ${entity.id}`);
        // 步骤1: 执行静态分析
        const analysisResult = await this.staticAnalyzer.analyzeEntity(entity);
        // 步骤2: 调用LLM生成摘要和标签
        const { summary, tags } = await this.llmLabeler.generateLabels(entity, analysisResult);
        // 返回丰富化后的实体
        return {
            ...entity,
            ...analysisResult,
            summary,
            tags
        };
    }
}
exports.EnrichmentOrchestrator = EnrichmentOrchestrator;
