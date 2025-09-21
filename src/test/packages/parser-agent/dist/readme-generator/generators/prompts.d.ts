/**
 * AI 提示词配置管理
 *
 * 这个模块将所有的AI提示词集中管理，与业务逻辑完全分离，提高了代码的可维护性。
 * 采用策略模式设计，每种分析场景都有对应的提示词模板，支持灵活的参数化配置。
 *
 * 设计原则：
 * - 职责分离：提示词管理与业务逻辑分离
 * - 参数化：所有提示词支持动态参数注入
 * - 可扩展：新增分析场景只需添加新的提示词模板
 * - 类型安全：完整的TypeScript类型定义
 *
 * 支持的分析场景：
 * - 项目架构概览分析
 * - 目录详细分析
 * - 综合分析报告
 * - 业务组件分析
 */
import { ProjectAnalysis } from '../types';
import { BaseEntity } from './types';
/**
 * 提示词模板数据接口
 *
 * 定义了架构概览分析所需的所有数据结构，确保提示词生成时有完整的上下文信息。
 */
export interface PromptTemplateData {
    /** 项目基础分析结果，包含技术栈、文件统计等信息 */
    analysis: ProjectAnalysis;
    /** 过滤后的代码实体列表，排除workspace级别的抽象实体 */
    entities: BaseEntity[];
    /** 可选的自定义业务需求描述，AI会重点关注这些要求 */
    customContent?: string;
    /** 架构分析器的输出结果，包含架构模式识别等信息 */
    architectureResult?: any;
    /** 核心类型分析结果，包含项目的主要数据模型信息 */
    coreTypesAnalysis?: string;
    /** Mermaid图表数据，用于可视化项目结构 */
    mermaidDiagrams?: any[];
}
/**
 * 目录分析提示词数据接口
 *
 * 定义了目录级别分析所需的数据结构，专注于单个目录的深度分析。
 */
export interface DirectoryPromptData {
    /** 目录基本信息，包含路径、用途、文件数量等 */
    dir: {
        path: string;
        fullPath?: string;
        purpose: string;
        fileCount: number;
    };
    /** 该目录下的代表性实体，经过筛选的高质量样本 */
    representativeEntities: BaseEntity[];
    /** 文件到实体的映射关系，便于理解文件结构 */
    fileEntries: [string, BaseEntity[]][];
    /** 可选的自定义业务需求描述 */
    customContent?: string;
}
/**
 * AI 提示词模板类
 *
 * 核心的提示词生成器，采用静态方法设计，无状态且线程安全。
 * 每个方法负责生成特定场景下的AI提示词，确保AI分析的质量和一致性。
 */
export declare class PromptTemplates {
    /**
     * 生成项目架构概览分析提示词
     *
     * 这是最重要的提示词模板之一，用于指导AI生成全面的项目架构分析。
     * 提示词设计遵循AI工程最佳实践，包含清晰的角色定义、详细的上下文信息、
     * 明确的输出要求和结构化的分析框架。
     *
     * 提示词特色：
     * - 角色扮演：让AI扮演资深软件架构师角色
     * - 多维分析：从DDD、架构模式、技术栈等多个角度分析
     * - 上下文丰富：包含项目信息、实体数据、图表信息等
     * - 业务导向：支持自定义业务需求的特别关注
     *
     * @param data 包含项目分析所需的完整数据集
     * @returns 结构化的AI提示词，指导生成架构概览分析
     */
    static generateArchitectureOverviewPrompt(data: PromptTemplateData): string;
    /**
     * 生成目录详细分析提示词
     *
     * 这个提示词模板用于指导AI对单个目录进行深入的代码分析和结构化报告。
     * 它包含了丰富的上下文信息，如目录路径、目的、文件数量、实体列表等，
     * 以及详细的实体属性（名称、类型、文件、导入、调用等）和文件-实体映射。
     *
     * 提示词特色：
     * - 上下文丰富：提供完整的目录信息和实体数据
     * - 实体详细：展示每个实体的详细属性，便于理解
     * - 文件-实体映射：清晰展示文件与实体的对应关系
     * - 业务导向：支持自定义业务需求的特别关注
     *
     * @param data 包含目录分析所需的数据
     * @returns 结构化的AI提示词，指导生成目录详细分析
     */
    static generateDirectoryAnalysisPrompt(data: DirectoryPromptData, isRoute?: boolean): string;
    /**
     * 生成综合分析报告提示词
     *
     * 这个提示词模板用于指导AI生成一个综合性的技术文档报告，
     * 将架构概览、详细代码分析、路由分析、数据流分析等不同维度的分析结果
     * 整合到一个完整的报告中。
     *
     * 提示词特色：
     * - 多维度整合：将不同分析结果有机整合
     * - 结构清晰：采用清晰的标题和层级
     * - 业务导向：强调分析结果与业务需求的关联
     * - 输出格式规范：提供标准的Markdown格式输出
     *
     * @param data 包含所有分析组件的数据
     * @returns 结构化的AI提示词，指导生成综合分析报告
     */
    static generateComprehensiveAnalysisPrompt(data: {
        architectureOverview: string;
        detailedCodeAnalysis: string;
        routeAnalysis: string;
        dataFlowAnalysis: string;
        mermaidDiagrams: any;
        analysis: ProjectAnalysis;
        entities: BaseEntity[];
        customContent?: string;
    }): string;
    /**
     * 生成业务组件分析提示词
     *
     * 这个提示词模板用于指导AI从业务视角分析项目中的组件，
     * 识别哪些组件直接服务于业务需求，以及它们之间的关联关系。
     *
     * 提示词特色：
     * - 业务导向：强调组件与业务需求的关联
     * - 组件详细：展示每个组件的详细信息，便于理解
     * - 关联关系：分析组件之间的集成点和依赖关系
     * - 业务影响评估：评估组件对业务连续性和优化的影响
     *
     * @param data 包含业务组件分析所需的数据
     * @returns 结构化的AI提示词，指导生成业务组件分析
     */
    static generateBusinessComponentAnalysisPrompt(data: {
        entities: BaseEntity[];
        customContent?: string;
    }): string;
}
