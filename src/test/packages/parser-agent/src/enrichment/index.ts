/**
 * Enrichment Agent 入口模块
 * 导出所有子模块和主要功能
 */

import path from 'path';
import { EnrichmentConfig } from './interfaces';
import { EnrichmentOrchestrator } from './orchestrator';
import { BaseEntity } from './interfaces';

// 重新导出接口
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
export async function enrichEntities(
  inputPath: string,
  outputPath: string,
  rootDir: string = process.cwd(),
  config?: Partial<EnrichmentConfig>,
  fullEntities?: BaseEntity[]
): Promise<string> {
  const orchestrator = new EnrichmentOrchestrator(rootDir, {
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
export async function updateStaticAnalysis(
  inputPath: string,
  outputPath: string,
  rootDir: string = process.cwd(),
  config?: Partial<EnrichmentConfig>,
  fullEntities?: BaseEntity[],
  enrichedInputPath?: string
): Promise<string> {
  const orchestrator = new EnrichmentOrchestrator(rootDir, {
    ...config,
    inputPath,
    outputPath
  }, fullEntities);
  
  return orchestrator.runStaticAnalysisUpdate(inputPath, outputPath, enrichedInputPath);
}

/**
 * 命令行入口
 */
export async function runCli(args: string[]): Promise<void> {
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
  } catch (error) {
    console.error(`处理失败: ${(error as Error).message}`);
    process.exit(1);
  }
}

// 如果直接运行脚本，启动命令行处理
if (require.main === module) {
  runCli(process.argv.slice(2));
} 