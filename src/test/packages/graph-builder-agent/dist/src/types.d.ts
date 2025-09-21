/**
 * 代码文件实体接口定义
 */
export interface FileEntity {
    id: string;
    path: string;
    name: string;
    extension: string;
}
/**
 * 丰富化实体接口定义
 */
export interface EnrichedEntity {
    id: string;
    type: string;
    file: string;
    loc: {
        start: number;
        end?: number;
    } | number;
    rawName: string;
    IMPORTS: string[];
    CALLS: string[];
    EMITS: string[];
    TEMPLATE_COMPONENTS?: string[];
    summary: string;
    tags: string[];
}
