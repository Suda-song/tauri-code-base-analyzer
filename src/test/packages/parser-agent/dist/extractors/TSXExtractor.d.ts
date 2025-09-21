interface BaseEntity {
    id: string;
    type: string;
    file: string;
    loc: {
        start: number;
        end: number;
    };
    rawName: string;
}
export declare class TSXExtractor {
    private static readonly EXTRACTOR_TYPE;
    private static tsManager;
    static extract(filePath: string, rootDir: string): BaseEntity[];
    /**
     * 清理提取器缓存
     */
    static clearCache(): void;
    /**
     * 获取提取器缓存统计
     */
    static getCacheStats(): {
        sourceFileCount: number;
        extractionCacheCount: number;
        estimatedMemoryUsage: string;
    };
    /**
     * 提取函数声明
     */
    private static extractFunctions;
    /**
     * 提取类声明
     */
    private static extractClasses;
    /**
     * 提取变量声明
     */
    private static extractVariables;
    /**
     * 提取导出声明
     */
    private static extractExports;
    /**
     * 在当前文件中查找本地实体信息
     */
    private static findLocalEntity;
}
export {};
