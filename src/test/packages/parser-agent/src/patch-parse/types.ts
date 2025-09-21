import { BaseEntity } from '../enrichment/interfaces';

// 任务进度接口
export interface TaskProgress {
  totalFiles: number;      // 总文件数（包含基础文件数量）
  processedFiles: number;  // 已处理文件数
  processingFiles: string[]; // 正在处理的文件列表
  pendingFiles: number;    // 待处理文件数
  percentage: number;      // 完成百分比
  workspace?: string;      // 对应的工作空间路径（可选）
}

// 处理选项接口
export interface ProcessOptions {
  rootDir?: string;
  concurrency?: number;
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
  baseFileCount?: number; // 基础文件数量，默认100
  commitHash?: string; // 可选的commit hash，用于获取指定commit的变更文件
}

// 文件实体映射接口
export interface FileEntityMapping {
  file: string;            // 文件路径
  entities: BaseEntity[];  // 该文件的实体列表
  relativePath: string;    // 相对路径
} 