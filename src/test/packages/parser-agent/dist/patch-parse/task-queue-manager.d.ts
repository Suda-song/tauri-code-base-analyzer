import { TaskProgress } from './types';
export declare class TaskQueueManager {
    private static instance;
    private taskQueue;
    private processingQueue;
    private totalProcessed;
    private callback;
    private isPaused;
    private baseFileCount;
    private isProcessing;
    private constructor();
    static getInstance(): TaskQueueManager;
    setCallback(callback: (progress: TaskProgress) => void): void;
    setBaseFileCount(count: number): void;
    addFiles(files: string[]): void;
    /**
     * 从队列中移除指定文件（支持删除场景）
     * @param files 要移除的文件列表
     */
    removeFiles(files: string[]): void;
    getNextBatch(batchSize?: number): string[];
    markFileCompleted(file: string): void;
    pause(): void;
    resume(): void;
    isPausedState(): boolean;
    hasWork(): boolean;
    isProcessingState(): boolean;
    setProcessing(processing: boolean): void;
    getProgress(): TaskProgress;
    notifyProgress(): void;
    reset(): void;
}
