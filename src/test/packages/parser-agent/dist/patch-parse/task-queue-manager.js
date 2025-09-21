"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskQueueManager = void 0;
// 任务队列管理器（单例）
class TaskQueueManager {
    constructor() {
        this.taskQueue = new Set();
        this.processingQueue = new Set();
        this.totalProcessed = 0;
        this.callback = null;
        this.isPaused = false;
        this.baseFileCount = 100;
        this.isProcessing = false;
    }
    static getInstance() {
        if (!TaskQueueManager.instance) {
            TaskQueueManager.instance = new TaskQueueManager();
        }
        return TaskQueueManager.instance;
    }
    setCallback(callback) {
        this.callback = callback;
    }
    setBaseFileCount(count) {
        this.baseFileCount = count;
    }
    addFiles(files) {
        // 处理文件去重：移除队列中已存在的文件，保留新的
        const newFiles = new Set(files);
        // 从taskQueue中移除重复的文件
        const toRemove = new Set();
        for (const existingFile of this.taskQueue) {
            if (newFiles.has(existingFile)) {
                toRemove.add(existingFile);
            }
        }
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
    removeFiles(files) {
        if (files.length === 0)
            return;
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
    getNextBatch(batchSize = 5) {
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
    markFileCompleted(file) {
        this.processingQueue.delete(file);
        this.totalProcessed++;
        this.notifyProgress();
    }
    pause() {
        this.isPaused = true;
        console.log('⏸️ 任务队列已暂停');
    }
    resume() {
        this.isPaused = false;
        console.log('▶️ 任务队列已恢复');
    }
    isPausedState() {
        return this.isPaused;
    }
    hasWork() {
        return this.taskQueue.size > 0 || this.processingQueue.size > 0;
    }
    isProcessingState() {
        return this.isProcessing;
    }
    setProcessing(processing) {
        this.isProcessing = processing;
    }
    getProgress() {
        const totalFiles = this.baseFileCount + this.totalProcessed + this.taskQueue.size + this.processingQueue.size;
        const processedFiles = this.baseFileCount + this.totalProcessed;
        const percentage = totalFiles > 0 ? (processedFiles / totalFiles) * 100 : 0;
        return {
            totalFiles,
            processedFiles,
            processingFiles: [...Array.from(this.processingQueue), ...Array.from(this.taskQueue)],
            pendingFiles: this.taskQueue.size,
            percentage: Math.round(percentage * 100) / 100
        };
    }
    notifyProgress() {
        if (this.callback) {
            this.callback(this.getProgress());
        }
    }
    reset() {
        this.taskQueue.clear();
        this.processingQueue.clear();
        this.totalProcessed = 0;
        this.isPaused = false;
        this.isProcessing = false;
        this.callback = null;
        this.baseFileCount = 100;
    }
}
exports.TaskQueueManager = TaskQueueManager;
