/**
 * 业务组件分析器 - 识别和分析项目中的业务组件
 */
import { BaseEntity, BusinessComponent } from './types';
export declare class BusinessComponentAnalyzer {
    private entities;
    constructor(entities: BaseEntity[]);
    /**
     * 分析业务组件
     */
    analyze(): {
        businessComponents: BusinessComponent[];
        componentStats: {
            totalComponents: number;
            businessComponents: number;
            uiComponents: number;
            utilityComponents: number;
            mostUsedComponent: string;
        };
        documentation: string;
    };
    private identifyComponents;
    private isComponent;
    private isComponentEntity;
    private isLocalComponentImport;
    private extractComponentNameFromPath;
    private extractComponentNameFromEntity;
    private classifyComponentType;
    /**
     * 判断是否为内置组件
     */
    private isBuiltinComponent;
    /**
     * 查找组件的消费者（多种匹配方式）
     */
    private findComponentConsumers;
    /**
     * 获取组件名称的不同变体
     */
    private getComponentNameVariations;
    private analyzeDependencies;
    private generateComponentDescription;
    private analyzeFunctionality;
    private generateComponentStats;
    private generateDocumentation;
}
