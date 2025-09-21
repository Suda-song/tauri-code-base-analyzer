export interface BaseEntity {
    id: string;
    type: string;
    file: string;
    loc: any;
    rawName: string;
    isWorkspace?: boolean;
    isDDD?: boolean;
}
export interface EnrichedEntity extends BaseEntity {
    IMPORTS: string[];
    CALLS: string[];
    EMITS: string[];
    TEMPLATE_COMPONENTS: string[];
    summary: string;
    tags: string[];
    ANNOTATION?: string;
}
export interface RagResult {
    entities: EnrichedEntity[];
    relevanceScores: {
        [entityId: string]: number;
    };
    prompt: string;
}
export interface RelatedEntitiesResult {
    sourceEntity: EnrichedEntity;
    relatedEntities: {
        imports: EnrichedEntity[];
        calls: EnrichedEntity[];
        templates: EnrichedEntity[];
        similar: EnrichedEntity[];
        relationships: {
            [id: string]: string[];
        };
    };
    prompt: string;
}
export interface SmartRelatedResult {
    sourceEntity: EnrichedEntity;
    smartSelection: EnrichedEntity[];
    reasoning: string;
    allCandidates: {
        imports: EnrichedEntity[];
        calls: EnrichedEntity[];
        templates: EnrichedEntity[];
        similar: EnrichedEntity[];
    };
}
/**
 * RAG（检索增强生成）内联工具类
 * 用于代码实体的智能检索和关系分析
 */
export declare class RagInlineTool {
    private entities;
    private projectRoot;
    private anthropic;
    private entityMap;
    private logger;
    private entitiesFilePath?;
    private fileWatcher?;
    private lastModifiedTime?;
    constructor(entitiesPath?: string, projectRoot?: string);
    /**
     * 从JSON文件加载实体数据
     * @param entitiesPath 实体JSON文件路径
     */
    loadEntities(entitiesPath: string): void;
    /**
     * 设置文件监听器，当实体文件变化时自动重新加载
     * @param entitiesPath 实体JSON文件路径
     */
    private setupFileWatcher;
    /**
     * 手动重新加载实体数据
     * @returns 是否重新加载成功
     */
    reloadEntities(): boolean;
    /**
     * 检查实体文件是否存在且可读
     * @returns 文件状态信息
     */
    getFileStatus(): {
        exists: boolean;
        readable: boolean;
        lastModified?: Date;
        entityCount: number;
    };
    /**
     * 清理资源（关闭文件监听器）
     */
    dispose(): void;
    /**
     * 基于自然语言查询搜索相关代码实体
     * @param userQuery 用户的自然语言查询
     * @param topK 返回的实体数量（默认5个）
     * @returns 搜索结果，包含实体列表、相关性得分和生成的提示词
     */
    search(userQuery: string, topK?: number): Promise<RagResult>;
    /**
     * 获取与指定实体相关的其他实体（图的二跳查询）
     * 分析四种关系：导入关系、调用关系、模板关系、相似标签关系
     * @param entityId 目标实体的ID
     * @param maxRelated 每种关系类型返回的最大相关实体数
     * @returns 关系分析结果，如果实体不存在则返回null
     */
    getRelatedEntities(entityId: string, maxRelated?: number): Promise<RelatedEntitiesResult | null>;
    /**
     * 使用AI识别用户查询的意图
     * @param query 用户查询
     * @returns 识别出的意图关键词
     */
    private identifyIntent;
    /**
     * 使用多阶段策略计算每个实体与查询的相关性得分
     * @param query 用户查询
     * @param intent 识别出的意图
     * @returns 实体ID到相关性得分的映射
     */
    private calculateRelevanceScores;
    /**
     * 第一阶段：快速文本匹配预筛选
     */
    private quickTextFilter;
    /**
     * 获取实体类型相关性加成
     */
    private getTypeRelevanceBonus;
    /**
     * 小规模：直接AI评分
     */
    private directAIScoring;
    /**
     * 中等规模：混合评分策略
     */
    private hybridScoring;
    /**
     * 大规模：多阶段评分策略
     */
    private multiStageScoring;
    /**
     * 批量AI评分
     *
     * 请根据以下因素综合评估：
     * 1. 组件摘要中是否包含查询相关内容
     * 2. 组件标签是否与用户意图匹配
     * 3. 组件类型和功能是否符合用户需求
     * 4. 组件的导入和调用关系是否与查询相关
     * 5. 组件的注释信息是否与查询相关
     */
    private batchAIScoring;
    /**
     * 精确AI评分（用于高分实体的二次评分）
     */
    private precisionAIScoring;
    /**
     * 回退机制：使用文本匹配计算相关性得分
     * @param query 用户查询
     * @param intent 识别出的意图
     * @returns 实体ID到相关性得分的映射
     */
    private calculateFallbackRelevanceScores;
    /**
     * 提取关键词（去除常见停用词）
     * @param text 输入文本
     * @returns 关键词数组
     */
    private extractKeywords;
    /**
     * 为搜索到的实体构建详细的提示词
     * @param query 用户查询
     * @param entities 相关实体列表
     * @param relevanceScores 相关性得分
     * @returns 构建的提示词
     */
    private buildPrompt;
    /**
   * 为关系分析构建提示词
   * @param sourceEntity 源实体
   * @param relatedEntities 相关实体列表
   * @param relationships 关系映射
   * @returns 构建的关系分析提示词
   */
    private buildRelatedPrompt;
    /**
     * 辅助方法：添加关系到关系映射中
     * @param relationships 关系映射对象
     * @param entityId 实体ID
     * @param relationType 关系类型
     */
    private addRelationship;
    /**
     * 辅助方法：检查实体是否已存在于给定的实体列表中
     * @param entity 要检查的实体
     * @param entityLists 实体列表数组
     * @returns 如果实体已存在则返回true
     */
    private isEntityInLists;
    /**
     * 获取实体统计信息
     * @returns 包含实体数量、类型分布等统计信息的对象
     */
    getStatistics(): {
        totalEntities: number;
        entitiesByType: {
            [type: string]: number;
        };
        entitiesByTags: {
            [tag: string]: number;
        };
    };
    /**
     * 智能关联实体方法 - 基于用户需求和大模型能力筛选最相关的实体
     * @param entityId 核心实体ID
     * @param userRequirement 用户需求描述
     * @param maxEntities 返回的最大实体数量（1-3个）
     * @returns 智能筛选结果，如果实体不存在则返回null
     */
    getSmartRelatedEntities(entityId: string, userRequirement: string, maxEntities?: number): Promise<SmartRelatedResult | null>;
    /**
     * 使用AI智能选择最相关的实体
     * @param sourceEntity 源实体
     * @param candidates 候选实体列表
     * @param userRequirement 用户需求
     * @param maxEntities 最大返回数量
     * @returns 选择结果和推理过程
     */
    private selectSmartEntities;
}
export declare function searchCodeEntities(query: string, entitiesPath: string, projectRoot?: string, topK?: number): Promise<RagResult>;
export declare function getRelatedCodeEntities(entityId: string, entitiesPath: string, projectRoot?: string, maxRelated?: number): Promise<RelatedEntitiesResult | null>;
