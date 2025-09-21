#!/usr/bin/env node

/**
 * @file 自动注释测试脚本
 * @description 自动运行实体解析和注释丰富流程的测试脚本
 */

import path from 'path';
import fs from 'fs';
import { extractAllEntities } from './fileWalker';
import { EnrichmentOrchestrator } from './enrichment/orchestrator';

async function runAutoAnnotationTest() {
  // 1. 设置路径
  const projectRoot = path.resolve(__dirname, '../../../');
  const targetDir = path.join(projectRoot, 'apps/after-sale-demo');
  const outputDir = path.join(projectRoot, 'packages/parser-agent/data');
  const entitiesJsonPath = path.join(outputDir, 'entities.json');
  const enrichedEntitiesJsonPath = path.join(outputDir, 'entities.enriched.json');

  console.log('===== 自动注释测试流程 =====');
  console.log(`目标目录: ${targetDir}`);
  console.log(`输出目录: ${outputDir}`);

  // 2. 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    console.log(`创建输出目录: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // 3. 提取实体
    console.log('\n[步骤1] 开始提取代码实体...');
    const startExtractTime = Date.now();
    const entities = (await extractAllEntities(targetDir) || []).filter((entity: any, idx: number) => idx < 3);
    const extractDuration = (Date.now() - startExtractTime) / 1000;
    
    console.log(`✅ 提取完成，共提取了 ${entities.length} 个实体, 耗时 ${extractDuration.toFixed(2)}s`);

    // 统计实体类型
    const typeCount = entities.reduce<Record<string, number>>((acc, entity) => {
      acc[entity.type] = (acc[entity.type] || 0) + 1;
      return acc;
    }, {});
    
    console.log('实体类型统计:');
    Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  - ${type}: ${count} 个`);
      });

    // 4. 保存实体到JSON文件
    fs.writeFileSync(entitiesJsonPath, JSON.stringify(entities, null, 2));
    console.log(`✅ 实体已保存到: ${entitiesJsonPath}`);

    // 5. 运行丰富化流程
    console.log('\n[步骤2] 开始丰富化流程...');
    const startEnrichTime = Date.now();
    
    const orchestrator = new EnrichmentOrchestrator(targetDir, {
      concurrency: 5, 
      maxRetries: 3,
      retryDelay: 1000,
      inputPath: entitiesJsonPath,
      outputPath: enrichedEntitiesJsonPath
    });

    // 运行丰富化流程
    const resultPath = await orchestrator.run();
    const enrichDuration = (Date.now() - startEnrichTime) / 1000;
    
    console.log(`✅ 丰富化完成, 结果保存到: ${resultPath}, 耗时 ${enrichDuration.toFixed(2)}s`);

    // 6. 验证结果
    if (fs.existsSync(resultPath)) {
      const enrichedEntities = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
      console.log(`\n[步骤3] 验证结果: ${enrichedEntities.length} 个实体已丰富化`);
      
      // 验证注释和MD5生成
      const annotationCount = enrichedEntities.filter((e: any) => e.ANNOTATION?.length > 0).length;
      const codeMd5Count = enrichedEntities.filter((e: any) => e.codeMd5?.length > 0).length;
      const annotationMd5Count = enrichedEntities.filter((e: any) => e.annotationMd5?.length > 0).length;

      console.log(`✅ 注释生成情况: ${annotationCount}/${enrichedEntities.length} (${(annotationCount/enrichedEntities.length*100).toFixed(2)}%)`);
      console.log(`✅ codeMd5生成情况: ${codeMd5Count}/${enrichedEntities.length} (${(codeMd5Count/enrichedEntities.length*100).toFixed(2)}%)`);
      console.log(`✅ annotationMd5生成情况: ${annotationMd5Count}/${enrichedEntities.length} (${(annotationMd5Count/enrichedEntities.length*100).toFixed(2)}%)`);
      
      // 输出前5个实体的摘要和标签示例
      console.log('\n摘要和标签示例:');
      enrichedEntities.slice(0, 5).forEach((entity: any) => {
        console.log(`\n[${entity.type}] ${entity.id}`);
        console.log(`  摘要: ${entity.summary || '(无)'}`);
        console.log(`  标签: ${entity.tags?.join(', ') || '(无)'}`);
        console.log(`  注释: ${entity.ANNOTATION ? (entity.ANNOTATION.length > 50 ? entity.ANNOTATION.substring(0, 50) + '...' : entity.ANNOTATION) : '(无)'}`);
      });

      // 总结
      const totalDuration = (enrichDuration + extractDuration).toFixed(2);
      console.log('\n===== 测试流程完成 =====');
      console.log(`总耗时: ${totalDuration}s`);
      console.log(`实体总数: ${entities.length}`);
      console.log(`丰富化实体: ${enrichedEntities.length}`);
      console.log(`注释覆盖率: ${(annotationCount/enrichedEntities.length*100).toFixed(2)}%`);
    } else {
      console.error(`❌ 丰富化结果文件未找到: ${resultPath}`);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', (error as Error).message);
    console.error((error as Error).stack);
  }
}

// 运行测试
runAutoAnnotationTest().catch(err => {
  console.error('❌ 运行时错误:', err);
  process.exit(1);
});