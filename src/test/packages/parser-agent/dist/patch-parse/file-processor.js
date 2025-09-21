"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileProcessor = void 0;
const orchestrator_1 = require("../enrichment/orchestrator");
// 文件处理器（只做富化处理）
class FileProcessor {
    constructor(rootDir, options = {}) {
        this.rootDir = rootDir;
        this.options = {
            concurrency: 5,
            maxRetries: 3,
            retryDelay: 1000,
            batchSize: 5,
            baseFileCount: 100,
            ...options
        };
        // 创建预初始化的 orchestrator 实例
        this.orchestrator = new orchestrator_1.EnrichmentOrchestrator(rootDir, {
            concurrency: this.options.concurrency,
            maxRetries: this.options.maxRetries,
            retryDelay: this.options.retryDelay,
            preInitialize: true, // 启用预初始化
            inputPath: '', // 不再需要文件路径
            outputPath: '' // 不再需要文件路径
        });
        console.log('🔧 FileProcessor 已创建预初始化的 orchestrator 实例');
    }
    /**
     * 基于文件实体映射批量处理富化（只做富化）
     * @param fileEntityMappings 文件实体映射列表
     * @param fullEntities 完整的实体列表（用于富化上下文）
     */
    async processBatchFileEntityMappings(fileEntityMappings, fullEntities) {
        if (fileEntityMappings.length === 0) {
            console.log('📭 没有文件实体映射需要处理');
            return [];
        }
        // 收集所有需要富化的实体
        const entitiesToEnrich = [];
        fileEntityMappings.forEach(mapping => {
            entitiesToEnrich.push(...mapping.entities);
        });
        if (entitiesToEnrich.length === 0) {
            console.log('📭 没有实体需要富化');
            return [];
        }
        console.log(`🚀 批量富化处理: ${fileEntityMappings.length} 个文件映射, ${entitiesToEnrich.length} 个实体, ${fullEntities.length} 个上下文实体`);
        try {
            // 使用预初始化的 orchestrator 直接处理实体数组
            const enrichedEntities = await this.orchestrator.enrichEntitiesDirectly(entitiesToEnrich, fullEntities);
            console.log(`✅ 批量富化完成，处理了 ${enrichedEntities.length} 个实体`);
            return enrichedEntities;
        }
        catch (error) {
            console.error(`❌ 批量富化失败: ${error.message}`);
            throw error;
        }
    }
    /**
     * 清理资源（可选调用）
     */
    dispose() {
        console.log('🧹 FileProcessor 已清理资源');
        // orchestrator 实例会自动被垃圾回收
    }
}
exports.FileProcessor = FileProcessor;
