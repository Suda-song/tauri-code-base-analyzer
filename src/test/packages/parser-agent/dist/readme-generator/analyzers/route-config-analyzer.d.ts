/**
 * 路由配置分析器 - AI驱动的页面路由解析和数据流转分析
 * 专注于页面路由的引入和调用关系，生成详细的数据流转图
 */
import { RouteAnalysis, EnrichedEntity } from '../types';
import { AIService } from '../generators/ai-service';
export interface RouteRelatedEntity {
    entity: EnrichedEntity;
    filePath: string;
    summary: string;
    aiGeneratedSummary?: string;
    relationType: 'route_component' | 'dependency' | 'api_service' | 'utility' | 'store' | 'other';
}
export interface PathDimensionData {
    filePath: string;
    entities: EnrichedEntity[];
    originalSummaries: string[];
    originalFilePaths: string[];
    aiGeneratedSummary?: string;
    relationType: RouteRelatedEntity['relationType'];
}
export interface DirectoryDependency {
    fromDirectory: string;
    toDirectory: string;
    dependencyType: 'import' | 'api_call' | 'utility' | 'component' | 'store';
    dependencyFiles: string[];
    dependencyCount: number;
}
export interface ComponentRelationsData {
    dependencies: DirectoryDependency[];
    summary: {
        totalDirectories: number;
        totalDependencies: number;
        routeComponentDirs: number;
        apiServiceDirs: number;
        utilityDirs: number;
        dependencyDirs: number;
    };
}
export interface EnhancedRouteAnalysisResult {
    routeAnalysis: RouteAnalysis | null;
    componentRelations: ComponentRelationsData;
    fileRelations: PathDimensionData[];
    totalRelatedFiles: number;
    totalRelatedEntities: number;
}
/**
 * AI驱动的路由配置分析器
 */
export declare class RouteConfigAnalyzer {
    private projectPath;
    private routeConfigPath;
    private routeConfig;
    private enrichedEntities;
    private aiService;
    private customRoutePath;
    constructor(projectPath: string, enrichedEntities?: EnrichedEntity[], aiService?: AIService, customContent?: string);
    /**
     * 设置enriched数据
     */
    setEnrichedEntities(entities: EnrichedEntity[]): void;
    /**
     * 解析customContent中的自定义路由路径
     */
    private parseCustomRoutePath;
    /**
     * 从项目中加载enriched entities数据
     */
    private loadEnrichedEntities;
    /**
     * 提取路由相关的实体
     */
    private extractRouteRelatedEntities;
    /**
     * 根据文件路径查找相关实体
     */
    private findRelatedEntitiesByPath;
    /**
     * 确定实体的关系类型
     */
    private determineRelationType;
    /**
     * 根据文件路径查找实体
     */
    private findEntityByFilePath;
    /**
     * 将实体维度数据转换为路径维度数据（按目录级别聚合）
     */
    private groupEntitiesByPath;
    /**
     * 使用AI生成目录功能总结
     */
    private generateFilePathSummaryWithAI;
    /**
     * 生成结构化的组件关系数据
     */
    private generateComponentRelationsWithAI;
    /**
     * 分析真实的目录依赖关系（基于import数据）
     */
    private analyzeRealDirectoryDependencies;
    /**
     * 确定依赖类型
     */
    private determineDependencyType;
    /**
     * 生成回退的组件关系数据
     */
    private generateFallbackComponentRelationsData;
    /**
     * 执行增强的路由分析，包含Component Relations和File Relations
     */
    analyzeEnhancedWithRelations(): Promise<EnhancedRouteAnalysisResult>;
    /**
     * AI驱动的路由分析（主要入口）
     */
    analyze(): Promise<RouteAnalysis | null>;
    /**
     * 查找路由配置文件
     */
    private findRouteConfigFile;
    /**
     * 使用AI解析页面路由（核心方法）
     */
    private parsePageRoutesWithAI;
    /**
     * 过滤和验证页面路由
     */
    private filterAndValidatePageRoutes;
    /**
     * 标准化组件路径
     */
    private normalizeComponentPath;
    /**
     * 判断是否为非页面路由
     */
    private isNonPageRoute;
    /**
     * 验证组件文件是否存在
     */
    private verifyComponentExists;
    /**
     * 从路由信息推断组件路径
     */
    private inferComponentPathFromRoute;
    /**
     * 基于路由路径推断组件路径
     */
    private inferFromRoutePath;
    /**
     * 基于路由名称推断组件路径
     */
    private inferFromRouteName;
    /**
     * 标准化路由信息
     */
    private standardizeRoute;
    /**
     * 分析并读取导入的路由文件
     */
    private analyzeImportedRoutes;
    /**
     * 解析导入路径为绝对路径
     */
    private resolveImportPath;
    /**
     * 获取项目上下文信息供AI分析使用
     */
    private getProjectContextForAI;
    /**
     * 获取项目结构信息
     */
    private getProjectStructure;
    /**
     * 从enriched数据中获取已知组件
     */
    private getKnownComponentsFromEnriched;
    /**
     * 构建路由树
     */
    private buildRouteTree;
    /**
     * 生成页面名称
     */
    private generatePageName;
    /**
     * 提取页面组件信息
     */
    private extractPageComponents;
    /**
     * 根据文件路径查找对应的实体（简化版）
     * 利用enriched entities中路径已经是相对路径的特点
     */
    private findEntityByPath;
    /**
     * 判断是否为本地导入
     */
    private isLocalImport;
    /**
     * 判断是否为API调用
     */
    private isApiCall;
    /**
     * 判断是否为状态导入
     */
    private isStateImport;
}
