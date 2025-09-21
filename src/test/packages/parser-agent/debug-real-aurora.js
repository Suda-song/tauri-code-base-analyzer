const path = require('path');
const fs = require('fs');
const { extractAllEntities } = require('./dist/fileWalker');

/**
 * 实际测试aurora项目的workspace解析
 */
async function debugRealAurora() {
  const auroraDir = '/Users/chenxufeng/Desktop/project-clone/aurora/packages/fulfillment/fulfillment-aftersale-ark';
  
  console.log(`🔍 开始调试实际aurora项目: ${auroraDir}`);
  
  // 检查目录是否存在
  if (!fs.existsSync(auroraDir)) {
    console.error(`❌ 目录不存在: ${auroraDir}`);
    return;
  }
  
  // 检查package.json
  const packageJsonPath = path.join(auroraDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error(`❌ package.json不存在: ${packageJsonPath}`);
    return;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  console.log(`📦 包名: ${packageJson.name}`);
  
  if (packageJson.dependenciesMeta) {
    console.log(`🔗 dependenciesMeta配置:`);
    Object.entries(packageJson.dependenciesMeta).forEach(([name, meta]) => {
      console.log(`  ${name}: injected=${meta.injected || false}`);
    });
  }
  
  // 检查workspace根目录
  const workspaceRoot = '/Users/chenxufeng/Desktop/project-clone/aurora';
  console.log(`🏠 workspace根目录: ${workspaceRoot}`);
  
  if (!fs.existsSync(workspaceRoot)) {
    console.error(`❌ workspace根目录不存在: ${workspaceRoot}`);
    return;
  }
  
  // 检查workspace配置文件
  const pnpmWorkspacePath = path.join(workspaceRoot, 'pnpm-workspace.yaml');
  const rootPackageJsonPath = path.join(workspaceRoot, 'package.json');
  
  console.log(`📄 检查workspace配置文件:`);
  console.log(`  pnpm-workspace.yaml: ${fs.existsSync(pnpmWorkspacePath) ? '存在' : '不存在'}`);
  console.log(`  package.json: ${fs.existsSync(rootPackageJsonPath) ? '存在' : '不存在'}`);
  
  if (fs.existsSync(pnpmWorkspacePath)) {
    const yamlContent = fs.readFileSync(pnpmWorkspacePath, 'utf-8');
    console.log(`📝 pnpm-workspace.yaml内容:`);
    console.log(yamlContent);
  }
  
  if (fs.existsSync(rootPackageJsonPath)) {
    const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf-8'));
    if (rootPackageJson.workspaces) {
      console.log(`📝 package.json workspaces配置:`);
      console.log(JSON.stringify(rootPackageJson.workspaces, null, 2));
    }
  }
  
  // 手动检查packages目录结构
  const packagesDir = path.join(workspaceRoot, 'packages');
  if (fs.existsSync(packagesDir)) {
    console.log(`📁 packages目录结构:`);
    try {
      const entries = fs.readdirSync(packagesDir);
      entries.forEach(entry => {
        const entryPath = path.join(packagesDir, entry);
        if (fs.statSync(entryPath).isDirectory()) {
          console.log(`  📂 ${entry}/`);
          
          // 检查是否有package.json
          const subPackageJsonPath = path.join(entryPath, 'package.json');
          if (fs.existsSync(subPackageJsonPath)) {
            try {
              const subPackageJson = JSON.parse(fs.readFileSync(subPackageJsonPath, 'utf-8'));
              console.log(`    📦 ${subPackageJson.name}`);
            } catch (error) {
              console.log(`    ❌ package.json解析失败`);
            }
          } else {
            // 检查子目录
            try {
              const subEntries = fs.readdirSync(entryPath);
              subEntries.forEach(subEntry => {
                const subEntryPath = path.join(entryPath, subEntry);
                if (fs.statSync(subEntryPath).isDirectory()) {
                  const subSubPackageJsonPath = path.join(subEntryPath, 'package.json');
                  if (fs.existsSync(subSubPackageJsonPath)) {
                    try {
                      const subSubPackageJson = JSON.parse(fs.readFileSync(subSubPackageJsonPath, 'utf-8'));
                      console.log(`    📂 ${subEntry}/ -> 📦 ${subSubPackageJson.name}`);
                    } catch (error) {
                      console.log(`    📂 ${subEntry}/ -> ❌ package.json解析失败`);
                    }
                  }
                }
              });
            } catch (error) {
              // 忽略读取错误
            }
          }
        }
      });
    } catch (error) {
      console.error(`❌ 读取packages目录失败:`, error);
    }
  }
  
  // 手动查找目标包
  const targetPackages = ['@xhs/shared-ark', '@xhs/fulfillment-common-ark', '@xhs/lib-fulfillment-modules'];
  console.log(`\n🎯 手动查找目标包:`);
  
  for (const packageName of targetPackages) {
    console.log(`\n查找: ${packageName}`);
    let found = false;
    
    // 在packages目录中递归查找
    function searchInDir(dir, depth = 0) {
      if (depth > 3) return false;
      
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          if (entry.startsWith('.')) continue;
          
          const entryPath = path.join(dir, entry);
          if (fs.statSync(entryPath).isDirectory()) {
            const packageJsonPath = path.join(entryPath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
              try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                if (packageJson.name === packageName) {
                  console.log(`  ✅ 找到: ${entryPath}`);
                  return true;
                }
              } catch (error) {
                // 忽略解析错误
              }
            }
            
            // 递归搜索子目录
            if (searchInDir(entryPath, depth + 1)) {
              return true;
            }
          }
        }
      } catch (error) {
        // 忽略读取错误
      }
      return false;
    }
    
    found = searchInDir(packagesDir);
    if (!found) {
      console.log(`  ❌ 未找到`);
    }
  }
  
  console.log(`\n🚀 开始运行实体提取...`);
  try {
    const entities = await extractAllEntities(auroraDir);
    console.log(`✅ 实体提取完成，共提取 ${entities.length} 个实体`);
    
    // 统计各包的实体数量
    const packageStats = {};
    entities.forEach(entity => {
      if (entity.file) {
        let packageName = 'unknown';
        if (entity.file.includes('shared-ark') || entity.file.includes('@xhs/shared-ark')) {
          packageName = '@xhs/shared-ark';
        } else if (entity.file.includes('fulfillment-common') || entity.file.includes('@xhs/fulfillment-common-ark')) {
          packageName = '@xhs/fulfillment-common-ark';
        } else if (entity.file.includes('lib-fulfillment') || entity.file.includes('@xhs/lib-fulfillment-modules')) {
          packageName = '@xhs/lib-fulfillment-modules';
        } else if (entity.file.includes('fulfillment-aftersale-ark')) {
          packageName = 'fulfillment-aftersale-ark';
        }
        
        if (!packageStats[packageName]) {
          packageStats[packageName] = 0;
        }
        packageStats[packageName]++;
      }
    });
    
    console.log(`\n📊 各包实体统计:`);
    Object.entries(packageStats).forEach(([pkg, count]) => {
      console.log(`  ${pkg}: ${count} 个实体`);
    });
    
  } catch (error) {
    console.error(`❌ 实体提取失败:`, error);
  }
}

// 运行调试
debugRealAurora().catch(err => {
  console.error('调试失败:', err);
  process.exit(1);
}); 