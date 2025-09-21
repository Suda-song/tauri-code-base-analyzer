/**
 * cli/index.ts
 * MR统计功能的命令行入口
 */

import { Command } from 'commander';
import { MRStatisticsService } from '../services/mr-statistics-service';
import { saveMRStats, getMRStats, getMRStatsList, MRManager } from '../db/mr-manager';
import { MRStatisticsResult } from '../models/interfaces';
import { initHttpClient } from '../services/http-client';
import { readFileSync } from 'fs';
import { join } from 'path';

// 创建命令行程序
const program = new Command();

// 读取版本号
function getVersion(): string {
  try {
    const packagePath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    return '1.0.0';
  }
}

// 设置版本号和描述
program
  .version(getVersion())
  .description('MR统计工具 - 计算MR阶段的代码采纳率统计数据');

/**
 * 格式化输出MR统计结果
 * @param result MR统计结果
 * @param verbose 是否输出详细信息
 */
function formatMRStatsResult(result: MRStatisticsResult, verbose: boolean = false): void {
  console.log('\n📊 MR统计结果:');
  console.log('----------------------------------------');
  console.log(`🆔 ID: ${result.id}`);
  if (result.appName) {
    console.log(`📱 应用: ${result.appName}`);
  }
  console.log(`🌿 分支: ${result.sourceBranch} -> ${result.targetBranch}`);
  console.log(`📅 创建时间: ${result.createdAt.toLocaleString()}`);
  if (result.mergedAt) {
    console.log(`🔄 合并时间: ${result.mergedAt.toLocaleString()}`);
  }
  console.log('----------------------------------------');
  console.log(`📄 文件级统计:`);
  console.log(`  总文件数: ${result.totalMRFiles}`);
  console.log(`  包含AI代码的文件数: ${result.includeAiCodeFiles}`);
  console.log(`  文件级采纳率: ${result.mrFileAcceptanceRate}%`);
  console.log('----------------------------------------');
  console.log(`💻 代码行级统计:`);
  console.log(`  总代码行数: ${result.totalMRCodeLines}`);
  console.log(`  包含AI代码的行数: ${result.includeAiCodeLines}`);
  console.log(`  代码行级采纳率: ${result.mrCodeAcceptanceRate}%`);
  
  if (verbose) {
    console.log('----------------------------------------');
    console.log(`📝 相关提交 (${result.relatedCommits.length}):`);
    result.relatedCommits.forEach((commit, index) => {
      console.log(`  ${index + 1}. ${commit.hash.substring(0, 7)} - ${commit.summary}`);
    });
  }
  
  console.log('----------------------------------------');
}

/**
 * 计算MR统计命令
 */
program
  .command('calculate')
  .description('计算当前分支的MR统计数据')
  .option('-s, --source <branch>', '源分支名称')
  .option('-t, --target <branch>', '目标分支名称，默认为master')
  .option('-a, --app-name <name>', '应用名称')
  .option('-v, --verbose', '输出详细信息')
  .option('--threshold-file <value>', '文件匹配阈值 (0-1)', parseFloat)
  .option('--threshold-code <value>', '代码匹配阈值 (0-1)', parseFloat)
  .option('--pod', '容器环境模式，使用远程分支引用')
  .action(async (options) => {
    try {
      console.log('🚀 开始计算MR统计数据...');
      
      // 如果是Pod模式，初始化HTTP客户端
      if (options.pod) {
        const baseURL = process.env.AURORAFLOW_API_URL || 'http://localhost:3000';
        initHttpClient({ baseURL });
        MRManager.setHttpMode(true);
        console.log(`🌐 Pod模式已启用，使用HTTP API: ${baseURL}`);
      }
      
      // 创建服务实例
      const service = new MRStatisticsService({
        sourceBranch: options.source,
        targetBranch: options.target || 'master',
        appName: options.appName,
        verbose: options.verbose,
        isPodMode: options.pod,
        thresholds: {
          fileMatch: options.thresholdFile || 0.7,
          codeMatch: options.thresholdCode || 0.6
        }
      });
      
      // 计算统计数据
      const result = await service.calculateMRStatistics();
      
      // 保存到数据库/HTTP
      const id = await saveMRStats(result);
      console.log(`✅ MR统计数据已保存，ID: ${id}`);
      
      // 格式化输出结果
      formatMRStatsResult(result, options.verbose);
      
      // 只在非Pod模式下关闭数据库连接
      if (!options.pod) {
        const { MRStatsDB } = await import('../db/mr-stats-db');
        await MRStatsDB.close();
      }
    } catch (error) {
      console.error('❌ 计算MR统计数据失败:', error);
      process.exit(1);
    }
  });

/**
 * 显示MR统计命令
 */
program
  .command('show')
  .description('显示MR统计数据')
  .option('-i, --id <id>', 'MR统计记录ID')
  .option('-s, --source <branch>', '源分支名称')
  .option('-t, --target <branch>', '目标分支名称，默认为master')
  .option('-v, --verbose', '输出详细信息')
  .option('--pod', '容器环境模式，使用远程分支引用')
  .action(async (options) => {
    try {
      // 如果是Pod模式，初始化HTTP客户端
      if (options.pod) {
        const baseURL = process.env.AURORAFLOW_API_URL || 'http://localhost:3000';
        initHttpClient({ baseURL });
        MRManager.setHttpMode(true);
      }
      
      let result: MRStatisticsResult | null = null;
      
      if (options.id) {
        // 通过ID查询
        result = await getMRStats(options.id);
      } else if (options.source) {
        // 通过分支查询
        const { getLatestMRStatsByBranch } = await import('../db/mr-manager');
        result = await getLatestMRStatsByBranch(options.source, options.target || 'master');
      } else {
        console.error('❌ 请提供MR统计记录ID或源分支名称');
        process.exit(1);
      }
      
      if (!result) {
        console.error('❌ 未找到匹配的MR统计记录');
        process.exit(1);
      }
      
      // 格式化输出结果
      formatMRStatsResult(result, options.verbose);
    } catch (error) {
      console.error('❌ 显示MR统计数据失败:', error);
      process.exit(1);
    }
  });

/**
 * 列出MR统计记录命令
 */
program
  .command('list')
  .description('列出MR统计记录')
  .option('-s, --source <branch>', '过滤源分支')
  .option('-t, --target <branch>', '过滤目标分支')
  .option('-l, --limit <number>', '限制记录数量', parseInt, 10)
  .option('-o, --offset <number>', '记录偏移量', parseInt, 0)
  .action(async (options) => {
    try {
      console.log('📋 获取MR统计记录列表...');
      
      // 查询记录列表
      const results = await getMRStatsList({
        sourceBranch: options.source,
        targetBranch: options.target,
        limit: options.limit,
        offset: options.offset
      });
      
      if (results.length === 0) {
        console.log('⚠️ 未找到匹配的MR统计记录');
        return;
      }
      
      console.log(`\n📊 找到 ${results.length} 条MR统计记录:`);
      console.log('----------------------------------------');
      
      // 输出列表
      results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.id}`);
        if (result.appName) {
          console.log(`   应用: ${result.appName}`);
        }
        console.log(`   分支: ${result.sourceBranch} -> ${result.targetBranch}`);
        console.log(`   创建时间: ${result.createdAt.toLocaleString()}`);
        console.log(`   文件采纳率: ${result.mrFileAcceptanceRate}% | 代码采纳率: ${result.mrCodeAcceptanceRate}%`);
        console.log('----------------------------------------');
      });
    } catch (error) {
      console.error('❌ 列出MR统计记录失败:', error);
      process.exit(1);
    }
  });

// 解析命令行参数
export function run(args: string[] = process.argv): void {
  program.parse(args);
  
  // 如果没有提供命令，显示帮助信息
  if (process.argv.length <= 2) {
    program.help();
  }
}

// 如果直接运行此文件
if (require.main === module) {
  run();
}

export default { run };