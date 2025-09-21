"use strict";
/**
 * README 生成器主入口文件 - 精简重构版
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeGenerator = void 0;
exports.generateReadme = generateReadme;
exports.generateReadmeToFile = generateReadmeToFile;
const fileWalker_1 = require("../fileWalker");
const utils_1 = require("./utils");
const project_analyzer_1 = require("./analyzers/project-analyzer");
const ai_generator_1 = require("./generators/ai-generator");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * 主要的README生成类 - 重构版
 */
class ReadmeGenerator {
    constructor(projectPath) {
        this.entities = [];
        this.projectPath = projectPath;
    }
    /**
     * 加载实体数据 - 优先使用已有的entities.json，而不是重新分析
     */
    async loadEntities() {
        const basePath = path_1.default.join(this.projectPath, 'data', 'entities.enriched.json');
        // 回退到基础entities数据
        if (fs_1.default.existsSync(basePath)) {
            try {
                const baseData = JSON.parse(fs_1.default.readFileSync(basePath, 'utf8'));
                console.log(`📄 使用基础数据: ${baseData.length} 个实体 (无依赖关系)`);
                return baseData;
            }
            catch (error) {
                console.warn('⚠️ 读取基础数据失败，进行实时提取', error);
            }
        }
        // 最后回退到实时提取
        console.log('🔍 进行实时代码实体提取...');
        return await (0, fileWalker_1.extractAllEntities)(this.projectPath);
    }
    /**
     * 生成README文档的主入口
     */
    async generateReadme(template = 'comprehensive', language = 'zh-CN', customFile) {
        console.log('🔍 开始分析项目结构...');
        // 1. 提取代码实体 - 优先使用enriched数据
        this.entities = await this.loadEntities();
        console.log(`✅ 提取了 ${this.entities.length} 个代码实体`);
        // 2. 深度分析项目
        const analysis = await this.analyzeProject();
        console.log('✅ 项目分析完成');
        // 3. 使用AI生成器生成文档内容
        const contentGenerator = new ai_generator_1.ReadmeContentGenerator();
        const readme = await contentGenerator.generateContent(analysis, template, language, this.projectPath, customFile);
        console.log('✅ README生成完成');
        return readme;
    }
    /**
     * 深度分析项目结构和代码
     */
    async analyzeProject() {
        const projectName = path_1.default.basename(this.projectPath);
        const packageInfo = utils_1.ProjectUtils.readPackageInfo(this.projectPath);
        // 使用模块化分析器进行各种分析
        console.log('📊 分析项目结构...');
        const structureAnalyzer = new project_analyzer_1.ProjectStructureAnalyzer(this.projectPath);
        const structure = await structureAnalyzer.analyze();
        console.log('📈 分析代码统计...');
        const codeStatsAnalyzer = new project_analyzer_1.CodeStatsAnalyzer(this.projectPath, this.entities);
        const codeStats = codeStatsAnalyzer.analyze();
        console.log('🔗 分析依赖关系...');
        const dependencyAnalyzer = new project_analyzer_1.DependencyAnalyzer();
        const dependencies = dependencyAnalyzer.analyze(packageInfo);
        console.log('🛠️ 识别技术栈...');
        const technologyAnalyzer = new project_analyzer_1.TechnologyStackAnalyzer(this.entities);
        const technologies = technologyAnalyzer.analyze(packageInfo, structure);
        console.log('🏗️ 分析架构模式...');
        const architectureAnalyzer = new project_analyzer_1.ArchitectureAnalyzer(this.entities);
        const architecture = await architectureAnalyzer.analyze();
        console.log('✨ 评估最佳实践...');
        const bestPracticesAnalyzer = new project_analyzer_1.BestPracticesAnalyzer(this.projectPath, this.entities);
        const bestPractices = await bestPracticesAnalyzer.analyze();
        // 识别项目类型
        const projectType = project_analyzer_1.BestPracticesAnalyzer.identifyProjectType(packageInfo, structure, dependencies);
        return {
            projectName,
            projectPath: this.projectPath,
            packageInfo,
            projectType,
            structure,
            codeStats,
            dependencies,
            technologies,
            mainEntries: utils_1.ProjectUtils.findMainEntries(this.projectPath),
            testFiles: this.entities
                .filter(entity => entity.file.includes('test') || entity.file.includes('spec'))
                .map(entity => entity.file),
            configFiles: utils_1.ProjectUtils.findConfigFiles(this.projectPath),
            documentation: utils_1.ProjectUtils.findDocumentation(this.projectPath),
            entities: this.entities,
            architecture,
            bestPractices
        };
    }
}
exports.ReadmeGenerator = ReadmeGenerator;
/**
 * 便捷的导出函数
 */
async function generateReadme(projectPath, template = 'comprehensive', language = 'zh-CN', customFile) {
    const generator = new ReadmeGenerator(projectPath);
    return generator.generateReadme(template, language, customFile);
}
/**
 * 生成带时间戳的文件名
 * @param baseDir 基础目录
 * @param prefix 文件名前缀，默认为 'readme'
 * @returns 完整的文件路径
 */
function generateTimestampedFilename(baseDir, prefix = 'readme') {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}${month}${day}${hour}${minute}${second}`;
    const filename = `${prefix}-${timestamp}.md`;
    return path_1.default.join(baseDir, filename);
}
/**
 * 智能处理输出路径
 * @param outputPath 用户指定的输出路径
 * @param projectPath 项目路径
 * @returns 处理后的完整输出路径
 */
function resolveOutputPath(outputPath, projectPath) {
    // 如果是绝对路径
    if (path_1.default.isAbsolute(outputPath)) {
        // 检查是否是目录
        if (fs_1.default.existsSync(outputPath) && fs_1.default.statSync(outputPath).isDirectory()) {
            return generateTimestampedFilename(outputPath);
        }
        // 如果文件不存在，直接返回
        return outputPath;
    }
    // 如果是相对路径，先解析为绝对路径
    const absolutePath = path_1.default.resolve(projectPath, outputPath);
    // 检查路径是否存在且是目录
    if (fs_1.default.existsSync(absolutePath) && fs_1.default.statSync(absolutePath).isDirectory()) {
        return generateTimestampedFilename(absolutePath);
    }
    // 检查父目录是否存在且是目录
    const parentDir = path_1.default.dirname(absolutePath);
    if (fs_1.default.existsSync(parentDir) && fs_1.default.statSync(parentDir).isDirectory()) {
        // 如果文件名部分为空或只是扩展名，生成带时间戳的文件名
        const basename = path_1.default.basename(outputPath);
        if (!basename || basename === '.md' || basename === 'readme.md') {
            return generateTimestampedFilename(parentDir);
        }
    }
    return absolutePath;
}
/**
 * 生成README并保存到文件 - 支持智能文件名生成
 */
async function generateReadmeToFile(projectPath, outputPath = path_1.default.join(projectPath, 'ai-readme.md'), template = 'comprehensive', language = 'zh-CN', customFile) {
    console.log('🚀 开始生成AI友好的README文档...');
    // 智能处理输出路径
    const resolvedOutputPath = resolveOutputPath(outputPath, projectPath);
    // 如果路径发生了变化，显示提示
    if (resolvedOutputPath !== outputPath) {
        console.log(`📝 检测到目录路径，自动生成文件名: ${path_1.default.basename(resolvedOutputPath)}`);
    }
    const readme = await generateReadme(projectPath, template, language, customFile);
    // 确保输出目录存在
    const outputDir = path_1.default.dirname(resolvedOutputPath);
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    // 写入文件
    fs_1.default.writeFileSync(resolvedOutputPath, readme, 'utf8');
    console.log(`✅ AI README已生成并保存到: ${resolvedOutputPath}`);
    console.log(`📄 文件大小: ${(fs_1.default.statSync(resolvedOutputPath).size / 1024).toFixed(2)} KB`);
}
// 导出所有需要的类型和工具
__exportStar(require("./types"), exports);
__exportStar(require("./utils"), exports);
__exportStar(require("./analyzers/project-analyzer"), exports);
__exportStar(require("./generators/ai-generator"), exports);
__exportStar(require("./analyzers/enriched-data-analyzer"), exports);
__exportStar(require("./analyzers/route-config-analyzer"), exports);
__exportStar(require("./analyzers/data-flow-analyzer"), exports);
__exportStar(require("./analyzers/enhanced-project-analyzer"), exports);
