export interface BaseEntity {
    id: string;
    type: string;
    file: string;
    loc: {
        start: number;
        end?: number;
    };
    rawName: string;
    isDDD?: boolean;
    isWorkspace?: boolean;
}
export interface EnrichedEntity extends BaseEntity {
    IMPORTS: string[];
    CALLS: string[];
    EMITS: string[];
    TEMPLATE_COMPONENTS?: string[];
    summary: string;
    tags: string[];
    ANNOTATION?: string;
    isDDD?: boolean;
    isWorkspace?: boolean;
}
export interface EnrichmentConfig {
    concurrency: number;
    maxRetries: number;
    retryDelay: number;
    inputPath: string;
    outputPath: string;
    preInitialize?: boolean;
}
export interface LLMConfig {
    apiKey?: string;
    model: string;
    maxConcurrency: number;
}
export interface LLMResponse {
    summary: string;
    tags: string[];
}
export interface StaticAnalysisResult {
    IMPORTS: string[];
    CALLS: string[];
    EMITS: string[];
    TEMPLATE_COMPONENTS?: string[];
    ANNOTATION?: string;
}
