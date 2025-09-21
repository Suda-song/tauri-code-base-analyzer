/**
 * 数据流转分析器 - 基于路由分析的页面数据流转整合
 * 极简版：专注于数据整合和格式转换，避免重复分析
 */

import path from 'path';
import {
    DataFlowAnalysis,
    PageDataFlow,
    DataFlowStep,
    ApiCallInfo,
    StateManagementInfo,
    ComponentInteraction
} from '../types';
import { RouteConfigAnalyzer, EnhancedRouteAnalysisResult } from './route-config-analyzer';

/**
 * 数据流转分析器（极简版）
 * 主要职责：整合RouteConfigAnalyzer的结果，提供统一的数据流分析接口
 */
export class DataFlowAnalyzer {
    private projectPath: string;
    private routeAnalyzer: RouteConfigAnalyzer;

    constructor(projectPath: string, routeAnalyzer: RouteConfigAnalyzer) {
        this.projectPath = projectPath;
        this.routeAnalyzer = routeAnalyzer;
    }

    /**
     * 分析数据流转（基于路由增强分析）
     */
    async analyze(): Promise<DataFlowAnalysis> {
        console.log('📊 开始简化版数据流转分析...');

        // 简化版本 - 基于基础路由分析
        const basicRouteAnalysis = await this.routeAnalyzer.analyze();
        if (!basicRouteAnalysis) {
            console.log('❌ 路由分析失败，无法生成数据流转分析');
            throw new Error('路由分析失败，无法生成数据流转分析');
        }

        // 生成简化的页面流信息
        const pageFlows = basicRouteAnalysis.pageComponents?.map(component => ({
            pageName: component.name,
            pageFile: component.componentPath,
            apiCalls: [],
            stateAccess: [],
            componentUsage: [],
            imports: [],
            navigationTargets: [],
            dataFlow: []
        })) || [];

        console.log(`📋 简化版数据流转分析完成，包含 ${pageFlows.length} 个页面`);

        return {
            pageFlows,
            mermaidDiagram: '',
            apiCalls: [],
            stateManagement: [],
            componentInteractions: []
        };
    }

    /**
     * 将路由详情转换为页面数据流
     */
    private convertRouteDetailsToPageFlows(routeDetails: any[]): PageDataFlow[] {
        const pageFlows: PageDataFlow[] = [];

        for (const route of routeDetails) {
            const dataFlowSteps: DataFlowStep[] = [];

            // 构建数据流转步骤
            // 1. 导入依赖流转
            for (const importInfo of route.imports || []) {
                if (importInfo.isLocal) {
                    dataFlowSteps.push({
                        from: route.componentPath,
                        to: importInfo.source,
                        type: 'component',
                        description: `导入${importInfo.type === 'default' ? '默认' : '命名'}组件`
                    });
                }
            }

            // 2. API调用流转
            for (const call of route.calls || []) {
                if (call.type === 'api') {
                    dataFlowSteps.push({
                        from: route.componentPath,
                        to: call.functionName,
                        type: 'api',
                        description: `调用API接口获取数据`
                    });
                }
            }

            // 3. 状态管理流转
            for (const state of route.stateUsage || []) {
                dataFlowSteps.push({
                    from: route.componentPath,
                    to: state,
                    type: 'state',
                    description: `访问应用状态`
                });
            }

            // 4. Hook使用流转
            for (const call of route.calls || []) {
                if (call.type === 'hook') {
                    dataFlowSteps.push({
                        from: route.componentPath,
                        to: call.functionName,
                        type: 'component',
                        description: `使用React/Vue Hook`
                    });
                }
            }

            const pageFlow: PageDataFlow = {
                pageName: route.name || this.getPageNameFromPath(route.componentPath),
                pageFile: route.componentPath,
                imports: route.dependencies || [],
                apiCalls: route.apiCalls || [],
                stateAccess: route.stateUsage || [],
                componentUsage: this.extractComponentUsage(route),
                navigationTargets: this.extractNavigationTargets(route),
                dataFlow: dataFlowSteps
            };

            pageFlows.push(pageFlow);
        }

        return pageFlows;
    }

    /**
     * 从路由详情中提取API调用信息
     */
    private extractApiCallsFromRoutes(routeDetails: any[]): ApiCallInfo[] {
        const apiCallMap = new Map<string, ApiCallInfo>();

        for (const route of routeDetails) {
            for (const call of route.calls || []) {
                if (call.type === 'api') {
                    const apiName = call.functionName;
                    
                    if (!apiCallMap.has(apiName)) {
                        apiCallMap.set(apiName, {
                            name: apiName,
                            method: this.inferApiMethod(apiName),
                            endpoint: this.inferApiEndpoint(apiName),
                            usedInPages: [],
                            dataFlow: `API调用: ${apiName}`
                        });
                    }

                    const apiInfo = apiCallMap.get(apiName)!;
                    const pageName = route.name || this.getPageNameFromPath(route.componentPath);
                    if (!apiInfo.usedInPages.includes(pageName)) {
                        apiInfo.usedInPages.push(pageName);
                    }
                }
            }
        }

        return Array.from(apiCallMap.values());
    }

    /**
     * 从路由详情中提取状态管理信息
     */
    private extractStateManagementFromRoutes(routeDetails: any[]): StateManagementInfo[] {
        const stateMap = new Map<string, StateManagementInfo>();

        for (const route of routeDetails) {
            for (const state of route.stateUsage || []) {
                if (!stateMap.has(state)) {
                    stateMap.set(state, {
                        name: state,
                        type: this.inferStateType(state),
                        filePath: state,
                        usedInPages: []
                    });
                }

                const stateInfo = stateMap.get(state)!;
                const pageName = route.name || this.getPageNameFromPath(route.componentPath);
                if (!stateInfo.usedInPages.includes(pageName)) {
                    stateInfo.usedInPages.push(pageName);
                }
            }
        }

        return Array.from(stateMap.values());
    }

    /**
     * 从路由详情中提取组件交互信息
     */
    private extractComponentInteractionsFromRoutes(routeDetails: any[]): ComponentInteraction[] {
        const interactionMap = new Map<string, ComponentInteraction>();

        for (const route of routeDetails) {
            for (const importInfo of route.imports || []) {
                if (importInfo.isLocal) {
                    const componentName = this.getComponentNameFromPath(importInfo.source);
                    
                    if (!interactionMap.has(componentName)) {
                        interactionMap.set(componentName, {
                            component: componentName,
                            usedInPages: [],
                            interactions: []
                        });
                    }

                    const interaction = interactionMap.get(componentName)!;
                    const pageName = route.name || this.getPageNameFromPath(route.componentPath);
                    
                    if (!interaction.usedInPages.includes(pageName)) {
                        interaction.usedInPages.push(pageName);
                    }

                    const interactionType = `${importInfo.type}导入`;
                    if (!interaction.interactions.includes(interactionType)) {
                        interaction.interactions.push(interactionType);
                    }
                }
            }
        }

        return Array.from(interactionMap.values());
    }

    /**
     * 提取组件使用情况
     */
    private extractComponentUsage(route: any): string[] {
        const components: string[] = [];
        
        // 从导入中提取组件
        for (const importInfo of route.imports || []) {
            if (importInfo.isLocal) {
                components.push(this.getComponentNameFromPath(importInfo.source));
            }
        }

        // 从调用中提取组件相关调用
        for (const call of route.calls || []) {
            if (call.type === 'component') {
                components.push(call.functionName);
            }
        }

        return [...new Set(components)]; // 去重
    }

    /**
     * 提取导航目标
     */
    private extractNavigationTargets(route: any): string[] {
        const targets: string[] = [];
        
        // 从调用中提取导航相关调用
        for (const call of route.calls || []) {
            if (this.isNavigationCall(call.functionName)) {
                targets.push(call.functionName);
            }
        }

        return targets;
    }

    /**
     * 生成备用数据流图（当RouteConfigAnalyzer的图为空时）
     */
    private generateFallbackDiagram(pageFlows: PageDataFlow[]): string {
        const lines: string[] = [];
        
        lines.push('graph TD');
        lines.push('    %% 页面数据流转图 (简化版)');
        lines.push('');

        // 样式定义
        lines.push('    classDef pageNode fill:#e1f5fe,stroke:#0277bd,stroke-width:2px;');
        lines.push('    classDef apiNode fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;');
        lines.push('    classDef stateNode fill:#e8f5e8,stroke:#388e3c,stroke-width:2px;');
        lines.push('');

        // 生成页面节点
        pageFlows.forEach((pageFlow, index) => {
            const pageId = `P${index + 1}`;
            lines.push(`    ${pageId}["📄 ${pageFlow.pageName}"]:::pageNode`);
            
            // 添加API调用连接
            pageFlow.apiCalls.forEach((api, apiIndex) => {
                const apiId = `A${index}_${apiIndex}`;
                lines.push(`    ${apiId}["🔗 ${api}"]:::apiNode`);
                lines.push(`    ${pageId} --> ${apiId}`);
            });

            // 添加状态访问连接
            pageFlow.stateAccess.forEach((state, stateIndex) => {
                const stateId = `S${index}_${stateIndex}`;
                lines.push(`    ${stateId}["🏪 ${state}"]:::stateNode`);
                lines.push(`    ${pageId} --> ${stateId}`);
            });
        });

        return lines.join('\n');
    }

    // 工具方法

    private getPageNameFromPath(componentPath: string): string {
        const fileName = path.basename(componentPath, path.extname(componentPath));
        return fileName.charAt(0).toUpperCase() + fileName.slice(1);
    }

    private getComponentNameFromPath(componentPath: string): string {
        return path.basename(componentPath, path.extname(componentPath));
    }

    private inferApiMethod(apiName: string): string {
        const lowerName = apiName.toLowerCase();
        if (lowerName.includes('get') || lowerName.includes('fetch') || lowerName.includes('query')) return 'GET';
        if (lowerName.includes('post') || lowerName.includes('create') || lowerName.includes('add')) return 'POST';
        if (lowerName.includes('put') || lowerName.includes('update') || lowerName.includes('edit')) return 'PUT';
        if (lowerName.includes('delete') || lowerName.includes('remove')) return 'DELETE';
        return 'GET';
    }

    private inferApiEndpoint(apiName: string): string {
        return `/api/${apiName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    }

    private inferStateType(stateName: string): 'store' | 'hook' | 'context' {
        const lowerName = stateName.toLowerCase();
        if (lowerName.includes('store') || lowerName.includes('vuex') || lowerName.includes('pinia')) return 'store';
        if (lowerName.includes('use') || lowerName.includes('hook')) return 'hook';
        return 'context';
    }

    private isNavigationCall(callName: string): boolean {
        const navKeywords = ['router', 'navigate', 'push', 'replace', 'go', 'redirect'];
        return navKeywords.some(keyword => callName.toLowerCase().includes(keyword));
    }
} 