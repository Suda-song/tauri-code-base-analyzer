/**
 * 项目分析器 - 负责分析项目的各个方面
 */
import { ProjectStructure, CodeStats, DependencyAnalysis, ArchitectureAnalysis, BestPracticeAnalysis } from '../types';
/**
 * 项目结构分析器
 */
export declare class ProjectStructureAnalyzer {
    private projectPath;
    constructor(projectPath: string);
    /**
     * 分析项目结构
     */
    analyze(): Promise<ProjectStructure>;
}
/**
 * 代码统计分析器
 */
export declare class CodeStatsAnalyzer {
    private projectPath;
    private entities;
    constructor(projectPath: string, entities: any[]);
    /**
     * 分析代码统计信息
     */
    analyze(): CodeStats;
}
/**
 * 依赖分析器
 */
export declare class DependencyAnalyzer {
    /**
     * 分析依赖关系
     */
    analyze(packageInfo: any): DependencyAnalysis;
}
/**
 * 技术栈分析器
 */
export declare class TechnologyStackAnalyzer {
    private entities;
    constructor(entities: any[]);
    /**
     * 识别技术栈
     */
    analyze(packageInfo: any, structure: ProjectStructure): string[];
}
/**
 * 架构分析器
 */
export declare class ArchitectureAnalyzer {
    private entities;
    constructor(entities: any[]);
    /**
     * 分析架构模式
     */
    analyze(): Promise<ArchitectureAnalysis>;
    /**
     * 分析组件结构
     */
    private analyzeComponentStructure;
    /**
     * 分析API结构
     */
    private analyzeApiStructure;
    /**
     * 推断架构模式
     */
    private inferArchitecturePattern;
    /**
     * 识别架构层次
     */
    private identifyArchitectureLayers;
    /**
     * 分析数据流
     */
    private analyzeDataFlow;
    /**
     * 判断是否为共享组件
     */
    private isSharedComponent;
    /**
     * 判断是否为服务函数
     */
    private isServiceFunction;
    /**
     * 判断是否有某个层
     */
    private hasLayer;
}
/**
 * 最佳实践分析器
 */
export declare class BestPracticesAnalyzer {
    private projectPath;
    private entities;
    constructor(projectPath: string, entities: any[]);
    /**
     * 分析最佳实践
     */
    analyze(): Promise<BestPracticeAnalysis>;
    /**
     * 评估代码质量
     */
    private evaluateCodeQuality;
    /**
     * 查找测试文件
     */
    private findTestFiles;
    /**
     * 计算注释比例
     */
    private calculateCommentRatio;
    /**
     * 计算代码复用性
     */
    private calculateCodeReusability;
    /**
     * 计算可维护性
     */
    private calculateMaintainability;
    /**
     * 评估性能
     */
    private evaluatePerformance;
    /**
     * 计算平均文件大小
     */
    private calculateAverageFileSize;
    /**
     * 识别项目类型
     */
    static identifyProjectType(packageInfo: any, structure: ProjectStructure, dependencies: DependencyAnalysis): string;
}
