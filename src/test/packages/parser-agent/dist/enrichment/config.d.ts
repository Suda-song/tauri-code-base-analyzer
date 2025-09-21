import { EnrichmentConfig, LLMConfig } from './interfaces';
export declare const DEFAULT_ENRICHMENT_CONFIG: EnrichmentConfig;
export declare const getLLMConfig: () => LLMConfig;
export declare const getEnrichmentConfig: (customConfig?: Partial<EnrichmentConfig>) => EnrichmentConfig;
export declare const resolveFilePath: (filePath: string, relativeTo?: string) => string;
