"use strict";
/**
 * LLM标签生成器
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMLabeler = void 0;
const config_1 = require("./config");
const aws_anthropic_1 = require("@xhs/aws-anthropic");
const ai_1 = require("ai");
const tools_1 = require("./tools");
const jsonrepair_1 = require("jsonrepair");
process.env.XHS_AWS_BEDROCK_API_KEY = 'aa74edef9cb44aab8a03f37f36197ec6';
// 创建Anthropic客户端
const anthropic = (0, aws_anthropic_1.createAnthropic)({});
// 请求速率限制控制
class RateLimiter {
    constructor(maxConcurrent) {
        this.queue = [];
        this.running = 0;
        this.maxConcurrent = maxConcurrent;
    }
    async add(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                this.running++;
                try {
                    const result = await fn();
                    resolve(result);
                }
                catch (err) {
                    reject(err);
                }
                finally {
                    this.running--;
                    this.processQueue();
                }
            });
            this.processQueue();
        });
    }
    processQueue() {
        if (this.running < this.maxConcurrent && this.queue.length > 0) {
            const next = this.queue.shift();
            if (next) {
                next();
            }
        }
    }
}
class LLMLabeler {
    constructor(config, projectRoot, entities) {
        this.config = config || (0, config_1.getLLMConfig)();
        this.rateLimiter = new RateLimiter(this.config.maxConcurrency || 5);
        this.projectRoot = projectRoot || process.cwd();
        this.entities = entities || [];
        // 预创建工具实例
        this.tools = (0, tools_1.createTools)(this.projectRoot);
        this.toolsMap = (0, tools_1.createToolsMap)(this.tools);
    }
    /**
     * 设置新的实体列表
     * @param entities 新的实体列表
     */
    setEntities(entities) {
        this.entities = entities;
    }
    /**
     * 为实体生成摘要和标签
     */
    async generateLabels(entity, analysisResult) {
        return this.rateLimiter.add(() => this.callLLM(entity, analysisResult));
    }
    async callLLM(entity, analysisResult) {
        try {
            // 构建提示词
            const prompt = this.buildPrompt(entity, analysisResult);
            try {
                const modelName = "claude-3-7-sonnet-latest";
                // 使用缓存的工具实例
                const { text: answer } = await (0, ai_1.generateText)({
                    // @ts-ignore
                    model: anthropic(modelName, { structuredOutputs: true }),
                    tools: this.toolsMap,
                    maxSteps: 10,
                    system: prompt,
                    prompt: "请分析这个代码实体并生成摘要和标签。如果需要查看更多代码，可以使用read_file工具。",
                });
                if (!answer) {
                    console.error("LLM返回空结果");
                    return this.fallbackResult(entity, analysisResult);
                }
                console.log('answer', answer);
                // 返回解析结果
                return this.parseResponse(answer, entity, analysisResult);
            }
            catch (callError) {
                console.error(`LLM API调用失败: ${callError.message}`);
                return this.fallbackResult(entity, analysisResult);
            }
        }
        catch (error) {
            console.error(`LLM处理失败: ${error.message}`);
            // 出错时返回备用结果
            return this.fallbackResult(entity, analysisResult);
        }
    }
    /**
     * 构建提示词
     */
    buildPrompt(entity, analysis) {
        // 获取导入组件的详细信息
        const importDetails = analysis.IMPORTS.map(importId => {
            const importedEntity = this.entities.find(e => e.id === importId);
            if (importedEntity) {
                return `  - ${importId}: ${importedEntity.file}`;
            }
            return `  - ${importId}`;
        }).join('\n');
        // 获取调用组件的详细信息
        const callDetails = analysis.CALLS.map(callId => {
            // 处理可能的方法调用格式 (如 "Component:name.method")
            const baseId = callId.split('.')[0];
            const calledEntity = this.entities.find(e => e.id === baseId);
            if (calledEntity) {
                return `  - ${callId}: ${calledEntity.file}`;
            }
            return `  - ${callId}`;
        }).join('\n');
        return `你是一个代码理解助手。请为以下代码实体生成简洁的业务摘要和标签。

如果需要查看更多相关文件来理解代码，可以使用read_file工具读取相关文件。

实体信息:
- 类型: ${entity.type}
- 名称: ${entity.rawName}
- 文件: ${entity.file}
${analysis.ANNOTATION ? `- 注释: ${analysis.ANNOTATION}` : ''}

代码分析:
- 导入:
${importDetails}

- 调用:
${callDetails}

- 事件: ${analysis.EMITS.join(', ')}
${analysis.TEMPLATE_COMPONENTS ? `- 模板组件: ${analysis.TEMPLATE_COMPONENTS.join(', ')}` : ''}

请按照以下要求生成摘要和标签：

1. 摘要要求：
   - 必须控制在160个字符以内
   - 简明扼要地描述实体的主要功能和用途
   - 使用中文描述
   - 避免使用"这个组件"、"该函数"等指代词
   - 如果注释中包含业务信息，请优先使用注释内容来生成摘要

2. 标签要求：
   - 生成3-5个标签
   - 每个标签使用1-3个词语
   - 标签应该反映实体的功能、类型、用途等特征
   - 优先使用业务相关的标签
   - 避免过于宽泛的标签（如"组件"、"函数"等）
   - 如果注释中包含业务信息，请优先使用注释内容来生成标签

在分析完成后，必须以下列JSON格式回复：
{
  "summary": "不超过160个字符的功能摘要",
  "tags": ["标签1", "标签2", "标签3", "标签4", "标签5"]
}

注意：
1. 不要解释你的分析过程，直接返回JSON格式的结果。
2. 确保你的回复可以被JSON.parse()解析。
3. 如果存在注释信息，请优先参考注释内容来生成摘要和标签（假如注释标明"已废弃"，则表示该实体已废弃，摘要和标签都应为"已废弃"）。
4. 请参考导入和调用组件的文件路径来理解当前实体的业务上下文。
`;
    }
    /**
     * 解析LLM回复中的JSON
     */
    parseResponse(text, entity, analysis) {
        try {
            // 检查响应是否为空
            if (!text || text.trim().length === 0) {
                console.warn('LLM返回了空响应');
                return this.fallbackResult(entity, analysis);
            }
            // 尝试提取JSON部分
            const jsonMatch = text.match(/\{[\s\S]*?\}/);
            if (!jsonMatch) {
                console.warn('LLM响应中未找到JSON格式内容:', text);
                return this.fallbackResult(entity, analysis);
            }
            const jsonText = jsonMatch[0];
            const parsed = JSON.parse((0, jsonrepair_1.jsonrepair)(jsonText));
            // 验证和清理
            const summary = typeof parsed.summary === 'string'
                ? parsed.summary.substring(0, 160) // 确保不超过160个中文字
                : '';
            const tags = Array.isArray(parsed.tags)
                ? parsed.tags.slice(0, 5).map(tag => typeof tag === 'string' ? tag : String(tag))
                : [];
            return { summary, tags };
        }
        catch (error) {
            console.error(`解析LLM响应失败: ${error.message}`);
            return this.fallbackResult(entity, analysis);
        }
    }
    /**
     * 用失败时使用
     */
    fallbackResult(entity, analysis) {
        const summary = entity
            ? `${entity.type === 'component' ? '组件' : '函数'}: ${entity.rawName}`
            : '未知实体';
        const tags = [];
        if (entity) {
            tags.push(entity.type);
            if (entity.type === 'component' && analysis?.TEMPLATE_COMPONENTS?.length) {
                tags.push('UI组件');
            }
            if (analysis?.CALLS?.length) {
                tags.push('有API调用');
            }
        }
        return {
            summary,
            tags: tags.slice(0, 3)
        };
    }
}
exports.LLMLabeler = LLMLabeler;
