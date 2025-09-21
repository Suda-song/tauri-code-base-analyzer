/**
 * 获取工作空间路径
 * 按照以下优先级顺序：
 * 1. process.env.CODE_RESEARCH_WORKSPACE_PATH
 * 2. 从shell配置文件读取CODE_RESEARCH_WORKSPACE_PATH变量
 * 3. process.env.CURSOR_WORKSPACE_PATH
 * 4. process.cwd()
 *
 * @returns 工作空间路径
 */
export declare function getWorkspacePath(): string;
/**
 * 获取entities文件的完整路径
 * @param filename 文件名，默认为 'entities.enriched.json'
 * @param workspacePath 可选的工作空间路径，如果不提供则自动获取
 * @returns entities文件的完整路径
 */
export declare function getEntitiesFilePath(filename?: string, workspacePath?: string): string;
//# sourceMappingURL=workspace-path.d.ts.map