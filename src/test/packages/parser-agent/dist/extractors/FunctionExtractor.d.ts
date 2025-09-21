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
export declare class FunctionExtractor {
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
    static extractFunctions(sourceFile: any, relativePath: string, entities: BaseEntity[]): void;
    static extractClasses(sourceFile: any, relativePath: string, entities: BaseEntity[]): void;
    static extractVariables(sourceFile: any, relativePath: string, entities: BaseEntity[]): void;
    static extractExports(sourceFile: any, relativePath: string, entities: BaseEntity[]): void;
    /**
     * 在当前文件中查找本地实体信息
     */
    private static findLocalEntity;
}
export {};
