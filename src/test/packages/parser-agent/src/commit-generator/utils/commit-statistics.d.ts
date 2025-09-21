/**
 * 文件变更记录接口
 */
export interface FileChange {
    change_id: string;
    flow_id: string;
    file_path: string;
    branch_name: string;
    user_name: string;
    change_type: string;
    lines_added: number;
    lines_deleted: number;
    lines_modified: number;
    total_changed_lines: number;
    change_details?: string;
    created_at: string;
}
/**
 * Flow记录接口
 */
export interface FlowRecord {
    flow_id: string;
    user_name: string;
    project_name: string;
    branch_name: string;
    task_context?: string;
    last_commit_hash: string;
    duration_ms?: number;
    rate?: number;
    subtask_description?: string;
    route_info?: string;
    change_type: string;
    change_content?: string;
    flow_summary?: string;
    extend?: any;
    total_operations: number;
    accepted_operations: number;
    tool_calls?: any[];
    created_at: Date;
    updated_at: Date;
}
/**
 * Commit统计数据接口
 */
export interface CommitStatistics {
    totalFiles: number;
    includeAiCodeFiles: number;
    aiCodeFiles: number;
    fileAcceptanceRate: number;
    totalCodeLines: number;
    includeAiCodeLines: number;
    aiCodeLines: number;
    codeAcceptanceRate: number;
    lastCommitHash: string;
}
/**
 * Commit统计服务
 * 计算与AI代码采纳相关的统计数据
 */
export declare class CommitStatisticsService {
    /**
     * 通过SQL查询Flow记录
     * 根据last_commit_hash查询关联的Flow记录
     */
    private static queryFlowsWithAcceptanceRate;
    /**
     * 通过SQL查询文件变更记录
     * 根据flow_id查询关联的文件变更记录
     */
    private static getFileChangesByFlowId;
    /**
     * 获取上一次提交的哈希值
     * @param currentHash 当前提交哈希
     * @returns 上一次提交的哈希值
     */
    static getPreviousCommitHash(currentHash: string): Promise<string>;
    /**
     * 计算Commit的统计数据
     * @param commitHash 当前提交哈希
     * @param branchName 分支名称
     * @param filesChanged 变更的文件列表
     * @param codeLinesAdded 新增的代码行数
     * @param codeLinesDeleted 删除的代码行数
     * @returns Commit统计数据
     */
    static calculateCommitStatistics(commitHash: string, branchName: string, filesChanged: string[], codeLinesAdded: number, codeLinesDeleted: number): Promise<CommitStatistics>;
    /**
     * 获取默认统计数据，使用-1表示特殊值
     */
    private static getDefaultStatistics;
    /**
     * 计算文件级采纳率
     */
    private static calculateFileAcceptance;
    /**
     * 计算代码行级采纳率
     * 使用change_details字段中的diff信息进行精确计算
     */
    private static calculateCodeAcceptance;
    /**
     * 解析diff信息，提取添加和删除的行数
     */
    private static parseDiffLines;
}
