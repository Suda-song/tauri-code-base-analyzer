const path = require('path');
const fs = require('fs');
const { extractAllEntities } = require('./dist/fileWalker');

/**
 * 测试修复后的aurora项目workspace解析
 */
async function testAuroraFixed() {
  const auroraDir = '/Users/chenxufeng/Desktop/project-clone/aurora/packages/fulfillment/fulfillment-aftersale-ark';
  
  console.log(`🧪 测试修复后的aurora项目workspace解析`);
  console.log(`项目目录: ${auroraDir}`);
  
  try {
    console.log(`\n🚀 开始实体提取...`);
    const startTime = Date.now();
    
    const entities = await extractAllEntities(auroraDir);
    
    const endTime = Date.now();
    console.log(`✅ 实体提取完成，共提取 ${entities.length} 个实体，耗时 ${endTime - startTime}ms`);
    
    // 统计各包的实体数量
    const packageStats = {};
    entities.forEach(entity => {
      if (entity.file) {
        let packageName = 'unknown';
        
        // 更精确的包名识别
        if (entity.file.includes('shared-ark') || entity.file.includes('shared/ark')) {
          packageName = '@xhs/shared-ark';
        } else if (entity.file.includes('fulfillment-common/ark') || entity.file.includes('fulfillment-common-ark')) {
          packageName = '@xhs/fulfillment-common-ark';
        } else if (entity.file.includes('fulfillment-common/biz-module') || entity.file.includes('lib-fulfillment-modules')) {
          packageName = '@xhs/lib-fulfillment-modules';
        } else if (entity.file.includes('fulfillment-aftersale-ark')) {
          packageName = 'fulfillment-aftersale-ark';
        } else {
          // 尝试从文件路径推断包名
          const pathParts = entity.file.split('/');
          if (pathParts.length >= 2) {
            if (pathParts[0] === 'packages') {
              if (pathParts.length >= 3) {
                packageName = `packages/${pathParts[1]}/${pathParts[2]}`;
              } else {
                packageName = `packages/${pathParts[1]}`;
              }
            } else if (pathParts[0] === 'shared') {
              packageName = `shared/${pathParts[1] || 'unknown'}`;
            }
          }
        }
        
        if (!packageStats[packageName]) {
          packageStats[packageName] = 0;
        }
        packageStats[packageName]++;
      }
    });
    
    console.log(`\n📊 各包实体统计:`);
    Object.entries(packageStats)
      .sort(([,a], [,b]) => b - a) // 按实体数量降序排列
      .forEach(([pkg, count]) => {
        console.log(`  ${pkg}: ${count} 个实体`);
      });
    
    // 检查是否找到了目标workspace包
    const targetPackages = ['@xhs/shared-ark', '@xhs/fulfillment-common-ark', '@xhs/lib-fulfillment-modules'];
    console.log(`\n🎯 目标workspace包检查:`);
    
    for (const targetPkg of targetPackages) {
      const count = packageStats[targetPkg] || 0;
      if (count > 0) {
        console.log(`  ✅ ${targetPkg}: ${count} 个实体`);
      } else {
        console.log(`  ❌ ${targetPkg}: 未找到实体`);
      }
    }
    
    // 显示一些示例实体
    console.log(`\n📝 实体示例 (前10个):`);
    entities.slice(0, 10).forEach((entity, index) => {
      console.log(`  ${index + 1}. ${entity.type}:${entity.name} (${entity.file})`);
    });
    
    // 检查是否有来自workspace包的实体
    const workspaceEntities = entities.filter(entity => 
      entity.file && (
        entity.file.includes('shared') ||
        entity.file.includes('fulfillment-common') ||
        entity.file.includes('biz-module')
      )
    );
    
    console.log(`\n🔗 workspace包实体数量: ${workspaceEntities.length}`);
    if (workspaceEntities.length > 0) {
      console.log(`workspace包实体示例:`);
      workspaceEntities.slice(0, 5).forEach((entity, index) => {
        console.log(`  ${index + 1}. ${entity.type}:${entity.name} (${entity.file})`);
      });
    }
    
  } catch (error) {
    console.error(`❌ 测试失败:`, error);
    console.error(error.stack);
  }
}

// 运行测试
testAuroraFixed().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
}); 