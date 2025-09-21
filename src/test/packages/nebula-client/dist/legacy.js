/**
 * 向后兼容的函数接口
 * 保持与原有代码的兼容性
 */
import { NebulaClient } from './client';
// 创建默认实例
let defaultClient = null;
/**
 * 获取默认客户端实例
 */
export function getDefaultClient() {
    if (!defaultClient) {
        defaultClient = new NebulaClient();
    }
    return defaultClient;
}
// 导出兼容的函数接口，保持向后兼容
export async function connectNebula() {
    return getDefaultClient().connect();
}
export async function executeNgql(query) {
    return getDefaultClient().executeNgql(query);
}
export async function releaseResources() {
    return getDefaultClient().disconnect();
}
export function isConnected() {
    return getDefaultClient().isConnected();
}
export function getSessionId() {
    return getDefaultClient().getSessionId();
}
//# sourceMappingURL=legacy.js.map