const fs = require('fs');
const path = require('path');
const { TSXExtractor } = require('./dist/extractors/TSXExtractor');

console.log('🧪 测试 after-sale-demo 项目中的 AftersaleDax.tsx');

// 测试文件路径
const testFile = '../../apps/after-sale-demo/src/components/AftersaleDax.tsx';
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
  
  // 使用TSXExtractor提取实体
  console.log('\n🔍 提取实体...');
  const entities = TSXExtractor.extract(testFile, rootDir);
  
  console.log(`\n✅ 提取的实体数量: ${entities.length}`);
  console.log('\n📋 实体详情:');
  entities.forEach((entity, index) => {
    console.log(`${index + 1}. ID: ${entity.id}`);
    console.log(`   类型: ${entity.type}`);
    console.log(`   原始名称: ${entity.rawName}`);
    console.log(`   位置: ${entity.loc.start}${entity.loc.end ? `-${entity.loc.end}` : ''}`);
    console.log('');
  });
  
  // 验证期望结果
  const expectedCount = 1;
  const hasCorrectCount = entities.length === expectedCount;
  
  // 检查是否有正确的默认导出实体
  const hasDefaultExport = entities.some(e => e.rawName === 'default');
  const hasCorrectComponentId = entities.some(e => e.id.startsWith('Component:') && e.id.includes('AftersaleDax'));
  
  console.log('\n🔍 验证结果:');
  console.log(`实体数量正确 (应为1): ${hasCorrectCount ? '✅' : '❌'}`);
  console.log(`包含默认导出: ${hasDefaultExport ? '✅' : '❌'}`);
  console.log(`包含正确的组件ID: ${hasCorrectComponentId ? '✅' : '❌'}`);
  
  const isFixed = hasCorrectCount && hasDefaultExport && hasCorrectComponentId;
  console.log(`\n🎯 修复成功: ${isFixed ? '✅' : '❌'}`);
  
  if (isFixed) {
    console.log('\n🎉 恭喜！重复实体提取问题已修复');
    console.log('- 只提取了一个实体');
    console.log('- 正确标记为默认导出');
    console.log('- ID格式正确');
  } else {
    console.log('\n⚠️ 问题仍然存在，需要进一步调试');
    
    // 如果有多个实体，分析重复的原因
    if (entities.length > 1) {
      console.log('\n🔍 多个实体分析:');
      const grouped = entities.reduce((acc, entity) => {
        const key = `${entity.type}-${entity.rawName}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(entity);
        return acc;
      }, {});
      
      Object.entries(grouped).forEach(([key, ents]) => {
        if (ents.length > 1) {
          console.log(`❌ 重复的${key}: ${ents.length}个`);
          ents.forEach((e, i) => {
            console.log(`   ${i+1}. ${e.id} (位置: ${e.loc.start})`);
          });
        }
      });
    }
    
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ 测试失败:', error);
  process.exit(1);
} 