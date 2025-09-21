"use strict";
/**
 * 增强项目结构分析器 - 基于 enriched 数据的目录结构分析
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedProjectStructureAnalyzer = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("../utils");
/**
 * 增强项目结构分析器
 */
class EnhancedProjectStructureAnalyzer {
    constructor(projectPath, enrichedAnalyzer) {
        this.enrichedEntities = [];
        this.directorySemanticsMap = new Map();
        this.projectPath = projectPath;
        this.enrichedAnalyzer = enrichedAnalyzer;
    }
    /**
     * 分析项目结构（增强版）
     */
    async analyze() {
        console.log('🏗️ 开始增强项目结构分析...');
        // 1. 加载 enriched 数据
        this.enrichedEntities = await this.enrichedAnalyzer.loadEnrichedData();
        // 2. 生成目录语义描述
        this.directorySemanticsMap = this.enrichedAnalyzer.generateDirectorySemantics();
        // 3. 执行基础结构分析
        const basicStructure = await this.analyzeBasicStructure();
        // 4. 增强目录信息
        const enhancedDirectories = await this.enhanceDirectoryInfo(basicStructure.directories);
        // 5. 分析特殊工程含义
        const specialMeaningAnalysis = this.enrichedAnalyzer.analyzeSpecialMeanings();
        // 6. 分析文件夹规范
        const folderStandardAnalysis = this.enrichedAnalyzer.analyzeFolderStandards();
        console.log('✅ 增强项目结构分析完成');
        return {
            ...basicStructure,
            enhancedDirectories,
            specialMeaningAnalysis,
            folderStandardAnalysis
        };
    }
    /**
     * 分析基础项目结构
     */
    async analyzeBasicStructure() {
        const directories = [];
        const keyFiles = [];
        const fileDistribution = {};
        let totalFiles = 0;
        let totalDirectories = 0;
        // 递归遍历目录
        const traverseDirectory = (dirPath, relativePath = '') => {
            try {
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
                        // 跳过隐藏文件和 node_modules
                        if (item.startsWith('.') || item === 'node_modules')
                            return;
                        try {
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
                                        complexity: this.calculateFileComplexity(itemPath),
                                        importance: utils_1.FileAnalysisUtils.calculateFileImportance(item)
                                    });
                                }
                            }
                        }
                        catch (error) {
                            console.warn(`无法访问 ${itemPath}:`, error);
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
                            path: relativePath,
                            purpose: utils_1.FileAnalysisUtils.getDirectoryPurpose(relativePath, mainFileTypes),
                            fileCount,
                            subDirectories,
                            mainFileTypes,
                            importance: utils_1.FileAnalysisUtils.calculateDirectoryImportance(relativePath, fileCount)
                        });
                    }
                }
            }
            catch (error) {
                console.warn(`无法遍历目录 ${dirPath}:`, error);
            }
        };
        // 开始遍历
        traverseDirectory(this.projectPath);
        return {
            totalFiles,
            totalDirectories,
            directories,
            keyFiles,
            fileDistribution
        };
    }
    /**
     * 增强目录信息
     */
    async enhanceDirectoryInfo(basicDirectories) {
        const enhancedDirectories = [];
        for (const basicDir of basicDirectories) {
            const enhancedInfo = this.directorySemanticsMap.get(basicDir.path);
            if (enhancedInfo) {
                // 合并基础信息和增强信息
                enhancedDirectories.push({
                    ...basicDir,
                    ...enhancedInfo,
                    // 更新子目录数量
                    subDirectories: basicDir.subDirectories
                });
            }
            else {
                // 为没有 enriched 数据的目录生成基础增强信息
                enhancedDirectories.push({
                    ...basicDir,
                    semanticDescription: this.generateBasicSemanticDescription(basicDir),
                    enrichedPurpose: basicDir.purpose,
                    containsPages: this.containsPages(basicDir.path),
                    containsServices: this.containsServices(basicDir.path),
                    containsUtils: this.containsUtils(basicDir.path)
                });
            }
        }
        return enhancedDirectories;
    }
    /**
     * 生成基础语义描述
     */
    generateBasicSemanticDescription(directory) {
        const dirName = path_1.default.basename(directory.path);
        const fileTypes = directory.mainFileTypes;
        let description = `${dirName} 目录`;
        if (fileTypes.includes('.vue')) {
            description += '，包含 Vue 组件';
        }
        if (fileTypes.includes('.ts') || fileTypes.includes('.js')) {
            description += '，包含 TypeScript/JavaScript 文件';
        }
        if (fileTypes.includes('.json')) {
            description += '，包含配置文件';
        }
        return description;
    }
    /**
     * 获取目录统计信息
     */
    getDirectoryStats() {
        const directoriesWithSpecialMeaning = Array.from(this.directorySemanticsMap.values())
            .filter(dir => dir.specialMeaning).length;
        const directoriesWithEnrichedData = this.directorySemanticsMap.size;
        // 计算合规性得分
        const folderStandardAnalysis = this.enrichedAnalyzer.analyzeFolderStandards();
        const complianceScore = folderStandardAnalysis.complianceScore;
        return {
            totalDirectories: this.directorySemanticsMap.size,
            directoriesWithSpecialMeaning,
            directoriesWithEnrichedData,
            complianceScore
        };
    }
    /**
     * 获取关键目录信息
     */
    getCriticalDirectories() {
        return Array.from(this.directorySemanticsMap.values())
            .filter(dir => dir.importance > 7)
            .sort((a, b) => b.importance - a.importance);
    }
    /**
     * 获取特定类型的目录
     */
    getDirectoriesByType(type) {
        const filterFn = (dir) => {
            switch (type) {
                case 'pages':
                    return dir.containsPages;
                case 'services':
                    return dir.containsServices;
                case 'utils':
                    return dir.containsUtils;
                default:
                    return false;
            }
        };
        return Array.from(this.directorySemanticsMap.values()).filter(filterFn);
    }
    /**
     * 生成目录树结构
     */
    generateDirectoryTree() {
        const tree = [];
        const directories = Array.from(this.directorySemanticsMap.values());
        // 按路径深度和重要性排序
        const sortedDirectories = directories.sort((a, b) => {
            const depthA = a.path.split('/').length;
            const depthB = b.path.split('/').length;
            if (depthA !== depthB) {
                return depthA - depthB;
            }
            return b.importance - a.importance;
        });
        sortedDirectories.forEach(dir => {
            const depth = dir.path.split('/').length - 1;
            const indent = '  '.repeat(depth);
            const specialMark = dir.specialMeaning ? ' ⭐' : '';
            tree.push(`${indent}📁 ${path_1.default.basename(dir.path)}/ (${dir.fileCount} files)${specialMark}`);
            if (dir.semanticDescription) {
                tree.push(`${indent}   ${dir.semanticDescription}`);
            }
        });
        return tree.join('\n');
    }
    /**
     * 生成目录摘要报告
     */
    generateDirectorySummary() {
        const stats = this.getDirectoryStats();
        const criticalDirs = this.getCriticalDirectories();
        const summary = [
            `📊 目录结构统计`,
            `• 总目录数量: ${stats.totalDirectories}`,
            `• 包含特殊含义的目录: ${stats.directoriesWithSpecialMeaning}`,
            `• 包含增强数据的目录: ${stats.directoriesWithEnrichedData}`,
            `• 规范合规性得分: ${stats.complianceScore.toFixed(1)}%`,
            ``,
            `🌟 关键目录 (重要性 > 7):`,
            ...criticalDirs.slice(0, 5).map(dir => `• ${dir.path}: ${dir.specialMeaning || dir.semanticDescription}`)
        ];
        return summary.join('\n');
    }
    // 辅助方法
    calculateFileComplexity(filePath) {
        try {
            return utils_1.CodeAnalysisUtils.calculateFileComplexity(filePath);
        }
        catch (error) {
            return 1;
        }
    }
    containsPages(dirPath) {
        const entities = this.enrichedEntities.filter(e => path_1.default.dirname(e.file) === dirPath);
        return entities.some(e => e.type === 'component' &&
            (e.tags?.includes('页面组件') || e.file.includes('pages')));
    }
    containsServices(dirPath) {
        const entities = this.enrichedEntities.filter(e => path_1.default.dirname(e.file) === dirPath);
        return entities.some(e => e.tags?.includes('API接口') ||
            e.tags?.includes('服务层') ||
            e.file.includes('services'));
    }
    containsUtils(dirPath) {
        const entities = this.enrichedEntities.filter(e => path_1.default.dirname(e.file) === dirPath);
        return entities.some(e => e.tags?.includes('工具函数') ||
            e.file.includes('utils'));
    }
    /**
     * 获取目录的 enriched 实体
     */
    getDirectoryEntities(dirPath) {
        return this.enrichedEntities.filter(e => path_1.default.dirname(e.file) === dirPath);
    }
    /**
     * 获取目录语义映射
     */
    getDirectorySemantics() {
        return this.directorySemanticsMap;
    }
    /**
     * 根据路径获取目录信息
     */
    getDirectoryInfo(dirPath) {
        return this.directorySemanticsMap.get(dirPath);
    }
}
exports.EnhancedProjectStructureAnalyzer = EnhancedProjectStructureAnalyzer;
