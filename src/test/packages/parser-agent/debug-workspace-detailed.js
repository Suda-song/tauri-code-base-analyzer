const path = require('path');
const fs = require('fs');

/**
 * 详细调试aurora项目的workspace解析问题
 */
async function debugWorkspaceDetailed() {
  const auroraDir = '/Users/chenxufeng/Desktop/project-clone/aurora/packages/fulfillment/fulfillment-aftersale-ark';
  const workspaceRoot = '/Users/chenxufeng/Desktop/project-clone/aurora';
  
  console.log(`🔍 详细调试aurora项目workspace解析`);
  console.log(`项目目录: ${auroraDir}`);
  console.log(`workspace根目录: ${workspaceRoot}`);
  
  // 1. 检查项目的package.json
  const packageJsonPath = path.join(auroraDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error(`❌ package.json不存在: ${packageJsonPath}`);
    return;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  console.log(`\n📦 当前项目包信息:`);
  console.log(`  包名: ${packageJson.name}`);
  
  // 检查所有依赖
  const allDeps = {
    ...packageJson.dependencies || {},
    ...packageJson.devDependencies || {},
    ...packageJson.peerDependencies || {}
  };
  
  console.log(`\n🔗 所有依赖:`);
  Object.entries(allDeps).forEach(([name, version]) => {
    if (version.startsWith('workspace:')) {
      console.log(`  ✅ workspace依赖: ${name} -> ${version}`);
    } else if (name.startsWith('@xhs/')) {
      console.log(`  🔍 @xhs包: ${name} -> ${version}`);
    }
  });
  
  // 检查dependenciesMeta
  if (packageJson.dependenciesMeta) {
    console.log(`\n🔧 dependenciesMeta配置:`);
    Object.entries(packageJson.dependenciesMeta).forEach(([name, meta]) => {
      console.log(`  ${name}: ${JSON.stringify(meta)}`);
    });
  }
  
  // 2. 检查workspace根目录配置
  console.log(`\n🏠 检查workspace根目录配置:`);
  
  // 检查pnpm-workspace.yaml
  const pnpmWorkspacePath = path.join(workspaceRoot, 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpmWorkspacePath)) {
    const yamlContent = fs.readFileSync(pnpmWorkspacePath, 'utf-8');
    console.log(`📄 pnpm-workspace.yaml内容:`);
    console.log(yamlContent);
  }
  
  // 检查根package.json
  const rootPackageJsonPath = path.join(workspaceRoot, 'package.json');
  if (fs.existsSync(rootPackageJsonPath)) {
    const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf-8'));
    if (rootPackageJson.workspaces) {
      console.log(`📄 根package.json workspaces配置:`);
      console.log(JSON.stringify(rootPackageJson.workspaces, null, 2));
    }
  }
  
  // 3. 手动搜索目标包
  const targetPackages = ['@xhs/shared-ark', '@xhs/fulfillment-common-ark', '@xhs/lib-fulfillment-modules'];
  console.log(`\n🎯 手动搜索目标包:`);
  
  for (const packageName of targetPackages) {
    console.log(`\n查找包: ${packageName}`);
    
    // 在packages目录中搜索
    const packagesDir = path.join(workspaceRoot, 'packages');
    const found = searchPackageInDirectory(packagesDir, packageName, 0, 3);
    
    if (!found) {
      console.log(`  ❌ 在packages目录中未找到`);
      
      // 尝试在其他常见目录搜索
      const otherDirs = ['apps', 'libs', 'modules'];
      for (const dir of otherDirs) {
        const dirPath = path.join(workspaceRoot, dir);
        if (fs.existsSync(dirPath)) {
          const foundInOther = searchPackageInDirectory(dirPath, packageName, 0, 3);
          if (foundInOther) break;
        }
      }
    }
  }
  
  // 4. 检查node_modules中的符号链接
  console.log(`\n🔗 检查node_modules中的符号链接:`);
  const nodeModulesPath = path.join(workspaceRoot, 'node_modules');
  
  if (fs.existsSync(nodeModulesPath)) {
    // 检查@xhs作用域
    const xhsScopePath = path.join(nodeModulesPath, '@xhs');
    if (fs.existsSync(xhsScopePath)) {
      console.log(`📂 @xhs作用域目录存在`);
      
      try {
        const xhsPackages = fs.readdirSync(xhsScopePath);
        console.log(`  包含的包: ${xhsPackages.join(', ')}`);
        
        for (const pkg of xhsPackages) {
          const pkgPath = path.join(xhsScopePath, pkg);
          try {
            const stat = fs.lstatSync(pkgPath);
            if (stat.isSymbolicLink()) {
              const realPath = fs.realpathSync(pkgPath);
              console.log(`  📎 ${pkg} -> ${realPath}`);
              
              // 检查是否指向workspace
              if (!realPath.includes('node_modules')) {
                console.log(`    ✅ 这是workspace包`);
              } else {
                console.log(`    ❌ 这是外部包`);
              }
            } else {
              console.log(`  📁 ${pkg} (非符号链接)`);
            }
          } catch (error) {
            console.log(`  ❌ 无法检查 ${pkg}: ${error.message}`);
          }
        }
      } catch (error) {
        console.log(`  ❌ 无法读取@xhs目录: ${error.message}`);
      }
    } else {
      console.log(`❌ @xhs作用域目录不存在`);
    }
    
    // 检查.pnpm目录
    const pnpmDir = path.join(nodeModulesPath, '.pnpm');
    if (fs.existsSync(pnpmDir)) {
      console.log(`📂 .pnpm目录存在，检查file+packages模式...`);
      
      try {
        const pnpmEntries = fs.readdirSync(pnpmDir);
        const filePackagesEntries = pnpmEntries.filter(entry => entry.startsWith('file+packages+'));
        
        console.log(`  找到 ${filePackagesEntries.length} 个file+packages条目:`);
        filePackagesEntries.slice(0, 10).forEach(entry => {
          console.log(`    ${entry}`);
        });
        
        if (filePackagesEntries.length > 10) {
          console.log(`    ... 还有 ${filePackagesEntries.length - 10} 个条目`);
        }
      } catch (error) {
        console.log(`  ❌ 无法读取.pnpm目录: ${error.message}`);
      }
    }
  } else {
    console.log(`❌ node_modules目录不存在`);
  }
  
  // 5. 测试workspace模式解析
  console.log(`\n🧪 测试workspace模式解析:`);
  const testPatterns = ['packages/*', 'packages/*/*', 'packages/fulfillment/*'];
  
  for (const pattern of testPatterns) {
    console.log(`\n测试模式: ${pattern}`);
    const resolvedPaths = resolveWorkspacePatternSimple(workspaceRoot, pattern);
    console.log(`  解析出 ${resolvedPaths.length} 个路径`);
    
    // 显示前几个路径
    resolvedPaths.slice(0, 5).forEach(p => {
      const relativePath = path.relative(workspaceRoot, p);
      console.log(`    ${relativePath}`);
    });
    
    if (resolvedPaths.length > 5) {
      console.log(`    ... 还有 ${resolvedPaths.length - 5} 个路径`);
    }
  }
}

/**
 * 在指定目录中搜索包
 */
function searchPackageInDirectory(dir, packageName, currentDepth, maxDepth) {
  if (currentDepth >= maxDepth || !fs.existsSync(dir)) {
    return false;
  }
  
  try {
    const entries = fs.readdirSync(dir);
    
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      
      const entryPath = path.join(dir, entry);
      
      try {
        const stat = fs.statSync(entryPath);
        
        if (stat.isDirectory()) {
          // 检查当前目录是否包含目标package.json
          const packageJsonPath = path.join(entryPath, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            try {
              const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
              if (packageJson.name === packageName) {
                console.log(`  ✅ 找到: ${entryPath}`);
                return true;
              }
            } catch (error) {
              // 忽略package.json解析错误
            }
          }
          
          // 递归搜索子目录
          if (searchPackageInDirectory(entryPath, packageName, currentDepth + 1, maxDepth)) {
            return true;
          }
        }
      } catch (error) {
        // 忽略访问权限错误
      }
    }
  } catch (error) {
    console.log(`  ❌ 无法读取目录 ${dir}: ${error.message}`);
  }
  
  return false;
}

/**
 * 简单的workspace模式解析
 */
function resolveWorkspacePatternSimple(rootDir, pattern) {
  const results = [];
  
  if (pattern.includes('*')) {
    const parts = pattern.split('/');
    let currentPaths = [rootDir];
    
    for (const part of parts) {
      if (part === '*') {
        const newPaths = [];
        for (const currentPath of currentPaths) {
          if (fs.existsSync(currentPath)) {
            try {
              const entries = fs.readdirSync(currentPath);
              for (const entry of entries) {
                if (entry.startsWith('.')) continue;
                
                const entryPath = path.join(currentPath, entry);
                try {
                  if (fs.statSync(entryPath).isDirectory()) {
                    newPaths.push(entryPath);
                  }
                } catch (error) {
                  // 忽略访问错误
                }
              }
            } catch (error) {
              // 忽略读取错误
            }
          }
        }
        currentPaths = newPaths;
      } else {
        currentPaths = currentPaths.map(p => path.join(p, part));
      }
    }
    
    // 只返回存在的路径
    results.push(...currentPaths.filter(p => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    }));
  } else {
    // 直接路径
    const fullPath = path.resolve(rootDir, pattern);
    if (fs.existsSync(fullPath)) {
      results.push(fullPath);
    }
  }
  
  return results;
}

// 运行调试
debugWorkspaceDetailed().catch(err => {
  console.error('调试失败:', err);
  process.exit(1);
}); 