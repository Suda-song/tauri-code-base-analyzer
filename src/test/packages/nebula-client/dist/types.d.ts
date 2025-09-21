/**
 * Nebula Client 类型定义
 */
export interface NebulaClientOptions {
    gatewayHost?: string;
    nebulaHost?: string;
    nebulaPort?: number;
    username?: string;
    password?: string;
    space?: string;
}
export interface ConnectRequest {
    username: string;
    password: string;
    address: string;
    port: number;
}
export interface ExecRequest {
    gql: string;
}
export interface NebulaResponse<T = any> {
    code: number;
    message: string;
    data?: T;
}
export interface QueryResult {
    error: null | string;
    data: any[];
    timeCost: number;
}
export interface ClientConfig {
    gatewayHost: string;
    nebulaHost: string;
    nebulaPort: number;
    username: string;
    space: string;
}
//# sourceMappingURL=types.d.ts.map