/**
 * 路由配置分析器 - AI驱动的页面路由解析和数据流转分析
 * 专注于页面路由的引入和调用关系，生成详细的数据流转图
 */

// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { generateText } from 'ai';
import { createAnthropic } from "@xhs/aws-anthropic";
import {
    RouteAnalysis,
    PageComponentInfo,
    RouteNode,
    EnrichedEntity
} from '../types';
import { AIService, defaultAIService } from '../generators/ai-service';

process.env.XHS_AWS_BEDROCK_API_KEY = 'aa74edef9cb44aab8a03f37f36197ec6';



export interface RouteRelatedEntity {
    entity: EnrichedEntity;
    filePath: string;
    summary: string;
    aiGeneratedSummary?: string;
    relationType: 'route_component' | 'dependency' | 'api_service' | 'utility' | 'store' | 'other';
}

export interface PathDimensionData {
    filePath: string; // 现在代表目录路径，而不是具体文件路径
    entities: EnrichedEntity[];
    originalSummaries: string[];
    originalFilePaths: string[]; // 该目录下包含的原始文件路径列表
    aiGeneratedSummary?: string;
    relationType: RouteRelatedEntity['relationType'];
}

export interface DirectoryDependency {
    fromDirectory: string;
    toDirectory: string;
    dependencyType: 'import' | 'api_call' | 'utility' | 'component' | 'store';
    dependencyFiles: string[];
    dependencyCount: number;
}

export interface ComponentRelationsData {
    dependencies: DirectoryDependency[];
    summary: {
        totalDirectories: number;
        totalDependencies: number;
        routeComponentDirs: number;
        apiServiceDirs: number;
        utilityDirs: number;
        dependencyDirs: number;
    };
}

export interface EnhancedRouteAnalysisResult {
    routeAnalysis: RouteAnalysis | null;
    componentRelations: ComponentRelationsData;
    fileRelations: PathDimensionData[];
    totalRelatedFiles: number;
    totalRelatedEntities: number;
}



/**
 * AI驱动的路由配置分析器
 */
export class RouteConfigAnalyzer {
    private projectPath: string;
    private routeConfigPath: string = '';
    private routeConfig: any = null;
    private enrichedEntities: EnrichedEntity[] = [];
    private aiService: AIService;
    private customRoutePath: string | null = null;

    constructor(
        projectPath: string, 
        enrichedEntities: EnrichedEntity[] = [], 
        aiService: AIService = defaultAIService, 
        customContent?: string,
        autoLoadEntities: boolean = true
    ) {
        this.projectPath = projectPath;
        this.enrichedEntities = enrichedEntities;
        this.aiService = aiService;
        this.customRoutePath = this.parseCustomRoutePath(customContent);
        
        // 根据参数决定是否自动加载enriched entities
        if (autoLoadEntities && this.enrichedEntities.length === 0) {
            this.loadEnrichedEntities();
        }
    }

    /**
     * 设置enriched数据
     */
    setEnrichedEntities(entities: EnrichedEntity[]): void {
        this.enrichedEntities = entities;
    }

    /**
     * 解析customContent中的自定义路由路径
     */
    private parseCustomRoutePath(customContent?: string): string | null {
        if (!customContent) return null;
        
        // 支持更多书写习惯：任意级别标题 + 中英文关键词 + 中英文冒号
        const routePathMatch = customContent.match(/#{1,6}\s*.*?(文件路径|路径|配置路径|File\s*Path|file\s*path|Route.*?[Pp]ath)\s*[：:]?\s*\n\s*([^\n]+)/i);
        console.log("🚀🚀🚀 ~ RouteConfigAnalyzer ~ parseCustomRoutePath ~ routePathMatch=====>", routePathMatch)
        if (routePathMatch && routePathMatch[2]) {
            const customPath = routePathMatch[2].trim();
            console.log(`🔍 发现自定义路由路径: ${customPath}`);
            return customPath;
        }
        
        return null;
    }

    /**
     * 从项目中加载enriched entities数据
     */
    private loadEnrichedEntities(): void {
        try {
            // 尝试从多个可能的位置加载entities.enriched.json
            const possiblePaths = [
                path.join(this.projectPath, 'data', 'entities.enriched.json'),
                path.join(this.projectPath, 'entities.enriched.json'),
                path.join(process.cwd(), 'data', 'entities.enriched.json'),
                path.join(process.cwd(), 'entities.enriched.json')
            ];

            for (const entityPath of possiblePaths) {
                if (fs.existsSync(entityPath)) {
                    console.log(`📚 加载enriched entities from: ${entityPath}`);
                    const entitiesData = JSON.parse(fs.readFileSync(entityPath, 'utf-8'));
                    this.enrichedEntities = Array.isArray(entitiesData) ? entitiesData : [];
                    console.log(`✅ 成功加载 ${this.enrichedEntities.length} 个enriched entities`);
                    break;
                }
            }

            if (this.enrichedEntities.length === 0) {
                console.warn('⚠️  未找到enriched entities数据文件');
            }
        } catch (error) {
            console.error('❌ 加载enriched entities失败:', error);
            this.enrichedEntities = [];
        }
    }

    /**
     * 提取路由相关的实体
     */
    private extractRouteRelatedEntities(routeAnalysis: RouteAnalysis): RouteRelatedEntity[] {
        if (!routeAnalysis || !routeAnalysis.pageComponents) {
            return [];
        }

        const relatedEntities: RouteRelatedEntity[] = [];
        const processedPaths = new Set<string>();

        // 从路由组件中提取相关实体
        for (const pageComponent of routeAnalysis.pageComponents) {
            if (!pageComponent.componentPath) continue;

            // 查找路由组件本身
            const routeEntity = this.findEntityByFilePath(pageComponent.componentPath);
            if (routeEntity && !processedPaths.has(routeEntity.file)) {
                relatedEntities.push({
                    entity: routeEntity,
                    filePath: routeEntity.file,
                    summary: routeEntity.summary || '路由组件',
                    relationType: 'route_component'
                });
                processedPaths.add(routeEntity.file);
            }

            // 查找相关的API服务、工具类、组件等
            this.findRelatedEntitiesByPath(pageComponent.componentPath, relatedEntities, processedPaths);
        }

        return relatedEntities;
    }

    /**
     * 根据文件路径查找相关实体
     */
    private findRelatedEntitiesByPath(componentPath: string, relatedEntities: RouteRelatedEntity[], processedPaths: Set<string>): void {
        const componentDir = path.dirname(componentPath);
        const componentBaseName = path.basename(componentPath, path.extname(componentPath));

        // 查找同目录下的相关文件
        for (const entity of this.enrichedEntities) {
            if (processedPaths.has(entity.file)) continue;

            const entityDir = path.dirname(entity.file);
            const entityBaseName = path.basename(entity.file, path.extname(entity.file));

            // 同目录的相关文件
            if (entityDir === componentDir || entityDir.startsWith(componentDir)) {
                const relationType = this.determineRelationType(entity);
                relatedEntities.push({
                    entity,
                    filePath: entity.file,
                    summary: entity.summary || `${relationType}文件`,
                    relationType
                });
                processedPaths.add(entity.file);
            }
            // 相关的API服务
            else if (entity.file.includes('/api/') || entity.file.includes('/service/')) {
                relatedEntities.push({
                    entity,
                    filePath: entity.file,
                    summary: entity.summary || 'API服务',
                    relationType: 'api_service'
                });
                processedPaths.add(entity.file);
            }
            // 相关的工具类
            else if (entity.file.includes('/utils/') || entity.file.includes('/helper/')) {
                relatedEntities.push({
                    entity,
                    filePath: entity.file,
                    summary: entity.summary || '工具类',
                    relationType: 'utility'
                });
                processedPaths.add(entity.file);
            }
            // 状态管理
            else if (entity.file.includes('/store/') || entity.file.includes('/state/')) {
                relatedEntities.push({
                    entity,
                    filePath: entity.file,
                    summary: entity.summary || '状态管理',
                    relationType: 'store'
                });
                processedPaths.add(entity.file);
            }
        }
    }

    /**
     * 确定实体的关系类型
     */
    private determineRelationType(entity: EnrichedEntity): RouteRelatedEntity['relationType'] {
        const filePath = entity.file.toLowerCase();
        
        if (filePath.includes('/api/') || filePath.includes('/service/')) {
            return 'api_service';
        }
        if (filePath.includes('/utils/') || filePath.includes('/helper/')) {
            return 'utility';
        }
        if (filePath.includes('/store/') || filePath.includes('/state/')) {
            return 'store';
        }
        if (entity.type === 'component' || filePath.includes('/component/')) {
            return 'dependency';
        }
        return 'other';
    }

    /**
     * 根据文件路径查找实体
     */
    private findEntityByFilePath(filePath: string): EnrichedEntity | null {
        return this.enrichedEntities.find(entity => 
            entity.file === filePath || 
            entity.file.endsWith(filePath) ||
            filePath.endsWith(entity.file)
        ) || null;
    }

    /**
     * 将实体维度数据转换为路径维度数据（按目录级别聚合）
     */
    private groupEntitiesByPath(relatedEntities: RouteRelatedEntity[]): PathDimensionData[] {
        const pathMap = new Map<string, {
            entities: EnrichedEntity[];
            summaries: string[];
            relationType: RouteRelatedEntity['relationType'];
            originalFilePaths: string[]; // 记录原始文件路径
        }>();

        // 按目录路径分组（使用文件的父级目录）
        for (const relatedEntity of relatedEntities) {
            const originalFilePath = relatedEntity.filePath;
            // 获取文件的父级目录作为分组键
            const directoryPath = path.dirname(originalFilePath);
            
            if (!pathMap.has(directoryPath)) {
                pathMap.set(directoryPath, {
                    entities: [],
                    summaries: [],
                    relationType: relatedEntity.relationType,
                    originalFilePaths: []
                });
            }
            
            const pathData = pathMap.get(directoryPath)!;
            pathData.entities.push(relatedEntity.entity);
            pathData.summaries.push(relatedEntity.summary);
            pathData.originalFilePaths.push(originalFilePath);
        }

        // 转换为PathDimensionData数组
        const pathDimensionData: PathDimensionData[] = [];
        for (const [directoryPath, data] of pathMap) {
            pathDimensionData.push({
                filePath: directoryPath, // 现在是目录路径
                entities: data.entities,
                originalSummaries: data.summaries,
                originalFilePaths: data.originalFilePaths,
                relationType: data.relationType
            });
        }

        return pathDimensionData;
    }

    /**
     * 使用AI生成目录功能总结
     */
    private async generateFilePathSummaryWithAI(pathData: PathDimensionData): Promise<string> {
        try {
            // 构建该目录下所有实体的信息
            const entitiesInfo = pathData.entities.map((entity, index) => {
                const originalFilePath = pathData.originalFilePaths[index] || '未知文件';
                const fileName = path.basename(originalFilePath);
                return `实体${index + 1}: ${fileName} 中的 ${entity.type} - ${entity.rawName || 'unnamed'} - ${pathData.originalSummaries[index] || '无描述'}`;
            }).join('\n');

            // 获取该目录包含的文件列表
            const filesList = [...new Set(pathData.originalFilePaths)].map(fp => path.basename(fp)).join(', ');

            const prompt = `请分析以下目录及其包含的所有文件和代码实体，生成简洁的目录功能总结：

目录路径: ${pathData.filePath}
目录类型: ${pathData.relationType}
包含文件: ${filesList}

该目录包含的实体信息：
${entitiesInfo}

请基于该目录包含的所有文件和实体，用一句话总结这个目录的主要功能和职责（UI组件、逻辑组件、API服务、工具类、状态管理等），不超过200字。重点关注目录的整体功能模块，而不是单个文件或实体的细节。`;

            const aiSummary = await this.aiService.generateDirectoryAnalysis(prompt);
            return aiSummary.replace(/^[#\-\*\s]+/, '').trim() || pathData.originalSummaries[0] || '功能模块';
        } catch (error) {
            console.warn(`⚠️ AI生成目录功能总结失败 ${pathData.filePath}:`, error);
            return pathData.originalSummaries[0] || '功能模块';
        }
    }

    /**
     * 生成结构化的组件关系数据
     */
    private async generateComponentRelationsWithAI(pathDimensionData: PathDimensionData[]): Promise<ComponentRelationsData> {
        try {
            // 分析真实的目录依赖关系
            const dependencies = this.analyzeRealDirectoryDependencies(pathDimensionData);
            
            // 生成统计信息
            const summary = {
                totalDirectories: pathDimensionData.length,
                totalDependencies: dependencies.length,
                routeComponentDirs: pathDimensionData.filter(p => p.relationType === 'route_component').length,
                apiServiceDirs: pathDimensionData.filter(p => p.relationType === 'api_service').length,
                utilityDirs: pathDimensionData.filter(p => p.relationType === 'utility').length,
                dependencyDirs: pathDimensionData.filter(p => p.relationType === 'dependency').length
            };

            const relationData: ComponentRelationsData = {
                dependencies,
                summary
            };
            
            return relationData;
        } catch (error) {
            console.warn('⚠️ 生成组件关系数据失败:', error);
            return this.generateFallbackComponentRelationsData(pathDimensionData);
        }
    }

    /**
     * 分析真实的目录依赖关系（基于import数据）
     */
    private analyzeRealDirectoryDependencies(pathDimensionData: PathDimensionData[]): DirectoryDependency[] {
        const dependencies: DirectoryDependency[] = [];
        const dependencyMap = new Map<string, DirectoryDependency>();

        for (const pathData of pathDimensionData) {
            const fromDirectory = pathData.filePath;

            // 分析该目录下每个实体的imports
            for (const entity of pathData.entities) {
                if (entity.IMPORTS && entity.IMPORTS.length > 0) {
                    const localImports = entity.IMPORTS.filter(imp => this.isLocalImport(imp));

                    for (const importPath of localImports) {
                        const toDirectory = path.dirname(importPath);
                        
                        // 跳过同目录导入
                        if (toDirectory === fromDirectory || toDirectory === '.') continue;

                        const dependencyKey = `${fromDirectory} → ${toDirectory}`;
                        
                        if (!dependencyMap.has(dependencyKey)) {
                            // 确定依赖类型
                            const dependencyType = this.determineDependencyType(toDirectory, importPath);
                            
                            dependencyMap.set(dependencyKey, {
                                fromDirectory,
                                toDirectory,
                                dependencyType,
                                dependencyFiles: [],
                                dependencyCount: 0
                            });
                        }

                        const dependency = dependencyMap.get(dependencyKey)!;
                        dependency.dependencyCount++;
                        
                        const fileName = path.basename(importPath);
                        if (!dependency.dependencyFiles.includes(fileName)) {
                            dependency.dependencyFiles.push(fileName);
                        }
                    }
                }

                // 分析API调用
                if (entity.CALLS && entity.CALLS.length > 0) {
                    const apiCalls = entity.CALLS.filter(call => this.isApiCall(call));
                    
                    if (apiCalls.length > 0) {
                        // 查找可能的API服务目录
                        const apiServiceDirs = pathDimensionData.filter(p => p.relationType === 'api_service');
                        
                        for (const apiDir of apiServiceDirs) {
                            const dependencyKey = `${fromDirectory} → ${apiDir.filePath}`;
                            
                            if (!dependencyMap.has(dependencyKey)) {
                                dependencyMap.set(dependencyKey, {
                                    fromDirectory,
                                    toDirectory: apiDir.filePath,
                                    dependencyType: 'api_call',
                                    dependencyFiles: apiCalls.slice(0, 3),
                                    dependencyCount: apiCalls.length
                                });
                            }
                        }
                    }
                }
            }
        }

        return Array.from(dependencyMap.values()).sort((a, b) => b.dependencyCount - a.dependencyCount);
    }

    /**
     * 确定依赖类型
     */
    private determineDependencyType(targetDirectory: string, importPath: string): DirectoryDependency['dependencyType'] {
        const lowerPath = targetDirectory.toLowerCase();
        
        if (lowerPath.includes('/api/') || lowerPath.includes('/service/')) {
            return 'api_call';
        }
        if (lowerPath.includes('/utils/') || lowerPath.includes('/helper/')) {
            return 'utility';
        }
        if (lowerPath.includes('/store/') || lowerPath.includes('/state/')) {
            return 'store';
        }
        if (lowerPath.includes('/component/')) {
            return 'component';
        }
        
        return 'import';
    }

    /**
     * 生成回退的组件关系数据
     */
    private generateFallbackComponentRelationsData(pathDimensionData: PathDimensionData[]): ComponentRelationsData {
        return {
            dependencies: [],
            summary: {
                totalDirectories: pathDimensionData.length,
                totalDependencies: 0,
                routeComponentDirs: pathDimensionData.filter(p => p.relationType === 'route_component').length,
                apiServiceDirs: pathDimensionData.filter(p => p.relationType === 'api_service').length,
                utilityDirs: pathDimensionData.filter(p => p.relationType === 'utility').length,
                dependencyDirs: pathDimensionData.filter(p => p.relationType === 'dependency').length
            }
        };
    }



    /**
     * 执行增强的路由分析，包含Component Relations和File Relations
     */
    async analyzeEnhancedWithRelations(): Promise<EnhancedRouteAnalysisResult> {
        console.log('🚀 开始增强路由分析（包含关系分析）...');

        // 1. 执行基础路由分析
        const routeAnalysis = await this.analyze();
        if (!routeAnalysis) {
            return {
                routeAnalysis: null,
                componentRelations: '无法进行路由分析',
                fileRelations: [],
                totalRelatedEntities: 0
            };
        }

        // 2. 提取路由相关实体
        const relatedEntities = this.extractRouteRelatedEntities(routeAnalysis);
        console.log(`📚 提取了 ${relatedEntities.length} 个相关实体`);

        // 3. 按文件路径维度重新组织数据
        console.log('🔄 将数据按文件路径维度重新组织...');
        const pathDimensionData = this.groupEntitiesByPath(relatedEntities);
        console.log(`📁 聚合后得到 ${pathDimensionData.length} 个文件路径`);

        // 4. 为每个文件路径生成AI总结
        console.log('🤖 开始为文件路径生成AI总结...');
        const batchSize = 3;
        for (let i = 0; i < pathDimensionData.length; i += batchSize) {
            const batch = pathDimensionData.slice(i, i + batchSize);
            const promises = batch.map(pathData => this.generateFilePathSummaryWithAI(pathData));
            
            try {
                const results = await Promise.all(promises);
                results.forEach((summary, index) => {
                    if (summary) {
                        batch[index].aiGeneratedSummary = summary;
                    }
                });
            } catch (error) {
                console.warn(`⚠️ 批量生成文件路径AI总结失败 (batch ${Math.floor(i/batchSize) + 1}):`, error);
            }

            // 延迟避免API限制
            if (i + batchSize < pathDimensionData.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // 5. 生成组件关系数据
        console.log('🔗 生成组件关系数据...');
        const componentRelations = await this.generateComponentRelationsWithAI(pathDimensionData);

        // 6. 写入最终结果
        const finalResult = {
            routeAnalysis,
            componentRelations,
            fileRelations: pathDimensionData,
            totalRelatedFiles: pathDimensionData.length,
            totalRelatedEntities: relatedEntities.length
        };

        console.log('✅ 增强路由分析完成');
        return finalResult;
    }

    /**
     * AI驱动的路由分析（主要入口）
     */
    async analyze(): Promise<RouteAnalysis | null> {
        console.log('🤖 开始AI驱动的路由分析...');

        // 1. 查找路由配置文件
        const routeConfigPath = this.findRouteConfigFile();
        if (!routeConfigPath) {
            console.log('⚠️  未找到路由配置文件');
            return null;
        }

        this.routeConfigPath = routeConfigPath;
        console.log(`🔍 发现路由配置文件: ${routeConfigPath}`);

        // 2. 使用AI解析页面路由
        let routeConfig = null, routeConfigJsonObj= null, routeConfigName = `${this.projectPath}_routeConfig.json`;
        const routeConfigJsonPath = path.resolve(__dirname, routeConfigName)
        if(fs.existsSync(routeConfigJsonPath)){
            const routeConfigJson = fs.readFileSync(routeConfigJsonPath, 'utf-8');
            routeConfigJsonObj = JSON.parse(routeConfigJson);
        }
        if(routeConfigJsonObj){
            routeConfig = routeConfigJsonObj;
        }else{
            routeConfig = await this.parsePageRoutesWithAI(routeConfigPath);
        }
        
        if (!routeConfig || routeConfig.length === 0) {
            console.log('❌ AI路由解析失败或无页面路由');
            return null;
        }

        this.routeConfig = routeConfig;
        fs.writeFileSync(routeConfigName, JSON.stringify(routeConfig, null, 2));
        console.log(`✅ AI成功解析了 ${routeConfig.length} 个页面路由`);

        // 3. 提取页面组件信息
        const pageComponents = this.extractPageComponents(routeConfig);
        console.log(`📋 提取了 ${pageComponents.length} 个页面组件`);

        // 4. 构建路由树
        const routeTree = this.buildRouteTree(routeConfig);

        return {
            routeConfigPath,
            routeConfig,
            totalRoutes: pageComponents.length,
            pageComponents,
            routeTree
        };
    }

    /**
     * 获取项目路由配置数据
     */
    async getProjectRouteConfig(): Promise<any[]> {
        const routeConfigPath = this.findRouteConfigFile();
        if (!routeConfigPath) {
            throw new Error('未找到路由配置文件');
        }
        
        return await this.parsePageRoutesWithAI(routeConfigPath);
    }

    /**
     * 查找路由配置文件
     */
    private findRouteConfigFile(): string | null {
        // 优先使用自定义路由路径
        if (this.customRoutePath) {
            const customFullPath = path.join(this.projectPath, this.customRoutePath);
            if (fs.existsSync(customFullPath)) {
                console.log(`✅ 使用自定义路由路径: ${this.customRoutePath}`);
                return customFullPath;
            } else {
                console.warn(`⚠️ 自定义路由路径不存在: ${this.customRoutePath}`);
            }
        }

        // 回退到默认路径
        const possiblePaths = [
            'src/config/routes.config.ts',
            'src/config/routes.config.js',
            'src/router/index.ts',
            'src/router/index.js',
            'src/routes/index.ts',
            'src/routes/index.js',
            'src/config/routes.ts',
            'src/config/routes.js',
            'src/routes.ts',
            'src/routes.js',
            'router/index.ts',
            'router/index.js',
            'routes.config.ts',
            'routes.config.js'
        ];

        for (const relativePath of possiblePaths) {
            const fullPath = path.join(this.projectPath, relativePath);
            if (fs.existsSync(fullPath)) {
                return fullPath;
            }
        }

        return null;
    }

    /**
     * 使用AI解析页面路由（核心方法）
     */
    private async parsePageRoutesWithAI(configPath: string): Promise<any[]> {
        try {
            const content = fs.readFileSync(configPath, 'utf-8');
            console.log('📄 读取路由配置文件成功');
            
            const anthropic = createAnthropic();
            
            // 获取项目上下文信息
            const projectContext = await this.getProjectContextForAI();
            
            // 分析并读取导入的路由文件
            const importedRoutes = await this.analyzeImportedRoutes(content, configPath);
            console.log(`📁 发现 ${importedRoutes.length} 个导入的路由文件`);
            
            const prompt = `
你是一个专业的前端代码分析工具。请分析以下路由配置文件，**只提取关联到具体页面组件的路由**，忽略重定向、布局等非页面路由。

## 项目上下文信息
配置文件路径: ${configPath}
项目根目录: ${this.projectPath}

## 主路由配置文件内容
\`\`\`typescript
${content}
\`\`\`

## 导入的路由文件内容
${importedRoutes.map(imported => `
### ${imported.filePath}
\`\`\`typescript
${imported.content}
\`\`\`
`).join('\n')}

## 特别注意导入路由的处理
- 需要解析所有从其他文件导入的路由配置
- 将导入的路由数组展开并合并到主路由中
- 保持导入路由的原始结构和组件引用

## 解析要求

### 1. 只提取页面路由
- **只包含**有具体组件引用的路由（页面级组件）
- **排除**重定向路由（redirect）
- **排除**纯布局路由（只有children没有component）
- **排除**抽象路由（如父级容器路由）
- **展开**所有子路由为独立的页面路由项

### 2. 组件路径解析（重要）
- 动态导入：() => import('./pages/UserList.vue') → componentPath: "src/pages/UserList.vue"
- 相对导入：'./components/Page.vue' → componentPath: "src/components/Page.vue"
- @/导入：'@/views/Dashboard.vue' → componentPath: "src/views/Dashboard.vue"
- 组件变量：UserListComponent → 基于import语句推断真实路径
- **所有页面路由都必须有有效的componentPath（相对于项目根目录）**
- **componentPath将在后续处理中转换为绝对路径**

### 3. 路径推断规则
- 业务页面组件通常在: src/pages/, src/views/, src/modules/
- 根据路由名称和路径推断组件位置
- 验证推断的组件路径在项目中是否存在

### 4. 路由分类
只保留以下类型的路由：
- 业务页面路由（列表、详情、表单等）
- 功能页面路由（仪表板、设置等）
- **不包含**：根路由重定向、布局路由、404路由等

## 输出格式（仅返回 JSON，无其他文字）

[
  {
    "path": "/user/list",
    "name": "UserList",
    "component": "() => import('./pages/user/UserList.vue')",
    "componentPath": "src/pages/user/UserList.vue",
    "isLazy": true,
    "meta": {
      "title": "用户列表",
      "pageKey": "user.list"
    }
  },
  {
    "path": "/order/detail/:id",
    "name": "OrderDetail",
    "component": "OrderDetailComponent",
    "componentPath": "src/pages/order/OrderDetail.vue",
    "isLazy": false,
    "meta": {
      "title": "订单详情"
    }
  }
]

## 特别注意
1. **只返回页面级路由**，过滤掉所有非页面路由
2. **每个路由都要有有效的componentPath（相对于项目根目录）**
3. **路径要完整**，包含参数（如 :id）
4. **组件引用格式保持原样**在component字段中
5. **展开所有嵌套路由**为独立项，不使用children嵌套
6. **合并所有导入的路由配置**，包括从其他文件导入的路由数组
`;

            console.log('🤖 开始解析路由');
            // @ts-ignore
            const { text } = await generateText({
                model: anthropic('claude-3-7-sonnet-latest'),
                prompt,
                maxTokens: 8000,
                temperature: 0.1
            });

            // 解析AI返回的JSON
            const cleanText = text.trim();
            const jsonStart = cleanText.indexOf('[');
            const jsonEnd = cleanText.lastIndexOf(']') + 1;
            
            if (jsonStart !== -1 && jsonEnd > jsonStart) {
                const jsonText = cleanText.substring(jsonStart, jsonEnd);
                const routes = JSON.parse(jsonText);
                
                if (Array.isArray(routes)) {
                    console.log(`🤖 AI成功解析 ${routes.length} 个页面路由`);
                    
                    // 过滤和验证路由
                    const validRoutes = this.filterAndValidatePageRoutes(routes);
                    console.log(`✅ 验证后保留 ${validRoutes.length} 个有效页面路由`);
                    
                    return validRoutes;
                }
            }
            
            console.log('⚠️  AI返回的内容无法解析为有效JSON');
            console.log('AI响应内容:', cleanText.substring(0, 500) + '...');
            return [];
            
        } catch (error: any) {
            console.error('AI路由解析失败:', error?.message || error);
            return [];
        }
    }

    /**
     * 过滤和验证页面路由
     */
    private filterAndValidatePageRoutes(routes: any[]): any[] {
        const validRoutes: any[] = [];

        for (const route of routes) {
            // 基本验证
            if (!route.path || !route.componentPath) {
                console.log(`⚠️  跳过无效路由: ${JSON.stringify(route)}`);
                continue;
            }

            // 排除非页面路由
            if (this.isNonPageRoute(route)) {
                console.log(`⚠️  跳过非页面路由: ${route.path}`);
                continue;
            }

            // 验证组件路径
            const normalizedComponentPath = this.normalizeComponentPath(route.componentPath);
            const componentExists = this.verifyComponentExists(normalizedComponentPath);
            
            if (!componentExists) {
                console.log(`⚠️  组件文件不存在，尝试推断: ${normalizedComponentPath}`);
                const inferredPath = this.inferComponentPathFromRoute(route);
                if (inferredPath && this.verifyComponentExists(inferredPath)) {
                    // 转换为绝对路径
                    route.componentPath = inferredPath;
                    console.log(`✅ 推断组件路径成功: ${route.componentPath}`);
                } else {
                    console.log(`❌ 无法找到组件文件，跳过路由: ${route.path}`);
                    continue;
                }
            } else {
                // 转换为绝对路径
                route.componentPath = normalizedComponentPath;
            }

            // 标准化路由信息
            const standardizedRoute = this.standardizeRoute(route);
            validRoutes.push(standardizedRoute);
        }

        return validRoutes;
    }

    /**
     * 标准化组件路径
     */
    private normalizeComponentPath(componentPath: string): string {
        if (!componentPath) return '';
        
        // 处理 @/ 别名
        if (componentPath.startsWith('@/')) {
            return componentPath.replace('@/', 'src/');
        }
        
        // 处理相对路径 ./ 和 ../
        if (componentPath.startsWith('./') || componentPath.startsWith('../')) {
            // 简化处理，移除相对路径前缀，假设相对于 src 目录
            let cleanPath = componentPath;
            if (cleanPath.startsWith('./')) {
                cleanPath = cleanPath.substring(2);
            }
            // 对于 ../ 的情况，简单移除前缀（实际项目中需要更复杂的逻辑）
            cleanPath = cleanPath.replace(/^\.\.\/+/, '');
            return `src/${cleanPath}`;
        }
        
        // 处理动态导入中的路径
        if (componentPath.includes('import(')) {
            const match = componentPath.match(/import\(['"`]([^'"`]+)['"`]\)/);
            if (match) {
                return this.normalizeComponentPath(match[1]);
            }
        }
        
        // 如果已经是完整路径，直接返回
        if (componentPath.startsWith('src/')) {
            return componentPath;
        }
        
        // 默认添加 src/ 前缀
        return `src/${componentPath}`;
    }

    /**
     * 判断是否为非页面路由
     */
    private isNonPageRoute(route: any): boolean {
        // 重定向路由
        if (route.redirect) return true;
        
        // 根路由
        if (route.path === '/' && !route.componentPath) return true;
        
        // 404或错误页面（可选择保留）
        if (route.path.includes('*') || route.path.includes('404')) return false; // 保留404页面
        
        // 纯布局路由（有children但无component）
        if (route.children && !route.componentPath) return true;
        
        return false;
    }

    /**
     * 验证组件文件是否存在
     */
    private verifyComponentExists(componentPath: string): boolean {
        // 如果已经是绝对路径，直接检查
        if (path.isAbsolute(componentPath)) {
            return fs.existsSync(componentPath);
        }
        
        // 如果是相对路径，拼接项目根目录
        const fullPath = path.join(this.projectPath, componentPath);
        return fs.existsSync(fullPath);
    }

    /**
     * 从路由信息推断组件路径
     */
    private inferComponentPathFromRoute(route: any): string | null {
        const routePath = route.path;
        const routeName = route.name;
        
        // 基于路由路径推断
        const pathBasedInference = this.inferFromRoutePath(routePath);
        if (pathBasedInference && this.verifyComponentExists(pathBasedInference)) {
            return pathBasedInference;
        }
        
        // 基于路由名称推断
        if (routeName) {
            const nameBasedInference = this.inferFromRouteName(routeName);
            if (nameBasedInference && this.verifyComponentExists(nameBasedInference)) {
                return nameBasedInference;
            }
        }
        
        return null;
    }

    /**
     * 基于路由路径推断组件路径
     */
    private inferFromRoutePath(routePath: string): string | null {
        // 清理路由路径
        const cleanPath = routePath.replace(/^\//, '').replace(/\/:[^\/]+/g, '').replace(/\*/g, '');
        
        if (!cleanPath) return null;
        
        // 转换为组件名
        const componentName = cleanPath
            .split('/')
            .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
            .join('');
        
        // 可能的路径
        const possiblePaths = [
            `src/pages/${cleanPath}.vue`,
            `src/pages/${cleanPath}/index.vue`,
            `src/pages/${componentName}.vue`,
            `src/views/${cleanPath}.vue`,
            `src/views/${cleanPath}/index.vue`,
            `src/views/${componentName}.vue`,
            `src/components/${cleanPath}.vue`,
            `src/components/${componentName}.vue`
        ];
        
        for (const possiblePath of possiblePaths) {
            if (this.verifyComponentExists(possiblePath)) {
                return possiblePath;
            }
        }
        
        return null;
    }

    /**
     * 基于路由名称推断组件路径
     */
    private inferFromRouteName(routeName: string): string | null {
        // 可能的路径
        const possiblePaths = [
            `src/pages/${routeName}.vue`,
            `src/pages/${routeName}/index.vue`,
            `src/views/${routeName}.vue`,
            `src/views/${routeName}/index.vue`,
            `src/components/${routeName}.vue`
        ];
        
        for (const possiblePath of possiblePaths) {
            if (this.verifyComponentExists(possiblePath)) {
                return possiblePath;
            }
        }
        
        return null;
    }

    /**
     * 标准化路由信息
     */
    private standardizeRoute(route: any): any {
        return {
            path: route.path,
            name: route.name || this.generatePageName(route.path),
            component: route.component || '',
            componentPath: route.componentPath,
            isLazy: Boolean(route.isLazy),
            meta: route.meta || {}
        };
    }

    /**
     * 分析并读取导入的路由文件
     */
    private async analyzeImportedRoutes(content: string, configPath: string): Promise<{filePath: string, content: string}[]> {
        const importedRoutes: {filePath: string, content: string}[] = [];
        
        // 匹配 import 语句
        const importRegex = /import\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`]/g;
        let match;
        
        while ((match = importRegex.exec(content)) !== null) {
            const [, importName, importPath] = match;
            
            // 只处理看起来像路由的导入
            if (importName.toLowerCase().includes('route') || importPath.toLowerCase().includes('route')) {
                try {
                    const resolvedPath = this.resolveImportPath(importPath, configPath);
                    console.log(`🔍 尝试读取导入的路由文件: ${resolvedPath}`);
                    
                    if (fs.existsSync(resolvedPath)) {
                        const importedContent = fs.readFileSync(resolvedPath, 'utf-8');
                        importedRoutes.push({
                            filePath: resolvedPath,
                            content: importedContent
                        });
                        console.log(`✅ 成功读取导入路由: ${resolvedPath}`);
                        
                        // 递归处理导入文件中的导入
                        const nestedImports = await this.analyzeImportedRoutes(importedContent, resolvedPath);
                        importedRoutes.push(...nestedImports);
                    } else {
                        console.log(`⚠️  导入路由文件不存在: ${resolvedPath}`);
                    }
                } catch (error) {
                    console.log(`❌ 读取导入路由文件失败: ${importPath}`, error);
                }
            }
        }
        
        return importedRoutes;
    }

    /**
     * 解析导入路径为绝对路径
     */
    private resolveImportPath(importPath: string, currentFilePath: string): string {
        if (importPath.startsWith('@/')) {
            // 处理 @/ 别名
            return path.join(this.projectPath, 'src', importPath.substring(2));
        } else if (importPath.startsWith('./') || importPath.startsWith('../')) {
            // 处理相对路径
            const currentDir = path.dirname(currentFilePath);
            const resolvedPath = path.resolve(currentDir, importPath);
            
            // 尝试添加常见的文件扩展名
            const extensions = ['.ts', '.js', '.vue', '/index.ts', '/index.js'];
            for (const ext of extensions) {
                const pathWithExt = resolvedPath + ext;
                if (fs.existsSync(pathWithExt)) {
                    return pathWithExt;
                }
            }
            
            return resolvedPath;
        } else {
            // 处理绝对路径或 node_modules
            return path.resolve(this.projectPath, 'node_modules', importPath);
        }
    }

    /**
     * 获取项目上下文信息供AI分析使用
     */
    private async getProjectContextForAI(): Promise<{projectStructure: string, knownComponents: string}> {
        const projectStructure = this.getProjectStructure();
        const knownComponents = this.getKnownComponentsFromEnriched();
        
        return {
            projectStructure,
            knownComponents
        };
    }

    /**
     * 获取项目结构信息
     */
    private getProjectStructure(): string {
        const commonDirs = [
            'src/pages/',
            'src/views/', 
            'src/components/',
            'src/layouts/',
            'src/modules/',
            'src/router/',
            'src/config/'
        ];

        let structure = "项目目录结构:\n";
        
        for (const dir of commonDirs) {
            const fullPath = path.join(this.projectPath, dir);
            if (fs.existsSync(fullPath)) {
                structure += `✓ ${dir} (存在)\n`;
                
                // 列出一些示例文件
                try {
                    const files = fs.readdirSync(fullPath)
                        .filter(file => file.endsWith('.vue') || file.endsWith('.tsx') || file.endsWith('.jsx'))
                        .slice(0, 5);
                    if (files.length > 0) {
                        structure += `  └─ 示例: ${files.join(', ')}\n`;
                    }
                } catch (error) {
                    // 忽略错误
                }
            } else {
                structure += `✗ ${dir} (不存在)\n`;
            }
        }

        return structure;
    }

    /**
     * 从enriched数据中获取已知组件
     */
    private getKnownComponentsFromEnriched(): string {
        if (this.enrichedEntities.length === 0) {
            return "暂无enriched数据";
        }

        let components = "已知组件文件 (来自enriched数据):\n";
        
        const componentEntities = this.enrichedEntities.filter(entity => 
            entity.type === 'Component' || 
            (entity.file && (entity.file.includes('/pages/') || entity.file.includes('/views/')))
        );

        componentEntities.slice(0, 20).forEach(entity => {
            components += `- ${entity.file} (${entity.type}:${entity.rawName})\n`;
        });

        if (componentEntities.length > 20) {
            components += `... 还有 ${componentEntities.length - 20} 个组件\n`;
        }

        return components;
    }



    /**
     * 构建路由树
     */
    private buildRouteTree(routeConfig: any[]): RouteNode[] {
        return routeConfig.map(route => ({
            path: route.path,
            name: route.name,
            componentPath: route.componentPath,
            meta: route.meta
        }));
    }

    /**
     * 生成页面名称
     */
    private generatePageName(routePath: string): string {
        if (!routePath) return 'UnknownPage';
        
        // 移除路径参数
        const cleanPath = routePath.replace(/\/:[^\/]+/g, '').replace(/\*/g, '');
        
        // 转换为驼峰命名
        return cleanPath
            .split('/')
            .filter(segment => segment && segment !== '')
            .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
            .join('') || 'HomePage';
    }

    /**
     * 提取页面组件信息
     */
    private extractPageComponents(routeConfig: any[]): PageComponentInfo[] {
        return routeConfig.map(route => ({
            name: route.name || this.generatePageName(route.path),
            path: route.path,
            componentPath: route.componentPath,
            meta: route.meta || {},
            isLazy: route.isLazy || false
        }));
    }



    /**
     * 根据文件路径查找对应的实体（简化版）
     * 利用enriched entities中路径已经是相对路径的特点
     */
    private findEntityByPath(filePath: string): EnrichedEntity | null {
        if (!this.enrichedEntities || this.enrichedEntities.length === 0) {
            return null;
        }

        // 将绝对路径转换为相对路径（如果需要）
        const relativePath = path.isAbsolute(filePath) 
            ? path.relative(this.projectPath, filePath)
            : filePath;

        // 直接匹配相对路径 - entities.enriched.json中的路径已经是标准相对路径
        const entity = this.enrichedEntities.find(e => e.file === relativePath);
        if (entity) {
            console.log(`✅ 找到实体: ${relativePath} -> ${entity.type}:${entity.rawName}`);
            return entity;
        }

        console.log(`❌ 未找到实体: ${relativePath}`);
        return null;
    }



    /**
     * 判断是否为本地导入
     */
    private isLocalImport(importPath: string): boolean {
        return importPath.startsWith('./') || 
               importPath.startsWith('../') || 
               importPath.startsWith('@/') || 
               importPath.startsWith('src/');
    }

    /**
     * 判断是否为API调用
     */
    private isApiCall(call: string): boolean {
        const apiKeywords = ['api', 'request', 'fetch', 'post', 'get', 'put', 'delete', 'ajax'];
        const lowerCall = call.toLowerCase();
        return apiKeywords.some(keyword => lowerCall.includes(keyword));
    }

    /**
     * 判断是否为状态导入
     */
    private isStateImport(importPath: string): boolean {
        const stateKeywords = ['store', 'state', 'vuex', 'pinia', 'redux'];
        const lowerPath = importPath.toLowerCase();
        return stateKeywords.some(keyword => lowerPath.includes(keyword));
    }
} 