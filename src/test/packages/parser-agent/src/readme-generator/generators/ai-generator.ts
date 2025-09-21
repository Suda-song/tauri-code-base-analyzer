/**
 * AI 文档生成器 - 工程结构分析内容生成器
 * 
 * 这是整个README生成系统的核心组件，负责协调各个分析器的工作，
 * 通过AI生成详细的项目架构分析、目录结构分析、路由分析等内容。
 * 
 * 主要职责：
 * - 协调架构分析器、路由分析器、数据流分析器等子组件
 * - 管理AI生成流程和异常处理
 * - 提供统一的分析接口和回退机制
 * - 整合多种分析结果生成综合洞察报告
 */

import fs from 'fs';
import path from 'path';
import { AIInsights, ProjectAnalysis } from '../types';

// Import analyzers
import { ArchitectureAnalyzer } from './architecture-analyzer';
import { MermaidGenerator } from './mermaid-generator';
import { BaseEntity } from './types';
import { RouteConfigAnalyzer } from '../analyzers/route-config-analyzer';
// import { DataFlowAnalyzer } from '../analyzers/data-flow-analyzer';
import { PromptTemplates, PromptTemplateData, DirectoryPromptData } from './prompts';
import { AIService, defaultAIService } from './ai-service';
import { TemplateFormatters, RouteAnalysisData, DataFlowAnalysisData, DirectoryInfo } from './formatters';

/**
 * 工程结构分析生成器
 * 
 * 核心AI文档生成类，集成多个专业分析器，通过AI技术生成全面的项目分析报告。
 * 采用模块化设计，支持可插拔的分析器和可配置的AI服务。
 * 
 * 设计模式：
 * - 策略模式：不同类型的分析器可以互换使用
 * - 依赖注入：AI服务可以外部注入，便于测试和扩展
 * - 回退机制：当AI生成失败时，提供静态模板作为备选方案
 * 
 * 核心组件：
 * - architectureAnalyzer: 架构模式分析器
 * - mermaidGenerator: 流程图生成器  
 * - routeAnalyzer: 路由配置分析器（可选）
 * - dataFlowAnalyzer: 数据流转分析器（可选）
 * - aiService: AI调用服务封装
 */
export class AIDocumentGenerator {
    /** 架构分析器 - 分析项目的整体架构模式和技术栈 */
    private architectureAnalyzer: ArchitectureAnalyzer;
    
    /** Mermaid图表生成器 - 生成项目结构的可视化图表 */
    private mermaidGenerator: MermaidGenerator;
    
    /** 路由分析器 - 分析前端路由配置和页面组件关系（可选，用于Web项目） */
    private routeAnalyzer: RouteConfigAnalyzer | null = null;
    
    /** AI调用服务 - 封装与AI模型的交互逻辑 */
    private aiService: AIService;

    /**
     * 构造函数
     * 
     * @param aiService AI服务实例，默认使用全局默认服务
     *                  可以注入自定义的AI服务实现，便于测试和定制化
     */
    constructor(aiService: AIService = defaultAIService) {
        // 架构分析器和Mermaid生成器将在generateAllInsights中初始化
        // 这样设计是为了延迟初始化，只有在实际需要时才创建对象
        this.architectureAnalyzer = null!;
        this.mermaidGenerator = null!;
        this.aiService = aiService;
    }

    /**
     * 过滤重要目录
     * 
     * 从项目目录列表中筛选出对代码分析有价值的目录，排除依赖包、构建产物等无关目录。
     * 同时根据目录的重要性和包含的文件数量进行智能排序，确保最重要的目录优先分析。
     * 
     * 过滤规则：
     * - 排除第三方依赖：node_modules, .git等
     * - 排除构建产物：dist, build, .next等  
     * - 排除临时文件：tmp, temp, coverage等
     * 
     * 排序策略：
     * - 优先级关键词：src/components, src/utils, src/api等核心业务目录
     * - 文件数量：包含更多文件的目录优先级更高
     * - 最终返回前20个最重要的目录
     * 
     * @param directories 原始目录列表，包含路径、用途、文件数量等信息
     * @returns 过滤并排序后的重要目录列表，最多20个
     */
    private filterImportantDirectories(directories: any[]): any[] {
        const excludePatterns = [
            'node_modules',
            '.git',
            'dist',
            'build',
            '.next',
            '.nuxt',
            'coverage',
            '.nyc_output',
            'tmp',
            'temp'
        ];

        // 定义重要目录的优先级
        const priorityKeywords = [
            'src/constants',
            'src/providers', 
            'src/utils',
            'src/hooks',
            'src/components',
            'src/containers',
            'src/services',
            'src/api',
            'src/stores',
            'src/types',
            'constants',
            'providers',
            'utils', 
            'hooks',
            'components',
            'containers'
        ];

        const filtered = directories.filter((dir: any) => {
            const dirName = path.basename(dir.path);
            const dirPath = dir.path.toLowerCase();
            
            // Exclude specific patterns
            return !excludePatterns.some(pattern => 
                dirName.startsWith(pattern) || 
                dirPath.includes(`/${pattern}/`) ||
                dirPath.startsWith(pattern)
            );
        });

        // 按优先级排序：重要目录优先，然后按实体数量排序
        const sortedDirectories = filtered.sort((a, b) => {
            const aPath = a.path.toLowerCase();
            const bPath = b.path.toLowerCase();
            
            // 计算优先级得分
            const getScore = (dirPath: string) => {
                let score = 0;
                priorityKeywords.forEach((keyword, index) => {
                    if (dirPath.includes(keyword)) {
                        score += (priorityKeywords.length - index) * 10; // 优先级得分
                    }
                });
                return score;
            };
            
            const aScore = getScore(aPath);
            const bScore = getScore(bPath);
            
            // 先按优先级得分排序
            if (aScore !== bScore) {
                return bScore - aScore;
            }
            
            // 然后按文件数量排序
            return (b.fileCount || 0) - (a.fileCount || 0);
        });

        return sortedDirectories.slice(0, 20); // 增加到20个目录
    }

    /**
     * 按目录分组实体
     * 
     * 将代码实体按其所在目录进行分组，便于后续的目录级别分析。
     * 自动过滤掉workspace级别的实体，只保留具体的代码文件实体。
     * 
     * 处理逻辑：
     * - 过滤workspace实体：排除项目根目录级别的抽象实体
     * - 按目录路径分组：使用文件的dirname作为分组键
     * - 构建映射关系：目录路径 -> 该目录下的所有实体列表
     * 
     * 使用场景：
     * - 目录级别的代码分析
     * - 生成目录结构文档
     * - 计算每个目录的代码复杂度
     * 
     * @param entities 原始实体列表，包含项目中所有解析出的代码实体
     * @returns Map对象，键为目录路径，值为该目录下的实体数组
     */
    private groupEntitiesByDirectory(entities: BaseEntity[]): Map<string, BaseEntity[]> {
        const directoryMap = new Map<string, BaseEntity[]>();
        
        // 过滤掉workspace实体
        const filteredEntities = entities.filter(entity => entity.isWorkspace === false);

        filteredEntities.forEach(entity => {
            const dir = path.dirname(entity.file);
            if (!directoryMap.has(dir)) {
                directoryMap.set(dir, []);
            }
            directoryMap.get(dir)!.push(entity);
        });
        
        return directoryMap;
    }

    /**
     * 生成项目架构概览
     * 
     * 这是AI分析的核心方法之一，通过整合多种分析结果生成全面的项目架构概览。
     * 结合架构分析器、图表生成器、核心类型分析等多维度信息，利用AI生成深度洞察。
     * 
     * 分析维度：
     * - 架构模式识别：识别DDD、分层架构、微服务等架构模式
     * - 技术栈分析：分析技术选型的合理性和一致性
     * - 核心类型梳理：分析项目的核心数据类型和接口定义
     * - 可视化图表：生成Mermaid流程图增强理解
     * 
     * AI增强特性：
     * - 结合业务需求：如果提供了customContent，AI会特别关注相关业务逻辑
     * - 智能洞察：基于代码结构生成架构建议和改进方案
     * - 回退机制：AI生成失败时自动使用静态模板保证可用性
     * 
     * @param analysis 项目基础分析结果，包含技术栈、文件统计等信息
     * @param entities 过滤后的代码实体列表，排除workspace级别实体
     * @param customContent 可选的自定义业务需求描述，AI会重点关注这些要求
     * @returns AI生成的架构概览分析报告，markdown格式
     */
    async generateProjectArchitectureOverview(analysis: ProjectAnalysis, entities: BaseEntity[], customContent?: string): Promise<string> {
        // 过滤掉workspace实体
        const filteredEntities = entities.filter(entity => entity.isWorkspace === false);
        
        const architectureResult = this.architectureAnalyzer.analyzeArchitecture(analysis, filteredEntities);
        const mermaidDiagrams = this.mermaidGenerator.generateAllDiagrams(analysis, filteredEntities, architectureResult);
        
        // Generate core types analysis
        const coreTypesAnalysis = this.analyzeCoreTypes(filteredEntities);
        
        // 构建 Prompt 数据
        const promptData: PromptTemplateData = {
            analysis,
            entities: filteredEntities,
            customContent,
            architectureResult,
            coreTypesAnalysis,
            mermaidDiagrams
        };
        
        const prompt = PromptTemplates.generateArchitectureOverviewPrompt(promptData);

        try {
            return await this.aiService.generateArchitectureAnalysis(prompt);
        } catch (error) {
            console.warn('⚠️ Architecture overview generation failed:', error);
            return this.generateFallbackArchitectureOverview(analysis, filteredEntities);
        }
    }

    /**
     * 分析核心类型定义
     * 
     * 识别和分析项目中的核心类型定义文件，这些通常是项目的数据模型基础。
     * 通过分析interface、type等类型定义，可以深入理解项目的业务领域模型。
     * 
     * 识别策略：
     * - 文件路径匹配：包含'types'、'interface'关键词的文件
     * - 实体类型匹配：类型为'interface'、'type'的实体
     * - 按文件分组：同一文件中的相关类型会被归类分析
     * 
     * 分析价值：
     * - 了解数据模型设计：核心业务对象的结构设计
     * - 类型系统完整性：TypeScript类型定义的覆盖程度
     * - 架构清晰度：类型定义的组织方式反映架构思路
     * 
     * @param entities 项目中的所有代码实体
     * @returns 核心类型文件的分析摘要，包含文件路径和类型列表
     */
    private analyzeCoreTypes(entities: BaseEntity[]): string {
        const typeFiles = entities.filter(entity => 
            entity.file.includes('types') || 
            entity.file.includes('interface') ||
            entity.type === 'interface' ||
            entity.type === 'type'
        );

        if (typeFiles.length === 0) {
            return 'No core type files detected';
        }

        const typesByFile = new Map<string, BaseEntity[]>();
        typeFiles.forEach(entity => {
            if (!typesByFile.has(entity.file)) {
                typesByFile.set(entity.file, []);
            }
            typesByFile.get(entity.file)!.push(entity);
        });

        let analysis = 'Core type files analysis:\n';
        Array.from(typesByFile.entries()).slice(0, 5).forEach(([file, types]) => {
            analysis += `- ${file}: ${types.map(t => t.id || t.rawName).join(', ')}\n`;
        });

        return analysis;
    }

    /**
     * 生成详细目录代码分析
     * 
     * 对项目中的重要目录进行逐一深度分析，生成每个目录的职责、结构、依赖关系等详细报告。
     * 该方法是目录级别分析的入口，会智能筛选重要目录并进行批量处理。
     * 
     * 分析流程：
     * 1. 实体过滤：移除workspace级别的抽象实体
     * 2. 目录分组：将实体按所在目录进行分组
     * 3. 重要性筛选：选择最有价值的20个目录进行分析
     * 4. 批量处理：分批处理目录避免API限制
     * 5. 延迟控制：在批次间增加延迟避免频率限制
     * 
     * 技术特点：
     * - 智能限流：通过批量大小和延迟控制API调用频率
     * - 异常隔离：单个目录分析失败不影响其他目录
     * - 内容定制：支持自定义业务需求的重点关注
     * 
     * @param analysis 项目整体分析结果，提供全局上下文信息
     * @param entities 项目中的所有代码实体列表
     * @param customContent 可选的自定义业务需求，AI会在分析中特别关注
     * @returns 所有重要目录的详细分析报告，markdown格式，多个目录报告拼接而成
     */
    async generateDetailedDirectoryCodeAnalysis(analysis: ProjectAnalysis, entities: BaseEntity[], customContent?: string): Promise<string> {
        // 过滤掉workspace实体
        const filteredEntities = entities.filter(entity => entity.isWorkspace === false);
        const directoryMap = this.groupEntitiesByDirectory(filteredEntities);
        const importantDirectories = this.filterImportantDirectories(analysis.structure.directories);
        
        let allAnalysisResults = '';
        
        // Process directories in batches to avoid API limits
        const batchSize = 1;
        for (let i = 0; i < Math.min(importantDirectories.length, 20); i += batchSize) { // 增加到20个目录
            const batch = importantDirectories.slice(i, i + batchSize);
            
            const batchAnalysis = await this.processBatchDirectories(batch, directoryMap, analysis, customContent);
            allAnalysisResults += batchAnalysis + '\n\n';
            
            // Add delay to avoid API limits
            if (i + batchSize < importantDirectories.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        return allAnalysisResults;
    }

    /**
     * 批量处理目录分析
     * 
     * 对单个目录进行深度AI分析的核心方法。这个方法会智能处理各种边界情况，
     * 并通过AI生成该目录的详细分析报告，包括目录职责、文件结构、依赖关系等。
     * 
     * 处理流程：
     * 1. 边界检查：处理空目录和无效实体的情况
     * 2. 实体筛选：从目录下选择最具代表性的实体进行分析
     * 3. 文件分组：按文件对实体进行分组，便于理解文件职责
     * 4. AI分析：调用AI服务生成深度分析报告
     * 5. 异常处理：AI失败时使用回退模板保证可用性
     * 
     * 智能筛选策略：
     * - 最多选择4个文件进行分析，避免信息过载
     * - 每个文件最多分析3个实体，保证分析质量
     * - 优先选择包含更多实体的文件
     * 
     * @param directories 待分析的目录列表（通常只包含一个目录）
     * @param directoryMap 目录到实体的映射关系
     * @param analysis 项目整体分析信息，提供上下文
     * @param customContent 自定义业务需求，AI会特别关注这些内容
     * @returns 该目录的详细分析报告，markdown格式
     */
    private async processBatchDirectories(
        directories: any[],
        directoryMap: Map<string, BaseEntity[]>,
        analysis: ProjectAnalysis,
        customContent?: string
    ): Promise<string> {
        const dir = directories[0];
        const allFolderEntities = directoryMap.get(dir.path) || [];

        if (allFolderEntities.length === 0) {
            return TemplateFormatters.generateEmptyDirectoryAnalysis(dir);
        }

        // Group entities by file, take entities from top 4 files
        const entitiesByFile = new Map<string, BaseEntity[]>();
        allFolderEntities.forEach(entity => {
            if (!entitiesByFile.has(entity.file)) {
                entitiesByFile.set(entity.file, []);
            }
            entitiesByFile.get(entity.file)!.push(entity);
        });

        const fileEntries = Array.from(entitiesByFile.entries()).slice(0, 4);
        const representativeEntities = fileEntries.flatMap(([, entities]) => entities.slice(0, 3));
        
        if (representativeEntities.length === 0) {
            return TemplateFormatters.generateInvalidEntitiesDirectoryAnalysis(dir);
        }

        // 构建目录分析 Prompt 数据
        const promptData: DirectoryPromptData = {
            dir,
            representativeEntities,
            fileEntries,
            customContent
        };

        // 添加强调保持Markdown标题层级一致性的提示
        let prompt = PromptTemplates.generateDirectoryAnalysisPrompt(promptData);
        prompt += "\n\nIMPORTANT FINAL NOTE: Maintain strict markdown heading hierarchy. Use ## for directory headings, ### for subsections, and #### for file details. NEVER use single # for directory headings.";

        try {
            return await this.aiService.generateDirectoryAnalysis(prompt);
        } catch (error) {
            console.warn(`⚠️ Directory analysis failed for ${dir.path}:`, error);
            return this.generateFallbackDirectoryAnalysis(dir, representativeEntities);
        }
    }

    /**
     * 生成回退目录分析
     * 
     * 当AI分析失败时的备选方案，生成基于静态模板的目录分析报告。
     * 虽然不如AI分析深入，但能保证系统的可用性和基本分析功能。
     * 
     * 回退分析内容：
     * - 目录基本信息：路径、文件数量等
     * - 实体统计：按类型统计实体分布
     * - 文件列表：列出主要的代码文件
     * 
     * @param dir 目录信息对象，包含路径和基本统计数据
     * @param entities 该目录下的代表性实体列表
     * @returns 静态模板生成的目录分析报告
     */
    private generateFallbackDirectoryAnalysis(dir: DirectoryInfo, entities: BaseEntity[]): string {
        return TemplateFormatters.generateFallbackDirectoryAnalysis(dir, entities);
    }

    /**
     * 生成回退架构概览
     * 
     * 当AI架构分析失败时的备选方案，使用静态模板生成基础的架构概览。
     * 提供项目的基本架构信息，确保在AI服务不可用时仍能生成可读的分析报告。
     * 
     * 回退内容包括：
     * - 项目基本信息：名称、描述、技术栈
     * - 文件结构统计：文件数量、类型分布
     * - 主要技术特征：基于文件扩展名的技术栈识别
     * 
     * @param analysis 项目分析结果，包含基础统计信息
     * @param entities 过滤后的实体列表
     * @returns 静态模板生成的架构概览报告
     */
    private generateFallbackArchitectureOverview(analysis: ProjectAnalysis, entities: BaseEntity[]): string {
        return TemplateFormatters.generateFallbackArchitectureOverview(analysis, entities);
    }

    /**
     * 生成所有工程洞察
     * 
     * 这是AI文档生成的主入口方法，协调所有分析器生成完整的工程分析报告。
     * 该方法按照特定的顺序执行各种分析，并将结果整合成全面的项目洞察。
     * 
     * 分析流程：
     * 1. 初始化准备：过滤实体、初始化分析器
     * 2. 架构概览：生成项目整体架构分析
     * 3. 目录分析：深入分析重要目录的代码结构
     * 4. 路由分析：分析前端路由配置（如果适用）
     * 5. 数据流分析：分析组件间数据流转（如果适用）
     * 6. 综合报告：整合所有分析结果生成最终报告
     * 
     * 特殊处理：
     * - 自定义需求：如果提供customContent，所有分析都会特别关注这些内容
     * - 异常隔离：某个分析失败不会影响其他分析的执行
     * - 延迟控制：在分析间添加延迟避免API频率限制
     * 
     * @param analysis 项目基础分析结果，包含文件统计、技术栈等信息
     * @param projectPath 项目根目录路径，用于路由和数据流分析
     * @param entities 项目中解析出的所有代码实体
     * @param customContent 可选的自定义业务需求，会在所有分析中重点关注
     * @returns 包含所有洞察的完整分析报告对象
     */
    async generateAllInsights(analysis: ProjectAnalysis, projectPath: string, entities: BaseEntity[], customContent?: string): Promise<AIInsights> {
        console.log('🤖 Starting engineering structure analysis...');

        // 过滤掉workspace实体
        const filteredEntities = entities.filter(entity => entity.isWorkspace === false);
        console.log(`📊 Filtered entities: ${filteredEntities.length} (from ${entities.length} total)`);

        // 记录自定义内容（如果提供）
        if (customContent) {
            console.log('📋 检测到自定义业务要求，将重点关注以下内容：');
            console.log(customContent.substring(0, 200) + (customContent.length > 200 ? '...' : ''));
        }

        // 初始化分析器
        this.architectureAnalyzer = new ArchitectureAnalyzer();
        this.mermaidGenerator = new MermaidGenerator();
        this.routeAnalyzer = new RouteConfigAnalyzer(projectPath, [], this.aiService, customContent);

        // 1. 生成包含自定义内容的架构概览
        const architectureOverview = await this.generateProjectArchitectureOverview(analysis, filteredEntities, customContent);
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // 2. 生成包含自定义内容的详细目录分析
        const detailedCodeAnalysis = await this.generateDetailedDirectoryCodeAnalysis(analysis, filteredEntities, customContent);
            
        try {          
            // 3. 生成路由配置分析
            const routeAnalysis = await this.generateRouteConfigAnalysis(analysis, filteredEntities);
               

            // 4. 生成其他分析报告（不需要AI调用）
            const mermaidDiagrams = this.mermaidGenerator.generateAllDiagrams(analysis, filteredEntities, this.architectureAnalyzer.analyzeArchitecture(analysis, filteredEntities));

            // 5. 整合所有分析结果
            const comprehensiveAnalysis = await this.buildComprehensiveAnalysis(
                architectureOverview,
                detailedCodeAnalysis,
                mermaidDiagrams,
                analysis,
                filteredEntities,
                customContent
            );

            return {
                architectureInsights: architectureOverview,
                usageGuide: detailedCodeAnalysis,
                developmentGuide: comprehensiveAnalysis,
                deploymentGuide: '',
                routeAnalysis
            };
        } catch (error) {
            console.error('⚠️ Error during engineering analysis:', error);
            return this.generateFallbackInsights(analysis, filteredEntities);
        }
    }

    /**
     * 构建综合分析报告
     * 
     * 将各种专项分析结果整合成一份完整的综合分析报告。
     * 这是最终用户看到的主要技术文档，包含项目的全方位技术分析。
     * 
     * 报告结构：
     * 1. 业务需求（如果有）：优先展示自定义的业务关注点
     * 2. 架构图表：Mermaid可视化图表增强理解
     * 3. 路由分析：前端路由配置和页面结构分析
     * 4. 数据流分析：组件间数据流转和API调用分析
     * 
     * 设计特点：
     * - 模块化组织：不同分析结果独立呈现，便于阅读
     * - 安全检查：对所有输入数据进行有效性验证
     * - 分隔符：使用统一的分隔符提高文档可读性
     * 
     * @param architectureOverview 架构概览分析结果
     * @param detailedCodeAnalysis 详细目录代码分析结果
     * @param routeAnalysis 路由分析结果
     * @param mermaidDiagrams Mermaid图表列表
     * @param analysis 项目基础分析数据
     * @param entities 过滤后的实体列表
     * @param customContent 自定义业务需求内容
     * @returns 完整的综合分析报告，markdown格式
     */
    private async buildComprehensiveAnalysis(
        architectureOverview: string,
        detailedCodeAnalysis: string,
        mermaidDiagrams: any,
        analysis: ProjectAnalysis,
        entities: BaseEntity[],
        customContent?: string
    ): Promise<string> {
        let report = '';

        // Add custom business requirements at the beginning if provided
        if (customContent) {
            report += '## 🎯 业务特定要求与重点关注\n\n';
            report += customContent;
            report += '\n\n---\n\n';
        }

        // Mermaid diagrams - 添加安全检查
        if (mermaidDiagrams && Array.isArray(mermaidDiagrams) && mermaidDiagrams.length > 0) {
            report += '## 📊 Project Architecture Diagrams\n\n';
            mermaidDiagrams.filter((diagram: any) => !!diagram.title).slice(0, 3).forEach((diagram: any) => {
                if (diagram && diagram.title && diagram.description && diagram.content) {
                    report += `### ${diagram.title}\n\n`;
                    report += `${diagram.description}\n\n`;
                    report += '```mermaid\n';
                    report += diagram.content;
                    report += '\n```\n\n';
                }
            });
        }

        return report;
    }

    /**
     * 生成回退洞察
     * 
     * 当完整的AI分析流程失败时的应急方案，确保始终能生成可用的分析报告。
     * 使用静态模板和基础分析算法生成简化版的项目洞察。
     * 
     * 回退策略：
     * - 基础架构分析：使用模板生成基本架构信息
     * - 简单代码分析：基于统计数据的代码分析
     * - 固定格式：使用预定义格式确保输出一致性
     * 
     * @param analysis 项目基础分析数据
     * @param entities 过滤后的实体列表
     * @returns 回退模式下的基础洞察报告
     */
    private generateFallbackInsights(analysis: ProjectAnalysis, entities: BaseEntity[]): AIInsights {
        const architectureOverview = this.generateFallbackArchitectureOverview(analysis, entities);
        const simpleCodeAnalysis = this.generateSimpleCodeAnalysis(analysis, entities);
        
        return {
            architectureInsights: architectureOverview,
            usageGuide: simpleCodeAnalysis,
            developmentGuide: 'Comprehensive analysis report is temporarily unavailable, please refer to the basic architecture analysis.',
            deploymentGuide: '',
            routeAnalysis: ''
        };
    }

    /**
     * 生成简单代码分析
     * 
     * 基于静态模板的简化版代码分析，当AI分析不可用时提供基础的代码洞察。
     * 主要基于文件统计、目录结构等静态信息生成分析报告。
     * 
     * 分析内容：
     * - 目录结构概览：重要目录的基本信息
     * - 实体统计：按类型统计代码实体分布  
     * - 文件组织：展示项目的文件组织结构
     * 
     * @param analysis 项目分析结果，包含基础统计信息
     * @param entities 过滤后的实体列表
     * @returns 简单的代码分析报告，markdown格式
     */
    private generateSimpleCodeAnalysis(analysis: ProjectAnalysis, entities: BaseEntity[]): string {
        // 过滤掉workspace实体
        const filteredEntities = entities.filter(entity => entity.isWorkspace === false);
        
        const directoryMap = this.groupEntitiesByDirectory(filteredEntities);
        const importantDirectories = this.filterImportantDirectories(analysis.structure.directories);

        return TemplateFormatters.generateSimpleCodeAnalysis(
            analysis,
            filteredEntities,
            directoryMap,
            importantDirectories
        );
    }

    /**
     * 格式化增强路由分析结果
     * 
     * 将增强的路由分析结果转换为格式化的markdown文档，包含Component Relations和File Relations。
     * 
     * @param enhancedResult 增强的路由分析结果
     * @returns 格式化后的增强路由分析报告，markdown格式
     */
    private formatEnhancedRouteAnalysis(enhancedResult: any): string {
        return TemplateFormatters.formatEnhancedRouteAnalysis(enhancedResult);
    }

    /**
     * 生成路由配置分析
     */
    private async generateRouteConfigAnalysis(analysis: ProjectAnalysis, filteredEntities: BaseEntity[]): Promise<string> {
        if (!this.routeAnalyzer) return "";
        
        try {
            console.log("🌐 开始路由配置分析...");
            const enrichedEntities = filteredEntities as any[];
            this.routeAnalyzer.setEnrichedEntities(enrichedEntities);
            
            const result = await this.routeAnalyzer.analyzeEnhancedWithRelations();
            if (result && result.routeAnalysis) {
                return this.formatEnhancedRouteAnalysis(result);
            }
            return "";
        } catch (error) {
            console.warn("⚠️ Route config analysis failed:", error);
            return "";
        }
    }

    /**
     * 格式化数据流分析结果
     * 
     * 将数据流分析器的原始分析结果转换为格式化的markdown文档。
     * 通过模板格式化器统一处理数据流分析结果的展示格式。
     * 
     * 格式化内容：
     * - 数据流概览：显示数据在组件间的流转路径
     * - API调用分析：组件与后端API的交互关系
     * - 状态管理：全局状态和本地状态的使用情况
     * 
     * @param dataFlowResult 数据流分析器返回的原始分析结果
     * @returns 格式化后的数据流分析报告，markdown格式
     */
    private formatDataFlowAnalysis(dataFlowResult: DataFlowAnalysisData | null): string {
        return TemplateFormatters.formatDataFlowAnalysis(dataFlowResult);
    }
}

/**
 * README内容生成器
 * 
 * 负责生成完整README文档的高级封装类。
 * 集成AI文档生成器，并添加了文件操作、自定义内容读取等实用功能。
 * 
 * 主要功能：
 * - README内容生成：协调AI生成器生成完整的README文档
 * - 自定义内容支持：支持从外部文件读取自定义业务需求
 * - 异常处理：提供完善的错误处理和回退机制
 * - 格式化输出：确保生成的README符合markdown规范
 * 
 * 使用场景：
 * - 项目文档自动化：自动为代码项目生成技术文档
 * - CI/CD集成：在持续集成流程中自动更新项目文档
 * - 定制化文档：根据特定业务需求生成针对性文档
 */
export class ReadmeContentGenerator {
    /** AI文档生成器实例 - 负责核心的AI分析和内容生成 */
    private aiGenerator: AIDocumentGenerator;

    /**
     * 构造函数
     * 
     * 初始化README内容生成器，创建AI文档生成器实例。
     * 采用组合模式，将AI生成能力封装在内部。
     */
    constructor() {
        this.aiGenerator = new AIDocumentGenerator();
    }

    /**
     * 生成完整README内容
     * 
     * 这是README生成的主要入口方法，协调所有组件生成完整的项目文档。
     * 支持自定义业务需求，能够根据特定要求调整生成的文档内容。
     * 
     * 生成流程：
     * 1. 参数验证：检查项目路径和分析数据的有效性
     * 2. 实体提取：从分析结果中提取代码实体信息
     * 3. 自定义内容：读取外部文件中的自定义业务需求
     * 4. AI分析：调用AI生成器进行深度分析
     * 5. 文档构建：将分析结果整合成完整的README文档
     * 
     * 特殊处理：
     * - 空实体处理：当没有发现代码实体时使用回退方案
     * - 文件读取：安全地读取自定义需求文件
     * - 异常恢复：任何步骤失败都有相应的回退策略
     * 
     * @param analysis 项目分析结果，包含文件统计、技术栈等基础信息
     * @param template 文档模板（当前版本暂未使用，为未来扩展预留）
     * @param language 文档语言（当前版本暂未使用，为未来国际化预留）
     * @param projectPath 项目根目录路径，用于路由分析等需要文件系统访问的功能
     * @param customFile 可选的自定义需求文件路径，包含特定的业务关注点
     * @returns 完整的README文档内容，markdown格式
     */
    async generateContent(
        analysis: ProjectAnalysis,
        template: string,
        language: string,
        projectPath?: string,
        customFile?: string
    ): Promise<string> {
        const actualProjectPath = projectPath || process.cwd();
        
        // Extract entities, ensure data availability
        const entities = (analysis as any).entities as BaseEntity[] || [];
        if (entities.length === 0) {
            console.warn('⚠️ No entities found in analysis result, unable to generate AI analysis content.');
            return this.generateFallbackReadme(analysis);
        }

        // Read custom content if provided
        let customContent = '';
        if (customFile && fs.existsSync(customFile)) {
            try {
                customContent = fs.readFileSync(customFile, 'utf8');
                console.log(`📋 成功读取自定义文件: ${customFile}`);
            } catch (error) {
                console.warn(`⚠️ 读取自定义文件失败: ${customFile}`, error);
            }
        }

        // Get AI-generated engineering analysis content
        const insights = await this.aiGenerator.generateAllInsights(analysis, actualProjectPath, entities, customContent);

        // Build final README
        return this.buildReadme(this.aiGenerator,analysis, insights, entities, customContent);
    }

    /**
     * 构建README文档
     * 
     * 将AI分析生成的各种洞察整合成最终的README文档。
     * 通过模板格式化器确保文档格式的一致性和专业性。
     * 
     * 文档结构：
     * - 项目概述：基于分析结果的项目介绍
     * - 架构洞察：AI生成的架构分析
     * - 使用指南：详细的目录和代码分析
     * - 开发指南：综合的开发文档
     * - 自定义内容：如果有的话，会在合适位置插入
     * 
     * @param analysis 项目基础分析结果
     * @param insights AI生成的各种洞察报告
     * @param entities 代码实体列表
     * @param customContent 自定义业务需求内容
     * @returns 完整的README文档，markdown格式
     */
    private buildReadme(aiGenerator: AIDocumentGenerator, analysis: ProjectAnalysis, insights: AIInsights, entities: BaseEntity[], customContent?: string): string {
        return TemplateFormatters.buildReadme(aiGenerator, analysis, insights, entities, customContent);
        }

    /**
     * 生成回退README
     * 
     * 当AI分析完全失败时的最后备选方案，生成基础的项目README。
     * 基于项目的静态分析结果，提供最基本但完整的项目文档。
     * 
     * 回退内容：
     * - 项目基本信息：名称、描述等
     * - 技术栈识别：基于文件类型的技术栈推断
     * - 文件结构：基本的目录结构展示
     * - 标准模板：使用预定义的文档模板
     * 
     * @param analysis 项目基础分析结果
     * @returns 基础版README文档，markdown格式
     */
    private generateFallbackReadme(analysis: ProjectAnalysis): string {
        return TemplateFormatters.generateFallbackReadme(analysis);
    }
}
