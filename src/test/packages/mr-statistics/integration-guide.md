# MR统计子包集成指南

本文档提供将MR统计子包集成到主项目的详细步骤。

## 1. 安装子包

在主项目根目录执行：

```bash
npm install --save ../packages/mr-statistics
```

或者如果子包已经发布到npm仓库：

```bash
npm install --save mr-statistics
```

## 2. 修改package.json

在主项目的package.json中添加以下脚本：

```json
{
  "scripts": {
    "mr-stats": "mr-stats calculate",
    "mr-stats:show": "mr-stats show",
    "mr-stats:list": "mr-stats list",
    "publish": "npm run mr-stats && [原publish命令]"
  }
}
```

## 3. 数据库配置

如果需要配置数据库连接，可以在项目根目录创建`.mrrc`配置文件：

```json
{
  "database": {
    "host": "localhost",
    "port": 3306,
    "database": "modular_dev",
    "username": "root",
    "password": "password",
    "dialect": "mysql"
  },
  "thresholds": {
    "fileMatch": 0.7,
    "codeMatch": 0.6
  },
  "ignorePatterns": [
    "**/*.min.js",
    "**/*.min.css",
    "**/node_modules/**",
    "**/dist/**"
  ]
}
```

## 4. 环境变量配置

也可以通过环境变量配置子包：

```bash
# 数据库配置
export MR_STATS_DB_HOST=localhost
export MR_STATS_DB_PORT=3306
export MR_STATS_DB_NAME=modular_dev
export MR_STATS_DB_USER=root
export MR_STATS_DB_PASSWORD=password

# 阈值配置
export MR_STATS_THRESHOLD_FILE=0.7
export MR_STATS_THRESHOLD_CODE=0.6

# 其他配置
export MR_STATS_TARGET_BRANCH=master
export MR_STATS_VERBOSE=true
```

## 5. 执行MR统计

完成配置后，可以执行以下命令计算MR统计数据：

```bash
npm run mr-stats
```

或者直接使用命令行工具：

```bash
mr-stats calculate --source feature/new-feature --target master --verbose
```

## 6. 查看统计结果

查看最近的MR统计结果：

```bash
npm run mr-stats:list
```

查看特定ID的MR统计结果：

```bash
npm run mr-stats:show -- --id mr_12345
```

## 7. 自定义集成

如果需要更深度的集成，可以在自定义脚本中使用子包的API：

```javascript
const { calculateAndSaveMRStats } = require('mr-statistics');

async function main() {
  try {
    // 计算并保存MR统计数据
    const mrId = await calculateAndSaveMRStats({
      sourceBranch: 'feature/new-feature',
      targetBranch: 'master'
    });
    console.log(`MR统计数据已保存，ID: ${mrId}`);
  } catch (error) {
    console.error('计算MR统计数据失败:', error);
  }
}

main();
```

## 8. 调试和故障排除

如果遇到问题，可以启用详细日志：

```bash
mr-stats calculate --verbose
```

常见问题和解决方案：

1. 数据库连接失败：检查数据库配置是否正确
2. 无法获取Git信息：确保当前目录是有效的Git仓库
3. 找不到AI任务记录：检查分支名称和提交哈希是否正确
4. 采纳率计算不准确：调整匹配阈值并使用--verbose选项查看详细匹配信息

## 9. CI/CD集成

在CI/CD流程中集成MR统计：

```yaml
# GitLab CI示例
mr-statistics:
  stage: post-deploy
  script:
    - npm install -g mr-statistics
    - mr-stats calculate --target master
  only:
    - master
```

## 10. 更新子包

当子包有更新时，执行以下命令更新：

```bash
npm update mr-statistics
```