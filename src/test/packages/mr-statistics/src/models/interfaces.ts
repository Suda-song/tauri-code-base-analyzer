/**
 * interfaces.ts
 * MR统计功能的核心接口定义
 */

import { FileChange, FlowRecord } from '../imports';

/**
 * MR统计选项接口
 */
export interface MRStatisticsOptions {
  // 基本配置
  sourceBranch?: string;     // 源分支名称，默认为当前分支
  targetBranch?: string;     // 目标分支名称，默认为master
  appName?: string;          // 应用名称
  verbose?: boolean;         // 是否输出详细日志
  isPodMode?: boolean;       // 是否为容器环境模式
  
  // 阈值配置
  thresholds?: {
    fileMatch: number;       // 文件匹配阈值（0-1）
    codeMatch: number;       // 代码匹配阈值（0-1）
  };
  
  // 过滤配置
  ignorePatterns?: string[]; // 需要忽略的文件模式（glob格式）
  
  // 数据库配置
  dbConfig?: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    dialect?: string;
  };
}

/**
 * MR统计结果接口
 */
export interface MRStatisticsResult {
  // MR基本信息
  id: string;                // MR统计唯一标识符
  appName?: string;          // 应用名称
  sourceBranch: string;      // 源分支名称
  targetBranch: string;      // 目标分支名称
  
  // 文件级采纳统计
  totalMRFiles: number;      // MR总文件数
  includeAiCodeFiles: number;// 包含AI代码的文件数
  aiCodeFiles: number;       // AI生成的文件总数
  mrFileAcceptanceRate: number; // 文件级采纳率

  // 代码行级采纳统计
  totalMRCodeLines: number;      // MR总代码行数(或AI生成的代码行总数)
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

/**
 * 文件变更记录扩展接口
 * 扩展自FileChange，添加了匹配状态字段
 */
export interface FileChangeWithMatchStatus extends FileChange {
  matchStatus: {
    isMatched: boolean;      // 文件是否匹配
    matchType: 'exact' | 'partial' | 'name' | 'none'; // 匹配类型
    matchScore: number;      // 匹配分数 (0-1)
    matchedFilePath?: string; // 匹配到的文件路径
    codeMatchScore?: number;  // 代码内容匹配分数 (0-1)
    codeMatchedLines?: number; // 匹配的代码行数
    codeTotalLines?: number;  // 代码总行数
  };
}

/**
 * MR文件变更接口
 */
export interface MRFileChange {
  filePath: string;          // 文件路径
  changeType: 'added' | 'modified' | 'deleted'; // 变更类型
  linesAdded: number;        // 添加的行数
  linesDeleted: number;      // 删除的行数
  isAiGenerated: boolean;    // 是否由AI生成
  matchedAiFiles: FileChangeWithMatchStatus[]; // 匹配到的AI生成文件
  diffContent?: string;      // 差异内容
}

/**
 * Git分支信息接口
 */
export interface BranchInfo {
  currentBranch: string;     // 当前分支名称
  targetBranch: string;      // 目标分支名称（通常是master）
  baseSha: string;           // 分支基础哈希
  latestSha: string;         // 最新提交哈希
  isMerged: boolean;         // 是否已合并到目标分支
  mergeBaseSha?: string;     // 合并基础哈希（如果已合并）
}

/**
 * MR数据库记录接口
 * 用于数据库模型定义
 */
export interface MRStatsRecord {
  id: string;                // MR统计唯一标识符
  appName?: string;          // 应用名称
  sourceBranch: string;      // 开发分支名称
  targetBranch: string;      // 目标分支名称
  
  // MR级别 AI代码文件采纳率
  totalMRFiles: number;      // MR阶段变更的总文件数
  includeAiCodeFiles: number;// MR阶段包含AI代码的文件数
  aiCodeFiles: number;       // AI生成的文件总数
  mrFileAcceptanceRate: number; // MR阶段AI变更文件维度采纳率百分比
  
  // MR级别 AI代码采纳率
  totalMRCodeLines: number;  // MR中总代码行数(或AI生成的代码行总数)
  includeAiCodeLines: number;// MR中被接受的代码行数
  mrCodeAcceptanceRate: number; // MR阶段AI代码采纳率百分比
  
  // 相关提交哈希列表
  relatedCommits: string;    // JSON格式的相关提交哈希列表
  
  // 时间信息
  createdAt: Date;           // MR创建时间
  mergedAt?: Date;           // MR合并时间
}

/**
 * 代码匹配结果接口
 */
export interface CodeMatchResult {
  isMatched: boolean;        // 是否匹配
  matchScore: number;        // 匹配分数 (0-1)
  matchedLines: number;      // 匹配的行数
  totalLines: number;        // 总行数
}

/**
 * MR统计上下文接口
 * 在统计过程中传递的上下文对象
 */
export interface MRStatisticsContext {
  branchInfo: BranchInfo;    // 分支信息
  mrFiles: MRFileChange[];   // MR文件变更
  aiFlowRecords: FlowRecord[]; // AI流程记录
  aiFileChanges: FileChange[]; // AI文件变更
  options: MRStatisticsOptions; // 统计选项
}