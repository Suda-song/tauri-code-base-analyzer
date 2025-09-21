/**
 * package.json.update.js
 * 用于集成MR统计子包到主项目的脚本
 * 
 * 用法: node package.json.update.js /path/to/main/package.json
 */

const fs = require('fs');
const path = require('path');

// 获取命令行参数
const mainPackageJsonPath = process.argv[2];

if (!mainPackageJsonPath) {
  console.error('❌ 请提供主项目package.json的路径');
  console.error('用法: node package.json.update.js /path/to/main/package.json');
  process.exit(1);
}

// 读取主项目的package.json
try {
  const packageJsonContent = fs.readFileSync(mainPackageJsonPath, 'utf-8');
  const packageJson = JSON.parse(packageJsonContent);
  
  // 备份原始package.json
  fs.writeFileSync(
    `${mainPackageJsonPath}.backup`,
    packageJsonContent,
    'utf-8'
  );
  console.log(`✅ 已备份原始package.json到 ${mainPackageJsonPath}.backup`);
  
  // 添加mr-statistics依赖
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  packageJson.dependencies['mr-statistics'] = '^1.0.0';
  
  // 添加mr-statistics脚本
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  
  // 添加mr-stats脚本
  packageJson.scripts['mr-stats'] = 'mr-stats calculate';
  packageJson.scripts['mr-stats:show'] = 'mr-stats show';
  packageJson.scripts['mr-stats:list'] = 'mr-stats list';
  
  // 如果有publish脚本，修改它
  if (packageJson.scripts.publish) {
    packageJson.scripts.publish = `npm run mr-stats && ${packageJson.scripts.publish}`;
  } else {
    // 如果没有publish脚本，创建一个基本的
    packageJson.scripts.publish = 'npm run mr-stats && npm publish';
  }
  
  // 将更新后的package.json写回文件
  fs.writeFileSync(
    mainPackageJsonPath,
    JSON.stringify(packageJson, null, 2),
    'utf-8'
  );
  console.log(`✅ 已更新package.json: ${mainPackageJsonPath}`);
  console.log(`👉 添加了依赖: mr-statistics@^1.0.0`);
  console.log(`👉 添加了脚本: mr-stats, mr-stats:show, mr-stats:list`);
  console.log(`👉 更新了脚本: publish`);
  
} catch (error) {
  console.error(`❌ 更新package.json失败:`, error);
  process.exit(1);
}