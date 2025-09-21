# MR统计子包概览

## 目录结构

```
mr-statistics/
├── package.json            # 子包的配置文件
├── tsconfig.json           # TypeScript配置
├── README.md               # 使用说明文档
├── integration-guide.md    # 集成指南文档
├── package.json.update.js  # 集成辅助脚本
├── src/                    # 源代码目录
│   ├── index.ts            # 入口文件，导出所有公共API
│   ├── cli/                # 命令行接口
│   │   ├── index.ts        # CLI入口点
│   │   └── run.js          # CLI运行脚本
│   ├── models/             # 数据模型
│   │   ├── interfaces.ts   # 接口定义
│   │   └── mr-stats.ts     # MR统计数据模型
│   ├── git/                # Git操作相关
│   │   └── branch-info.ts  # 分支信息获取
│   ├── db/                 # 数据库操作
│   │   └── mr-manager.ts   # MR记录管理器
│   ├── utils/              # 工具函数
│   │   └── code-matcher.ts # 代码匹配工具
│   └── services/           # 核心服务
│       └── mr-statistics-service.ts  # MR统计服务
```

## 核心文件详解

### 1. src/index.ts
入口文件，导出所有公共API，方便用户使用。

主要导出内容：
- `MRStatisticsService` - 核心统计服务类
- `saveMRStats`, `getMRStats` - 数据库操作函数
- `calculateAndSaveMRStats` - 便捷函数

### 2. src/services/mr-statistics-service.ts
MR统计的核心实现，负责协调各模块工作，计算采纳率统计数据。

主要功能：
- 获取分支信息
- 获取变更文件
- 获取AI任务记录
- 匹配文件和代码
- 计算采纳率
- 生成统计结果

### 3. src/utils/code-matcher.ts
代码匹配工具，提供文件匹配和代码匹配的算法实现。

主要功能：
- 文件路径匹配
- 代码内容匹配
- 采纳率计算
- diff解析

### 4. src/git/branch-info.ts
Git分支信息处理，负责获取分支、提交和变更文件等信息。

主要功能：
- 获取分支信息
- 检查分支合并状态
- 获取变更文件
- 获取提交记录

### 5. src/db/mr-manager.ts
MR统计记录管理器，负责数据库操作。

主要功能：
- 保存MR统计记录
- 查询MR统计记录
- 转换数据格式

### 6. src/models/mr-stats.ts
MR统计数据的数据库模型定义。

主要字段：
- 分支信息
- 文件级采纳率统计
- 代码行级采纳率统计
- 相关提交信息
- 时间信息

### 7. src/models/interfaces.ts
定义各种接口和类型，用于类型检查和代码提示。

主要接口：
- `MRStatisticsOptions` - 统计选项
- `MRStatisticsResult` - 统计结果
- `FileChangeWithMatchStatus` - 带匹配状态的文件变更
- `MRFileChange` - MR文件变更

### 8. src/cli/index.ts
命令行工具的入口，处理命令行参数和执行相应的操作。

主要命令：
- `calculate` - 计算MR统计数据
- `show` - 显示特定的统计记录
- `list` - 列出多条统计记录

## 数据流程

1. **输入阶段**
   - 通过命令行或API传入参数
   - 默认使用当前分支作为源分支，master作为目标分支

2. **Git信息获取**
   - 获取分支信息
   - 获取变更文件
   - 获取提交记录

3. **数据查询阶段**
   - 查询与分支相关的AI任务记录
   - 查询AI生成的文件变更记录

4. **匹配阶段**
   - 匹配MR变更的文件和AI生成的文件
   - 解析diff信息，计算代码行匹配

5. **计算阶段**
   - 计算文件级采纳率
   - 计算代码行级采纳率

6. **输出阶段**
   - 生成统计结果
   - 保存到数据库
   - 格式化输出

## 关键算法

### 1. 文件匹配算法

```typescript
// 精确匹配
if (normalizedMrFiles.includes(normalizedChangePath)) {
  matchStatus = { isMatched: true, matchType: 'exact', matchScore: 1.0 };
}
// 部分路径匹配
else if (normalizedMrFiles.some(filePath => 
  filePath.endsWith(normalizedChangePath) || normalizedChangePath.endsWith(filePath))) {
  matchStatus = { isMatched: true, matchType: 'partial', matchScore: 0.9 };
}
// 文件名匹配
else if (normalizedMrFiles.some(filePath => 
  path.basename(filePath) === path.basename(normalizedChangePath))) {
  matchStatus = { isMatched: true, matchType: 'name', matchScore: 0.8 };
}
```

### 2. 采纳率计算算法

```typescript
// 计算采纳率
const acceptanceRate = Number(((matchedItems * 100.0) / totalItems).toFixed(2));
```

### 3. 特殊值处理算法

```typescript
// 只有当AI确实生成了代码文件(aiCodeFiles > 0)时，才计算采纳率
// 否则使用0表示"AI有变更但全部未采纳"
let fileAcceptanceRate = 0;
if (aiCodeFiles > 0) {
  if (totalFiles > 0) {
    fileAcceptanceRate = Number(((includeAiCodeFiles * 100.0) / totalFiles).toFixed(2));
  }
}
```

## API示例

### 基本使用

```typescript
import { MRStatisticsService, saveMRStats } from 'mr-statistics';

// 创建服务实例
const service = new MRStatisticsService({
  targetBranch: 'master',
  thresholds: { fileMatch: 0.7, codeMatch: 0.6 }
});

// 计算统计数据
const result = await service.calculateMRStatistics();

// 保存到数据库
await saveMRStats(result);

// 输出结果
console.log(`文件级采纳率: ${result.mrFileAcceptanceRate}%`);
console.log(`代码行级采纳率: ${result.mrCodeAcceptanceRate}%`);
```

### 便捷函数

```typescript
import { calculateAndSaveMRStats } from 'mr-statistics';

// 计算并保存MR统计数据
const mrId = await calculateAndSaveMRStats({
  sourceBranch: 'feature/new-feature',
  targetBranch: 'master'
});
```

## 命令行示例

```bash
# 计算当前分支的MR统计数据
mr-stats calculate

# 指定源分支和目标分支
mr-stats calculate --source feature/new-feature --target master

# 查看指定ID的MR统计结果
mr-stats show --id mr_12345

# 查看最近的MR统计记录
mr-stats list --limit 10
```

## 集成示例

```bash
# 安装子包
npm install --save mr-statistics

# 使用集成辅助脚本
node node_modules/mr-statistics/package.json.update.js ./package.json

# 执行MR统计
npm run mr-stats
```