/**
 * Nebula Graph HTTP Gateway Client SDK
 *
 * @author XHS
 * @version 1.0.0
 */
// 导出主类
export { NebulaClient } from './client';
// 导出向后兼容的函数接口
export { getDefaultClient, connectNebula, executeNgql, releaseResources, isConnected, getSessionId } from './legacy';
// 默认导出主类
export { NebulaClient as default } from './client';
//# sourceMappingURL=index.js.map