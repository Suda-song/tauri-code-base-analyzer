import { config } from 'dotenv';
import path from 'path';
import { EnrichmentConfig, LLMConfig } from './interfaces';

// 加载.env文件
config();

export const DEFAULT_ENRICHMENT_CONFIG: EnrichmentConfig = {
  concurrency: 5,
  maxRetries: 3,
  retryDelay: 1000,
  inputPath: 'entities.json',
  outputPath: 'entities.enriched.json',
  preInitialize: false
};

export const getLLMConfig = (): LLMConfig => {
  return {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-latest',
    maxConcurrency: parseInt(process.env.LLM_MAX_CONCURRENCY || '5', 10)
  };
};

export const getEnrichmentConfig = (customConfig?: Partial<EnrichmentConfig>): EnrichmentConfig => {
  return {
    ...DEFAULT_ENRICHMENT_CONFIG,
    ...customConfig
  };
};

export const resolveFilePath = (filePath: string, relativeTo?: string): string => {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  
  const basePath = relativeTo || process.cwd();
  return path.resolve(basePath, filePath);
}; 