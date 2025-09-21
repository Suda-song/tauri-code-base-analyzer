"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeRAG = void 0;
const aws_anthropic_1 = require("@xhs/aws-anthropic");
const ai_1 = require("ai");
const schema_1 = require("./schema");
class CodeRAG {
    constructor(client) {
        this.client = client;
        // 配置AI客户端
        process.env.XHS_AWS_BEDROCK_API_KEY = 'aa74edef9cb44aab8a03f37f36197ec6';
        this.anthropic = (0, aws_anthropic_1.createAnthropic)({});
    }
    /**
     * 查询代码相关问题
     * @param question 用户问题
     * @returns AI回答
     */
    async query(question) {
        console.log('🔍 开始RAG检索...');
        // 1. 从问题中提取关键词进行图谱检索
        const keywords = this.extractKeywords(question);
        console.log(`📝 提取关键词: ${keywords.join(', ')}`);
        // 2. 在图谱中搜索相关实体（一跳）
        const relatedEntities = await this.searchEntities(keywords);
        console.log(`🎯 找到 ${relatedEntities.length} 个相关实体`);
        // 3. 进行二跳查询，找到更多相关信息
        const contextInfo = await this.expandContext(relatedEntities);
        console.log(`🔗 扩展后共获得 ${contextInfo.entities.length} 个实体信息`);
        // 4. 组织上下文信息
        const context = this.organizeContext(contextInfo);
        // 5. 调用AI回答问题
        const answer = await this.askAI(question, context);
        return answer;
    }
    /**
     * 从问题中提取关键词
     */
    extractKeywords(question) {
        const keywords = [];
        // 简单的关键词匹配
        const patterns = [
            { words: ['登录', 'login'], entity: 'Login' },
            { words: ['用户', 'user'], entity: 'User' },
            { words: ['个人资料', 'profile'], entity: 'Profile' },
            { words: ['认证', 'auth'], entity: 'auth' },
            { words: ['表单', 'form'], entity: 'Form' },
            { words: ['服务', 'service'], entity: 'Service' },
            { words: ['组件', 'component'], entity: 'Component' },
            { words: ['验证', 'validation'], entity: 'validation' }
        ];
        for (const pattern of patterns) {
            if (pattern.words.some(word => question.includes(word))) {
                keywords.push(pattern.entity);
            }
        }
        return keywords.length > 0 ? keywords : ['User', 'Login']; // 默认关键词
    }
    /**
     * 在图谱中搜索相关实体
     */
    async searchEntities(keywords) {
        const entities = [];
        for (const keyword of keywords) {
            try {
                const possibleIds = [
                    `Page:${keyword}`,
                    `Component:${keyword}`,
                    `Service:${keyword}`,
                    `Util:${keyword}`,
                    `Store:${keyword}`
                ];
                for (const id of possibleIds) {
                    try {
                        const query = `FETCH PROP ON ${schema_1.ENTITY_TAG} "${id}" YIELD vertex AS v`;
                        const result = await this.client.executeNgql(query);
                        if (result.data?.length > 0) {
                            entities.push(...result.data);
                        }
                    }
                    catch (e) {
                        // 忽略不存在的ID
                    }
                }
                // 通过通配符方式搜索
                const knownEntities = [
                    'Page:Login', 'Page:UserProfile',
                    'Component:LoginForm', 'Component:UserCard',
                    'Service:authService', 'Service:userService',
                    'Util:validation', 'Store:userStore'
                ];
                for (const entityId of knownEntities) {
                    if (entityId.toLowerCase().includes(keyword.toLowerCase())) {
                        try {
                            const query = `FETCH PROP ON ${schema_1.ENTITY_TAG} "${entityId}" YIELD vertex AS v`;
                            const result = await this.client.executeNgql(query);
                            if (result.data?.length > 0) {
                                entities.push(...result.data);
                            }
                        }
                        catch (e) {
                            // 忽略错误
                        }
                    }
                }
            }
            catch (e) {
                console.log(`⚠️  搜索关键词 "${keyword}" 时出错，继续其他搜索`);
            }
        }
        // 去重
        const uniqueEntities = entities.filter((entity, index, self) => index === self.findIndex(e => e.v?._vid === entity.v?._vid));
        return uniqueEntities.slice(0, 10); // 限制数量
    }
    /**
     * 二跳查询，扩展上下文
     */
    async expandContext(entities) {
        const allEntities = [...entities];
        const relationships = [];
        // 对每个找到的实体，查询其相关实体
        for (const entity of entities) {
            if (!entity.v?._vid)
                continue;
            try {
                // 查询导入关系
                const importsQuery = `GO FROM "${entity.v._vid}" OVER ${schema_1.REL_IMPORTS} YIELD $$.${schema_1.ENTITY_TAG}.raw_name AS name, $$.${schema_1.ENTITY_TAG}.description AS desc, edge AS rel, dst(edge) AS target`;
                const importsResult = await this.client.executeNgql(importsQuery);
                if (importsResult.data?.length > 0) {
                    relationships.push(...importsResult.data.map(r => ({ ...r, type: 'IMPORTS', source: entity.v._vid })));
                    // 获取目标实体的详细信息
                    for (const rel of importsResult.data) {
                        if (rel.target) {
                            try {
                                const targetQuery = `FETCH PROP ON ${schema_1.ENTITY_TAG} "${rel.target}" YIELD vertex AS v`;
                                const targetResult = await this.client.executeNgql(targetQuery);
                                if (targetResult.data?.length > 0) {
                                    allEntities.push(...targetResult.data);
                                }
                            }
                            catch (e) {
                                // 忽略错误，继续处理
                            }
                        }
                    }
                }
                // 查询调用关系
                const callsQuery = `GO FROM "${entity.v._vid}" OVER ${schema_1.REL_CALLS} YIELD $$.${schema_1.ENTITY_TAG}.raw_name AS name, $$.${schema_1.ENTITY_TAG}.description AS desc, edge AS rel, dst(edge) AS target`;
                const callsResult = await this.client.executeNgql(callsQuery);
                if (callsResult.data?.length > 0) {
                    relationships.push(...callsResult.data.map(r => ({ ...r, type: 'CALLS', source: entity.v._vid })));
                }
                // 查询被谁包含（反向查询）
                const containedQuery = `GO FROM "${entity.v._vid}" OVER ${schema_1.REL_CONTAINS} REVERSELY YIELD $$.${schema_1.FILE_TAG}.path AS file_path, edge AS rel, dst(edge) AS file_id`;
                const containedResult = await this.client.executeNgql(containedQuery);
                if (containedResult.data?.length > 0) {
                    relationships.push(...containedResult.data.map(r => ({ ...r, type: 'CONTAINED_IN', source: entity.v._vid })));
                }
            }
            catch (e) {
                console.log(`⚠️  扩展实体 ${entity.v._vid} 时出错，继续处理其他实体`);
            }
        }
        // 去重实体
        const uniqueEntities = allEntities.filter((entity, index, self) => index === self.findIndex(e => e.v?._vid === entity.v?._vid));
        return {
            entities: uniqueEntities,
            relationships
        };
    }
    /**
     * 组织上下文信息
     */
    organizeContext(contextInfo) {
        let context = "以下是从代码图谱中检索到的相关信息：\n\n";
        // 组织实体信息
        context += "## 相关代码实体：\n";
        for (const entity of contextInfo.entities) {
            if (entity.v) {
                const props = entity.v.props;
                context += `- **${props?.raw_name || 'Unknown'}** (${props?.entity_type || 'unknown'})\n`;
                context += `  文件: ${props?.file_path || 'unknown'}\n`;
                if (props?.description) {
                    context += `  描述: ${props.description}\n`;
                }
                context += "\n";
            }
        }
        // 组织关系信息
        if (contextInfo.relationships.length > 0) {
            context += "## 相关关系：\n";
            for (const rel of contextInfo.relationships) {
                context += `- ${rel.source} ${rel.type} ${rel.target || rel.name}\n`;
            }
            context += "\n";
        }
        return context;
    }
    /**
     * 调用AI回答问题
     */
    async askAI(question, context) {
        try {
            const prompt = `你是一个代码分析助手。基于以下从代码图谱中检索到的信息，请回答用户的问题。

${context}

用户问题: ${question}

请提供一个详细且有用的回答，解释相关的代码结构和功能。`;
            const { text: answer } = await (0, ai_1.generateText)({
                // @ts-ignore
                model: this.anthropic("claude-3-7-sonnet-latest"),
                prompt,
                maxTokens: 1000,
            });
            return answer || "抱歉，无法生成回答。";
        }
        catch (error) {
            console.error(`AI调用失败: ${error.message}`);
            return "抱歉，AI服务暂时不可用，但基于图谱检索到了相关的代码信息。";
        }
    }
}
exports.CodeRAG = CodeRAG;
