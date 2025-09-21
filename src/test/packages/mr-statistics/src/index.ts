/**
 * index.ts
 * MR统计功能的主入口文件
 */

// 导出服务
export { MRStatisticsService } from './services/mr-statistics-service';
export { CodeMatcher } from './utils/code-matcher';
export { BranchInfoService } from './git/branch-info';

// 导出数据库操作
export { 
  MRManager, 
  saveMRStats, 
  getMRStats, 
  getLatestMRStatsByBranch, 
  getMRStatsList 
} from './db/mr-manager';

// 导出模型和接口
export { MRStatsModel } from './models/mr-stats';
export { 
  MRStatisticsOptions, 
  MRStatisticsResult, 
  MRStatsRecord, 
  BranchInfo, 
  FileChangeWithMatchStatus, 
  MRFileChange, 
  CodeMatchResult 
} from './models/interfaces';

// 导出命令行工具
export { run } from './cli';

/**
 * 计算并保存MR统计数据的便捷函数
 * @param options MR统计选项
 */
export async function calculateAndSaveMRStats(options: {
  sourceBranch?: string;
  targetBranch?: string;
  thresholds?: {
    fileMatch: number;
    codeMatch: number;
  };
} = {}): Promise<string> {
  // 导入服务和函数，解决循环引用问题
  const { MRStatisticsService } = require('./services/mr-statistics-service');
  const { saveMRStats } = require('./db/mr-manager');

  const service = new MRStatisticsService(options);
  const result = await service.calculateMRStatistics();
  return await saveMRStats(result);
}