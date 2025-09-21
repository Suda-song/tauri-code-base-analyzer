#!/usr/bin/env node

const { CommitGenerator } = require('./dist/commit-generator/index');
const path = require('path');

async function testCommitGenerator() {
  console.log('🧪 开始测试 CommitGenerator...');
  
  // 测试项目路径
  const projectPath = path.join(__dirname, '../../apps/after-sale-demo');
  
  try {
    // 创建CommitGenerator实例
    const generator = new CommitGenerator(projectPath);
    
    console.log('\n📋 测试1: 验证提交条件');
    const validation = await generator.validateCommitConditions();
    console.log('验证结果:', validation);
    
    if (validation.isValid) {
      console.log('\n🚀 测试2: 生成提交消息');
      
      // 模拟目标上下文
      const targetInput = {
        prdContent: '优化售后服务系统的用户体验',
        pingcodeTask: '修复售后申请表单的验证逻辑',
        technicalSolution: '更新表单验证规则，改进错误提示信息'
      };
      
      // 生成提交消息
      const result = await generator.generateCommit(targetInput, {
        language: 'zh',
        maxCandidates: 3,
        includeBody: true
      });
      
      console.log('\n📊 生成结果:');
      console.log('- 候选消息数量:', result.candidates.length);
      console.log('- 最终提交消息:', result.finalCommitMessage);
      
      if (result.analysisContext) {
        console.log('\n📈 分析上下文:');
        console.log('- 实体数量:', result.analysisContext.businessContext.entities.length);
        console.log('- 业务领域:', result.analysisContext.businessContext.businessDomain);
        console.log('- 变更文件:', result.analysisContext.changeContext.changedFiles.length);
        
        // 显示找到的实体
        if (result.analysisContext.businessContext.entities.length > 0) {
          console.log('\n🔍 找到的相关实体:');
          result.analysisContext.businessContext.entities.forEach((entity, index) => {
            console.log(`  ${index + 1}. [${entity.type}] ${entity.rawName} - ${entity.file}`);
            console.log(`     摘要: ${entity.summary?.substring(0, 50)}...`);
          });
        }
      }
      
      // 显示所有候选消息
      console.log('\n📝 所有候选消息:');
      result.candidates.forEach((candidate, index) => {
        console.log(`\n候选 ${index + 1} (置信度: ${candidate.confidence}%):`);
        console.log(candidate.fullMessage);
      });
      
    } else {
      console.log('\n❌ 提交条件验证失败');
      console.log('问题:', validation.issues);
      console.log('建议:', validation.suggestions);
    }
    
    console.log('\n📊 测试3: 性能统计');
    const stats = await generator.getProjectStats();
    console.log('项目统计:', stats);
    
    // 清理资源
    await generator.close();
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    if (error.stack) {
      console.error('错误堆栈:', error.stack);
    }
  }
  
  console.log('\n✅ 测试完成');
}

// 运行测试
testCommitGenerator().catch(console.error);
