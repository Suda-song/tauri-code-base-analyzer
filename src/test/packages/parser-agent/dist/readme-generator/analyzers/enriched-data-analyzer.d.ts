/**
 * Enriched 数据分析器 - 处理 entities.enriched.json 数据
 */
import { EnrichedEntity, SpecialMeaningAnalysis, FolderStandardAnalysis, EnhancedDirectoryInfo } from '../types';
/**
 * Enriched 数据分析器
 */
export declare class EnrichedDataAnalyzer {
    private projectPath;
    private enrichedEntities;
    private enrichedDataPath;
    constructor(projectPath: string);
    /**
     * 加载 enriched 数据
     */
    loadEnrichedData(): Promise<EnrichedEntity[]>;
    /**
     * 基于 enriched 数据生成目录语义描述
     */
    generateDirectorySemantics(): Map<string, EnhancedDirectoryInfo>;
    /**
     * 按目录分组实体
     */
    private groupEntitiesByDirectory;
    /**
     * 生成目录语义描述
     */
    private generateDirectorySemanticDescription;
    /**
     * 生成增强的目录用途描述
     */
    private generateEnrichedPurpose;
    /**
     * 提取共同主题
     */
    private extractCommonThemes;
    /**
     * 检测目录特殊工程含义
     */
    private detectDirectorySpecialMeaning;
    /**
     * 获取模式含义映射
     */
    private getPatternMeanings;
    /**
     * 分析特殊工程含义
     */
    analyzeSpecialMeanings(): SpecialMeaningAnalysis;
    /**
     * 计算文件重要性
     */
    private calculateFileImportance;
    /**
     * 获取文件特殊含义
     */
    private getFileSpecialMeaning;
    /**
     * 识别工程模式
     */
    private identifyEngineeringPatterns;
    /**
     * 分析文件夹规范
     */
    analyzeFolderStandards(): FolderStandardAnalysis;
    /**
     * 生成推荐标准
     */
    private generateRecommendedStandard;
    /**
     * 计算合规性得分
     */
    private calculateComplianceScore;
    /**
     * 获取目录下的文件
     */
    private getDirectoryFiles;
    /**
     * 获取主要文件类型
     */
    private getMainFileTypes;
    /**
     * 计算目录重要性
     */
    private calculateDirectoryImportance;
    /**
     * 检查是否包含页面组件
     */
    private containsPages;
    /**
     * 检查是否包含服务
     */
    private containsServices;
    /**
     * 检查是否包含工具函数
     */
    private containsUtils;
    /**
     * 生成建议
     */
    private generateRecommendations;
    /**
     * 获取 enriched 实体数据
     */
    getEnrichedEntities(): EnrichedEntity[];
    /**
     * 根据文件路径获取实体
     */
    getEntityByFile(filePath: string): EnrichedEntity | undefined;
    /**
     * 根据类型获取实体
     */
    getEntitiesByType(type: string): EnrichedEntity[];
    /**
     * 根据标签获取实体
     */
    getEntitiesByTag(tag: string): EnrichedEntity[];
}
