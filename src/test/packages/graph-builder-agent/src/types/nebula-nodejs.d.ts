/**
 * Nebula Nodejs SDK类型声明
 */
declare module '@nebula-contrib/nebula-nodejs' {
  export interface ConnectionOptions {
    servers: string[];
    userName: string;
    password: string;
    space: string;
    poolSize?: number;
    bufferSize?: number;
    executeTimeout?: number;
    pingInterval?: number;
  }

  export interface NebulaResponse {
    error: string | null;
    data: any[];
    timeCost: number;
  }

  export interface NebulaClient {
    execute(query: string, original?: boolean): Promise<NebulaResponse>;
    close(): Promise<void>;
    on(event: string, callback: (data: any) => void): NebulaClient;
  }

  export function createClient(options: ConnectionOptions): NebulaClient;
  export function hash64(input: string): string[];
  export function bytesToLongLongString(buffer: number[]): string;
} 