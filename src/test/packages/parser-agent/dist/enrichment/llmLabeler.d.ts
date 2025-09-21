/**
 * LLM标签生成器
 */
import { BaseEntity, LLMConfig, LLMResponse, StaticAnalysisResult } from './interfaces';
export declare class LLMLabeler {
    private config;
    private rateLimiter;
    private projectRoot;
    private entities;
    private tools;
    private toolsMap;
    constructor(config?: LLMConfig, projectRoot?: string, entities?: BaseEntity[]);
    /**
     * 设置新的实体列表
     * @param entities 新的实体列表
     */
    setEntities(entities: BaseEntity[]): void;
    /**
     * 为实体生成摘要和标签
     */
    generateLabels(entity: BaseEntity, analysisResult: StaticAnalysisResult): Promise<LLMResponse>;
    private callLLM;
    /**
     * 构建提示词
     */
    private buildPrompt;
    /**
     * 解析LLM回复中的JSON
     */
    private parseResponse;
    /**
     * 用失败时使用
     */
    private fallbackResult;
}
