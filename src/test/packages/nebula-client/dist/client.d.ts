import { NebulaClientOptions, QueryResult, ClientConfig } from './types';
/**
 * Nebula Graph HTTP Gateway 客户端类
 */
export declare class NebulaClient {
    private gatewayHost;
    private nebulaHost;
    private nebulaPort;
    private username;
    private password;
    private space;
    private sessionId;
    constructor(options?: NebulaClientOptions);
    /**
     * 连接到 Nebula Graph
     */
    connect(): Promise<void>;
    /**
     * 执行NGQL查询
     * @param query NGQL查询语句
     * @param retryCount 重试计数，防止无限递归
     * @returns 查询结果
     */
    executeNgql(query: string, retryCount?: number): Promise<QueryResult>;
    /**
     * 断开连接并释放资源
     */
    disconnect(): Promise<void>;
    /**
     * 获取连接状态
     */
    isConnected(): boolean;
    /**
     * 获取当前会话ID（用于调试）
     */
    getSessionId(): string | null;
    /**
     * 获取当前配置信息
     */
    getConfig(): ClientConfig;
}
//# sourceMappingURL=client.d.ts.map