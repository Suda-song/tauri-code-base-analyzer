# MR统计子包结构设计

## 子包名称
`mr-statistics`

## 子包路径
`/packages/mr-statistics`

## 文件结构

```
mr-statistics/
├── package.json            # 子包的配置文件
├── tsconfig.json           # TypeScript配置
├── .gitignore              # Git忽略文件
├── README.md               # 使用说明文档
├── src/                    # 源代码目录
│   ├── index.ts            # 入口文件，导出所有公共API
│   ├── cli/                # 命令行接口
│   │   ├── index.ts        # CLI入口点
│   │   └── commands.ts     # CLI命令定义
│   ├── models/             # 数据模型
│   │   ├── index.ts        # 模型导出
│   │   ├── mr-stats.ts     # MR统计数据模型
│   │   └── interfaces.ts   # 接口定义
│   ├── git/                # Git操作相关
│   │   ├── index.ts        # 导出Git相关功能
│   │   ├── branch-info.ts  # 分支信息获取
│   │   ├── diff-parser.ts  # Git差异解析
│   │   └── commit-info.ts  # Commit信息获取
│   ├── db/                 # 数据库操作
│   │   ├── index.ts        # 数据库操作导出
│   │   ├── config.ts       # 数据库配置
│   │   └── mr-manager.ts   # MR记录管理器
│   ├── utils/              # 工具函数
│   │   ├── index.ts        # 工具函数导出
│   │   ├── logger.ts       # 日志工具
│   │   ├── code-matcher.ts # 代码匹配工具
│   │   └── path-utils.ts   # 路径处理工具
│   └── services/           # 核心服务
│       ├── index.ts        # 服务导出
│       ├── mr-statistics-service.ts  # MR统计服务
│       ├── file-acceptance.ts        # 文件级采纳率计算
│       └── code-acceptance.ts        # 代码行级采纳率计算
├── tests/                  # 单元测试
│   ├── git/                # Git相关测试
│   ├── services/           # 服务测试
│   └── utils/              # 工具函数测试
└── docs/                   # 文档
    ├── api.md              # API文档
    └── examples.md         # 使用示例
```

## 模块划分与职责

### 1. 核心服务层 (services/)

#### MRStatisticsService (mr-statistics-service.ts)
- 核心统计服务，协调各模块工作
- 提供统计数据计算的高级API
- 处理多次提交的数据聚合逻辑

#### FileAcceptanceService (file-acceptance.ts)
- 负责文件级采纳率的计算
- 实现文件匹配算法
- 处理文件路径标准化和比较

#### CodeAcceptanceService (code-acceptance.ts)
- 负责代码行级采纳率的计算
- 解析代码差异信息
- 计算代码行变更的相关指标

### 2. Git操作层 (git/)

#### BranchInfoService (branch-info.ts)
- 获取当前分支信息
- 检测合并状态
- 确定目标分支（通常是master）

#### DiffParser (diff-parser.ts)
- 解析Git差异输出
- 提取文件变更信息
- 支持不同的合并策略（merge、rebase、squash）

#### CommitInfoService (commit-info.ts)
- 获取提交历史
- 提取提交元数据
- 处理提交消息和作者信息

### 3. 数据库操作层 (db/)

#### MRManager (mr-manager.ts)
- MR统计数据的CRUD操作
- 查询和保存MR统计数据
- 处理与数据库的交互逻辑

#### DatabaseConfig (config.ts)
- 数据库连接配置
- 表结构初始化

### 4. 模型层 (models/)

#### MRStatsModel (mr-stats.ts)
- MR统计数据模型
- 定义统计字段和关系
- 提供模型实例方法

#### Interfaces (interfaces.ts)
- 定义各种接口和类型
- MR统计结果接口
- 配置选项接口

### 5. 工具层 (utils/)

#### CodeMatcher (code-matcher.ts)
- 代码匹配算法实现
- 支持不同的匹配策略
- 计算代码相似度

#### Logger (logger.ts)
- 日志记录工具
- 支持不同级别的日志
- 格式化输出

#### PathUtils (path-utils.ts)
- 路径处理工具函数
- 标准化路径比较
- 处理不同操作系统的路径差异

### 6. 命令行接口 (cli/)

#### Commands (commands.ts)
- 定义CLI命令参数
- 处理命令行输入
- 生成帮助文档

#### CLI入口 (index.ts)
- 命令行程序入口点
- 解析命令行参数
- 调用对应的服务

## 关键接口设计

### MRStatisticsService 公共API

```typescript
interface MRStatisticsOptions {
  sourceBranch?: string;     // 源分支名称，默认为当前分支
  targetBranch?: string;     // 目标分支名称，默认为master
  databaseConfig?: DBConfig; // 数据库配置
  verbose?: boolean;         // 是否输出详细日志
  thresholds?: {             // 采纳率阈值配置
    fileMatch: number;       // 文件匹配阈值（0-1）
    codeMatch: number;       // 代码匹配阈值（0-1）
  };
  ignorePatterns?: string[]; // 需要忽略的文件模式
}

interface MRStatisticsResult {
  // MR基本信息
  mrId: string;              // MR唯一标识符
  sourceBranch: string;      // 源分支名称
  targetBranch: string;      // 目标分支名称
  
  // 文件级采纳统计
  totalMRFiles: number;      // MR总文件数
  includeAiCodeFiles: number;// 包含AI代码的文件数
  mrFileAcceptanceRate: number; // 文件级采纳率

  // 代码行级采纳统计
  totalMRCodeLines: number;      // MR总代码行数
  includeAiCodeLines: number;    // 包含AI代码的行数
  mrCodeAcceptanceRate: number;  // 代码行级采纳率

  // 相关提交信息
  relatedCommits: Array<{
    hash: string;            // 提交哈希
    summary: string;         // 提交描述
    timestamp: Date;         // 提交时间
  }>;

  // 时间信息
  createdAt: Date;           // MR创建时间
  mergedAt?: Date;           // MR合并时间
}

class MRStatisticsService {
  // 构造函数
  constructor(options?: MRStatisticsOptions);

  // 计算MR统计数据
  calculateMRStatistics(): Promise<MRStatisticsResult>;

  // 保存MR统计结果到数据库
  saveMRStatistics(result: MRStatisticsResult): Promise<string>;

  // 获取已有的MR统计数据
  getMRStatistics(mrId: string): Promise<MRStatisticsResult | null>;

  // 获取当前分支的MR统计数据
  getCurrentBranchStatistics(): Promise<MRStatisticsResult | null>;
  
  // 获取多个MR的统计数据
  getMRStatisticsList(options?: {
    sourceBranch?: string;
    targetBranch?: string;
    limit?: number;
    offset?: number;
  }): Promise<MRStatisticsResult[]>;
}
```

## 命令行接口设计

### CLI命令

```
# 计算当前分支MR统计并保存
mr-stats calculate

# 指定源分支和目标分支计算
mr-stats calculate --source=feature/new-feature --target=master

# 查看最近的MR统计结果
mr-stats list --limit=10

# 查看特定MR的统计结果
mr-stats show --id=mr_12345

# 帮助信息
mr-stats --help
```