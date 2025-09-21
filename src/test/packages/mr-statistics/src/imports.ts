/**
 * imports.ts
 * 提供MR统计包的数据库和类型导入
 */

// 导入Sequelize类型
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';

// 导入本地类型定义，不再从parser-agent包导入
import { FileChange, FlowRecord } from './types/file-changes';

// 导入本包的数据库管理
import { MRStatsDB } from './db/mr-stats-db';

// 获取sequelize实例的函数
async function getSequelize(): Promise<Sequelize> {
  return await MRStatsDB.getInstance();
}

export {
  getSequelize,
  FileChange,
  FlowRecord,
  Sequelize,
  QueryTypes
};