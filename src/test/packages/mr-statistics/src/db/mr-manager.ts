/**
 * mr-manager.ts
 * MR统计记录管理器
 */

import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { MRStatsModel } from '../models/mr-stats';
import { MRStatisticsResult, MRStatsRecord } from '../models/interfaces';
import { getSequelize, Sequelize } from '../imports';
import { getHttpClient } from '../services/http-client';

/**
 * MR统计记录管理器类
 * 提供MR统计数据的CRUD操作
 */
export class MRManager {
  private static isInitialized: boolean = false;
  private static useHttpMode: boolean = false;

  /**
   * 设置HTTP模式
   */
  public static setHttpMode(enabled: boolean): void {
    MRManager.useHttpMode = enabled;
    console.log(`🔧 MRManager模式设置: ${enabled ? 'HTTP' : '数据库'}`);
  }

  /**
   * 初始化管理器
   */
  public static async initialize(): Promise<void> {
    if (MRManager.isInitialized) {
      return;
    }
    
    if (MRManager.useHttpMode) {
      console.log('✅ MRManager HTTP模式初始化完成');
      MRManager.isInitialized = true;
      return;
    }
    
    try {
      // 获取独立的sequelize实例（会自动初始化数据库和模型）
      await getSequelize();
      
      MRManager.isInitialized = true;
      console.log('✅ MRManager数据库模式初始化完成');
    } catch (error) {
      console.error('❌ MRManager初始化失败:', error);
      throw new Error(`MRManager初始化失败: ${error}`);
    }
  }

  /**
   * 保存MR统计记录
   * @param data MR统计结果
   * @returns 保存的记录ID
   */
  public static async saveMRStats(data: MRStatisticsResult): Promise<string> {
    if (!MRManager.isInitialized) {
      await MRManager.initialize();
    }
    
    console.log(`💾 保存MR统计记录: ${data.sourceBranch} -> ${data.targetBranch}`);
    
    if (MRManager.useHttpMode) {
      return await getHttpClient().saveMRStats(data);
    }
    
    try {
      const id = data.id || uuidv4();
      
      // 将相关提交信息转换为JSON格式
      const relatedCommits = JSON.stringify(data.relatedCommits.map(commit => ({
        hash: commit.hash,
        summary: commit.summary,
        timestamp: commit.timestamp
      })));
      
      // 转换为数据库模型格式
      const record: MRStatsRecord = {
        id,
        appName: data.appName,
        sourceBranch: data.sourceBranch,
        targetBranch: data.targetBranch,
        totalMRFiles: data.totalMRFiles,
        includeAiCodeFiles: data.includeAiCodeFiles,
        aiCodeFiles: data.aiCodeFiles,
        mrFileAcceptanceRate: data.mrFileAcceptanceRate,
        totalMRCodeLines: data.totalMRCodeLines,
        includeAiCodeLines: data.includeAiCodeLines,
        mrCodeAcceptanceRate: data.mrCodeAcceptanceRate,
        relatedCommits,
        createdAt: data.createdAt,
        mergedAt: data.mergedAt
      };
      
      // 保存或更新记录
      await MRStatsModel.upsert(record as any);
      
      console.log(`✅ MR统计记录保存成功: ${id}`);
      return id;
    } catch (error) {
      console.error(`❌ MR统计记录保存失败:`, error);
      throw new Error(`保存MR统计记录失败: ${error}`);
    }
  }

  /**
   * 获取MR统计记录
   * @param id 记录ID
   * @returns MR统计结果
   */
  public static async getMRStats(id: string): Promise<MRStatisticsResult | null> {
    if (!MRManager.isInitialized) {
      await MRManager.initialize();
    }
    
    if (MRManager.useHttpMode) {
      return await getHttpClient().getMRStats(id);
    }
    
    try {
      // 查询记录
      const record = await MRStatsModel.findByPk(id);
      
      if (!record) {
        console.log(`⚠️ 未找到ID为 ${id} 的MR统计记录`);
        return null;
      }
      
      // 将数据库记录转换为MR统计结果
      return MRManager.convertToResult(record);
    } catch (error) {
      console.error(`❌ 获取MR统计记录失败:`, error);
      return null;
    }
  }

  /**
   * 获取分支的最新MR统计记录
   * @param sourceBranch 源分支名称
   * @param targetBranch 目标分支名称
   * @returns MR统计结果
   */
  public static async getLatestMRStatsByBranch(
    sourceBranch: string,
    targetBranch: string = 'master'
  ): Promise<MRStatisticsResult | null> {
    if (!MRManager.isInitialized) {
      await MRManager.initialize();
    }
    
    if (MRManager.useHttpMode) {
      return await getHttpClient().getLatestMRStatsByBranch(sourceBranch, targetBranch);
    }
    
    try {
      // 查询最新的记录
      const record = await MRStatsModel.findOne({
        where: {
          sourceBranch,
          targetBranch
        },
        order: [['createdAt', 'DESC']]
      });
      
      if (!record) {
        console.log(`⚠️ 未找到分支 ${sourceBranch} -> ${targetBranch} 的MR统计记录`);
        return null;
      }
      
      // 将数据库记录转换为MR统计结果
      return MRManager.convertToResult(record);
    } catch (error) {
      console.error(`❌ 获取分支MR统计记录失败:`, error);
      return null;
    }
  }

  /**
   * 获取MR统计记录列表
   * @param options 查询选项
   * @returns MR统计结果列表
   */
  public static async getMRStatsList(options: {
    sourceBranch?: string;
    targetBranch?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<MRStatisticsResult[]> {
    if (!MRManager.isInitialized) {
      await MRManager.initialize();
    }
    
    if (MRManager.useHttpMode) {
      return await getHttpClient().getMRStatsList(options);
    }
    
    try {
      // 构建查询条件
      const where: any = {};
      if (options.sourceBranch) {
        where.sourceBranch = options.sourceBranch;
      }
      if (options.targetBranch) {
        where.targetBranch = options.targetBranch;
      }
      
      // 查询记录
      const records = await MRStatsModel.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: options.limit || 10,
        offset: options.offset || 0
      });
      
      // 将数据库记录转换为MR统计结果
      return records.map(record => MRManager.convertToResult(record));
    } catch (error) {
      console.error(`❌ 获取MR统计记录列表失败:`, error);
      return [];
    }
  }

  /**
   * 删除MR统计记录
   * @param id 记录ID
   * @returns 是否成功
   */
  public static async deleteMRStats(id: string): Promise<boolean> {
    if (!MRManager.isInitialized) {
      await MRManager.initialize();
    }
    
    if (MRManager.useHttpMode) {
      return await getHttpClient().deleteMRStats(id);
    }
    
    try {
      // 删除记录
      const result = await MRStatsModel.destroy({
        where: { id }
      });
      
      return result > 0;
    } catch (error) {
      console.error(`❌ 删除MR统计记录失败:`, error);
      return false;
    }
  }

  /**
   * 将数据库记录转换为MR统计结果
   * @param record 数据库记录
   * @returns MR统计结果
   */
  private static convertToResult(record: MRStatsModel): MRStatisticsResult {
    // 解析相关提交信息
    const relatedCommits = (() => {
      try {
        const json = record.getDataValue('relatedCommits');
        return typeof json === 'string' ? JSON.parse(json) : [];
      } catch (e) {
        console.warn('解析relatedCommits失败:', e);
        return [];
      }
    })();
    
    return {
      id: record.id,
      appName: record.appName,
      sourceBranch: record.sourceBranch,
      targetBranch: record.targetBranch,
      totalMRFiles: record.totalMRFiles,
      includeAiCodeFiles: record.includeAiCodeFiles,
      aiCodeFiles: record.aiCodeFiles,
      mrFileAcceptanceRate: record.mrFileAcceptanceRate,
      totalMRCodeLines: record.totalMRCodeLines,
      includeAiCodeLines: record.includeAiCodeLines,
      mrCodeAcceptanceRate: record.mrCodeAcceptanceRate,
      relatedCommits,
      createdAt: record.createdAt,
      mergedAt: record.mergedAt
    };
  }
}

/**
 * 便捷函数：保存MR统计记录
 */
export async function saveMRStats(data: MRStatisticsResult): Promise<string> {
  return await MRManager.saveMRStats(data);
}

/**
 * 便捷函数：获取MR统计记录
 */
export async function getMRStats(id: string): Promise<MRStatisticsResult | null> {
  return await MRManager.getMRStats(id);
}

/**
 * 便捷函数：获取分支的最新MR统计记录
 */
export async function getLatestMRStatsByBranch(
  sourceBranch: string,
  targetBranch: string = 'master'
): Promise<MRStatisticsResult | null> {
  return await MRManager.getLatestMRStatsByBranch(sourceBranch, targetBranch);
}

/**
 * 便捷函数：获取MR统计记录列表
 */
export async function getMRStatsList(options: {
  sourceBranch?: string;
  targetBranch?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<MRStatisticsResult[]> {
  return await MRManager.getMRStatsList(options);
}

export default MRManager;