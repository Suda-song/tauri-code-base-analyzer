/**
 * README 生成器相关类型定义
 */
/**
 * 项目分析结果接口
 */
export interface ProjectAnalysis {
    projectName: string;
    projectPath: string;
    packageInfo: any;
    projectType: string;
    structure: ProjectStructure;
    codeStats: CodeStats;
    dependencies: DependencyAnalysis;
    technologies: string[];
    mainEntries: string[];
    testFiles: string[];
    configFiles: string[];
    documentation: string[];
    entities: any[];
    architecture: ArchitectureAnalysis;
    bestPractices: BestPracticeAnalysis;
}
/**
 * 项目结构分析
 */
export interface ProjectStructure {
    totalFiles: number;
    totalDirectories: number;
    directories: DirectoryInfo[];
    enhancedDirectories?: EnhancedDirectoryInfo[];
    keyFiles: KeyFileInfo[];
    fileDistribution: {
        [key: string]: number;
    };
}
/**
 * 目录信息
 */
export interface DirectoryInfo {
    path: string;
    purpose: string;
    fileCount: number;
    subDirectories: number;
    mainFileTypes: string[];
    importance: number;
}
/**
 * 关键文件信息
 */
export interface KeyFileInfo {
    path: string;
    type: string;
    purpose: string;
    size: number;
    complexity: number;
    importance: number;
}
/**
 * 代码统计
 */
export interface CodeStats {
    totalLines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
    averageComplexity: number;
    fileTypeStats: {
        [key: string]: FileTypeStats;
    };
}
/**
 * 文件类型统计
 */
export interface FileTypeStats {
    count: number;
    lines: number;
    avgComplexity: number;
}
/**
 * 依赖分析
 */
export interface DependencyAnalysis {
    production: string[];
    development: string[];
    frameworksAndLibraries: string[];
    buildTools: string[];
    testingFrameworks: string[];
    uiLibraries: string[];
    stateManagement: string[];
    routing: string[];
}
/**
 * 架构分析
 */
export interface ArchitectureAnalysis {
    pattern: string;
    layers: string[];
    dataFlow: string;
    componentStructure: ComponentStructure;
    apiStructure: ApiStructure;
}
/**
 * 组件结构分析
 */
export interface ComponentStructure {
    totalComponents: number;
    componentsByType: {
        [key: string]: number;
    };
    componentHierarchy: any[];
    sharedComponents: string[];
}
/**
 * API结构分析
 */
export interface ApiStructure {
    endpoints: any[];
    methods: string[];
    dataModels: string[];
    authentication: string[];
}
/**
 * 最佳实践分析
 */
export interface BestPracticeAnalysis {
    score: number;
    strengths: string[];
    improvements: string[];
    recommendations: string[];
    codeQuality: CodeQualityMetrics;
}
/**
 * 代码质量指标
 */
export interface CodeQualityMetrics {
    testCoverage: number;
    documentationCoverage: number;
    codeReusability: number;
    maintainability: number;
    performance: number;
}
/**
 * AI 生成的洞察内容
 */
export interface AIInsights {
    architectureInsights: string;
    usageGuide: string;
    developmentGuide: string;
    deploymentGuide: string;
    routeAnalysis?: string;
}
/**
 * 生成器配置选项
 */
export interface GeneratorOptions {
    template: string;
    language: string;
    outputPath?: string;
    preview?: boolean;
    force?: boolean;
    verbose?: boolean;
}
/**
 * === 新增：增强功能相关类型定义 ===
 */
/**
 * Enriched 实体数据结构
 */
export interface EnrichedEntity {
    id: string;
    type: string;
    file: string;
    loc: any;
    rawName: string;
    isDDD: boolean;
    IMPORTS: string[];
    CALLS: string[];
    EMITS: string[];
    TEMPLATE_COMPONENTS: string[];
    summary: string;
    tags: string[];
    ANNOTATION: string;
}
/**
 * 路由配置分析结果
 */
export interface RouteAnalysis {
    routeConfigPath: string;
    totalRoutes: number;
    pageComponents: PageComponentInfo[];
    routeTree: RouteNode[];
    routeConfig: RouteNode[];
}
/**
 * 页面组件信息
 */
export interface PageComponentInfo {
    name: string;
    path: string;
    componentPath: string;
    meta?: any;
    isLazy: boolean;
    parentRoute?: string;
    children?: PageComponentInfo[];
}
/**
 * 路由节点
 */
export interface RouteNode {
    path: string;
    name?: string;
    componentPath?: string;
    meta?: any;
    children?: RouteNode[];
}
/**
 * 数据流转分析结果
 */
export interface DataFlowAnalysis {
    pageFlows: PageDataFlow[];
    mermaidDiagram: string;
    apiCalls: ApiCallInfo[];
    stateManagement: StateManagementInfo[];
    componentInteractions: ComponentInteraction[];
}
/**
 * 页面数据流转
 */
export interface PageDataFlow {
    pageName: string;
    pageFile: string;
    imports: string[];
    apiCalls: string[];
    stateAccess: string[];
    componentUsage: string[];
    navigationTargets: string[];
    dataFlow: DataFlowStep[];
}
/**
 * 数据流转步骤
 */
export interface DataFlowStep {
    from: string;
    to: string;
    type: 'api' | 'state' | 'component' | 'navigation' | 'data';
    description: string;
}
/**
 * API调用信息
 */
export interface ApiCallInfo {
    name: string;
    method: string;
    endpoint?: string;
    usedInPages: string[];
    dataFlow: string;
}
/**
 * 状态管理信息
 */
export interface StateManagementInfo {
    name: string;
    type: 'store' | 'hook' | 'context';
    filePath: string;
    usedInPages: string[];
}
/**
 * 组件交互信息
 */
export interface ComponentInteraction {
    component: string;
    usedInPages: string[];
    interactions: string[];
}
/**
 * 特殊工程含义分析
 */
export interface SpecialMeaningAnalysis {
    criticalDirectories: CriticalDirectoryInfo[];
    criticalFiles: CriticalFileInfo[];
    engineeringPatterns: EngineeringPattern[];
    recommendations: string[];
}
/**
 * 关键目录信息
 */
export interface CriticalDirectoryInfo {
    path: string;
    specialMeaning: string;
    importance: number;
    reason: string;
    detectionMethod: 'pattern' | 'tags' | 'content';
    relatedFiles: string[];
}
/**
 * 关键文件信息
 */
export interface CriticalFileInfo {
    path: string;
    specialMeaning: string;
    importance: number;
    reason: string;
    detectionMethod: 'pattern' | 'tags' | 'content';
    tags: string[];
}
/**
 * 工程模式
 */
export interface EngineeringPattern {
    pattern: string;
    description: string;
    examples: string[];
    benefits: string[];
}
/**
 * 文件夹规范分析
 */
export interface FolderStandardAnalysis {
    recommendedStandards: FolderStandard[];
    userCustomStandards: FolderStandard[];
    conflictResolution: StandardConflict[];
    complianceScore: number;
}
/**
 * 文件夹规范
 */
export interface FolderStandard {
    path: string;
    purpose: string;
    expectedFileTypes: string[];
    namingConvention: string;
    organizationRule: string;
    examples: string[];
    priority: 'system' | 'user';
}
/**
 * 规范冲突
 */
export interface StandardConflict {
    path: string;
    systemRecommendation: string;
    userCustomization: string;
    resolution: 'use_user' | 'use_system' | 'merge';
}
/**
 * 增强的项目分析结果（扩展原有的 ProjectAnalysis）
 */
export interface EnhancedProjectAnalysis extends ProjectAnalysis {
    enrichedEntities: EnrichedEntity[];
    routeAnalysis?: RouteAnalysis;
    dataFlowAnalysis?: DataFlowAnalysis;
    specialMeaningAnalysis: SpecialMeaningAnalysis;
    folderStandardAnalysis: FolderStandardAnalysis;
}
/**
 * 增强的目录信息（扩展原有的 DirectoryInfo）
 */
export interface EnhancedDirectoryInfo extends DirectoryInfo {
    semanticDescription: string;
    enrichedPurpose: string;
    specialMeaning?: string;
    folderStandard?: FolderStandard;
    containsPages: boolean;
    containsServices: boolean;
    containsUtils: boolean;
}
/**
 * 增强的AI洞察（扩展原有的 AIInsights）
 */
export interface EnhancedAIInsights extends AIInsights {
    dataFlowInsights: string;
    folderOrganizationInsights: string;
    specialMeaningHighlights: string;
    mcpContextInfo: string;
}
