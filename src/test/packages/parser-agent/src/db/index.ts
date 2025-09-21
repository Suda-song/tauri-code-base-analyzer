import { Sequelize, QueryTypes } from "sequelize";

interface IDBConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

interface FlowNode {
  id: string;
  description: string;
  contains: string[];
}
/**
 * @class DB
 * @description 数据库操作工具类，封装了MySQL数据库连接和查询功能
 * @business 为parser-agent提供数据库访问能力，支持模块化开发流程的数据查询
 */

export class DB {
  public static sequelize: Sequelize;
  private static isConnected: boolean = false;

  /**
   * 初始化数据库连接
   * @param config 数据库配置
   * @param enableLogging 是否启用SQL日志
   */
  public static async initDB(
    config: IDBConfig,
    enableLogging: boolean = false
  ): Promise<void> {
    if (DB.isConnected) {
      console.log("数据库已连接，跳过重复初始化");
      return;
    }

    DB.sequelize = new Sequelize({
      database: config.database,
      username: config.username,
      password: config.password,
      host: config.host,
      port: config.port,
      dialect: "mysql",
      timezone: "+08:00",
      logging: enableLogging ? console.log : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    });

    try {
      await DB.sequelize.authenticate();
      DB.isConnected = true;
      // console.error("✅ 数据库连接成功");
    } catch (error) {
      console.error("❌ 数据库连接失败:", error);
      throw error;
    }
  }

  /**
   * 执行查询
   * @param sql SQL查询语句
   * @param replacements 参数替换
   * @returns 查询结果
   */
  public static async query(sql: string, replacements?: any[]): Promise<any[]> {
    if (!DB.isConnected) {
      throw new Error("数据库未连接，请先调用 initDB()");
    }

    try {
      const results = await DB.sequelize.query(sql, {
        replacements,
        type: QueryTypes.SELECT,
      });
      return results as any[];
    } catch (error) {
      console.error("查询执行失败:", error);
      throw error;
    }
  }

  /**
   * 关闭数据库连接
   */
  public static async close(): Promise<void> {
    if (DB.sequelize) {
      await DB.sequelize.close();
      DB.isConnected = false;
      console.log("数据库连接已关闭");
    }
  }

  /**
   * 查询flow节点信息
   */
  public static async searchFlowNode(Workspace: string): Promise<any[]> {
    if (!DB.isConnected) {
      throw new Error("数据库未连接，请先调用 initDB()");
    }
    const flowResults: FlowNode[] = [];
    const sql = `SELECT * FROM modular_dev_flow_relation_entities WHERE workspace LIKE '%${Workspace}%'`;
    const entitResults = await DB.query(sql);
    if (entitResults.length === 0) {
      return [];
    }
    for (const entities of entitResults) {
      const flowSql = `SELECT * FROM modular_dev_flow_records WHERE flow_id = '${entities.flow_id}'`;
      const flowResult = (await DB.query(flowSql))[0];
      flowResults.push({
        id: entities.flow_id,
        description: flowResult.flow_summary,
        contains: [...entities.entity_ids],
      });
    }
    return flowResults;
  }

  /**
   * 检查连接状态
   */
  public static isDBConnected(): boolean {
    return DB.isConnected;
  }
}
