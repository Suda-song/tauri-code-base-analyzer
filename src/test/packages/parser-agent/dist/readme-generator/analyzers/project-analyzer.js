"use strict";
/**
 * 项目分析器 - 负责分析项目的各个方面
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BestPracticesAnalyzer = exports.ArchitectureAnalyzer = exports.TechnologyStackAnalyzer = exports.DependencyAnalyzer = exports.CodeStatsAnalyzer = exports.ProjectStructureAnalyzer = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("../utils");
/**
 * 项目结构分析器
 */
class ProjectStructureAnalyzer {
    constructor(projectPath) {
        this.projectPath = projectPath;
    }
    /**
     * 分析项目结构
     */
    async analyze() {
        const directories = [];
        const keyFiles = [];
        const fileDistribution = {};
        let totalFiles = 0;
        let totalDirectories = 0;
        // 递归遍历目录
        const traverseDirectory = (dirPath, relativePath = '') => {
            const items = fs_1.default.readdirSync(dirPath);
            const stats = fs_1.default.statSync(dirPath);
            if (stats.isDirectory()) {
                totalDirectories++;
                let fileCount = 0;
                let subDirectories = 0;
                const mainFileTypes = [];
                const fileTypeCount = {};
                items.forEach(item => {
                    const itemPath = path_1.default.join(dirPath, item);
                    const itemStats = fs_1.default.statSync(itemPath);
                    if (itemStats.isDirectory()) {
                        subDirectories++;
                        // 递归遍历子目录
                        traverseDirectory(itemPath, path_1.default.join(relativePath, item));
                    }
                    else {
                        fileCount++;
                        totalFiles++;
                        const ext = path_1.default.extname(item).toLowerCase();
                        fileTypeCount[ext] = (fileTypeCount[ext] || 0) + 1;
                        fileDistribution[ext] = (fileDistribution[ext] || 0) + 1;
                        // 识别关键文件
                        if (utils_1.FileAnalysisUtils.isKeyFile(item)) {
                            keyFiles.push({
                                path: path_1.default.join(relativePath, item),
                                type: utils_1.FileAnalysisUtils.getFileType(item),
                                purpose: utils_1.FileAnalysisUtils.getFilePurpose(item),
                                size: itemStats.size,
                                complexity: utils_1.CodeAnalysisUtils.calculateFileComplexity(itemPath),
                                importance: utils_1.FileAnalysisUtils.calculateFileImportance(item)
                            });
                        }
                    }
                });
                // 确定主要文件类型
                Object.entries(fileTypeCount)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .forEach(([ext]) => mainFileTypes.push(ext));
                // 只添加有意义的目录
                if (fileCount > 0 || subDirectories > 0) {
                    directories.push({
                        path: relativePath || '.',
                        purpose: utils_1.FileAnalysisUtils.getDirectoryPurpose(relativePath, mainFileTypes),
                        fileCount,
                        subDirectories,
                        mainFileTypes,
                        importance: utils_1.FileAnalysisUtils.calculateDirectoryImportance(relativePath, fileCount)
                    });
                }
            }
        };
        traverseDirectory(this.projectPath);
        return {
            totalFiles,
            totalDirectories,
            directories: directories.sort((a, b) => b.importance - a.importance),
            keyFiles: keyFiles.sort((a, b) => b.importance - a.importance),
            fileDistribution
        };
    }
}
exports.ProjectStructureAnalyzer = ProjectStructureAnalyzer;
/**
 * 代码统计分析器
 */
class CodeStatsAnalyzer {
    constructor(projectPath, entities) {
        this.projectPath = projectPath;
        this.entities = entities;
    }
    /**
     * 分析代码统计信息
     */
    analyze() {
        let totalLines = 0;
        let codeLines = 0;
        let commentLines = 0;
        let blankLines = 0;
        let totalComplexity = 0;
        let fileCount = 0;
        const fileTypeStats = {};
        // 基于提取的实体进行统计
        this.entities.forEach(entity => {
            const ext = path_1.default.extname(entity.file).toLowerCase();
            if (!fileTypeStats[ext]) {
                fileTypeStats[ext] = {
                    count: 0,
                    lines: 0,
                    avgComplexity: 0
                };
            }
            fileTypeStats[ext].count++;
            // 尝试读取文件内容进行详细分析
            try {
                const filePath = path_1.default.join(this.projectPath, entity.file);
                if (fs_1.default.existsSync(filePath)) {
                    const content = fs_1.default.readFileSync(filePath, 'utf8');
                    const lines = content.split('\n');
                    const fileStats = utils_1.CodeAnalysisUtils.analyzeFileContent(content);
                    totalLines += lines.length;
                    codeLines += fileStats.codeLines;
                    commentLines += fileStats.commentLines;
                    blankLines += fileStats.blankLines;
                    totalComplexity += fileStats.complexity;
                    fileCount++;
                    fileTypeStats[ext].lines += lines.length;
                    fileTypeStats[ext].avgComplexity += fileStats.complexity;
                }
            }
            catch (error) {
                // 忽略文件读取错误
            }
        });
        // 计算平均复杂度
        Object.values(fileTypeStats).forEach(stats => {
            if (stats.count > 0) {
                stats.avgComplexity = stats.avgComplexity / stats.count;
            }
        });
        return {
            totalLines,
            codeLines,
            commentLines,
            blankLines,
            averageComplexity: fileCount > 0 ? totalComplexity / fileCount : 0,
            fileTypeStats
        };
    }
}
exports.CodeStatsAnalyzer = CodeStatsAnalyzer;
/**
 * 依赖分析器
 */
class DependencyAnalyzer {
    /**
     * 分析依赖关系
     */
    analyze(packageInfo) {
        const production = Object.keys(packageInfo.dependencies || {});
        const development = Object.keys(packageInfo.devDependencies || {});
        const frameworksAndLibraries = [];
        const buildTools = [];
        const testingFrameworks = [];
        const uiLibraries = [];
        const stateManagement = [];
        const routing = [];
        // 分类依赖
        [...production, ...development].forEach(dep => {
            if (utils_1.DependencyUtils.isFramework(dep))
                frameworksAndLibraries.push(dep);
            if (utils_1.DependencyUtils.isBuildTool(dep))
                buildTools.push(dep);
            if (utils_1.DependencyUtils.isTestingFramework(dep))
                testingFrameworks.push(dep);
            if (utils_1.DependencyUtils.isUILibrary(dep))
                uiLibraries.push(dep);
            if (utils_1.DependencyUtils.isStateManagement(dep))
                stateManagement.push(dep);
            if (utils_1.DependencyUtils.isRouting(dep))
                routing.push(dep);
        });
        return {
            production,
            development,
            frameworksAndLibraries,
            buildTools,
            testingFrameworks,
            uiLibraries,
            stateManagement,
            routing
        };
    }
}
exports.DependencyAnalyzer = DependencyAnalyzer;
/**
 * 技术栈分析器
 */
class TechnologyStackAnalyzer {
    constructor(entities) {
        this.entities = entities;
    }
    /**
     * 识别技术栈
     */
    analyze(packageInfo, structure) {
        const technologies = new Set();
        // 基于依赖识别
        const allDeps = [
            ...Object.keys(packageInfo.dependencies || {}),
            ...Object.keys(packageInfo.devDependencies || {})
        ];
        allDeps.forEach(dep => {
            const tech = utils_1.DependencyUtils.mapDependencyToTechnology(dep);
            if (tech)
                technologies.add(tech);
        });
        // 基于文件类型识别
        Object.keys(structure.fileDistribution).forEach(ext => {
            const tech = utils_1.DependencyUtils.mapFileExtensionToTechnology(ext);
            if (tech)
                technologies.add(tech);
        });
        // 基于代码实体识别
        this.entities.forEach(entity => {
            const techs = utils_1.CodeAnalysisUtils.identifyTechnologyFromEntity(entity);
            techs.forEach(tech => technologies.add(tech));
        });
        return Array.from(technologies);
    }
}
exports.TechnologyStackAnalyzer = TechnologyStackAnalyzer;
/**
 * 架构分析器
 */
class ArchitectureAnalyzer {
    constructor(entities) {
        this.entities = entities;
    }
    /**
     * 分析架构模式
     */
    async analyze() {
        const componentStructure = this.analyzeComponentStructure();
        const apiStructure = this.analyzeApiStructure();
        // 基于项目结构推断架构模式
        const pattern = this.inferArchitecturePattern();
        const layers = this.identifyArchitectureLayers();
        const dataFlow = this.analyzeDataFlow();
        return {
            pattern,
            layers,
            dataFlow,
            componentStructure,
            apiStructure
        };
    }
    /**
     * 分析组件结构
     */
    analyzeComponentStructure() {
        const componentEntities = this.entities.filter(e => e.type === 'VueComponent' ||
            e.type === 'ReactComponent' ||
            e.type === 'Component');
        const componentsByType = {};
        const componentHierarchy = [];
        const sharedComponents = [];
        componentEntities.forEach(entity => {
            componentsByType[entity.type] = (componentsByType[entity.type] || 0) + 1;
            // 分析组件层次结构
            if (entity.TEMPLATE_COMPONENTS && entity.TEMPLATE_COMPONENTS.length > 0) {
                componentHierarchy.push({
                    name: entity.rawName,
                    children: entity.TEMPLATE_COMPONENTS
                });
            }
            // 识别共享组件
            if (this.isSharedComponent(entity)) {
                sharedComponents.push(entity.rawName);
            }
        });
        return {
            totalComponents: componentEntities.length,
            componentsByType,
            componentHierarchy,
            sharedComponents
        };
    }
    /**
     * 分析API结构
     */
    analyzeApiStructure() {
        const apiEntities = this.entities.filter(e => e.type === 'Function' && utils_1.APIAnalysisUtils.isApiFunction(e));
        const endpoints = [];
        const methods = new Set();
        const dataModels = new Set();
        const authentication = new Set();
        apiEntities.forEach(entity => {
            // 分析API端点
            if (entity.CALLS) {
                entity.CALLS.forEach((call) => {
                    if (utils_1.APIAnalysisUtils.isHttpCall(call)) {
                        const method = utils_1.APIAnalysisUtils.extractHttpMethod(call);
                        if (method)
                            methods.add(method);
                        endpoints.push({
                            name: entity.rawName,
                            method,
                            path: utils_1.APIAnalysisUtils.extractApiPath(call)
                        });
                    }
                });
            }
            // 分析数据模型
            if (entity.IMPORTS) {
                entity.IMPORTS.forEach((imp) => {
                    if (utils_1.APIAnalysisUtils.isDataModel(imp)) {
                        dataModels.add(imp);
                    }
                });
            }
        });
        return {
            endpoints,
            methods: Array.from(methods),
            dataModels: Array.from(dataModels),
            authentication: Array.from(authentication)
        };
    }
    /**
     * 推断架构模式
     */
    inferArchitecturePattern() {
        const vueComponents = this.entities.filter(e => e.type === 'VueComponent').length;
        const reactComponents = this.entities.filter(e => e.type === 'ReactComponent').length;
        const services = this.entities.filter(e => e.type === 'Function' && this.isServiceFunction(e)).length;
        if (vueComponents > 0)
            return 'Vue组件化架构';
        if (reactComponents > 0)
            return 'React组件化架构';
        if (services > 0)
            return '服务层架构';
        return '模块化架构';
    }
    /**
     * 识别架构层次
     */
    identifyArchitectureLayers() {
        const layers = [];
        if (this.hasLayer('view'))
            layers.push('视图层');
        if (this.hasLayer('component'))
            layers.push('组件层');
        if (this.hasLayer('service'))
            layers.push('服务层');
        if (this.hasLayer('store'))
            layers.push('状态层');
        if (this.hasLayer('util'))
            layers.push('工具层');
        return layers.length > 0 ? layers : ['业务逻辑层'];
    }
    /**
     * 分析数据流
     */
    analyzeDataFlow() {
        const hasVuex = this.entities.some(e => e.IMPORTS?.includes('vuex'));
        const hasPinia = this.entities.some(e => e.IMPORTS?.includes('pinia'));
        const hasRedux = this.entities.some(e => e.IMPORTS?.includes('redux'));
        if (hasVuex || hasPinia)
            return 'Vuex/Pinia状态管理';
        if (hasRedux)
            return 'Redux状态管理';
        return 'Props/Events数据流';
    }
    /**
     * 判断是否为共享组件
     */
    isSharedComponent(entity) {
        return entity.file.includes('components') &&
            !entity.file.includes('pages') &&
            !entity.file.includes('views');
    }
    /**
     * 判断是否为服务函数
     */
    isServiceFunction(entity) {
        return entity.file.includes('service') || entity.file.includes('api');
    }
    /**
     * 判断是否有某个层
     */
    hasLayer(layerName) {
        return this.entities.some(entity => entity.file.toLowerCase().includes(layerName) ||
            entity.rawName.toLowerCase().includes(layerName));
    }
}
exports.ArchitectureAnalyzer = ArchitectureAnalyzer;
/**
 * 最佳实践分析器
 */
class BestPracticesAnalyzer {
    constructor(projectPath, entities) {
        this.projectPath = projectPath;
        this.entities = entities;
    }
    /**
     * 分析最佳实践
     */
    async analyze() {
        const strengths = [];
        const improvements = [];
        const recommendations = [];
        let score = 0;
        // 代码质量评估
        const codeQuality = this.evaluateCodeQuality();
        score += codeQuality.maintainability * 0.3;
        score += codeQuality.testCoverage * 0.2;
        score += codeQuality.documentationCoverage * 0.2;
        score += codeQuality.codeReusability * 0.15;
        score += codeQuality.performance * 0.15;
        // 项目结构评估
        if (utils_1.ProjectUtils.hasGoodFolderStructure(this.projectPath)) {
            strengths.push('项目结构清晰，目录组织合理');
            score += 10;
        }
        else {
            improvements.push('建议优化项目目录结构');
            recommendations.push('采用标准的项目目录结构，如src/、tests/、docs/等');
        }
        // 配置文件评估
        if (utils_1.ProjectUtils.hasEssentialConfigFiles(this.projectPath)) {
            strengths.push('配置文件完整，开发环境配置规范');
            score += 10;
        }
        else {
            improvements.push('缺少重要的配置文件');
            recommendations.push('添加ESLint、Prettier、TypeScript等配置文件');
        }
        // 测试覆盖率评估
        if (codeQuality.testCoverage > 80) {
            strengths.push('测试覆盖率高，代码质量有保障');
        }
        else if (codeQuality.testCoverage > 50) {
            improvements.push('测试覆盖率有待提高');
            recommendations.push('增加单元测试和集成测试');
        }
        else {
            improvements.push('测试覆盖率较低');
            recommendations.push('建立完整的测试体系');
        }
        // 文档完整性评估
        if (codeQuality.documentationCoverage > 70) {
            strengths.push('文档完整，代码注释充分');
        }
        else {
            improvements.push('文档和注释需要完善');
            recommendations.push('添加API文档、使用说明和代码注释');
        }
        return {
            score: Math.min(100, Math.max(0, score)),
            strengths,
            improvements,
            recommendations,
            codeQuality
        };
    }
    /**
     * 评估代码质量
     */
    evaluateCodeQuality() {
        const testFiles = this.findTestFiles();
        const docFiles = utils_1.ProjectUtils.findDocumentation(this.projectPath);
        const totalFiles = this.entities.length;
        // 测试覆盖率（基于测试文件数量估算）
        const testCoverage = totalFiles > 0 ? (testFiles.length / totalFiles) * 100 : 0;
        // 文档覆盖率（基于注释和文档文件）
        const commentRatio = this.calculateCommentRatio();
        const hasDocFiles = docFiles.length > 0;
        const documentationCoverage = Math.min(100, commentRatio * 80 + (hasDocFiles ? 20 : 0));
        // 代码复用性（基于组件和函数的复用情况）
        const codeReusability = this.calculateCodeReusability();
        // 可维护性（基于代码复杂度和结构）
        const maintainability = this.calculateMaintainability();
        // 性能评估（基于代码实践）
        const performance = this.evaluatePerformance();
        return {
            testCoverage: Math.min(100, testCoverage),
            documentationCoverage,
            codeReusability,
            maintainability,
            performance
        };
    }
    /**
     * 查找测试文件
     */
    findTestFiles() {
        return this.entities
            .filter(entity => utils_1.FileAnalysisUtils.isTestFile(entity.file))
            .map(entity => entity.file);
    }
    /**
     * 计算注释比例
     */
    calculateCommentRatio() {
        const codeAnalyzer = new CodeStatsAnalyzer(this.projectPath, this.entities);
        const stats = codeAnalyzer.analyze();
        return stats.totalLines > 0 ? (stats.commentLines / stats.totalLines) * 100 : 0;
    }
    /**
     * 计算代码复用性
     */
    calculateCodeReusability() {
        const totalFunctions = this.entities.filter(e => e.type === 'Function').length;
        const reusableFunctions = this.entities.filter(e => e.type === 'Function' && (e.file.includes('util') || e.file.includes('helper'))).length;
        return totalFunctions > 0 ? (reusableFunctions / totalFunctions) * 100 : 50;
    }
    /**
     * 计算可维护性
     */
    calculateMaintainability() {
        const codeAnalyzer = new CodeStatsAnalyzer(this.projectPath, this.entities);
        const stats = codeAnalyzer.analyze();
        const complexityScore = Math.max(0, 100 - (stats.averageComplexity - 1) * 10);
        const structureScore = utils_1.ProjectUtils.hasGoodFolderStructure(this.projectPath) ? 20 : 0;
        const configScore = utils_1.ProjectUtils.hasEssentialConfigFiles(this.projectPath) ? 20 : 0;
        return Math.min(100, (complexityScore + structureScore + configScore) / 3);
    }
    /**
     * 评估性能
     */
    evaluatePerformance() {
        // 基于一些简单的性能指标评估
        let score = 70; // 基础分数
        // 检查是否有性能优化相关的配置
        const hasLazyLoading = this.entities.some(e => e.content && (e.content.includes('lazy') || e.content.includes('dynamic')));
        if (hasLazyLoading)
            score += 10;
        // 检查是否有构建优化配置
        const hasBuildOptimization = utils_1.ProjectUtils.findConfigFiles(this.projectPath).some(file => file.includes('webpack') || file.includes('vite'));
        if (hasBuildOptimization)
            score += 10;
        // 检查文件大小是否合理
        const avgFileSize = this.calculateAverageFileSize();
        if (avgFileSize < 1000)
            score += 10; // 小于1KB的平均文件大小
        return Math.min(100, score);
    }
    /**
     * 计算平均文件大小
     */
    calculateAverageFileSize() {
        let totalSize = 0;
        let fileCount = 0;
        this.entities.forEach(entity => {
            try {
                const filePath = path_1.default.join(this.projectPath, entity.file);
                if (fs_1.default.existsSync(filePath)) {
                    const stats = fs_1.default.statSync(filePath);
                    totalSize += stats.size;
                    fileCount++;
                }
            }
            catch (error) {
                // 忽略错误
            }
        });
        return fileCount > 0 ? totalSize / fileCount : 0;
    }
    /**
     * 识别项目类型
     */
    static identifyProjectType(packageInfo, structure, dependencies) {
        // 基于依赖判断
        if (dependencies.frameworksAndLibraries.includes('vue'))
            return 'Vue应用';
        if (dependencies.frameworksAndLibraries.includes('react'))
            return 'React应用';
        if (dependencies.frameworksAndLibraries.includes('next'))
            return 'Next.js应用';
        if (dependencies.frameworksAndLibraries.includes('nuxt'))
            return 'Nuxt.js应用';
        if (dependencies.frameworksAndLibraries.includes('express'))
            return 'Express后端应用';
        if (dependencies.frameworksAndLibraries.includes('koa'))
            return 'Koa后端应用';
        if (dependencies.frameworksAndLibraries.includes('nest'))
            return 'NestJS应用';
        // 基于文件结构判断
        if (structure.fileDistribution['.vue'] > 0)
            return 'Vue项目';
        if (structure.fileDistribution['.jsx'] > 0 || structure.fileDistribution['.tsx'] > 0)
            return 'React项目';
        if (structure.fileDistribution['.ts'] > structure.fileDistribution['.js'])
            return 'TypeScript项目';
        // 基于package.json scripts判断
        const scripts = packageInfo.scripts || {};
        if (scripts.dev || scripts.serve)
            return '前端应用';
        if (scripts.start && scripts.build)
            return 'Web应用';
        if (scripts.test)
            return '带测试的项目';
        return 'JavaScript项目';
    }
}
exports.BestPracticesAnalyzer = BestPracticesAnalyzer;
