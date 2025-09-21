import { Node } from 'ts-morph';
export interface BaseEntity {
    id: string;
    type: string;
    file: string;
    loc: {
        start: number;
        end?: number;
    };
    rawName: string;
}
/**
 * 通用实体ID生成器
 * 为所有extractor和StaticAnalyzer提供一致的ID生成逻辑
 */
export declare class EntityIdGenerator {
    private static entityMap;
    private static fileTypeCache;
    private static parentPathCandidatesCache;
    private static finalResultCache;
    /**
     * 初始化实体映射（供StaticAnalyzer使用）
     */
    static initEntityMap(entities: BaseEntity[]): void;
    /**
     * 生成实体ID - 标准模式（用于extractor）
     * @param filePath 文件路径
     * @param entityName 实体名称
     * @param isDefaultExport 是否是默认导出
     * @param entityNode AST节点（用于类型分析）
     * @param isJSXContext 是否在JSX上下文中
     */
    static generateId(filePath: string, entityName: string, isDefaultExport?: boolean, entityNode?: Node, isJSXContext?: boolean): {
        id: string;
        type: string;
        idPrefix: string;
    };
    /**
     * 生成实体ID - 查找模式（用于StaticAnalyzer）
     * @param filePath 文件路径
     * @param entityName 实体名称
     * @param isDefaultExport 是否是默认导出
     * @param rootDir 根目录（用于转换为相对路径）
     */
    static generateIdByLookup(filePath: string, entityName: string, isDefaultExport?: boolean, rootDir?: string): string;
    /**
     * 通过AST节点分析实体类型
     */
    private static analyzeNodeType;
    /**
     * 通过文件内容分析实体类型
     */
    private static analyzeEntityTypeFromFile;
    /**
     * 在父路径中搜索实体（处理嵌套导出的情况）
     */
    private static searchInParentPaths;
    /**
     * 获取指定父路径下的候选实体（带第一层缓存）
     */
    private static getParentPathCandidates;
    /**
     * 在候选实体中查找匹配的实体
     */
    private static findMatchingEntity;
    /**
     * 查找目录的入口文件
     */
    private static findEntryFile;
    /**
     * 在文件中查找特定实体
     */
    private static findEntityInFile;
    /**
     * 回退类型生成（基于命名规范）
     */
    private static fallbackTypeGeneration;
    /**
     * 清理缓存
     */
    static clearCache(): void;
}
