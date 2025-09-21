import { TaskProgress } from './types';

// 任务队列管理器（支持多实例）
export class TaskQueueManager {
  private taskQueue: Set<string> = new Set();
  private processingQueue: Set<string> = new Set();
  private totalProcessed: number = 0;
  private callback: ((progress: TaskProgress) => void) | null = null;
  private isPaused: boolean = false;
  private baseFileCount: number = 100;
  private isProcessing: boolean = false;
  private workspace: string; // 对应的工作空间路径

  constructor(workspace: string = process.cwd()) {
    this.workspace = workspace;
  }

  // 保持向后兼容的静态方法（已废弃，建议使用 WorkspaceManager）
  static getInstance(): TaskQueueManager {
    console.warn('⚠️ TaskQueueManager.getInstance() 已废弃，建议使用 WorkspaceManager');
    return new TaskQueueManager();
  }

  setCallback(callback: (progress: TaskProgress) => void): void {
    this.callback = callback;
  }

  setBaseFileCount(count: number): void {
    this.baseFileCount = count;
  }

  addFiles(files: string[]): void {
    // 处理文件去重：移除队列中已存在的文件，保留新的
    const newFiles = new Set(files);
    
    // 从taskQueue中移除重复的文件
    const toRemove = new Set<string>();
    this.taskQueue.forEach(existingFile => {
      if (newFiles.has(existingFile)) {
        toRemove.add(existingFile);
      }
    });
    toRemove.forEach(file => this.taskQueue.delete(file));
    
    // 添加新文件到队列
    files.forEach(file => this.taskQueue.add(file));
    
    console.log(`📋 添加 ${files.length} 个文件到队列，当前队列大小: ${this.taskQueue.size}`);
    this.notifyProgress();
  }

  /**
   * 从队列中移除指定文件（支持删除场景）
   * @param files 要移除的文件列表
   */
  removeFiles(files: string[]): void {
    if (files.length === 0) return;
    
    let removedCount = 0;
    files.forEach(file => {
      if (this.taskQueue.has(file)) {
        this.taskQueue.delete(file);
        removedCount++;
      }
      if (this.processingQueue.has(file)) {
        this.processingQueue.delete(file);
        removedCount++;
      }
    });
    
    if (removedCount > 0) {
      console.log(`🗑️ 从队列中移除 ${removedCount} 个文件，当前队列大小: ${this.taskQueue.size}`);
      this.notifyProgress();
    }
  }

  getNextBatch(batchSize: number = 5): string[] {
    if (this.isPaused) {
      return [];
    }

    const batch = Array.from(this.taskQueue).slice(0, batchSize);
    batch.forEach(file => {
      this.taskQueue.delete(file);
      this.processingQueue.add(file);
    });
    return batch;
  }

  markFileCompleted(file: string): void {
    this.processingQueue.delete(file);
    this.totalProcessed++;
    this.notifyProgress();
  }

  pause(): void {
    this.isPaused = true;
    console.log('⏸️ 任务队列已暂停');
  }

  resume(): void {
    this.isPaused = false;
    console.log('▶️ 任务队列已恢复');
  }

  isPausedState(): boolean {
    return this.isPaused;
  }

  hasWork(): boolean {
    return this.taskQueue.size > 0 || this.processingQueue.size > 0;
  }

  isProcessingState(): boolean {
    return this.isProcessing;
  }

  setProcessing(processing: boolean): void {
    this.isProcessing = processing;
  }

  getProgress(): TaskProgress {
    const totalFiles = this.baseFileCount + this.totalProcessed + this.taskQueue.size + this.processingQueue.size;
    const processedFiles = this.baseFileCount + this.totalProcessed;
    const percentage = totalFiles > 0 ? (processedFiles / totalFiles) * 100 : 0;

    return {
      totalFiles,
      processedFiles,
      processingFiles: [...Array.from(this.processingQueue), ...Array.from(this.taskQueue)],
      pendingFiles: this.taskQueue.size,
      percentage: Math.round(percentage * 100) / 100,
      workspace: this.workspace
    };
  }

  notifyProgress(): void {
    if (this.callback) {
      this.callback(this.getProgress());
    }
  }

  reset(): void {
    this.taskQueue.clear();
    this.processingQueue.clear();
    this.totalProcessed = 0;
    this.isPaused = false;
    this.isProcessing = false;
    this.callback = null;
    this.baseFileCount = 100;
  }
} 