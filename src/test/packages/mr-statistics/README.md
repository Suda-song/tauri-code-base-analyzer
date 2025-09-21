# MR统计子包

MR统计子包是一个用于计算MR阶段AI代码采纳率的工具包，提供了丰富的API和命令行工具，帮助团队评估AI代码在项目中的实际采纳情况。

## 功能特点

- 计算MR阶段的文件级采纳率和代码行级采纳率
- 支持多种匹配策略，提高统计准确性
- 提供完整的命令行工具，方便集成到CI/CD流程
- 持久化统计结果，便于后续查询和分析
- 支持不同的分支合并策略（merge、rebase、squash）

## 安装

```bash
npm install --save mr-statistics
```

## 使用方法

### 命令行工具

1. 计算当前分支的MR统计数据

```bash
mr-stats calculate
```

2. 指定源分支和目标分支

```bash
mr-stats calculate --source feature/new-feature --target master
```

3. 查看指定ID的MR统计结果

```bash
mr-stats show --id mr_12345
```

4. 查看最近的MR统计记录

```bash
mr-stats list --limit 10
```

### 在代码中使用

1. 基本用法

```typescript
import { calculateAndSaveMRStats } from 'mr-statistics';

async function example() {
  try {
    // 计算并保存MR统计数据
    const mrId = await calculateAndSaveMRStats({
      targetBranch: 'master'
    });
    console.log(`MR统计数据已保存，ID: ${mrId}`);
  } catch (error) {
    console.error('计算MR统计数据失败:', error);
  }
}
```

2. 使用底层API

```typescript
import { MRStatisticsService, saveMRStats } from 'mr-statistics';

async function example() {
  // 创建服务实例
  const service = new MRStatisticsService({
    sourceBranch: 'feature/new-feature',
    targetBranch: 'master',
    thresholds: {
      fileMatch: 0.8,
      codeMatch: 0.7
    },
    ignorePatterns: ['**/*.min.js', '**/dist/**']
  });
  
  // 计算统计数据
  const result = await service.calculateMRStatistics();
  
  // 保存到数据库
  const id = await saveMRStats(result);
  console.log(`MR统计数据已保存，ID: ${id}`);
  
  // 输出结果
  console.log(`文件级采纳率: ${result.mrFileAcceptanceRate}%`);
  console.log(`代码行级采纳率: ${result.mrCodeAcceptanceRate}%`);
}
```

3. 查询统计数据

```typescript
import { getMRStats, getMRStatsList } from 'mr-statistics';

async function example() {
  // 获取指定ID的MR统计数据
  const result = await getMRStats('mr_12345');
  if (result) {
    console.log(`MR ${result.mrId} 的采纳率: ${result.mrCodeAcceptanceRate}%`);
  }
  
  // 获取最近的10条MR统计记录
  const results = await getMRStatsList({
    limit: 10
  });
  console.log(`找到 ${results.length} 条MR统计记录`);
}
```

## 数据表结构

MR统计数据存储在`modular_dev_mr_stats`表中，包含以下字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | VARCHAR(255) | MR统计唯一标识符 |
| mr_id | VARCHAR(255) | Merge Request ID |
| source_branch | VARCHAR(255) | 开发分支名称 |
| target_branch | VARCHAR(255) | 目标分支名称 |
| total_mr_files | BIGINT | MR阶段变更的总文件数 |
| include_ai_code_files | BIGINT | MR阶段包含AI代码的文件数 |
| mr_file_acceptance_rate | DECIMAL(5,2) | MR阶段AI变更文件维度采纳率百分比 |
| total_mr_code_lines | BIGINT | MR中总代码行数 |
| include_ai_code_lines | BIGINT | MR中被接受的代码行数 |
| mr_code_acceptance_rate | DECIMAL(5,2) | MR阶段AI代码采纳率百分比 |
| related_commits | JSON | 相关提交哈希列表 |
| created_at | TIMESTAMP | MR创建时间 |
| merged_at | TIMESTAMP | MR合并时间 |

## 集成到项目

在主项目的`package.json`中添加以下脚本：

```json
{
  "scripts": {
    "mr-stats": "mr-stats calculate",
    "publish": "npm run mr-stats && [原publish命令]"
  }
}
```

这样在执行`npm run publish`时，会自动计算并保存MR统计数据。

## 代码匹配与采纳率计算

MR统计子包采用了精细的代码匹配策略和采纳率计算方法，以确保统计数据的准确性。

### 文件匹配策略

系统采用多层级的文件匹配策略，按优先级依次为：

1. **精确路径匹配（匹配分数1.0）**：文件路径完全相同
2. **部分路径匹配（匹配分数0.9）**：一个路径是另一个的结尾或开头
3. **文件名匹配（匹配分数0.8）**：仅文件名相同，路径不同

每种匹配都会产生一个匹配分数，只有当这个分数大于等于设定的阈值（默认0.7）时，才认为文件实际被匹配上。

### 代码内容匹配

系统还会对文件内容进行匹配，确保真正的代码内容被采纳：

- 比较AI生成的代码行与MR文件的内容
- 计算匹配的代码行比例
- 生成内容匹配分数（0-1之间）

### 多次Flow处理

当同一个文件有多次Flow（AI多次生成或修改）时，系统会：

- 按创建时间降序排序，优先处理最新的变更
- 对同一文件路径的变更记录进行去重
- 对同一文件的所有代码行变更进行合并和去重
- 以最新的变更记录为准计算采纳率

详细的代码采纳率计算方案请参考[文档](./docs/代码采纳率计算方案.md)。

## 使用示例

### 调整匹配阈值

您可以根据项目需要调整文件匹配和代码内容匹配的阈值：

```typescript
// 创建服务实例并设置更严格的匹配阈值
const service = new MRStatisticsService({
  thresholds: {
    fileMatch: 0.8,  // 默认为0.7
    codeMatch: 0.7   // 默认为0.6
  }
});
```

### 查看详细的匹配信息

```typescript
// 计算统计数据并查看详细的匹配信息
const result = await service.calculateMRStatistics();

// 查看匹配到的AI文件
console.log(`匹配到的AI文件数: ${result.includeAiCodeFiles}/${result.totalAiCodeFiles}`);
console.log(`文件级采纳率: ${result.mrFileAcceptanceRate}%`);

// 查看代码行匹配情况
console.log(`匹配到的AI代码行: ${result.includeAiCodeLines}/${result.totalAiCodeLines}`);
console.log(`代码行级采纳率: ${result.mrCodeAcceptanceRate}%`);
```

## 注意事项

- 确保项目是一个有效的Git仓库
- 当前用户需要有足够的权限访问Git信息
- 需要配置数据库连接信息
- MR统计仅在分支与目标分支不同时才有意义
- 当处理大型项目时，内容匹配可能会消耗较多资源
- 对于二进制文件或特殊格式文件，内容匹配可能不适用

## 后续计划

- 支持更多分支合并场景（rebase、squash merge等）
- 实现统计数据的可视化展示
- 进一步优化代码内容匹配算法
- 支持更多的统计维度和指标
- 提供针对大型项目的性能优化选项