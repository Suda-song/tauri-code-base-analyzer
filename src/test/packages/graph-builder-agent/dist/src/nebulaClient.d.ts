/**
 * 获取或创建Nebula Graph客户端
 */
export declare function getNebulaClient(): Promise<any>;
/**
 * 执行NGQL查询
 * @param query NGQL查询语句
 * @returns 查询结果
 */
export declare function executeNgql(query: string): Promise<any>;
/**
 * 释放客户端资源
 */
export declare function releaseResources(): Promise<void>;
