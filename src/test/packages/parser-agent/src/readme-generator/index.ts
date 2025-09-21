/**
 * README 生成器主入口文件 - 精简重构版
 */

import { extractAllEntities } from '../fileWalker';
import { ProjectAnalysis } from './types';
import { ProjectUtils } from './utils';
import {
    ProjectStructureAnalyzer,
    CodeStatsAnalyzer,
    DependencyAnalyzer,
    TechnologyStackAnalyzer,
    ArchitectureAnalyzer,
    BestPracticesAnalyzer
} from './analyzers/project-analyzer';
import { RouteConfigAnalyzer } from './analyzers/route-config-analyzer';
import { ReadmeContentGenerator } from './generators/ai-generator';
import fs from 'fs';
import path from 'path';
import glob from 'glob';

/**
 * 主要的README生成类 - 重构版
 */
export class ReadmeGenerator {
    private projectPath: string;
    private entities: any[] = [];

    constructor(projectPath: string) {
        this.projectPath = projectPath;
    }

    /**
     * 加载实体数据 - 优先使用已有的entities.json，而不是重新分析
     */
    private async loadEntities(): Promise<any[]> {
        const basePath = path.join(this.projectPath, 'data', 'entities.enriched.json');
        
        // 回退到基础entities数据
        if (fs.existsSync(basePath)) {
            try {
                const baseData = JSON.parse(fs.readFileSync(basePath, 'utf8'));
                console.log(`📄 使用基础数据: ${baseData.length} 个实体 (无依赖关系)`);
                return baseData;
            } catch (error) {
                console.warn('⚠️ 读取基础数据失败，进行实时提取', error);
            }
        }
        
        // 最后回退到实时提取
        console.log('🔍 进行实时代码实体提取...');
        return await extractAllEntities(this.projectPath);
    }

    /**
     * 生成README文档的主入口
     */
    async generateReadme(
        template: string = 'comprehensive',
        language: string = 'zh-CN',
        customFile?: string
    ): Promise<string> {
        console.log('🔍 开始分析项目结构...');

        // 1. 提取代码实体 - 优先使用enriched数据
        this.entities = await this.loadEntities();
        console.log(`✅ 提取了 ${this.entities.length} 个代码实体`);

        // 2. 深度分析项目
        const analysis = await this.analyzeProject();
        console.log('✅ 项目分析完成');

        // 3. 使用AI生成器生成文档内容
        const contentGenerator = new ReadmeContentGenerator();
        const readme = await contentGenerator.generateContent(analysis, template, language, this.projectPath, customFile);
        console.log('✅ README生成完成');

        return readme;
    }

    /**
     * 深度分析项目结构和代码
     */
    private async analyzeProject(): Promise<ProjectAnalysis> {
        const projectName = path.basename(this.projectPath);
        const packageInfo = ProjectUtils.readPackageInfo(this.projectPath);

        // 使用模块化分析器进行各种分析
        console.log('📊 分析项目结构...');
        const structureAnalyzer = new ProjectStructureAnalyzer(this.projectPath);
        const structure = await structureAnalyzer.analyze();

        console.log('📈 分析代码统计...');
        const codeStatsAnalyzer = new CodeStatsAnalyzer(this.projectPath, this.entities);
        const codeStats = codeStatsAnalyzer.analyze();

        console.log('🔗 分析依赖关系...');
        const dependencyAnalyzer = new DependencyAnalyzer();
        const dependencies = dependencyAnalyzer.analyze(packageInfo);

        console.log('🛠️ 识别技术栈...');
        const technologyAnalyzer = new TechnologyStackAnalyzer(this.entities);
        const technologies = technologyAnalyzer.analyze(packageInfo, structure);

        console.log('🏗️ 分析架构模式...');
        const architectureAnalyzer = new ArchitectureAnalyzer(this.entities);
        const architecture = await architectureAnalyzer.analyze();

        console.log('✨ 评估最佳实践...');
        const bestPracticesAnalyzer = new BestPracticesAnalyzer(this.projectPath, this.entities);
        const bestPractices = await bestPracticesAnalyzer.analyze();

        // 识别项目类型
        const projectType = BestPracticesAnalyzer.identifyProjectType(packageInfo, structure, dependencies);

        return {
            projectName,
            projectPath: this.projectPath,
            packageInfo,
            projectType,
            structure,
            codeStats,
            dependencies,
            technologies,
            mainEntries: ProjectUtils.findMainEntries(this.projectPath),
            testFiles: this.entities
                .filter(entity => entity.file.includes('test') || entity.file.includes('spec'))
                .map(entity => entity.file),
            configFiles: ProjectUtils.findConfigFiles(this.projectPath),
            documentation: ProjectUtils.findDocumentation(this.projectPath),
            entities: this.entities,
            architecture,
            bestPractices
        };
    }
}

/**
 * 便捷的导出函数
 */
export async function generateReadme(
    projectPath: string,
    template: string = 'comprehensive',
    language: string = 'zh-CN',
    customFile?: string
): Promise<string> {
    const generator = new ReadmeGenerator(projectPath);
    return generator.generateReadme(template, language, customFile);
}

/**
 * 生成带时间戳的文件名
 * @param baseDir 基础目录
 * @param prefix 文件名前缀，默认为 'readme'
 * @returns 完整的文件路径
 */
function generateTimestampedFilename(baseDir: string, prefix: string = 'readme'): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    
    const timestamp = `${year}${month}${day}${hour}${minute}${second}`;
    const filename = `${prefix}-${timestamp}.md`;
    
    return path.join(baseDir, filename);
}

/**
 * 智能处理输出路径
 * @param outputPath 用户指定的输出路径
 * @param projectPath 项目路径
 * @returns 处理后的完整输出路径
 */
function resolveOutputPath(outputPath: string, projectPath: string): string {
    // 如果是绝对路径
    if (path.isAbsolute(outputPath)) {
        // 检查是否是目录
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
            return generateTimestampedFilename(outputPath);
        }
        // 如果文件不存在，直接返回
        return outputPath;
    }
    
    // 如果是相对路径，先解析为绝对路径
    const absolutePath = path.resolve(projectPath, outputPath);
    
    // 检查路径是否存在且是目录
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
        return generateTimestampedFilename(absolutePath);
    }
    
    // 检查父目录是否存在且是目录
    const parentDir = path.dirname(absolutePath);
    if (fs.existsSync(parentDir) && fs.statSync(parentDir).isDirectory()) {
        // 如果文件名部分为空或只是扩展名，生成带时间戳的文件名
        const basename = path.basename(outputPath);
        if (!basename || basename === '.md' || basename === 'readme.md') {
            return generateTimestampedFilename(parentDir);
        }
    }
    
    return absolutePath;
}

/**
 * 生成README并保存到文件 - 支持智能文件名生成
 */
export async function generateReadmeToFile(
    projectPath: string,
    outputPath: string = path.join(projectPath, 'ai-readme.md'),
    template: string = 'comprehensive',
    language: string = 'zh-CN',
    customFile?: string
): Promise<void> {
    console.log('🚀 开始生成AI友好的README文档...');

    // 智能处理输出路径
    const resolvedOutputPath = resolveOutputPath(outputPath, projectPath);
    
    // 如果路径发生了变化，显示提示
    if (resolvedOutputPath !== outputPath) {
        console.log(`📝 检测到目录路径，自动生成文件名: ${path.basename(resolvedOutputPath)}`);
    }

    const readme = await generateReadme(projectPath, template, language, customFile);

    // 确保输出目录存在
    const outputDir = path.dirname(resolvedOutputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 写入文件
    fs.writeFileSync(resolvedOutputPath, readme, 'utf8');

    console.log(`✅ AI README已生成并保存到: ${resolvedOutputPath}`);
    console.log(`📄 文件大小: ${(fs.statSync(resolvedOutputPath).size / 1024).toFixed(2)} KB`);
}

/**
 * 用于存储文件和其时间戳信息的接口
 */
interface TimestampedFile {
    /** 文件绝对路径 */
    path: string;
    /** 从文件名提取的时间戳 */
    timestamp: string;
}

/**
 * 查找最新的README文件
 * 
 * 使用glob自动搜索readme-${timestamp}.md类型的文件，根据内容筛选出Readme工具生成的文件路径。
 * 如果有多个只返回最新生成的文件路径（根据timestamp判断）。
 * 
 * @param searchDir 搜索目录，默认为用户下载目录
 * @param workspace 工作空间目录，用于限定搜索范围（可选）。如果提供，将优先在此目录下搜索
 * @returns 最新README文件路径，如果没找到返回null
 */
export async function findLatestReadmeFile(searchDir: string = '/Users/fangqiji/Downloads', workspace?: string): Promise<string | null> {
    try {
        // 如果提供了workspace参数，优先在workspace下搜索
        const effectiveSearchDir = workspace ? 
            (path.isAbsolute(workspace) ? workspace : path.resolve(process.cwd(), workspace)) : 
            searchDir;
            
        // 检查目录是否存在
        if (!fs.existsSync(effectiveSearchDir) || !fs.statSync(effectiveSearchDir).isDirectory()) {
            console.error(`搜索目录不存在或不是有效目录: ${effectiveSearchDir}`);
            return null;
        }
        
        // 使用glob模式查找readme或ai-readme开头的md文件
        const pattern = path.join(effectiveSearchDir, '{readme,ai-readme}-*.md');
        const files: string[] = glob.sync(pattern);
        
        if (files.length === 0) {
            console.log(`在 ${effectiveSearchDir} 中没有找到README文件`);
            return null;
        }
        
        // 解析文件名中的时间戳并排序
        const timestampedFiles: TimestampedFile[] = files.map((file: string) => {
            const filename = path.basename(file);
            // 使用正则表达式提取时间戳部分
            const match = filename.match(/[a-zA-Z-]+-([0-9]{8,14})\.md/);
            const timestamp = match ? match[1] : '0';
            return { path: file, timestamp };
        });

        // 按时间戳降序排序
        timestampedFiles.sort((a: TimestampedFile, b: TimestampedFile) => b.timestamp.localeCompare(a.timestamp));
        
        // 确认是由Readme工具生成的（检查文件内容）
        for (const file of timestampedFiles) {
            try {
                const content = fs.readFileSync(file.path, 'utf-8');
                // 检查是否包含典型的README标记
                if (
                    content.includes('# ') && 
                    (content.includes('Project Overview') || 
                    content.includes('项目概览') || 
                    content.includes('Code Structure Analysis'))
                ) {
                    return file.path;
                }
            } catch (error) {
                console.warn(`无法读取文件 ${file.path}:`, error);
            }
        }

        return null;
    } catch (error) {
        console.error('查找README文件出错:', error);
        return null;
    }
}

/**
 * 定义README文档中的各部分类型
 */
export type ReadmeSection = 'route' | 'structure' | 'architecture' | 'directory' | 'all';

/**
 * 定义提取README内容的选项
 */
export interface ExtractReadmeOptions {
    /** README文件路径，如果未提供则自动查找 */
    readmePath?: string;
    /** 要提取的内容部分，默认为['all'] */
    sections?: ReadmeSection[];
    /** 工作空间目录，用于限定搜索范围 */
    workspace?: string;
}

/**
 * 提取README中的特定部分内容
 * 
 * 支持传入readme路径和section参数，根据section类型筛选需要的内容部分。
 * 
 * @param options 配置选项
 * @param options.readmePath README文件路径（可选，如果未提供则自动查找）
 * @param options.sections 要提取的部分，可选值: ['route', 'structure', 'architecture', 'directory', 'all']
 * @param options.workspace 工作空间目录，用于限定搜索范围（可选）
 * @returns 提取到的内容部分，按sections参数返回
 */
export async function extractReadmeSections(
    options: ExtractReadmeOptions = {}
): Promise<Record<ReadmeSection, string>> {
    const { readmePath, sections = ['all'] } = options;
    
    // 如果未提供readme路径，则自动查找
    const filePath = readmePath || await findLatestReadmeFile(undefined, options.workspace);
    if (!filePath) {
        console.error('未找到README文件');
        return {} as Record<ReadmeSection, string>;
    }
    
    try {
        // 检查文件是否存在且可读
        if (!fs.existsSync(filePath)) {
            console.error(`README文件不存在: ${filePath}`);
            return {} as Record<ReadmeSection, string>;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const result: Record<string, string> = {};
        
        // 如果请求'all'，则返回完整内容
        if (!sections.length || sections.includes('all')) {
            result.all = content;
            return result as Record<ReadmeSection, string>;
        }
        
        // 使用标题作为分割点提取内容
        const sectionPatterns: Record<ReadmeSection, RegExp> = {
            route: /## 🌐 Route Configuration Analysis[\s\S]*?(?=\n## |\n---|\n\n\n#|$)/,
            structure: /## 🗂️ Project Directory Structure[\s\S]*?(?=\n## |\n---|\n\n\n#|$)/,
            architecture: /## (🏗️ Architecture Analysis|📊 Project Architecture Diagrams)[\s\S]*?(?=\n## |\n---|\n\n\n#|$)/,
            directory: /(# 📂 Detailed Directory Analysis|## 📂 Detailed Directory Analysis)[\s\S]*/,
            all: /[\s\S]*/ // 匹配全部内容的正则表达式（实际不会用到，因为'all'情况已经处理）
        };
        
        // 提取请求的每个部分
        for (const section of sections) {
            if (section === 'all') continue; // 已经处理过
            
            const pattern = sectionPatterns[section];
            if (pattern) {
                const match = content.match(pattern);
                if (match) {
                    // 处理提取内容中可能的尾部多余分割线和意外内容
                    let cleanContent = match[0].trim();
                    
                    // 移除尾部的分隔线和空行
                    cleanContent = cleanContent.replace(/\n+---\n+$/, '');
                    cleanContent = cleanContent.replace(/\n+$/, '');
                    
                    result[section] = cleanContent;
                } else {
                    console.warn(`未在README中找到部分: ${section}`);
                    result[section] = '';
                }
            }
        }
        
        return result as Record<ReadmeSection, string>;
    } catch (error) {
        console.error(`提取README内容出错: ${error instanceof Error ? error.message : String(error)}`);
        return {} as Record<ReadmeSection, string>;
    }
}

/**
 * 获取项目路由配置
 * 
 * 通过RouteConfigAnalyzer类分析项目路由配置文件，使用AI解析页面路由信息。
 * 自动查找项目中的路由配置文件并提取所有页面级路由的详细信息。
 * 
 * @param projectPath 项目根目录路径
 * @returns 解析后的路由配置数据数组
 */
export async function getProjectRoutConfig(projectPath: string): Promise<any> {
    const analyzer = new RouteConfigAnalyzer(projectPath, [], undefined, undefined, false);
    const routeConfig = await analyzer.getProjectRouteConfig();
    return routeConfig;
} 


// 导出所有需要的类型和工具
export * from './types';
export * from './utils';
export * from './analyzers/project-analyzer';
export * from './generators/ai-generator';
export * from './analyzers/enriched-data-analyzer';
export * from './analyzers/route-config-analyzer';
export * from './analyzers/data-flow-analyzer';
export * from './analyzers/enhanced-project-analyzer'; 