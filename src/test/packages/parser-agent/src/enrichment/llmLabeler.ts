/**
 * LLM标签生成器
 */

import { BaseEntity, EnrichedEntity, LLMConfig, LLMResponse, StaticAnalysisResult } from './interfaces';
import { getLLMConfig } from './config';
import { createAnthropic } from "@xhs/aws-anthropic";
import fs from 'fs';
import path from 'path';
import { generateText, streamText } from "ai";
import { createTools, createToolsMap } from './tools';
import { jsonrepair } from 'jsonrepair';


process.env.XHS_AWS_BEDROCK_API_KEY = 'aa74edef9cb44aab8a03f37f36197ec6';

// 创建Anthropic客户端
const anthropic = createAnthropic({});

// 请求速率限制控制
class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private running = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        this.running++;
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.running--;
          this.processQueue();
        }
      });

      this.processQueue();
    });
  }

  private processQueue() {
    if (this.running < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }
}

export class LLMLabeler {
  private config: LLMConfig;
  private rateLimiter: RateLimiter;
  private projectRoot: string;
  private entities: BaseEntity[];
  // 缓存工具实例，避免重复创建
  private tools: any;
  private toolsMap: any;

  constructor(config?: LLMConfig, projectRoot?: string, entities?: BaseEntity[]) {
    this.config = config || getLLMConfig();
    this.rateLimiter = new RateLimiter(this.config.maxConcurrency || 5);
    this.projectRoot = projectRoot || process.cwd();
    this.entities = entities || [];
    
    // 预创建工具实例
    this.tools = createTools(this.projectRoot);
    this.toolsMap = createToolsMap(this.tools);
  }

  /**
   * 设置新的实体列表
   * @param entities 新的实体列表
   */
  setEntities(entities: BaseEntity[]): void {
    this.entities = entities;
  }



  /**
   * 为实体生成摘要和标签
   * @param commitHistory 实体的commit历史记录
   */
  async generateLabels(
    entity: BaseEntity, 
    analysisResult: StaticAnalysisResult,
    projectReadme: string,
    skipAnnotation: boolean = true,
    commitHistory: any[] = []
  ): Promise<LLMResponse> {
    return this.rateLimiter.add(() => this.callLLM(entity, analysisResult, projectReadme, skipAnnotation, commitHistory));
  }

  private async callLLM(
    entity: BaseEntity, 
    analysisResult: StaticAnalysisResult,
    projectReadme: string,
    skipAnnotation: boolean = true,
    commitHistory: any[] = []
  ): Promise<LLMResponse> {
    try {
      // 构建提示词
      const prompt = this.buildPrompt(entity, analysisResult, projectReadme, skipAnnotation, commitHistory);
      try {
        const modelName = "claude-3-7-sonnet-latest";

        // 使用缓存的工具实例
        const { text: answer } = await generateText({
          // @ts-ignore
          model: anthropic(modelName, { structuredOutputs: true }),
          tools: this.toolsMap,
          maxSteps: 10,
          system: prompt,
          prompt: "请分析这个代码实体并生成摘要、标签和代码注释。如果需要查看更多代码，可以使用read_file工具。",
        });

        if (!answer) {
          console.error("LLM返回空结果");
          return this.fallbackResult(entity, analysisResult, skipAnnotation);
        }
        console.log('answer', answer);
        // 返回解析结果
        return this.parseResponse(answer, entity, analysisResult, skipAnnotation);
      } catch (callError) {
        console.error(`LLM API调用失败: ${(callError as Error).message}`);
        return this.fallbackResult(entity, analysisResult, skipAnnotation);
      }
    } catch (error) {
      console.error(`LLM处理失败: ${(error as Error).message}`);
      // 出错时返回备用结果
      return this.fallbackResult(entity, analysisResult, skipAnnotation);
    }
  }

  /**
   * 构建commit历史上下文信息
   * @param commitHistory 实体的commit历史记录
   */
  private buildCommitContext(commitHistory: any[]): string {
    if (!commitHistory || commitHistory.length === 0) {
      return '';
    }
    
    // 取最近8个commit，按时间倒序排列，只需要commit_summary和commit_at字段
    const recentCommits = commitHistory
      .sort((a, b) => new Date(b.commit_at).getTime() - new Date(a.commit_at).getTime())
      .slice(0, 8);
    
    if (recentCommits.length === 0) {
      return '';
    }
    
    // 调整为时间正序，体现演进过程，优化只使用commit_summary
    const commitSummaries = recentCommits
      .reverse()
      .map((commit, index) => 
        `${index + 1}. ${commit.commit_summary} (${commit.commit_at.substring(0, 10)})`
      )
      .join('\n');
      
    return `\n该实体的历史需求迭代记录(共${recentCommits.length}次提交):\n${commitSummaries}\n`;
  }

  /**
   * 构建提示词
   * @param commitHistory 实体的commit历史记录
   */
  private buildPrompt(entity: BaseEntity, analysis: StaticAnalysisResult, projectReadme: string = '', skipAnnotation: boolean = true, commitHistory: any[] = []): string {
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

    // 构建项目背景信息
    const projectContext = projectReadme ? 
      `\n项目背景信息:\n${projectReadme.length > 2000 ? projectReadme.substring(0, 2000) + '...' : projectReadme}\n` : 
      '';

    // 🆕 构建commit历史信息
    const commitContext = this.buildCommitContext(commitHistory);

    return `你是一位专业的代码理解助手和注释专家（专门为代码库生成高质量的代码注释）。请为以下代码实体生成简洁的业务摘要、标签、项目描述和规范化的代码注释。

如果需要查看更多相关文件来理解代码，可以使用read_file工具读取相关文件。
${projectContext}${commitContext}
实体信息:
- 类型: ${entity.type}
- 名称: ${entity.rawName}
- 文件: ${entity.file}
${analysis.ANNOTATION ? `- 现有注释: ${analysis.ANNOTATION}` : ''}

代码分析:
- 导入:
${importDetails}

- 调用:
${callDetails}

- 事件: ${analysis.EMITS.join(', ')}
${analysis.TEMPLATE_COMPONENTS ? `- 模板组件: ${analysis.TEMPLATE_COMPONENTS.join(', ')}` : ''}

请按照以下要求生成摘要、标签、项目描述和规范化的代码注释：

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

3. 项目描述要求：
   - 控制在100个字符以内
   - 基于项目背景信息，描述该实体在整个项目中的作用和定位
   - 如果项目背景信息不足，可以留空
   - 使用中文描述

4. publishTag要求：
   - 控制在180个字符以内
   - 基于历史提交记录的commit_summary，按时间顺序提取该实体解决的需求迭代
   - 使用逗号分隔的需求描述格式，每个描述体现一个完整的业务需求或功能迭代
   - 重点体现需求演进过程：如"建立基础功能,完善核心逻辑,优化用户体验,修复关键问题"
   - 避免技术术语，专注业务价值和用户需求
   - 如果没有提交记录，返回空字符串
   - 示例：
     * "实现商品搜索功能,优化搜索算法性能,增加搜索结果筛选,修复搜索异常问题"
     * "建立用户权限体系,完善角色管理机制,优化权限验证流程"
     * "创建订单处理流程,增强订单状态管理,优化订单查询性能"
   
5. 注释要求：${skipAnnotation ? ' 返回空字符串' : `
   - 为该代码实体生成符合JSDoc格式的注释
   - 根据实体类型，使用适当的JSDoc标签：
     * 函数：@description 函数的目的和行为, @param {类型} 参数名 - 参数描述, @returns {类型} 返回值描述, @business 此函数的业务上下文
     * 组件：@component 组件名, @description 组件的目的和功能, @props {类型} 属性名 - 属性描述, @emits 事件名 - 事件描述, @business 此组件的业务上下文
     * 类：@class 类名, @description 类的目的和功能, @business 此类的业务上下文
     * 变量：简单注释描述用途和业务含义
     * 文件：@file 简要文件描述, @description 文件功能的详细描述, @business 业务上下文说明
   - 注释应重点包含业务含义和技术作用，强调业务上下文而非纯技术描述
   - 必要时可以添加 @example 使用示例、@warning 重要提醒、@todo 待办事项等标签
   - 如有现有注释，保留其中有用的信息并进行规范化和丰富`}

在分析完成后，必须以下列JSON格式回复：
{
  "summary": "不超过160个字符的功能摘要",
  "tags": ["标签1", "标签2", "标签3", "标签4", "标签5"],
  "projectDesc": "不超过100个字符的项目描述（可为空字符串）",
  "annotation": "生成的代码注释（可为空字符串）",
  "publishTag": "基于历史提交的需求迭代描述，不超过180个字符（可为空字符串）"
}

注意：
1. 不要解释你的分析过程，直接返回JSON格式的结果。
2. 确保你的回复可以被JSON.parse()解析。
3. 如果存在注释信息，请优先参考注释内容来生成摘要和标签（假如注释标明"已废弃"，则表示该实体已废弃，摘要和标签都应为"已废弃"）。
4. 请参考导入和调用组件的文件路径来理解当前实体的业务上下文。
5. 项目描述应该基于提供的项目背景信息，如果背景信息不足则留空。
6. 代码注释专注于业务逻辑：强调代码实现的业务价值和业务上下文，而非纯技术描述。
`;
  }

  /**
   * 解析LLM回复中的JSON
   */
  private parseResponse(text: string, entity?: BaseEntity, analysis?: StaticAnalysisResult, skipAnnotation: boolean = true): LLMResponse {
    try {
      // 检查响应是否为空
      if (!text || text.trim().length === 0) {
        console.warn('LLM返回了空响应');
        return this.fallbackResult(entity, analysis, skipAnnotation);
      }

      // 尝试通过更可靠的方式提取JSON
      // 找到文本中第一个 { 和最后一个 }
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        console.warn('LLM响应中未找到完整的JSON格式内容:', text);
        return this.fallbackResult(entity, analysis, skipAnnotation);
      }

      // 提取完整的JSON文本
      const jsonText = text.substring(firstBrace, lastBrace + 1);
      console.log('提取的JSON文本长度:', jsonText.length);
      
      console.log('jsonText:', jsonText);
      
      const parsed = JSON.parse(jsonrepair(jsonText)) as LLMResponse;
      
      // 验证和清理
      const summary = typeof parsed.summary === 'string' 
        ? parsed.summary.substring(0, 160) // 确保不超过160个中文字
        : '';
        
      const tags = Array.isArray(parsed.tags) 
        ? parsed.tags.slice(0, 5).map(tag => typeof tag === 'string' ? tag : String(tag)) 
        : [];

      const projectDesc = typeof parsed.projectDesc === 'string'
        ? parsed.projectDesc.substring(0, 100) // 确保不超过100个字符
        : '';
      
      // 获取注释（如果有）
      const annotation = typeof parsed.annotation === 'string' ? parsed.annotation : '';
      
      // 🆕 获取publishTag（如果有）
      const publishTag = typeof parsed.publishTag === 'string' 
        ? parsed.publishTag.substring(0, 180) // 确保不超过180个字符
        : undefined;
      
      return { summary, tags, projectDesc, annotation, publishTag: publishTag || '' };
    } catch (error) {
      console.error(`解析LLM响应失败: ${(error as Error).message}`);
      return this.fallbackResult(entity, analysis, skipAnnotation);
    }
  }
  
  /**
   * 用失败时使用
   */
  private fallbackResult(entity?: BaseEntity, analysis?: StaticAnalysisResult, skipAnnotation: boolean = true): LLMResponse {
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
    
    // 生成简单的注释
    const annotation = entity && !skipAnnotation ? 
      `/**\n * @description ${summary}\n */` : '';
    
    return {
      summary,
      tags: tags.slice(0, 3),
      projectDesc: '', // fallback时项目描述为空
      annotation,
      publishTag: '' // fallback时publishTag为空字符串
    };
  }
} 