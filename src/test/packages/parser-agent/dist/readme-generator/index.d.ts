/**
 * README 生成器主入口文件 - 精简重构版
 */
/**
 * 主要的README生成类 - 重构版
 */
export declare class ReadmeGenerator {
    private projectPath;
    private entities;
    constructor(projectPath: string);
    /**
     * 加载实体数据 - 优先使用已有的entities.json，而不是重新分析
     */
    private loadEntities;
    /**
     * 生成README文档的主入口
     */
    generateReadme(template?: string, language?: string, customFile?: string): Promise<string>;
    /**
     * 深度分析项目结构和代码
     */
    private analyzeProject;
}
/**
 * 便捷的导出函数
 */
export declare function generateReadme(projectPath: string, template?: string, language?: string, customFile?: string): Promise<string>;
/**
 * 生成README并保存到文件 - 支持智能文件名生成
 */
export declare function generateReadmeToFile(projectPath: string, outputPath?: string, template?: string, language?: string, customFile?: string): Promise<void>;
export * from './types';
export * from './utils';
export * from './analyzers/project-analyzer';
export * from './generators/ai-generator';
export * from './analyzers/enriched-data-analyzer';
export * from './analyzers/route-config-analyzer';
export * from './analyzers/data-flow-analyzer';
export * from './analyzers/enhanced-project-analyzer';
