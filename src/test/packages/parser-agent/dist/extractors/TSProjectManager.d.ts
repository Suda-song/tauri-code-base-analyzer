import { Project } from 'ts-morph';
/**
 * 通用 TypeScript 项目管理器
 * 提供单例模式的 ts-morph Project 实例和多层缓存机制
 * 适用于所有需要 TypeScript 解析的提取器
 */
export declare class TSProjectManager {
    private static instance;
    private project;
    private sourceFileCache;
    private extractionCache;
    private maxCacheSize;
    private constructor();
    /**
     * 获取单例实例
     */
    static getInstance(maxCacheSize?: number): TSProjectManager;
    /**
     * 获取 ts-morph Project 实例
     */
    getProject(): Project;
    /**
     * 获取带缓存的源文件
     * @param filePath 文件路径
     * @param content 文件内容（可选，如果不提供会自动读取）
     * @returns 源文件实例或null
     */
    getSourceFile(filePath: string, content?: string): any;
    /**
     * 检查提取缓存
     * @param filePath 文件路径
     * @param extractorType 提取器类型（用于区分不同提取器的缓存）
     */
    getCachedExtraction<T = any>(filePath: string, extractorType: string): T[] | null;
    /**
     * 设置提取缓存
     * @param filePath 文件路径
     * @param extractorType 提取器类型
     * @param entities 提取的实体
     */
    setCachedExtraction<T = any>(filePath: string, extractorType: string, entities: T[]): void;
    /**
     * 清理所有缓存
     */
    clearCache(): void;
    /**
     * 清理特定提取器的缓存
     */
    clearExtractorCache(extractorType: string): void;
    /**
     * 获取缓存统计信息
     */
    getCacheStats(): {
        sourceFileCount: number;
        extractionCacheCount: number;
        estimatedMemoryUsage: string;
    };
    /**
     * 检查源文件是否需要更新
     */
    private shouldUpdateSourceFile;
    /**
     * 创建并缓存源文件
     */
    private createAndCacheSourceFile;
    /**
     * 获取文件修改时间
     */
    private getFileModTime;
    /**
     * 检查文件是否已变更
     */
    private isFileChanged;
    /**
     * 检查并清理缓存
     */
    private checkAndCleanCache;
}
/**
 * 获取全局 TSProjectManager 实例的便捷函数
 */
export declare function getTSProjectManager(maxCacheSize?: number): TSProjectManager;
/**
 * 清理全局缓存的便捷函数
 */
export declare function clearTSCache(): void;
