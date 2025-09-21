export interface WorkspacePackageInfo {
    name: string;
    path: string;
    relativePath: string;
}
export interface WorkspaceMappingOptions {
    includeDevDependencies?: boolean;
    includePeerDependencies?: boolean;
    maxDepth?: number;
}
/**
 * 获取当前工程依赖的所有workspace包路径映射
 */
export declare function getWorkspacePackageMappings(projectRoot: string, options?: WorkspaceMappingOptions): WorkspacePackageInfo[];
/**
 * 获取workspace包中变更的文件列表
 */
export declare function getWorkspaceChangedFiles(projectRoot: string, gitChangedFiles: string[], options?: WorkspaceMappingOptions): string[];
//# sourceMappingURL=workspace-mapper.d.ts.map