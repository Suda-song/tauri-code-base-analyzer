/**
 * 共享类型定义 - 所有生成器模块使用的通用类型
 */
export interface BaseEntity {
    id: string;
    type: string;
    file: string;
    loc: any;
    rawName: string;
    isDDD?: boolean;
    isWorkspace?: boolean;
    IMPORTS?: string[];
    CALLS?: string[];
    EMITS?: string[];
    TEMPLATE_COMPONENTS?: string[];
    summary?: string;
    tags?: string[];
    ANNOTATION?: string;
}
export interface ThirdPartyComponent {
    name: string;
    library: string;
    version?: string;
    usageCount: number;
    files: string[];
    documentation?: string;
    description: string;
}
export interface CoreTypeInfo {
    name: string;
    file: string;
    usage: Array<{
        file: string;
        count: number;
    }>;
    definition: string;
    exports: string[];
    description: string;
}
export interface MermaidDiagram {
    type: 'flowchart' | 'classDiagram' | 'sequenceDiagram' | 'gitgraph' | 'pie';
    title: string;
    content: string;
    description: string;
}
export interface BusinessComponent {
    name: string;
    path: string;
    type: 'business' | 'ui' | 'utility';
    consumers: string[];
    dependencies: string[];
    description: string;
    functionality: string;
}
export interface DevelopmentStandard {
    category: string;
    title: string;
    description: string;
    examples: string[];
    compliance: number;
}
