/**
 * 架构分析器 - 专门负责项目架构模式分析
 */
import { ProjectAnalysis } from '../types';
import { BaseEntity } from './types';
export interface ArchitectureInsights {
    pattern: string;
    dddAnalysis: DDDAnalysis;
    frontendArchitecture: FrontendArchitecture;
    formArchitecture: FormArchitecture;
    layerStructure: LayerStructure;
    codeOrganization: CodeOrganization;
}
export interface DDDAnalysis {
    isDDD: boolean;
    domains: string[];
    entities: string[];
    valueObjects: string[];
    repositories: string[];
    services: string[];
    aggregates: string[];
    dataFlow: DataFlowNode[];
}
export interface FrontendArchitecture {
    type: 'MVC' | 'MVVM' | 'Component-Based' | 'Micro-Frontend' | 'Layered';
    stateManagement: string[];
    routingPattern: string;
    componentStructure: ComponentStructure;
}
export interface FormArchitecture {
    formLibraries: string[];
    validationPatterns: string[];
    formComponents: string[];
    formManagement: string;
}
export interface LayerStructure {
    presentation: string[];
    business: string[];
    data: string[];
    infrastructure: string[];
}
export interface CodeOrganization {
    byFeature: boolean;
    byLayer: boolean;
    byType: boolean;
    modularityScore: number;
}
export interface ComponentStructure {
    businessComponents: ComponentInfo[];
    uiComponents: ComponentInfo[];
    utilityComponents: ComponentInfo[];
}
export interface ComponentInfo {
    name: string;
    path: string;
    type: 'business' | 'ui' | 'utility';
    consumers: string[];
    dependencies: string[];
}
export interface DataFlowNode {
    from: string;
    to: string;
    type: 'data' | 'control' | 'dependency';
    description: string;
}
export declare class ArchitectureAnalyzer {
    /**
     * 分析项目架构模式
     */
    analyzeArchitecture(analysis: ProjectAnalysis, entities: BaseEntity[]): ArchitectureInsights;
    /**
     * 检测架构模式
     */
    private detectArchitecturePattern;
    /**
     * 分析DDD模式
     */
    private analyzeDDD;
    /**
     * 分析前端架构
     */
    private analyzeFrontendArchitecture;
    /**
     * 检测前端架构类型
     */
    private detectFrontendType;
    /**
     * 分析组件结构
     */
    private analyzeComponentStructure;
    /**
     * 分类组件类型
     */
    private classifyComponent;
    /**
     * 查找组件消费者
     */
    private findComponentConsumers;
    /**
     * 分析表单架构
     */
    private analyzeFormArchitecture;
    /**
     * 分析分层结构
     */
    private analyzeLayerStructure;
    /**
     * 分析代码组织方式
     */
    private analyzeCodeOrganization;
    /**
     * 计算模块化分数
     */
    private calculateModularityScore;
    /**
     * 生成数据流图
     */
    private generateDataFlow;
}
