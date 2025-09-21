import { ProcessOptions, FileEntityMapping } from './types';
export declare class PatchParseProcessor {
    private taskManager;
    private fileProcessor;
    private entityManager;
    private gitProvider;
    private rootDir;
    private fileEntityMappings;
    private options;
    constructor(rootDir: string, options?: ProcessOptions);
    /**
     * 先解析更新 entities.json，然后添加到队列进行富化
     * @param files 要处理的文件列表
     * @param deletedFiles 要删除的文件列表
     * @param options 处理选项
     */
    parseAndEnrichFiles(files: string[], deletedFiles?: string[], options?: ProcessOptions): Promise<void>;
    /**
     * 处理删除文件：从所有相关位置移除
     * @param deletedFiles 删除的文件列表
     */
    private handleDeletedFiles;
    /**
     * 启动任务处理队列（文件维度并行批处理）
     */
    startProcessingQueue(options?: ProcessOptions): Promise<void>;
    /**
     * 获取完整实体列表
     */
    private getFullEntities;
    /**
     * 获取文件实体映射状态（用于调试）
     */
    getFileEntityMappings(): Map<string, FileEntityMapping>;
    /**
     * 清理文件实体映射状态
     */
    clearFileEntityMappings(): void;
    notifyProgress(): void;
}
