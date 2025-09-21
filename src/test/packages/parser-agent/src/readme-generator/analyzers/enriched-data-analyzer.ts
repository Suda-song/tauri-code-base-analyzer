/**
 * Enriched 数据分析器 - 处理 entities.enriched.json 数据
 */

import fs from 'fs';
import path from 'path';
import {
    EnrichedEntity,
    SpecialMeaningAnalysis,
    CriticalDirectoryInfo,
    CriticalFileInfo,
    EngineeringPattern,
    FolderStandardAnalysis,
    FolderStandard,
    StandardConflict,
    EnhancedDirectoryInfo
} from '../types';

/**
 * Enriched 数据分析器
 */
export class EnrichedDataAnalyzer {
    private projectPath: string;
    private enrichedEntities: EnrichedEntity[] = [];
    private enrichedDataPath: string;

    constructor(projectPath: string) {
        this.projectPath = projectPath;
        this.enrichedDataPath = path.join(projectPath, 'data', 'entities.enriched.json');
    }

    /**
     * 加载 enriched 数据
     */
    async loadEnrichedData(): Promise<EnrichedEntity[]> {
        try {
            if (fs.existsSync(this.enrichedDataPath)) {
                const data = fs.readFileSync(this.enrichedDataPath, 'utf-8');
                this.enrichedEntities = JSON.parse(data);
                console.log(`✅ 加载了 ${this.enrichedEntities.length} 个 enriched 实体`);
                return this.enrichedEntities;
            } else {
                console.log('⚠️  未找到 entities.enriched.json 文件，使用默认分析');
                return [];
            }
        } catch (error) {
            console.error('❌ 加载 enriched 数据失败:', error);
            return [];
        }
    }

    /**
     * 基于 enriched 数据生成目录语义描述
     */
    generateDirectorySemantics(): Map<string, EnhancedDirectoryInfo> {
        const directoryMap = new Map<string, EnhancedDirectoryInfo>();

        // 按目录分组实体
        const entitiesByDirectory = this.groupEntitiesByDirectory();

        entitiesByDirectory.forEach((entities, dirPath) => {
            const semanticDescription = this.generateDirectorySemanticDescription(entities);
            const enrichedPurpose = this.generateEnrichedPurpose(entities);
            const specialMeaning = this.detectDirectorySpecialMeaning(dirPath, entities);
            
            directoryMap.set(dirPath, {
                path: dirPath,
                purpose: enrichedPurpose,
                semanticDescription,
                enrichedPurpose,
                specialMeaning,
                fileCount: entities.length,
                subDirectories: 0, // 将在后续计算
                mainFileTypes: this.getMainFileTypes(entities),
                importance: this.calculateDirectoryImportance(dirPath, entities),
                containsPages: this.containsPages(entities),
                containsServices: this.containsServices(entities),
                containsUtils: this.containsUtils(entities)
            });
        });

        return directoryMap;
    }

    /**
     * 按目录分组实体
     */
    private groupEntitiesByDirectory(): Map<string, EnrichedEntity[]> {
        const directoryMap = new Map<string, EnrichedEntity[]>();

        this.enrichedEntities.forEach(entity => {
            const dirPath = path.dirname(entity.file);
            if (!directoryMap.has(dirPath)) {
                directoryMap.set(dirPath, []);
            }
            directoryMap.get(dirPath)!.push(entity);
        });

        return directoryMap;
    }

    /**
     * 生成目录语义描述
     */
    private generateDirectorySemanticDescription(entities: EnrichedEntity[]): string {
        const summaries = entities.map(e => e.summary).filter(s => s);
        const tags = entities.flatMap(e => e.tags || []);
        
        // 提取关键词
        const keywordCounts = new Map<string, number>();
        tags.forEach(tag => {
            keywordCounts.set(tag, (keywordCounts.get(tag) || 0) + 1);
        });

        const topKeywords = Array.from(keywordCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([keyword]) => keyword);

        // 分析文件类型
        const fileTypes = entities.map(e => e.type);
        const hasComponents = fileTypes.includes('component');
        const hasServices = fileTypes.includes('function') || fileTypes.includes('service');
        const hasUtils = fileTypes.includes('utility') || fileTypes.includes('helper');

        let description = '';
        if (hasComponents) {
            description += '组件模块，';
        }
        if (hasServices) {
            description += '服务逻辑，';
        }
        if (hasUtils) {
            description += '工具函数，';
        }

        description += `主要包含${topKeywords.join('、')}相关功能`;

        return description;
    }

    /**
     * 生成增强的目录用途描述
     */
    private generateEnrichedPurpose(entities: EnrichedEntity[]): string {
        const purposes = entities.map(e => e.summary).filter(s => s);
        if (purposes.length === 0) return '未知用途';

        // 使用 AI 风格的摘要生成
        const commonThemes = this.extractCommonThemes(purposes);
        return `${commonThemes.join('、')}的实现和管理`;
    }

    /**
     * 提取共同主题
     */
    private extractCommonThemes(summaries: string[]): string[] {
        const themes: string[] = [];
        const keywords = ['售后', '订单', '用户', '数据', '管理', '服务', '组件', '工具', '配置'];
        
        keywords.forEach(keyword => {
            const count = summaries.filter(s => s.includes(keyword)).length;
            if (count > 0) {
                themes.push(keyword);
            }
        });

        return themes.slice(0, 3);
    }

    /**
     * 检测目录特殊工程含义
     */
    private detectDirectorySpecialMeaning(dirPath: string, entities: EnrichedEntity[]): string | undefined {
        const dirName = path.basename(dirPath);
        
        // 基于文件名模式的检测
        const patternMeanings = this.getPatternMeanings();
        for (const [pattern, meaning] of patternMeanings) {
            if (pattern.test(dirName)) {
                return meaning;
            }
        }

        // 基于 tags 的检测
        const allTags = entities.flatMap(e => e.tags || []);
        const specialTags = ['应用入口', '路由配置', '状态管理', 'API接口', '核心组件'];
        
        for (const tag of specialTags) {
            if (allTags.includes(tag)) {
                return `包含${tag}的关键模块`;
            }
        }

        return undefined;
    }

    /**
     * 获取模式含义映射
     */
    private getPatternMeanings(): Map<RegExp, string> {
        return new Map([
            [/^(pages?|views?)$/i, '页面组件目录，包含应用的主要页面'],
            [/^components?$/i, '可复用组件目录，包含通用UI组件'],
            [/^(services?|api)$/i, '服务层目录，包含API调用和业务逻辑'],
            [/^(stores?|state)$/i, '状态管理目录，包含全局状态和数据流'],
            [/^utils?$/i, '工具函数目录，包含通用工具和辅助函数'],
            [/^hooks?$/i, '自定义Hook目录，包含可复用的逻辑'],
            [/^(config|configs)$/i, '配置文件目录，包含应用配置'],
            [/^(types?|interfaces?)$/i, '类型定义目录，包含TypeScript类型'],
            [/^(constants?|const)$/i, '常量定义目录，包含应用常量'],
            [/^(assets?|static)$/i, '静态资源目录，包含图片、样式等'],
            [/^(tests?|__tests__)$/i, '测试文件目录，包含单元测试和集成测试']
        ]);
    }

    /**
     * 分析特殊工程含义
     */
    analyzeSpecialMeanings(): SpecialMeaningAnalysis {
        const criticalDirectories: CriticalDirectoryInfo[] = [];
        const criticalFiles: CriticalFileInfo[] = [];
        const engineeringPatterns: EngineeringPattern[] = [];

        // 分析关键目录
        const directorySemanticsMap = this.generateDirectorySemantics();
        directorySemanticsMap.forEach((info, dirPath) => {
            if (info.specialMeaning) {
                criticalDirectories.push({
                    path: dirPath,
                    specialMeaning: info.specialMeaning,
                    importance: info.importance,
                    reason: `基于文件内容和标签分析识别`,
                    detectionMethod: 'tags',
                    relatedFiles: this.getDirectoryFiles(dirPath)
                });
            }
        });

        // 分析关键文件
        this.enrichedEntities.forEach(entity => {
            const importance = this.calculateFileImportance(entity);
            if (importance > 7) {
                criticalFiles.push({
                    path: entity.file,
                    specialMeaning: this.getFileSpecialMeaning(entity),
                    importance,
                    reason: `高重要性文件，${entity.summary}`,
                    detectionMethod: 'tags',
                    tags: entity.tags || []
                });
            }
        });

        // 识别工程模式
        engineeringPatterns.push(...this.identifyEngineeringPatterns());

        return {
            criticalDirectories,
            criticalFiles,
            engineeringPatterns,
            recommendations: this.generateRecommendations(criticalDirectories, criticalFiles)
        };
    }

    /**
     * 计算文件重要性
     */
    private calculateFileImportance(entity: EnrichedEntity): number {
        let importance = 5; // 基础重要性

        // 基于文件类型
        if (entity.type === 'component') importance += 2;
        if (entity.type === 'function') importance += 1;

        // 基于标签
        const highValueTags = ['应用入口', '路由配置', '状态管理', 'API接口'];
        const hasHighValueTag = entity.tags?.some(tag => highValueTags.includes(tag));
        if (hasHighValueTag) importance += 3;

        // 基于依赖关系
        const totalDependencies = (entity.IMPORTS?.length || 0) + (entity.CALLS?.length || 0);
        if (totalDependencies > 5) importance += 2;

        return Math.min(importance, 10);
    }

    /**
     * 获取文件特殊含义
     */
    private getFileSpecialMeaning(entity: EnrichedEntity): string {
        const fileName = path.basename(entity.file);
        
        // 基于文件名模式
        if (fileName.match(/^(App|app)\.(vue|tsx?)$/)) {
            return '应用程序入口文件';
        }
        if (fileName.match(/^(router|routes?)\.(ts|js)$/)) {
            return '路由配置文件';
        }
        if (fileName.match(/^(store|stores?)\.(ts|js)$/)) {
            return '状态管理文件';
        }

        // 基于 tags
        const primaryTag = entity.tags?.[0];
        if (primaryTag) {
            return `${primaryTag}相关的核心文件`;
        }

        return entity.summary || '重要业务文件';
    }

    /**
     * 识别工程模式
     */
    private identifyEngineeringPatterns(): EngineeringPattern[] {
        const patterns: EngineeringPattern[] = [];

        // 分析组件模式
        const componentEntities = this.enrichedEntities.filter(e => e.type === 'component');
        if (componentEntities.length > 0) {
            patterns.push({
                pattern: 'Vue组件化开发',
                description: '采用Vue.js框架进行组件化开发',
                examples: componentEntities.slice(0, 3).map(e => e.file),
                benefits: ['代码复用', '维护性强', '团队协作友好']
            });
        }

        // 分析服务模式
        const serviceEntities = this.enrichedEntities.filter(e => 
            e.tags?.includes('API接口') || e.tags?.includes('服务层'));
        if (serviceEntities.length > 0) {
            patterns.push({
                pattern: '服务层架构',
                description: '将API调用和业务逻辑抽象为服务层',
                examples: serviceEntities.slice(0, 3).map(e => e.file),
                benefits: ['业务逻辑分离', 'API统一管理', '代码复用']
            });
        }

        return patterns;
    }

    /**
     * 分析文件夹规范
     */
    analyzeFolderStandards(): FolderStandardAnalysis {
        const recommendedStandards: FolderStandard[] = [];
        const userCustomStandards: FolderStandard[] = [];
        const conflictResolution: StandardConflict[] = [];

        // 基于现有结构推荐标准
        const directorySemanticsMap = this.generateDirectorySemantics();
        directorySemanticsMap.forEach((info, dirPath) => {
            const standard = this.generateRecommendedStandard(dirPath, info);
            if (standard) {
                recommendedStandards.push(standard);
            }
        });

        // 计算合规性得分
        const complianceScore = this.calculateComplianceScore(recommendedStandards);

        return {
            recommendedStandards,
            userCustomStandards,
            conflictResolution,
            complianceScore
        };
    }

    /**
     * 生成推荐标准
     */
    private generateRecommendedStandard(dirPath: string, info: EnhancedDirectoryInfo): FolderStandard | null {
        const dirName = path.basename(dirPath);
        
        const standardRules = new Map([
            ['components', {
                purpose: '可复用组件存储',
                expectedFileTypes: ['.vue', '.tsx', '.jsx'],
                namingConvention: 'PascalCase',
                organizationRule: '按功能模块分组'
            }],
            ['pages', {
                purpose: '页面组件存储',
                expectedFileTypes: ['.vue', '.tsx', '.jsx'],
                namingConvention: 'PascalCase',
                organizationRule: '按路由层级分组'
            }],
            ['services', {
                purpose: 'API服务和业务逻辑',
                expectedFileTypes: ['.ts', '.js'],
                namingConvention: 'camelCase',
                organizationRule: '按业务域分组'
            }],
            ['utils', {
                purpose: '工具函数和辅助方法',
                expectedFileTypes: ['.ts', '.js'],
                namingConvention: 'camelCase',
                organizationRule: '按功能分类'
            }]
        ]);

        const rule = standardRules.get(dirName);
        if (!rule) return null;

        return {
            path: dirPath,
            purpose: rule.purpose,
            expectedFileTypes: rule.expectedFileTypes,
            namingConvention: rule.namingConvention,
            organizationRule: rule.organizationRule,
            examples: this.getDirectoryFiles(dirPath).slice(0, 3),
            priority: 'system'
        };
    }

    /**
     * 计算合规性得分
     */
    private calculateComplianceScore(standards: FolderStandard[]): number {
        if (standards.length === 0) return 0;

        let totalScore = 0;
        let totalItems = 0;

        standards.forEach(standard => {
            const files = this.getDirectoryFiles(standard.path);
            if (files.length === 0) return;

            const expectedTypes = standard.expectedFileTypes;
            const matchingFiles = files.filter(file => 
                expectedTypes.some(type => file.endsWith(type))
            );

            const compliance = matchingFiles.length / files.length;
            totalScore += compliance * 100;
            totalItems++;
        });

        return totalItems > 0 ? totalScore / totalItems : 0;
    }

    /**
     * 获取目录下的文件
     */
    private getDirectoryFiles(dirPath: string): string[] {
        return this.enrichedEntities
            .filter(entity => path.dirname(entity.file) === dirPath)
            .map(entity => entity.file);
    }

    /**
     * 获取主要文件类型
     */
    private getMainFileTypes(entities: EnrichedEntity[]): string[] {
        const typeCount = new Map<string, number>();
        
        entities.forEach(entity => {
            const ext = path.extname(entity.file);
            typeCount.set(ext, (typeCount.get(ext) || 0) + 1);
        });

        return Array.from(typeCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([ext]) => ext);
    }

    /**
     * 计算目录重要性
     */
    private calculateDirectoryImportance(dirPath: string, entities: EnrichedEntity[]): number {
        const dirName = path.basename(dirPath);
        let importance = 5;

        // 基于目录名称
        const importantDirs = ['src', 'components', 'pages', 'services', 'utils'];
        if (importantDirs.includes(dirName)) importance += 2;

        // 基于文件数量
        if (entities.length > 10) importance += 1;
        if (entities.length > 20) importance += 1;

        // 基于内容重要性
        const hasHighValueContent = entities.some(e => 
            e.tags?.some(tag => ['应用入口', '路由配置', '状态管理'].includes(tag))
        );
        if (hasHighValueContent) importance += 2;

        return Math.min(importance, 10);
    }

    /**
     * 检查是否包含页面组件
     */
    private containsPages(entities: EnrichedEntity[]): boolean {
        return entities.some(e => 
            e.type === 'component' && 
            (e.tags?.includes('页面组件') || e.file.includes('pages'))
        );
    }

    /**
     * 检查是否包含服务
     */
    private containsServices(entities: EnrichedEntity[]): boolean {
        return entities.some(e => 
            e.tags?.includes('API接口') || 
            e.tags?.includes('服务层') ||
            e.file.includes('services')
        );
    }

    /**
     * 检查是否包含工具函数
     */
    private containsUtils(entities: EnrichedEntity[]): boolean {
        return entities.some(e => 
            e.tags?.includes('工具函数') || 
            e.file.includes('utils')
        );
    }

    /**
     * 生成建议
     */
    private generateRecommendations(
        criticalDirectories: CriticalDirectoryInfo[],
        criticalFiles: CriticalFileInfo[]
    ): string[] {
        const recommendations: string[] = [];

        if (criticalDirectories.length > 0) {
            recommendations.push(`发现 ${criticalDirectories.length} 个关键目录，建议重点关注其结构和组织`);
        }

        if (criticalFiles.length > 0) {
            recommendations.push(`发现 ${criticalFiles.length} 个核心文件，建议定期review和维护`);
        }

        recommendations.push('建议遵循既定的文件夹规范，保持代码结构一致性');

        return recommendations;
    }

    /**
     * 获取 enriched 实体数据
     */
    getEnrichedEntities(): EnrichedEntity[] {
        return this.enrichedEntities;
    }

    /**
     * 根据文件路径获取实体
     */
    getEntityByFile(filePath: string): EnrichedEntity | undefined {
        return this.enrichedEntities.find(entity => entity.file === filePath);
    }

    /**
     * 根据类型获取实体
     */
    getEntitiesByType(type: string): EnrichedEntity[] {
        return this.enrichedEntities.filter(entity => entity.type === type);
    }

    /**
     * 根据标签获取实体
     */
    getEntitiesByTag(tag: string): EnrichedEntity[] {
        return this.enrichedEntities.filter(entity => entity.tags?.includes(tag));
    }
} 