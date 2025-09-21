const fs = require('fs');
const path = require('path');

console.log('🧪 验证 Workspace 扫描修复效果');

// 读取提取的实体结果
const entitiesPath = '../../data/entities.json';

if (!fs.existsSync(entitiesPath)) {
  console.error('❌ 未找到 entities.json 文件，请先运行实体提取');
  process.exit(1);
}

const entities = JSON.parse(fs.readFileSync(entitiesPath, 'utf-8'));

console.log(`\n📊 提取结果统计:`);
console.log(`总实体数: ${entities.length}`);

// 按项目分组统计
const byProject = {};
const byPackage = {};

entities.forEach(entity => {
  const pathParts = entity.file.split('/');
  const project = pathParts[0];
  
  byProject[project] = (byProject[project] || 0) + 1;
  
  if (project === 'packages' && pathParts.length > 1) {
    const packageName = pathParts[1];
    byPackage[packageName] = (byPackage[packageName] || 0) + 1;
  }
});

console.log(`\n📦 按项目分组:`);
Object.entries(byProject).forEach(([project, count]) => {
  console.log(`  ${project}: ${count} 个实体`);
});

console.log(`\n📦 Workspace 包详情:`);
Object.entries(byPackage).forEach(([pkg, count]) => {
  console.log(`  packages/${pkg}: ${count} 个实体`);
});

// 检查是否包含了项目本身的实体
const hasAppsEntities = entities.some(e => e.file.startsWith('apps/'));
const hasAfterSaleDemo = entities.some(e => e.file.includes('after-sale-demo'));

console.log(`\n🔍 验证结果:`);
console.log(`包含 apps 项目实体: ${hasAppsEntities ? '✅' : '❌'}`);
console.log(`包含 after-sale-demo 实体: ${hasAfterSaleDemo ? '✅' : '❌'}`);
console.log(`包含 workspace 包实体: ${byProject.packages > 0 ? '✅' : '❌'}`);

// 检查具体的after-sale-demo实体
if (hasAfterSaleDemo) {
  const afterSaleEntities = entities.filter(e => e.file.includes('after-sale-demo'));
  console.log(`\n📋 after-sale-demo 实体详情 (${afterSaleEntities.length} 个):`);
  
  const fileGroups = {};
  afterSaleEntities.forEach(e => {
    const fileName = e.file.split('/').pop();
    if (!fileGroups[fileName]) fileGroups[fileName] = [];
    fileGroups[fileName].push(e);
  });
  
  Object.entries(fileGroups).forEach(([file, ents]) => {
    console.log(`  ${file}: ${ents.length} 个实体`);
    ents.forEach(e => {
      console.log(`    - ${e.id} (${e.type})`);
    });
  });
}

const isWorkspaceFixed = hasAppsEntities && hasAfterSaleDemo && byProject.packages > 0;
console.log(`\n🎯 Workspace 修复成功: ${isWorkspaceFixed ? '✅' : '❌'}`);

if (isWorkspaceFixed) {
  console.log('\n🎉 恭喜！Workspace 扫描已正确工作:');
  console.log('✅ 扫描了所有workspace包的实体');
  console.log('✅ 同时扫描了项目本身的实体');
  console.log('✅ 不再遗漏项目根目录的源码');
} else {
  console.log('\n⚠️  Workspace 扫描仍有问题，需要进一步调试');
  process.exit(1);
} 