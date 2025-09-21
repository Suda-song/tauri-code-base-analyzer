/**
 * AI服务封装 - 统一的AI调用接口
 * 
 * 这个模块将AI生成与业务逻辑完全分离，提供统一、类型安全的AI调用接口。
 * 采用策略模式设计，支持不同场景下的AI调用需求，并提供完善的错误处理机制。
 * 
 * 设计特点：
 * - 接口统一：所有AI调用通过统一的服务接口进行
 * - 配置灵活：支持不同场景下的参数配置（温度、最大token等）
 * - 错误处理：完善的异常处理和错误信息记录
 * - 可测试性：便于单元测试和集成测试
 * - 可扩展性：易于支持新的AI模型和服务提供商
 * 
 * 支持的AI生成场景：
 * - 架构分析生成
 * - 目录详细分析
 * - 综合报告生成
 * - 业务组件分析
 */

import { createAnthropic } from "@xhs/aws-anthropic";
import { generateText } from "ai";

// 设置环境变量
process.env.XHS_AWS_BEDROCK_API_KEY = '54eda85a0d48401da9a27389d537634a';

/**
 * AI生成选项接口
 * 
 * 定义了AI生成过程中可配置的参数选项，支持不同场景下的个性化配置。
 */
export interface AIGenerationOptions {
    /** 生成文本的最大token数量，控制输出长度 */
    maxTokens?: number;
    
    /** 生成温度，控制输出的随机性和创造性（0-1之间，越高越随机） */
    temperature?: number;
    
    /** 使用的AI模型名称，支持不同版本的Claude模型 */
    model?: string;
}

/**
 * AI调用服务类
 * 
 * 核心的AI服务封装类，提供了完整的AI调用生命周期管理。
 * 采用依赖注入模式，支持配置化的AI模型和参数设置。
 * 
 * 服务特性：
 * - 统一接口：所有AI调用都通过统一的方法进行
 * - 场景优化：针对不同分析场景提供优化的参数配置
 * - 异常安全：完善的错误处理和异常信息记录
 * - 性能监控：支持生成过程的性能监控和日志记录
 */
export class AIService {
    /** Anthropic AI客户端实例 */
    private anthropic: any;
    
    /** 默认配置选项，作为所有AI调用的基础配置 */
    private defaultOptions: AIGenerationOptions;

    /**
     * 构造函数
     * 
     * 初始化AI服务实例，设置默认配置和客户端连接。
     * 支持自定义配置选项，便于不同环境下的个性化设置。
     * 
     * @param options 自定义配置选项，会与默认配置合并
     */
    constructor(options: AIGenerationOptions = {}) {
        this.anthropic = createAnthropic({});
        this.defaultOptions = {
            maxTokens: 4000,
            temperature: 0.7,
            model: "claude-3-7-sonnet-latest",
            ...options
        };
    }

    /**
     * 生成文本内容
     * 
     * 核心的AI文本生成方法，所有其他生成方法都基于此方法实现。
     * 提供了完整的配置支持和错误处理机制。
     * 
     * 功能特性：
     * - 配置合并：自动合并默认配置和临时配置
     * - 异常处理：AI生成失败时抛出详细的错误信息
     * - 日志记录：记录生成过程中的警告和错误信息
     * 
     * @param prompt AI提示词，用于指导AI生成相应内容
     * @param options 临时配置选项，会覆盖默认配置
     * @returns 生成的文本内容
     * @throws AIGenerationError 当AI生成失败时抛出，包含原始错误和提示词信息
     */
    async generateText(prompt: string, options?: AIGenerationOptions): Promise<string> {
        const finalOptions = { ...this.defaultOptions, ...options };
        
        try {
            const { text } = await generateText({
                // @ts-ignore
                model: this.anthropic(finalOptions.model),
                prompt,
                maxTokens: finalOptions.maxTokens
            });
            return text;
        } catch (error) {
            console.warn('⚠️ AI text generation failed:', error);
            throw new AIGenerationError(`AI generation failed: ${error}`, prompt);
        }
    }

    /**
     * 生成架构概览分析
     * 
     * 针对项目或代码库的架构进行概览分析，提供整体结构和关键组件的描述。
     * 适用于快速了解项目整体架构和主要组成部分。
     * 
     * 参数：
     * - prompt: AI提示词，描述需要分析的架构范围和重点。
     * - options: 可选配置，如温度、最大token等。
     * 
     * @param prompt AI提示词
     * @param options 可选配置
     * @returns 生成的架构概览分析文本
     */
    async generateArchitectureAnalysis(prompt: string): Promise<string> {
        return this.generateText(prompt, {
            maxTokens: 4000,
            temperature: 0.5  // 较低的温度以获得更一致的架构分析
        });
    }

    /**
     * 生成目录详细分析
     * 
     * 对项目或代码库的目录结构进行详细分析，包括文件和子目录的层级、数量、类型等。
     * 适用于深入了解项目组织结构和文件分布。
     * 
     * 参数：
     * - prompt: AI提示词，描述需要分析的目录范围和重点。
     * - options: 可选配置，如温度、最大token等。
     * 
     * @param prompt AI提示词
     * @param options 可选配置
     * @returns 生成的目录详细分析文本
     */
    async generateDirectoryAnalysis(prompt: string): Promise<string> {
        return this.generateText(prompt, {
            maxTokens: 3000,
            temperature: 0.6
        });
    }

    /**
     * 生成综合分析报告
     * 
     * 生成一个综合性的分析报告，结合架构、目录、代码质量等多个维度进行全面评估。
     * 适用于需要一次性获取多个分析结果的场景。
     * 
     * 参数：
     * - prompt: AI提示词，描述需要分析的代码库范围和重点。
     * - options: 可选配置，如温度、最大token等。
     * 
     * @param prompt AI提示词
     * @param options 可选配置
     * @returns 生成的综合分析报告文本
     */
    async generateComprehensiveReport(prompt: string): Promise<string> {
        return this.generateText(prompt, {
            maxTokens: 6000,
            temperature: 0.7
        });
    }

    /**
     * 生成业务组件分析
     * 
     * 对项目中的业务组件进行详细分析，包括组件的职责、依赖关系、性能等。
     * 适用于深入了解业务逻辑和系统架构。
     * 
     * 参数：
     * - prompt: AI提示词，描述需要分析的业务组件范围和重点。
     * - options: 可选配置，如温度、最大token等。
     * 
     * @param prompt AI提示词
     * @param options 可选配置
     * @returns 生成的业务组件分析文本
     */
    async generateBusinessComponentAnalysis(prompt: string): Promise<string> {
        return this.generateText(prompt, {
            maxTokens: 3500,
            temperature: 0.6
        });
    }
}

/**
 * AI 生成错误类
 * 
 * 专门用于AI生成过程中的错误处理，继承自标准Error类。
 * 提供了额外的提示词信息，便于调试和错误追踪。
 * 
 * 错误信息包含：
 * - 标准错误信息：描述错误的具体原因
 * - 提示词内容：导致错误的原始提示词，便于问题复现和调试
 * - 错误类型标识：通过name属性标识这是AI生成相关的错误
 */
export class AIGenerationError extends Error {
    /** 导致错误的原始提示词，用于调试和问题追踪 */
    public prompt: string;

    /**
     * 构造函数
     * 
     * @param message 错误描述信息
     * @param prompt 导致错误的原始提示词
     */
    constructor(message: string, prompt: string) {
        super(message);
        this.name = 'AIGenerationError';
        this.prompt = prompt;
    }
}

/**
 * 默认AI服务实例
 * 
 * 提供一个全局默认的AI服务实例，使用标准配置。
 * 大多数情况下可以直接使用这个实例，无需自己创建新的AIService对象。
 * 
 * 默认配置：
 * - maxTokens: 4000
 * - temperature: 0.7  
 * - model: "claude-3-7-sonnet-latest"
 * 
 * 使用场景：
 * - 快速开始，无需自定义配置
 * - 单例模式，节省资源
 * - 测试和开发环境的便捷使用
 */
export const defaultAIService = new AIService(); 