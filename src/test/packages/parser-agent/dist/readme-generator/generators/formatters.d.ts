/**
 * 模板格式化器 - 统一的格式化逻辑管理
 *
 * 这个模块将所有的格式化逻辑和模板字符串集中管理，实现了完全的关注点分离。
 * 所有的Markdown模板、数据格式化、结构化输出都在这里统一处理，
 * 使业务逻辑代码更加清晰，模板修改更加便捷。
 *
 * 设计理念：
 * - 职责分离：格式化逻辑与业务逻辑完全分离
 * - 统一管理：所有模板字符串集中在一个地方
 * - 可重用性：格式化方法可在多个地方复用
 * - 类型安全：完整的TypeScript类型定义
 *
 * 支持的格式化场景：
 * - 路由分析结果格式化
 * - 数据流分析结果格式化
 * - 项目目录结构模板
 * - 统计表格生成
 * - README文档构建
 * - 各种回退模板
 */
import { ProjectAnalysis, AIInsights } from '../types';
import { BaseEntity } from './types';
import { AIDocumentGenerator } from './ai-generator';
import { EnhancedRouteAnalysisResult } from '../analyzers/route-config-analyzer';
/**
 * 路由分析数据接口
 *
 * 定义了路由分析结果的数据结构，用于类型安全的格式化处理。
 */
export interface RouteAnalysisData {
    /** 路由配置文件的路径 */
    routeConfigPath?: string;
    /** 项目中的路由总数 */
    totalRoutes?: number;
    /** 页面组件列表，包含路由路径、组件路径、元数据等信息 */
    pageComponents?: Array<{
        name: string;
        path: string;
        componentPath: string;
        meta?: {
            title?: string;
        };
    }>;
}
/**
 * 数据流分析数据接口
 *
 * 定义了数据流分析结果的数据结构，包含页面流转、API调用、状态管理等信息。
 */
export interface DataFlowAnalysisData {
    /** 页面数据流列表，描述每个页面的数据处理情况 */
    pageFlows?: Array<{
        pageName: string;
        pageFile: string;
        apiCalls?: any[];
        stateAccess?: any[];
        componentUsage?: any[];
    }>;
    /** 全局API调用统计 */
    apiCalls?: any[];
    /** 状态管理相关信息 */
    stateManagement?: any[];
    /** Mermaid格式的数据流图表 */
    mermaidDiagram?: string;
}
/**
 * 目录信息接口
 *
 * 定义了目录的基本信息结构，用于目录级别的分析和格式化。
 */
export interface DirectoryInfo {
    /** 目录路径 */
    path: string;
    /** 目录的业务用途或技术职责 */
    purpose: string;
    /** 目录下的文件数量 */
    fileCount: number;
}
/**
 * 模板格式化器类
 *
 * 提供了项目文档生成所需的所有格式化方法，采用静态方法设计，
 * 无状态且线程安全，所有方法都专注于特定的格式化任务。
 */
export declare class TemplateFormatters {
    /**
     * 格式化路由分析结果
     *
     * 将路由分析的原始数据转换为结构化的Markdown格式，
     * 包含路由配置概览和详细的页面组件列表。
     *
     * 格式化内容：
     * - 路由配置文件路径
     * - 路由总数统计
     * - 页面组件详细列表（路径、组件、标题等）
     *
     * @param routeResult 路由分析的原始数据，如果为null则返回提示信息
     * @returns 格式化后的Markdown文本，包含完整的路由分析报告
     */
    static formatRouteAnalysis(routeResult: RouteAnalysisData | null, routePageAnalysis: string): string;
    /**
     * 格式化增强的路由分析结果
     *
     * 以路由入口文件为维度，生成更有可读性的分析报告
     *
     * @param enhancedResult 增强的路由分析结果
     * @returns 格式化后的Markdown文本
     */
    static formatEnhancedRouteAnalysis(enhancedResult: EnhancedRouteAnalysisResult): string;
    /**
     * 格式化单个路由文件的分析 - 按用户期望的格式
     */
    private static formatSingleRouteFile;
    /**
     * 判断目录是否与路由相关
     */
    private static isRelatedToRoute;
    /**
     * 从组件关系数据中提取特定目录的依赖信息
     */
    private static extractDirectoryDependencies;
    /**
     * 按关系类型分组路径维度数据
     */
    private static groupPathDataByType;
    /**
     * 获取关系类型的显示名称
     */
    private static getRelationTypeDisplayName;
    /**
     * 格式化数据流分析结果
     *
     * 将数据流分析的原始数据转换为结构化的Markdown格式，
     * 包含数据流概览、Mermaid图表和页面数据流详细列表。
     *
     * 格式化内容：
     * - 页面数据流总数
     * - API调用总数
     * - 状态管理信息
     * - Mermaid图表（如果存在）
     * - 页面数据流详细列表（前5个）
     *
     * @param dataFlowResult 数据流分析的原始数据，如果为null则返回提示信息
     * @returns 格式化后的Markdown文本，包含完整的数据流分析报告
     */
    static formatDataFlowAnalysis(dataFlowResult: DataFlowAnalysisData | null): string;
    /**
     * 生成简单代码分析模板
     *
     * 生成一个简化的代码分析报告，包含前20个重要目录的概览。
     * 每个目录包含其目的、文件数量和检测到的实体数量。
     *
     * @param analysis 项目分析结果
     * @param entities 项目中的所有实体
     * @param directoryMap 目录路径到实体列表的映射
     * @param importantDirectories 排序后的重要目录列表
     * @returns 格式化后的Markdown文本，包含所有重要目录的概览
     */
    static generateSimpleCodeAnalysis(analysis: ProjectAnalysis, entities: BaseEntity[], directoryMap: Map<string, BaseEntity[]>, importantDirectories: DirectoryInfo[]): string;
    /**
     * 生成回退架构概览模板
     *
     * 生成一个回退的架构概览，包含项目基本信息、技术栈、文件数量、
     * 实体数量和目录数量。主要用于当详细分析不可用时提供一个基础概览。
     *
     * @param analysis 项目分析结果
     * @param entities 项目中的所有实体
     * @returns 格式化后的Markdown文本，包含回退的架构概览
     */
    static generateFallbackArchitectureOverview(analysis: ProjectAnalysis, entities: BaseEntity[]): string;
    /**
     * 生成回退目录分析模板
     *
     * 生成一个回退的目录分析模板，包含目录基本信息和检测到的实体。
     * 主要用于当详细分析不可用时提供一个基础目录分析。
     *
     * @param dir 目录信息
     * @param entities 目录中的实体列表
     * @returns 格式化后的Markdown文本，包含回退的目录分析
     */
    static generateFallbackDirectoryAnalysis(dir: DirectoryInfo, entities: BaseEntity[]): string;
    /**
     * 综合分析报告模板
     *
     * 构建一个综合的技术分析报告，包含架构概览、目录结构、路由分析、
     * 数据流分析等部分。所有部分都是可选的，只有当有数据时才生成。
     *
     * @param data 包含各个分析结果的对象
     * @returns 格式化后的Markdown文本，包含综合的技术分析报告
     */
    static buildComprehensiveReport(data: {
        architectureOverview: string;
        detailedCodeAnalysis: string;
        routeAnalysis: string;
        dataFlowAnalysis: string;
        mermaidDiagrams?: any;
    }): string;
    /**
     * 构建完整README模板
     *
     * 构建一个完整的README文档，包含项目概览、架构洞察、目录分析、
     * 自定义需求和项目亮点。所有部分都是可选的，只有当有数据时才生成。
     *
     * @param analysis 项目分析结果
     * @param insights AI洞察，包含架构洞察和使用指南
     * @param entities 项目中的所有实体
     * @param customContent 自定义的业务特定要求或注意事项
     * @returns 格式化后的Markdown文本，包含完整的README文档
     */
    static buildReadme(aiGenerator: AIDocumentGenerator, analysis: ProjectAnalysis, insights: AIInsights, entities: BaseEntity[], customContent?: string): string;
    /**
     * 生成回退README模板
     *
     * 生成一个回退的README模板，包含项目基本信息和分析状态。
     * 主要用于当详细分析不可用时提供一个基础项目概览。
     *
     * @param analysis 项目分析结果
     * @returns 格式化后的Markdown文本，包含回退的README
     */
    static generateFallbackReadme(analysis: ProjectAnalysis): string;
    /**
     * 生成空目录分析模板
     *
     * 生成一个表示目录为空的Markdown模板，包含目录路径和状态。
     * 主要用于当目录中没有检测到实体时。
     *
     * @param dir 目录信息
     * @returns 格式化后的Markdown文本，表示目录为空
     */
    static generateEmptyDirectoryAnalysis(dir: DirectoryInfo): string;
    /**
     * 生成无效实体目录分析模板
     *
     * 生成一个表示目录存在但未检测到有效实体的Markdown模板，
     * 包含目录路径和状态。主要用于当目录存在但无法提取实体时。
     *
     * @param dir 目录信息
     * @returns 格式化后的Markdown文本，表示目录存在但未检测到有效实体
     */
    static generateInvalidEntitiesDirectoryAnalysis(dir: DirectoryInfo): string;
    /**
     * 构建目录树结构模板
     *
     * 生成一个Mermaid格式的目录树结构模板，包含目录路径、文件数量、
     * 实体数量和目录用途。主要用于可视化项目结构。
     *
     * @param directories 目录信息列表
     * @param directoryMap 目录路径到实体列表的映射
     * @returns 格式化后的Mermaid代码，表示目录树结构
     */
    static buildDirectoryTree(directories: DirectoryInfo[], directoryMap: Map<string, BaseEntity[]>): string;
    /**
     * 生成项目架构图表模板
     *
     * 生成一个Markdown格式的项目架构图表模板，包含一个Mermaid图表。
     * 主要用于可视化项目的技术架构。
     *
     * @param mermaidDiagrams 包含Mermaid图表信息的数组
     * @returns 格式化后的Markdown文本，包含项目架构图表
     */
    static generateProjectStructureSection(mermaidDiagrams: any[]): string;
    /**
     * 生成自定义需求模板
     *
     * 生成一个Markdown格式的自定义需求模板，包含业务特定要求和
     * 重点关注事项。主要用于在README中添加特定的业务或技术要求。
     *
     * @param customContent 自定义的业务特定要求或注意事项
     * @returns 格式化后的Markdown文本，包含自定义需求
     */
    static generateCustomRequirementsSection(customContent?: string): string;
    /**
     * 格式化实体摘要
     *
     * 将实体列表按类型进行统计，并生成一个实体分布概览。
     * 主要用于在README中生成实体分布的Markdown表格。
     *
     * @param entities 项目中的所有实体
     * @returns 格式化后的Markdown文本，包含实体分布概览
     */
    private static formatEntitySummary;
}
