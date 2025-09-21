/**
 * 增强项目结构分析器 - 基于 enriched 数据的目录结构分析
 */
import { ProjectStructure, EnhancedDirectoryInfo, EnrichedEntity, SpecialMeaningAnalysis, FolderStandardAnalysis } from '../types';
import { EnrichedDataAnalyzer } from './enriched-data-analyzer';
/**
 * 增强项目结构分析器
 */
export declare class EnhancedProjectStructureAnalyzer {
    private projectPath;
    private enrichedAnalyzer;
    private enrichedEntities;
    private directorySemanticsMap;
    constructor(projectPath: string, enrichedAnalyzer: EnrichedDataAnalyzer);
    /**
     * 分析项目结构（增强版）
     */
    analyze(): Promise<ProjectStructure & {
        enhancedDirectories: EnhancedDirectoryInfo[];
        specialMeaningAnalysis: SpecialMeaningAnalysis;
        folderStandardAnalysis: FolderStandardAnalysis;
    }>;
    /**
     * 分析基础项目结构
     */
    private analyzeBasicStructure;
    /**
     * 增强目录信息
     */
    private enhanceDirectoryInfo;
    /**
     * 生成基础语义描述
     */
    private generateBasicSemanticDescription;
    /**
     * 获取目录统计信息
     */
    getDirectoryStats(): {
        totalDirectories: number;
        directoriesWithSpecialMeaning: number;
        directoriesWithEnrichedData: number;
        complianceScore: number;
    };
    /**
     * 获取关键目录信息
     */
    getCriticalDirectories(): EnhancedDirectoryInfo[];
    /**
     * 获取特定类型的目录
     */
    getDirectoriesByType(type: 'pages' | 'services' | 'utils'): EnhancedDirectoryInfo[];
    /**
     * 生成目录树结构
     */
    generateDirectoryTree(): string;
    /**
     * 生成目录摘要报告
     */
    generateDirectorySummary(): string;
    private calculateFileComplexity;
    private containsPages;
    private containsServices;
    private containsUtils;
    /**
     * 获取目录的 enriched 实体
     */
    getDirectoryEntities(dirPath: string): EnrichedEntity[];
    /**
     * 获取目录语义映射
     */
    getDirectorySemantics(): Map<string, EnhancedDirectoryInfo>;
    /**
     * 根据路径获取目录信息
     */
    getDirectoryInfo(dirPath: string): EnhancedDirectoryInfo | undefined;
}
