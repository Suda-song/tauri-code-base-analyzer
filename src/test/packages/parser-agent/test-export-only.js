const fs = require('fs');
const path = require('path');
const { FunctionExtractor } = require('./dist/extractors/FunctionExtractor');

console.log('🧪 测试实体提取器是否只提取导出实体');

// 测试文件路径
const testFile = '../../apps/after-sale-demo/src/router/index.ts';
const rootDir = '../../apps/after-sale-demo';

console.log(`📄 测试文件: ${testFile}`);
console.log(`📁 根目录: ${rootDir}`);

try {
  // 检查文件是否存在
  if (!fs.existsSync(testFile)) {
    console.error(`❌ 文件不存在: ${testFile}`);
    process.exit(1);
  }
  
  // 读取文件内容
  const content = fs.readFileSync(testFile, 'utf-8');
  console.log('\n📖 文件内容:');
  console.log('─'.repeat(50));
  console.log(content);
  console.log('─'.repeat(50));
  
  // 使用FunctionExtractor提取实体
  console.log('\n🔍 提取实体...');
  const entities = FunctionExtractor.extract(testFile, rootDir);
  
  console.log(`\n✅ 提取的实体数量: ${entities.length}`);
  console.log('\n📋 实体详情:');
  entities.forEach((entity, index) => {
    console.log(`${index + 1}. ID: ${entity.id}`);
    console.log(`   类型: ${entity.type}`);
    console.log(`   原始名称: ${entity.rawName}`);
    console.log(`   位置: ${entity.loc.start}${entity.loc.end ? `-${entity.loc.end}` : ''}`);
    console.log('');
  });
  
  // 分析结果
  const hasPrivateVarA = entities.some(e => e.rawName === 'a');
  const hasExportedRouter = entities.some(e => e.rawName === 'router');
  const hasPrivateRoutes = entities.some(e => e.rawName === 'routes');
  
  console.log('\n🔍 验证结果:');
  console.log(`包含私有变量 'a' (不应该): ${hasPrivateVarA ? '❌' : '✅'}`);
  console.log(`包含私有变量 'routes' (不应该): ${hasPrivateRoutes ? '❌' : '✅'}`);
  console.log(`包含导出变量 'router' (应该): ${hasExportedRouter ? '✅' : '❌'}`);
  
  const isFixed = !hasPrivateVarA && !hasPrivateRoutes && hasExportedRouter;
  console.log(`\n🎯 修复成功: ${isFixed ? '✅' : '❌'}`);
  
  if (isFixed) {
    console.log('\n🎉 恭喜！现在只提取导出的实体了');
    console.log('- 私有变量 a 不再被提取');
    console.log('- 私有变量 routes 不再被提取');
    console.log('- 导出变量 router 正确提取');
  } else {
    console.log('\n⚠️ 仍然存在问题:');
    if (hasPrivateVarA) console.log('  - 私有变量 a 仍被提取');
    if (hasPrivateRoutes) console.log('  - 私有变量 routes 仍被提取');
    if (!hasExportedRouter) console.log('  - 导出变量 router 未被提取');
    
    console.log('\n🔍 所有提取的实体:');
    entities.forEach(e => {
      const isExported = e.rawName === 'router' ? '(导出)' : '(私有)';
      console.log(`  - ${e.rawName} ${isExported}`);
    });
    
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ 测试失败:', error);
  process.exit(1);
} 