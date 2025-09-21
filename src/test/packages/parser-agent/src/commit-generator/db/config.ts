import { DatabaseConfig } from "./index";

/**
 * 环境类型
 */
export type Environment = "local" | "sit" | "staging" | "production";

const dataBaseSit = {
  username: 'codereview_rw',
  password: 'JYd3wcKskQPmgQ*E',
  database: 'codereview',
  host: 'mysql-wms-pressure-test-db01-master.int.xiaohongshu.com',
  port: 33071,
}

const dataBaseDefault = {
  username: 'commit_rw',
  password: 'RnLORUI7PnyV91*I',
  database: 'codereview',
  host: 'mysql-fls-internal-rs01-master.int.xiaohongshu.com',
  port: 33071,
}

/**
 * 数据库配置类
 */
export class CommitDBConfig {
  /**
   * 获取当前环境
   */
  static getEnvironment(): Environment {
    const env = process.env.NODE_ENV?.toLowerCase() || "local";
    switch (env) {
      case "production":
      case "prod":
        return "production";
      case "staging":
      case "stage":
        return "staging";
      case "sit":
        return "sit";
      default:
        return "local";
    }
  }

  /**
   * 数据库配置映射
   */
  private static database = {
    // local: dataBaseSit,
    // sit: dataBaseSit,
    local: dataBaseSit,
    sit: dataBaseSit,
    staging: dataBaseSit,
    production: dataBaseSit,
  };

  /**
   * 获取数据库配置
   */
  static getDatabaseConfig(env?: Environment): DatabaseConfig {
    const environment = env || CommitDBConfig.getEnvironment();
    return CommitDBConfig.database[environment];
  }

  /**
   * 是否启用调试模式
   */
  static isDebugMode(env?: Environment): boolean {
    const environment = env || CommitDBConfig.getEnvironment();
    return environment === "local" || process.env.DB_DEBUG === "true";
  }

  /**
   * 获取完整的初始化配置
   */
  static getInitConfig(env?: Environment): {
    config: DatabaseConfig;
    debug: boolean;
  } {
    const environment = env || CommitDBConfig.getEnvironment();
    const config = CommitDBConfig.getDatabaseConfig(environment);
    const debug = CommitDBConfig.isDebugMode(environment);

    console.log(`🔧 使用${environment}环境的数据库配置`);
    if (debug) {
      console.log(
        `📊 数据库配置: ${config.host}:${config.port}/${config.database}`
      );
    }

    return { config, debug };
  }
}
