/**
 * file-changes.ts
 * 文件变更类型定义
 */

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