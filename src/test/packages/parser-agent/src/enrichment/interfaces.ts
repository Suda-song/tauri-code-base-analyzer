export interface BaseEntity {
  id: string;
  type: string;
  file: string;
  loc: { start: number; end?: number };
  rawName: string;
  isDDD?: boolean;
  isWorkspace?: boolean;
  codeMd5?: string; // 实体代码的MD5值
}

export interface EnrichedEntity extends BaseEntity {
  IMPORTS: string[];
  CALLS: string[];
  EMITS: string[];
  TEMPLATE_COMPONENTS?: string[];
  summary: string;
  tags: string[];
  projectDesc?: string;
  ANNOTATION?: string;
  annotationMd5?: string; // 注释的MD5值
  isDDD?: boolean;
  isWorkspace?: boolean;
  publishTag?: string; // 基于历史commit的需求迭代描述
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
  projectDesc?: string;
  annotation: string;
  publishTag?: string; // 基于历史commit的需求迭代描述
}

export interface StaticAnalysisResult {
  IMPORTS: string[];
  CALLS: string[];
  EMITS: string[];
  TEMPLATE_COMPONENTS?: string[];
  ANNOTATION?: string;
  ORI_ANNOTATION?: string;
} 