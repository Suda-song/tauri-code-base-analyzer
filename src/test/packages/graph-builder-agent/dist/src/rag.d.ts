import { NebulaClient } from '@xhs/nebula-client';
export declare class CodeRAG {
    private client;
    private anthropic;
    constructor(client: NebulaClient);
    /**
     * 查询代码相关问题
     * @param question 用户问题
     * @returns AI回答
     */
    query(question: string): Promise<string>;
    /**
     * 从问题中提取关键词
     */
    private extractKeywords;
    /**
     * 在图谱中搜索相关实体
     */
    private searchEntities;
    /**
     * 二跳查询，扩展上下文
     */
    private expandContext;
    /**
     * 组织上下文信息
     */
    private organizeContext;
    /**
     * 调用AI回答问题
     */
    private askAI;
}
