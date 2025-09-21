/**
 * Commit Generator 类型定义
 */

import { EnrichedEntity } from "../enrichment/interfaces";

export type CommitEntity = EnrichedEntity;

/**
 * 目标上下文信息
 */
export interface TargetContext {
  links?: string[];
  redDocContexts?: RedDocContextItem[];
  documentContent?: string; // 拼接后的文档内容
}

/**
 * RedDoc上下文项（只包含必要字段）
 */
export interface RedDocContextItem {
  title: string;
  filePath: string;
}

/**
 * 文件业务上下文信息
 */
export interface FileBusinessContext {
  filePath: string;
  primaryPurpose: string;
  businessLogic: string;
  keyEntities: string[];
  entityTypes: string[];
}

/**
 * 业务上下文信息
 */
export interface BusinessContext {
  entities: CommitEntity[];
  entitySummaries: string[];
  entityTags: string[];
  entityTable?: string;
  fileBusinessContexts: FileBusinessContext[];
  keyEntitySummaries: string[];
  businessOverview: string;
}

/**
 * 变更上下文信息
 */
export interface ChangeContext {
  changedFiles: string[];
  diffContent: string;
  addedComments: string[];
  deletedLines: string[];
  addedLines: string[];
}

/**
 * 完整的commit分析上下文
 */
export interface CommitAnalysisContext {
  targetContext: TargetContext;
  businessContext: BusinessContext;
  changeContext: ChangeContext;
}

/**
 * Commit生成配置
 */
export interface CommitGenerationConfig {
  language: "zh" | "en";
  includeBody: boolean;
  maxCandidates: number;
  commitTypes: string[];
  maxLength: number;
}

/**
 * 生成的commit候选项
 */
export interface CommitCandidate {
  type: string;
  subject: string;
  body?: string;
  fullMessage: string;
}

/**
 * Commit生成结果
 */
export interface CommitGenerationResult {
  candidates: CommitCandidate[];
  analysisContext: CommitAnalysisContext;
  selectedCandidate?: CommitCandidate;
  finalCommitMessage?: string;
}

/**
 * 分析器接口
 */
export interface ContextAnalyzer<T> {
  analyze(input: any): Promise<T>;
}

/**
 * AI生成器配置
 */
export interface AIGeneratorConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  apiKey?: string;
}
