/**
 * Nebula Graph HTTP Gateway Client SDK
 *
 * @author XHS
 * @version 1.0.0
 */
export { NebulaClient } from './client';
export type { NebulaClientOptions, ConnectRequest, ExecRequest, NebulaResponse, QueryResult, ClientConfig } from './types';
export { getDefaultClient, connectNebula, executeNgql, releaseResources, isConnected, getSessionId } from './legacy';
export { NebulaClient as default } from './client';
//# sourceMappingURL=index.d.ts.map