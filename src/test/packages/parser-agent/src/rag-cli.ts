#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { searchCodeEntities, getRelatedCodeEntities } from './rag-inline-tool';
import packageJson from '../package.json';

// 创建命令行程序
const program = new Command();

program
  .name('rag-agent')
  .description('代码检索增强工具 - 根据自然语言查询检索相关代码组件和关系')
  .version(packageJson.version || '1.0.0');

/**
 * 确保输出目录存在
 * @param outputPath 输出文件路径
 */
function ensureOutputDirectory(outputPath: string): void {
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

/**
 * 格式化并显示搜索结果摘要
 * @param result 搜索结果
 */
function displaySearchSummary(result: any): void {
  console.log(`找到 ${result.entities.length} 个相关组件`);
  console.log('相关性排序:');

  // 按相关度排序实体
  const sortedEntities = [...result.entities].sort((a, b) =>
    (result.relevanceScores[b.id] || 0) - (result.relevanceScores[a.id] || 0)
  );

  // 显示每个实体的基本信息
  sortedEntities.forEach(entity => {
    const score = (result.relevanceScores[entity.id] || 0).toFixed(1);
    console.log(`- ${entity.id}: ${entity.summary} (相关度: ${score})`);
  });
}

/**
 * 格式化并显示关系分析结果摘要
 * @param result 关系分析结果
 */
function displayRelationshipSummary(result: any): void {
  const { imports, calls, templates, similar } = result.relatedEntities;
  const allRelated = [...imports, ...calls, ...templates, ...similar];

  console.log(`源组件: ${result.sourceEntity.id} (${result.sourceEntity.summary})`);
  console.log('相关组件汇总:');
  console.log(`- 导入关系: ${imports.length} 个组件`);
  console.log(`- 调用关系: ${calls.length} 个组件`);
  console.log(`- 模板组件: ${templates.length} 个组件`);
  console.log(`- 相似标签: ${similar.length} 个组件`);
  console.log(`总计: ${allRelated.length} 个相关组件`);

  // 显示相关组件示例（最多5个）
  if (allRelated.length > 0) {
    console.log('\n相关组件示例:');
    for (let i = 0; i < Math.min(5, allRelated.length); i++) {
      const entity = allRelated[i];
      const relations = result.relatedEntities.relationships[entity.id] || [];
      console.log(`- ${entity.id} (${relations.join(', ')}): ${entity.summary}`);
    }
  }
}

// 搜索命令
program
  .command('search')
  .description('根据自然语言查询检索相关代码组件')
  .argument('<query>', '自然语言查询')
  .requiredOption('-e, --entities <path>', '实体JSON文件路径', path.join(process.cwd(), 'data/entities.enriched.json'))
  .option('-r, --root <path>', '项目根目录', process.cwd())
  .option('-o, --output <path>', '输出提示词的文件路径', path.join(process.cwd(), 'search/prompt.txt'))
  .option('-k, --top <number>', '返回的组件数量', '5')
  .action(async (query, options) => {
    try {
      // 显示执行参数
      console.log(`
=== RAG 搜索工具 ===
查询: ${query}
实体文件: ${options.entities}
根目录: ${options.root}
返回数量: ${options.top}
输出文件: ${options.output || '(不保存)'}
===================
`);

      // 执行搜索
      const result = await searchCodeEntities(
        query,
        options.entities,
        options.root,
        parseInt(options.top, 10)
      );

      // 显示搜索结果摘要
      displaySearchSummary(result);

      // 保存提示词到文件
      if (options.output) {
        ensureOutputDirectory(options.output);
        fs.writeFileSync(options.output, result.prompt, 'utf8');
        console.log(`提示词已保存到: ${options.output}`);
      }

      process.exit(0);
    } catch (error) {
      console.error(`搜索失败: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// 二跳关系查询命令
program
  .command('related')
  .description('获取与指定实体相关的组件（图的二跳查询）')
  .argument('<entityId>', '实体ID')
  .requiredOption('-e, --entities <path>', '实体JSON文件路径', path.join(process.cwd(), 'data/entities.enriched.json'))
  .option('-r, --root <path>', '项目根目录', process.cwd())
  .option('-o, --output <path>', '输出提示词的文件路径', path.join(process.cwd(), 'related/prompt.txt'))
  .option('-m, --max <number>', '每种关系类型返回的最大相关实体数', '3')
  .action(async (entityId, options) => {
    try {
      // 显示执行参数
      console.log(`
=== RAG 二跳查询工具 ===
实体ID: ${entityId}
实体文件: ${options.entities}
根目录: ${options.root}
最大相关数: ${options.max}
输出文件: ${options.output || '(不保存)'}
=====================
`);

      // 执行关系查询
      const result = await getRelatedCodeEntities(
        entityId,
        options.entities,
        options.root,
        parseInt(options.max, 10)
      );

      if (!result) {
        console.error(`未找到ID为 ${entityId} 的实体`);
        process.exit(1);
      }

      // 显示关系分析结果摘要
      displayRelationshipSummary(result);

      // 保存提示词到文件
      if (options.output) {
        ensureOutputDirectory(options.output);
        fs.writeFileSync(options.output, result.prompt, 'utf8');
        console.log(`提示词已保存到: ${options.output}`);
      }

      process.exit(0);
    } catch (error) {
      console.error(`查询失败: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// 搜索+二跳组合命令
program
  .command('search-related')
  .description('先搜索相关组件，然后对每个组件执行二跳查询')
  .argument('<query>', '自然语言查询')
  .requiredOption('-e, --entities <path>', '实体JSON文件路径', path.join(process.cwd(), 'data/entities.enriched.json'))
  .option('-r, --root <path>', '项目根目录', process.cwd())
  .option('-o, --output <path>', '输出提示词的文件路径', path.join(process.cwd(), 'search-related/prompt.txt'))
  .option('-k, --top <number>', '返回的组件数量', '5')
  .option('-m, --max <number>', '每种关系类型返回的最大相关实体数', '3')
  .action(async (query, options) => {
    try {
      // 显示执行参数
      console.log(`
=== RAG 搜索+二跳查询工具 ===
查询: ${query}
实体文件: ${options.entities}
根目录: ${options.root}
返回数量: ${options.top}
最大相关数: ${options.max}
输出文件: ${options.output || '(不保存)'}
===========================
`);

      // 第一步：执行搜索
      console.log('步骤1: 执行搜索...');
      const searchResult = await searchCodeEntities(
        query,
        options.entities,
        options.root,
        parseInt(options.top, 10)
      );

      // 显示搜索结果摘要
      displaySearchSummary(searchResult);

      // 按相关度排序搜索结果
      const sortedEntities = [...searchResult.entities].sort((a, b) =>
        (searchResult.relevanceScores[b.id] || 0) - (searchResult.relevanceScores[a.id] || 0)
      );

      // 第二步：对每个搜索结果执行二跳查询
      console.log('\n步骤2: 执行关系分析...');
      const allResults = [];

      for (const entity of sortedEntities) {
        console.log(`正在查询 ${entity.id} 的相关组件...`);

        const relatedResult = await getRelatedCodeEntities(
          entity.id,
          options.entities,
          options.root,
          parseInt(options.max, 10)
        );

        if (relatedResult) {
          allResults.push({
            searchEntity: entity,
            relevanceScore: searchResult.relevanceScores[entity.id] || 0,
            relatedEntities: relatedResult
          });
        }
      }

      // 第三步：生成组合提示词
      console.log('\n步骤3: 生成综合分析结果...');
      let combinedPrompt = `# 搜索结果\n\n`;
      combinedPrompt += searchResult.prompt;

      combinedPrompt += `\n\n# 二跳查询结果\n\n`;
      for (const result of allResults) {
        const { searchEntity, relevanceScore, relatedEntities } = result;
        combinedPrompt += `## 源组件: ${searchEntity.id} (相关度: ${relevanceScore})\n`;
        combinedPrompt += relatedEntities.prompt;
        combinedPrompt += '\n---\n\n';
      }

      // 显示综合统计
      const totalRelatedCount = allResults.reduce((sum, result) => {
        const { imports, calls, templates, similar } = result.relatedEntities.relatedEntities;
        return sum + imports.length + calls.length + templates.length + similar.length;
      }, 0);

      console.log(`\n=== 综合分析完成 ===`);
      console.log(`核心组件: ${searchResult.entities.length} 个`);
      console.log(`相关组件: ${totalRelatedCount} 个`);
      console.log(`分析维度: 导入关系、调用关系、模板关系、相似标签`);

      // 第四步：保存结果
      if (options.output) {
        ensureOutputDirectory(options.output);
        fs.writeFileSync(options.output, combinedPrompt, 'utf8');
        console.log(`综合分析结果已保存到: ${options.output}`);
      }

      process.exit(0);
    } catch (error) {
      console.error(`查询失败: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse();
