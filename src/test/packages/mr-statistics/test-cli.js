#!/usr/bin/env node

/**
 * 测试CLI的简单脚本
 */

const { mockMrResult } = require('./mock-data');

// 模拟命令行参数
const command = process.argv[2] || 'help';

function printHelp() {
  console.log('\n🔍 MR统计测试工具');
  console.log('----------------------------------------');
  console.log('可用命令:');
  console.log('  calculate  - 模拟计算MR统计数据');
  console.log('  show       - 展示模拟的统计结果');
  console.log('  list       - 列出模拟的统计记录');
  console.log('  help       - 显示帮助信息');
  console.log('----------------------------------------');
}

function formatMRStatsResult(result, verbose = false) {
  console.log('\n📊 MR统计结果:');
  console.log('----------------------------------------');
  console.log(`🆔 ID: ${result.mrId}`);
  console.log(`🌿 分支: ${result.sourceBranch} -> ${result.targetBranch}`);
  console.log(`📅 创建时间: ${result.createdAt.toLocaleString()}`);
  console.log(`🔄 合并时间: ${result.mergedAt.toLocaleString()}`);
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

// 处理命令
switch (command) {
  case 'calculate':
    console.log('🚀 开始计算MR统计数据...');
    setTimeout(() => {
      console.log('✅ MR统计数据已保存到数据库，ID: mr_test_123456');
      formatMRStatsResult(mockMrResult, true);
    }, 1000);
    break;
    
  case 'show':
    formatMRStatsResult(mockMrResult, true);
    break;
    
  case 'list':
    console.log('📋 获取MR统计记录列表...');
    console.log('\n📊 找到 3 条MR统计记录:');
    console.log('----------------------------------------');
    console.log(`1. ${mockMrResult.mrId}`);
    console.log(`   分支: ${mockMrResult.sourceBranch} -> ${mockMrResult.targetBranch}`);
    console.log(`   创建时间: ${mockMrResult.createdAt.toLocaleString()}`);
    console.log(`   文件采纳率: ${mockMrResult.mrFileAcceptanceRate}% | 代码采纳率: ${mockMrResult.mrCodeAcceptanceRate}%`);
    console.log('----------------------------------------');
    console.log(`2. mr_test_654321`);
    console.log(`   分支: feature/another-branch -> master`);
    console.log(`   创建时间: ${new Date().toLocaleString()}`);
    console.log(`   文件采纳率: 85% | 代码采纳率: 72%`);
    console.log('----------------------------------------');
    console.log(`3. mr_test_987654`);
    console.log(`   分支: feature/third-branch -> develop`);
    console.log(`   创建时间: ${new Date().toLocaleString()}`);
    console.log(`   文件采纳率: 92% | 代码采纳率: 88%`);
    console.log('----------------------------------------');
    break;
    
  case 'help':
  default:
    printHelp();
    break;
}