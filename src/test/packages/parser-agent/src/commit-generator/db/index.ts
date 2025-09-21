import { Sequelize } from "sequelize-typescript";
import * as path from "path";
import { Op } from "sequelize";
import { CommitRecordModel } from "../models/commit-record";
import { CommitEntityIndexModel } from "../models/commit-entity-index";
import { CommitDBConfig } from "./config";

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  dialect?: string;
}

const operatorsAliases = {
  $eq: Op.eq,
  $ne: Op.ne,
  $gte: Op.gte,
  $gt: Op.gt,
  $lte: Op.lte,
  $lt: Op.lt,
  $not: Op.not,
  $in: Op.in,
  $notIn: Op.notIn,
  $is: Op.is,
  $like: Op.like,
  $notLike: Op.notLike,
  $iLike: Op.iLike,
  $notILike: Op.notILike,
  $regexp: Op.regexp,
  $notRegexp: Op.notRegexp,
  $iRegexp: Op.iRegexp,
  $notIRegexp: Op.notIRegexp,
  $between: Op.between,
  $notBetween: Op.notBetween,
  $overlap: Op.overlap,
  $contains: Op.contains,
  $contained: Op.contained,
  $adjacent: Op.adjacent,
  $strictLeft: Op.strictLeft,
  $strictRight: Op.strictRight,
  $noExtendRight: Op.noExtendRight,
  $noExtendLeft: Op.noExtendLeft,
  $and: Op.and,
  $or: Op.or,
  $any: Op.any,
  $all: Op.all,
  $values: Op.values,
  $col: Op.col,
};

// 导出sequelize，用于mr-statistics包访问
export let sequelize: Sequelize;

/**
 * 数据库连接管理类
 */
export class CommitDB {
  public static sequelize: Sequelize;
  private static isInitialized: boolean = false;

  /**
   * 初始化数据库连接
   */
  public static async initDB(
    config: DatabaseConfig,
    debug: boolean = false
  ): Promise<void> {
    if (CommitDB.isInitialized) {
      return;
    }

    console.log("🔗 初始化commit数据库连接...");

    CommitDB.sequelize = new Sequelize({
      database: config.database,
      username: config.username,
      password: config.password,
      host: config.host,
      port: config.port,
      dialect: "mysql",
      operatorsAliases,
      timezone: "+08:00",
      logging: debug ? console.log : false,
    });

    // 赋值给导出的sequelize实例，便于其他模块使用
    sequelize = CommitDB.sequelize;

    // 显式添加模型（避免在VSCode扩展打包环境中的路径问题）
    CommitDB.sequelize.addModels([CommitRecordModel, CommitEntityIndexModel]);
    


    try {
      await CommitDB.sequelize.authenticate();
      console.log("✅ commit数据库连接成功");
      CommitDB.isInitialized = true;
    } catch (error: any) {
      (error as any).message = `DB connection error: ${(error as any).message}`;
      throw error;
    }
  }

  /**
   * 检查数据库是否已初始化
   */
  public static isInitializedCheck(): boolean {
    return CommitDB.isInitialized;
  }

  /**
   * 获取Sequelize实例
   */
  public static getInstance(): Sequelize {
    if (!CommitDB.isInitialized) {
      throw new Error("数据库未初始化，请先调用 initDB");
    }
    return CommitDB.sequelize;
  }

  /**
   * 关闭数据库连接
   */
  public static async close(): Promise<void> {
    if (CommitDB.sequelize) {
      await CommitDB.sequelize.close();
      CommitDB.isInitialized = false;
      console.log("🔒 commit数据库连接已关闭");
    }
  }
}

// 导出配置类
export { CommitDBConfig };
