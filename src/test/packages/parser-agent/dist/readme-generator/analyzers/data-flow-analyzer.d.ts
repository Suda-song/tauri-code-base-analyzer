/**
 * 数据流转分析器 - 基于路由分析的页面数据流转整合
 * 极简版：专注于数据整合和格式转换，避免重复分析
 */
import { DataFlowAnalysis } from '../types';
import { RouteConfigAnalyzer } from './route-config-analyzer';
/**
 * 数据流转分析器（极简版）
 * 主要职责：整合RouteConfigAnalyzer的结果，提供统一的数据流分析接口
 */
export declare class DataFlowAnalyzer {
    private projectPath;
    private routeAnalyzer;
    constructor(projectPath: string, routeAnalyzer: RouteConfigAnalyzer);
    /**
     * 分析数据流转（基于路由增强分析）
     */
    analyze(): Promise<DataFlowAnalysis>;
    /**
     * 将路由详情转换为页面数据流
     */
    private convertRouteDetailsToPageFlows;
    /**
     * 从路由详情中提取API调用信息
     */
    private extractApiCallsFromRoutes;
    /**
     * 从路由详情中提取状态管理信息
     */
    private extractStateManagementFromRoutes;
    /**
     * 从路由详情中提取组件交互信息
     */
    private extractComponentInteractionsFromRoutes;
    /**
     * 提取组件使用情况
     */
    private extractComponentUsage;
    /**
     * 提取导航目标
     */
    private extractNavigationTargets;
    /**
     * 生成备用数据流图（当RouteConfigAnalyzer的图为空时）
     */
    private generateFallbackDiagram;
    private getPageNameFromPath;
    private getComponentNameFromPath;
    private inferApiMethod;
    private inferApiEndpoint;
    private inferStateType;
    private isNavigationCall;
}
