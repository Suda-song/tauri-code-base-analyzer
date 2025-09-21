#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import { enrichEntities, updateStaticAnalysis } from './index';
import packageJson from '../../package.json';
import { extractReadmeSections } from '../readme-generator/index';

// 检查项目README是否存在（包含结构/架构信息）
async function checkProjectReadme(rootDir: string): Promise<boolean> {
  try {
    const readmeData = await extractReadmeSections({
      workspace: rootDir,
      sections: ['structure', 'architecture']
    });
    const hasContent = Boolean((readmeData.structure && readmeData.structure.trim()) || (readmeData.architecture && readmeData.architecture.trim()));
    return hasContent;
  } catch (error) {
    return false;
  }
}

// 创建命令行程序
const program = new Command();

program
  .name('enrichment-agent')
  .description('使用LLM为代码实体添加元数据，提取导入、调用、事件等信息')
  .version(packageJson.version || '1.0.0');

// 完整的enrichment命令
program
  .command('enrich')
  .description('完整的实体丰富化流程（包含静态分析和LLM标注）')
  .argument('[inputPath]', '输入JSON文件路径', path.join(process.cwd(), 'data/entities.json'))
  .argument('[outputPath]', '输出JSON文件路径', path.join(process.cwd(), 'data/entities.enriched.json'))
  .option('-r, --root <path>', '项目根目录', process.cwd())
  .option('-c, --concurrency <number>', '最大并发数', '5')
  .option('--retries <number>', '失败重试次数', '3')
  .option('--retry-delay <ms>', '重试间隔(毫秒)', '1000')
  .action(async (inputPath, outputPath, options) => {
    try {
      console.log(`
=== Enrichment Agent - 完整流程 ===
输入文件: ${inputPath}
输出文件: ${outputPath}
根目录: ${options.root}
最大并发: ${options.concurrency}
重试次数: ${options.retries}
重试间隔: ${options.retryDelay}ms
===============================
`);

      // 检查README是否存在
      const hasReadme = await checkProjectReadme(options.root);
      if (!hasReadme) {
        console.error(`
❌ 错误：未找到包含结构/架构信息的README文件。

为了生成准确的项目描述(projectDesc)，需要先创建包含项目结构和架构信息的README。

请使用以下命令生成README：
  parser-agent readme ${options.root} --output ${path.join(options.root, 'README.md')} --force

详细请查看文档 https://docs.xiaohongshu.com/doc/c8cac762639b4c3b8421dfd8ef408f7e

或者手动创建README.md并包含以下章节：
  - ## 项目结构
  - ## 架构说明
`);
        process.exit(1);
      }

      const result = await enrichEntities(
        inputPath,
        outputPath,
        options.root,
        {
          concurrency: parseInt(options.concurrency, 10),
          maxRetries: parseInt(options.retries, 10),
          retryDelay: parseInt(options.retryDelay, 10)
        }
      );

      console.log(`处理完成! 输出保存到: ${result}`);
      process.exit(0);
    } catch (error) {
      console.error(`处理失败: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// 静态分析更新命令
program
  .command('update-static')
  .description('只更新静态分析结果，保留原有的summary和tags')
  .argument('[inputPath]', '输入JSON文件路径（基础实体）', path.join(process.cwd(), 'data/entities.json'))
  .argument('[outputPath]', '输出JSON文件路径', path.join(process.cwd(), 'data/entities.enriched.json'))
  .option('-r, --root <path>', '项目根目录', process.cwd())
  .option('-c, --concurrency <number>', '最大并发数', '5')
  .option('--retries <number>', '失败重试次数', '3')
  .option('--retry-delay <ms>', '重试间隔(毫秒)', '1000')
  .option('--enriched-input <path>', '已有enriched文件路径（默认使用outputPath）')
  .action(async (inputPath, outputPath, options) => {
    try {
      console.log(`
=== Enrichment Agent - 静态分析更新 ===
输入文件: ${inputPath}
输出文件: ${outputPath}
Enriched输入: ${options.enrichedInput || outputPath}
根目录: ${options.root}
最大并发: ${options.concurrency}
重试次数: ${options.retries}
重试间隔: ${options.retryDelay}ms
====================================
`);

      const result = await updateStaticAnalysis(
        inputPath,
        outputPath,
        options.root,
        {
          concurrency: parseInt(options.concurrency, 10),
          maxRetries: parseInt(options.retries, 10),
          retryDelay: parseInt(options.retryDelay, 10)
        },
        undefined, // fullEntities
        options.enrichedInput
      );

      console.log(`静态分析更新完成! 输出保存到: ${result}`);
      process.exit(0);
    } catch (error) {
      console.error(`处理失败: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// 保持原有的默认行为（兼容性）
program
  .argument('[inputPath]', '输入JSON文件路径', path.join(process.cwd(), 'data/entities.json'))
  .argument('[outputPath]', '输出JSON文件路径', path.join(process.cwd(), 'data/entities.enriched.json'))
  .option('-r, --root <path>', '项目根目录', process.cwd())
  .option('-c, --concurrency <number>', '最大并发数', '5')
  .option('--retries <number>', '失败重试次数', '3')
  .option('--retry-delay <ms>', '重试间隔(毫秒)', '1000')
  .action(async (inputPath, outputPath, options) => {
    try {
      console.log(`
=== Enrichment Agent (默认完整流程) ===
输入文件: ${inputPath}
输出文件: ${outputPath}
根目录: ${options.root}
最大并发: ${options.concurrency}
重试次数: ${options.retries}
重试间隔: ${options.retryDelay}ms
=====================================
`);

      // 检查README是否存在
      const hasReadme = await checkProjectReadme(options.root);
      if (!hasReadme) {
        console.error(`
❌ 错误：未找到包含结构/架构信息的README文件。

为了生成准确的项目描述(projectDesc)，需要先创建包含项目结构和架构信息的README。

请使用以下命令生成README：
  parser-agent readme ${options.root} --output ${path.join(options.root, 'README.md')} --force

详细请查看文档 https://docs.xiaohongshu.com/doc/c8cac762639b4c3b8421dfd8ef408f7e

或者手动创建README.md并包含以下章节：
  - ## 项目结构
  - ## 架构说明
`);
        process.exit(1);
      }

      const result = await enrichEntities(
        inputPath,
        outputPath,
        options.root,
        {
          concurrency: parseInt(options.concurrency, 10),
          maxRetries: parseInt(options.retries, 10),
          retryDelay: parseInt(options.retryDelay, 10)
        }
      );

      console.log(`处理完成! 输出保存到: ${result}`);
      process.exit(0);
    } catch (error) {
      console.error(`处理失败: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse(); 