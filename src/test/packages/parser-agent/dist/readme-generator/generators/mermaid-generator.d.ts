/**
 * Mermaid 图表生成器 - 负责生成项目架构图和依赖图
 */
import { ProjectAnalysis } from '../types';
import { BaseEntity, MermaidDiagram } from './types';
import { ArchitectureInsights, DDDAnalysis } from './architecture-analyzer';
export declare class MermaidGenerator {
    /**
     * 生成所有相关的Mermaid图表
     */
    generateAllDiagrams(analysis: ProjectAnalysis, entities: BaseEntity[], architectureInsights: ArchitectureInsights): MermaidDiagram[];
    /**
     * 生成项目架构依赖图
     */
    generateArchitectureDiagram(analysis: ProjectAnalysis, entities: BaseEntity[]): MermaidDiagram;
    /**
     * 生成DDD数据流图
     */
    generateDDDDataFlowDiagram(dddAnalysis: DDDAnalysis): MermaidDiagram;
    /**
     * 生成组件依赖图
     */
    generateComponentDependencyDiagram(entities: BaseEntity[]): MermaidDiagram;
    /**
     * 生成分层架构图
     */
    generateLayerDiagram(layerStructure: any): MermaidDiagram;
    /**
     * 生成技术栈分布饼图
     */
    generateTechStackPieChart(analysis: ProjectAnalysis): MermaidDiagram;
    /**
     * 获取目录显示名称
     */
    private getDisplayName;
    /**
     * 获取目录图标
     */
    private getDirectoryIcon;
    /**
     * 添加常见的架构连接关系
     */
    private addCommonArchitectureConnections;
    /**
     * 分析目录间的依赖关系
     */
    private analyzeDependenciesBetweenDirectories;
    /**
     * 获取实体所属目录
     */
    private getEntityDirectory;
    /**
     * 查找导入文件所属的目录
     */
    private findImportDirectory;
    /**
     * 分类目录类型
     */
    private categorizeDirectory;
    /**
     * 获取组件的显示名称
     */
    private getComponentDisplayName;
    /**
     * 获取组件图标
     */
    private getComponentIcon;
    /**
     * 根据组件名查找组件
     */
    private findComponentByName;
    /**
     * 根据导入路径查找组件
     */
    private findComponentByImportPath;
    /**
     * 添加推测的组件连接关系
     */
    private addInferredComponentConnections;
    /**
     * 获取组件类型
     */
    private getComponentType;
    /**
     * 清理ID，确保Mermaid语法兼容
     */
    private sanitizeId;
}
