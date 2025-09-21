"use strict";
/**
 * Enrichment Agent 入口模块
 * 导出所有子模块和主要功能
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichEntities = enrichEntities;
exports.updateStaticAnalysis = updateStaticAnalysis;
exports.runCli = runCli;
const orchestrator_1 = require("./orchestrator");
// 重新导出接口
__exportStar(require("./interfaces"), exports);
__exportStar(require("./config"), exports);
__exportStar(require("./loader"), exports);
__exportStar(require("./staticAnalyzer"), exports);
__exportStar(require("./llmLabeler"), exports);
__exportStar(require("./persistence"), exports);
__exportStar(require("./orchestrator"), exports);
/**
 * 便捷函数：处理指定实体文件
 * @param inputPath 输入文件路径
 * @param outputPath 输出文件路径
 * @param rootDir 项目根目录
 * @param config 自定义配置
 * @param fullEntities 完整的实体列表（可选）
 */
async function enrichEntities(inputPath, outputPath, rootDir = process.cwd(), config, fullEntities) {
    const orchestrator = new orchestrator_1.EnrichmentOrchestrator(rootDir, {
        ...config,
        inputPath,
        outputPath
    }, fullEntities);
    return orchestrator.run();
}
/**
 * 便捷函数：只更新静态分析结果，保留原有的summary和tags
 * @param inputPath 输入文件路径（基础实体）
 * @param outputPath 输出文件路径
 * @param rootDir 项目根目录
 * @param config 自定义配置
 * @param fullEntities 完整的实体列表（可选）
 * @param enrichedInputPath 已有enriched文件路径（可选，默认使用outputPath）
 */
async function updateStaticAnalysis(inputPath, outputPath, rootDir = process.cwd(), config, fullEntities, enrichedInputPath) {
    const orchestrator = new orchestrator_1.EnrichmentOrchestrator(rootDir, {
        ...config,
        inputPath,
        outputPath
    }, fullEntities);
    return orchestrator.runStaticAnalysisUpdate(inputPath, outputPath, enrichedInputPath);
}
/**
 * 命令行入口
 */
async function runCli(args) {
    const inputPath = args[0] || 'entities.json';
    const outputPath = args[1] || 'entities.enriched.json';
    const rootDir = args[2] || process.cwd();
    console.log(`
=== Enrichment Agent ===
输入文件: ${inputPath}
输出文件: ${outputPath}
根目录: ${rootDir}
======================
`);
    try {
        const resultPath = await enrichEntities(inputPath, outputPath, rootDir);
        console.log(`处理完成! 输出保存到: ${resultPath}`);
    }
    catch (error) {
        console.error(`处理失败: ${error.message}`);
        process.exit(1);
    }
}
// 如果直接运行脚本，启动命令行处理
if (require.main === module) {
    runCli(process.argv.slice(2));
}
