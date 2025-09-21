import { TaskProgress, ProcessOptions } from './types';
export { TaskProgress, ProcessOptions };
/**
 * 初始化任务队列（设置回调）
 * @param callback 进度回调函数
 * @param options 处理选项
 * @param force 是否强制重新初始化，默认false
 */
export declare function initializeTaskQueue(callback: (progress: TaskProgress) => void, options?: ProcessOptions, force?: boolean): void;
/**
 * 添加文件到处理队列（支持删除文件处理）
 * @param files 变更文件路径列表
 * @param deletedFiles 删除文件路径列表
 * @param options 处理选项
 */
export declare function addFilesToQueueWithDeletion(files: string[], deletedFiles?: string[], options?: ProcessOptions): Promise<void>;
/**
 * 添加文件到处理队列（不支持删除文件）
 * @param files 变更文件路径列表
 * @param options 处理选项
 */
export declare function addFilesToQueue(files: string[], options?: ProcessOptions): Promise<void>;
/**
 * 添加git变更文件到处理队列（包含删除文件处理）
 * @param options 处理选项（可选的rootDir，优先使用全局实例）
 */
export declare function addGitChangedFilesToQueue(options?: ProcessOptions): Promise<void>;
/**
 * 开始处理任务队列（只做富化处理）
 * @param options 处理选项
 */
export declare function startTaskQueue(options?: ProcessOptions): Promise<void>;
/**
 * 暂停任务队列
 */
export declare function pauseTaskQueue(): void;
/**
 * 恢复任务队列
 */
export declare function resumeTaskQueue(options?: ProcessOptions): Promise<void>;
/**
 * 获取当前任务进度
 */
export declare function getTaskProgress(): TaskProgress;
/**
 * 重置任务队列
 */
export declare function resetTaskQueue(): void;
/**
 * 获取文件实体映射状态（用于调试）
 */
export declare function getFileEntityMappings(): Map<string, import("./types").FileEntityMapping>;
export declare function getCurrentInitConfig(): {
    rootDir: string;
    baseFileCount?: number;
} | null;
