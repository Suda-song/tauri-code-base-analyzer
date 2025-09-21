/**
 * mr-stats-db.ts
 * MR统计独立的数据库连接管理
 */

import { Sequelize } from 'sequelize-typescript';
import { MRStatsModel } from '../models/mr-stats';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

/**
 * MR统计数据库连接管理类
 */
export class MRStatsDB {
  private static sequelize: Sequelize;
  private static isInitialized: boolean = false;

  /**
   * 初始化数据库连接
   */
  public static async initDB(config: DatabaseConfig, debug: boolean = false): Promise<void> {
    if (MRStatsDB.isInitialized) {
      return;
    }

    console.log('🔗 初始化MR统计数据库连接...');

    MRStatsDB.sequelize = new Sequelize({
      database: config.database,
      username: config.username,
      password: config.password,
      host: config.host,
      port: config.port,
      dialect: 'mysql',
      timezone: '+08:00',
      logging: debug ? console.log : false,
      dialectOptions: {
        connectTimeout: 20000,  // 20秒连接超时
        acquireTimeout: 20000   // 20秒获取连接超时
      }
    });

    // 添加MRStatsModel
    MRStatsDB.sequelize.addModels([MRStatsModel]);

    try {
      await MRStatsDB.sequelize.authenticate();
      console.log('✅ MR统计数据库连接成功');
      
      // 同步MRStatsModel表
      await MRStatsModel.sync();
      
      MRStatsDB.isInitialized = true;
    } catch (error: any) {
      console.error('❌ MR统计数据库连接失败:', error);
      console.log('⚠️ 跳过数据库操作，继续执行其他功能');
      
      // 临时标记为已初始化，避免重复尝试
      MRStatsDB.isInitialized = true;
      
      // 不抛出错误，允许程序继续执行
      return;
    }
  }

  /**
   * 获取Sequelize实例
   */
  public static async getInstance(): Promise<Sequelize> {
    if (!MRStatsDB.isInitialized) {
      // 自动初始化数据库
      const { config, debug } = await MRStatsDB.getConfig();
      await MRStatsDB.initDB(config, debug);
    }
    return MRStatsDB.sequelize;
  }

  /**
   * 获取数据库配置
   */
  private static async getConfig(): Promise<{ config: DatabaseConfig; debug: boolean }> {
    // 使用本地的配置系统
    const { CommitDBConfig } = await import('./commit-db-config');
    return CommitDBConfig.getInitConfig();
  }

  /**
   * 关闭数据库连接
   */
  public static async close(): Promise<void> {
    if (MRStatsDB.sequelize) {
      await MRStatsDB.sequelize.close();
      MRStatsDB.isInitialized = false;
      console.log('🔒 MR统计数据库连接已关闭');
    }
  }
}
