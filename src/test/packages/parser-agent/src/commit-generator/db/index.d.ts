import { Sequelize } from "sequelize-typescript";
export interface DatabaseConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    dialect?: string;
}
export declare let sequelize: Sequelize;
/**
 * 数据库连接管理类
 */
export declare class CommitDB {
    static sequelize: Sequelize;
    private static isInitialized;
    /**
     * 初始化数据库连接
     */
    static initDB(config: DatabaseConfig, debug?: boolean): Promise<void>;
    /**
     * 获取Sequelize实例
     */
    static getInstance(): Sequelize;
    /**
     * 关闭数据库连接
     */
    static close(): Promise<void>;
}
