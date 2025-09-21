/**
 * 向后兼容的函数接口
 * 保持与原有代码的兼容性
 */
import { NebulaClient } from './client';
import { QueryResult } from './types';
/**
 * 获取默认客户端实例
 */
export declare function getDefaultClient(): NebulaClient;
export declare function connectNebula(): Promise<void>;
export declare function executeNgql(query: string): Promise<QueryResult>;
export declare function releaseResources(): Promise<void>;
export declare function isConnected(): boolean;
export declare function getSessionId(): string | null;
//# sourceMappingURL=legacy.d.ts.map