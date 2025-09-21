/**
 * 向后兼容的函数接口
 * 保持与原有代码的兼容性
 */
import { NebulaClient } from './client';
import { QueryResult } from './types';

// 创建默认实例
let defaultClient: NebulaClient | null = null;

/**
 * 获取默认客户端实例
 */
export function getDefaultClient(): NebulaClient {
  if (!defaultClient) {
    defaultClient = new NebulaClient();
  }
  return defaultClient;
}

// 导出兼容的函数接口，保持向后兼容
export async function connectNebula(): Promise<void> {
  return getDefaultClient().connect();
}

export async function executeNgql(query: string): Promise<QueryResult> {
  return getDefaultClient().executeNgql(query);
}

export async function releaseResources(): Promise<void> {
  return getDefaultClient().disconnect();
}

export function isConnected(): boolean {
  return getDefaultClient().isConnected();
}

export function getSessionId(): string | null {
  return getDefaultClient().getSessionId();
} 