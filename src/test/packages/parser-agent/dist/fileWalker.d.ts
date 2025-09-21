/**
 * 向上查找workspace配置文件
 */
declare function findWorkspaceRoot(startDir: string): string | null;
/**
 * 获取项目实际依赖的workspace包信息
 */
declare function getWorkspaceInfo(rootDir: string): {
    packageNames: string[];
    packagePaths: string[];
};
export declare function extractAllEntities(rootDir: string, targetFiles?: string[]): Promise<any[]>;
/**
 * 生成智能搜索路径 - 保持原有逻辑 + 动态补充
 */
declare function generateIntelligentSearchPaths(workspaceRoot: string, packageName: string): string[];
/**
 * 构建真实的workspace包映射
 */
declare function buildRealWorkspacePackageMap(workspaceRoot: string): Map<string, string>;
export { findWorkspaceRoot, buildRealWorkspacePackageMap, getWorkspaceInfo, generateIntelligentSearchPaths };
