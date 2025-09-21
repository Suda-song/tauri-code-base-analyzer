"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityIdGenerator = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const TypeUtils_1 = require("./TypeUtils");
const TSProjectManager_1 = require("./TSProjectManager");
const ts_morph_1 = require("ts-morph");
/**
 * 通用实体ID生成器
 * 为所有extractor和StaticAnalyzer提供一致的ID生成逻辑
 */
class EntityIdGenerator {
    /**
     * 初始化实体映射（供StaticAnalyzer使用）
     */
    static initEntityMap(entities) {
        this.entityMap.clear();
        // this.parentPathCandidatesCache.clear(); // 清理父路径候选实体缓存
        // this.finalResultCache.clear(); // 清理最终结果缓存
        for (const entity of entities) {
            if (!this.entityMap.has(entity.file)) {
                this.entityMap.set(entity.file, new Map());
            }
            this.entityMap.get(entity.file).set(entity.rawName, entity);
        }
    }
    /**
     * 生成实体ID - 标准模式（用于extractor）
     * @param filePath 文件路径
     * @param entityName 实体名称
     * @param isDefaultExport 是否是默认导出
     * @param entityNode AST节点（用于类型分析）
     * @param isJSXContext 是否在JSX上下文中
     */
    static generateId(filePath, entityName, isDefaultExport = false, entityNode, isJSXContext = false) {
        const fileName = path_1.default.basename(filePath, path_1.default.extname(filePath));
        let finalEntityName = entityName;
        // 默认导出使用文件名
        if (isDefaultExport) {
            finalEntityName = fileName;
        }
        // 如果有AST节点，直接分析类型
        if (entityNode) {
            return this.analyzeNodeType(entityNode, finalEntityName, isJSXContext);
        }
        // 如果没有AST节点，通过文件内容分析
        return this.analyzeEntityTypeFromFile(filePath, entityName, isDefaultExport, isJSXContext);
    }
    /**
     * 生成实体ID - 查找模式（用于StaticAnalyzer）
     * @param filePath 文件路径
     * @param entityName 实体名称
     * @param isDefaultExport 是否是默认导出
     * @param rootDir 根目录（用于转换为相对路径）
     */
    static generateIdByLookup(filePath, entityName, isDefaultExport = false, rootDir) {
        let relativePath = filePath;
        if (rootDir) {
            relativePath = path_1.default.relative(rootDir, filePath);
        }
        // 首先尝试从已知实体中查找
        const fileEntities = this.entityMap.get(relativePath);
        if (fileEntities) {
            // Vue文件特殊处理
            if (filePath.endsWith('.vue')) {
                const firstEntity = fileEntities.values().next().value;
                if (firstEntity) {
                    return firstEntity.id;
                }
            }
            else {
                // 默认导出查找逻辑
                if (isDefaultExport) {
                    // 先查找 'default'
                    const defaultEntity = fileEntities.get('default');
                    if (defaultEntity)
                        return defaultEntity.id;
                    // 再查找文件名
                    const fileName = path_1.default.basename(filePath, path_1.default.extname(filePath));
                    const fileNameEntity = fileEntities.get(fileName);
                    if (fileNameEntity)
                        return fileNameEntity.id;
                    // 最后查找以文件名结尾的ID
                    for (const [rawName, entity] of fileEntities) {
                        if (entity.id.endsWith(`:${fileName}`)) {
                            return entity.id;
                        }
                    }
                }
                else {
                    // 命名导出直接查找
                    const namedEntity = fileEntities.get(entityName);
                    if (namedEntity) {
                        return namedEntity.id;
                    }
                }
            }
        }
        // 如果找不到，尝试在父路径中查找（处理嵌套导出的情况）
        if (rootDir) {
            const searchResult = this.searchInParentPaths(relativePath, entityName, isDefaultExport, rootDir);
            if (searchResult) {
                console.log(`在父路径中找到实体: ${entityName} -> ${searchResult}`);
                return searchResult;
            }
        }
        // 如果还找不到，需要特殊处理目录情况
        let actualFilePath = filePath;
        let finalEntityName = entityName;
        try {
            if (fs_1.default.existsSync(filePath)) {
                const stat = fs_1.default.statSync(filePath);
                if (stat.isDirectory()) {
                    // 如果是目录，查找入口文件
                    const entryFile = this.findEntryFile(filePath);
                    if (entryFile) {
                        actualFilePath = entryFile;
                        // 对于目录的默认导出，使用入口文件名
                        if (isDefaultExport) {
                            finalEntityName = path_1.default.basename(entryFile, path_1.default.extname(entryFile));
                        }
                        // 尝试从入口文件的实体映射中查找
                        const entryRelativePath = rootDir ? path_1.default.relative(rootDir, entryFile) : entryFile;
                        const entryFileEntities = this.entityMap.get(entryRelativePath);
                        if (entryFileEntities) {
                            if (isDefaultExport) {
                                // 查找默认导出
                                const defaultEntity = entryFileEntities.get('default');
                                if (defaultEntity)
                                    return defaultEntity.id;
                                const entryFileName = path_1.default.basename(entryFile, path_1.default.extname(entryFile));
                                const entryFileNameEntity = entryFileEntities.get(entryFileName);
                                if (entryFileNameEntity)
                                    return entryFileNameEntity.id;
                                // 查找以入口文件名结尾的ID
                                for (const [rawName, entity] of entryFileEntities) {
                                    if (entity.id.endsWith(`:${entryFileName}`)) {
                                        return entity.id;
                                    }
                                }
                            }
                            else {
                                // 命名导出直接查找
                                const namedEntity = entryFileEntities.get(entityName);
                                if (namedEntity) {
                                    return namedEntity.id;
                                }
                            }
                        }
                    }
                }
            }
        }
        catch (error) {
            console.warn(`处理路径 ${filePath} 时出错:`, error);
        }
        // 如果找不到，分析文件内容生成ID
        const result = this.analyzeEntityTypeFromFile(actualFilePath, finalEntityName, isDefaultExport);
        return result.id;
    }
    /**
     * 通过AST节点分析实体类型
     */
    static analyzeNodeType(node, entityName, isJSXContext) {
        if (node.getKind() === ts_morph_1.SyntaxKind.FunctionDeclaration) {
            const isComponent = TypeUtils_1.TypeUtils.isComponentFunction(node, isJSXContext);
            return {
                id: `${isComponent ? 'Component' : 'Function'}:${entityName}`,
                type: isComponent ? 'component' : 'function',
                idPrefix: isComponent ? 'Component' : 'Function'
            };
        }
        if (node.getKind() === ts_morph_1.SyntaxKind.ClassDeclaration) {
            const isComponent = TypeUtils_1.TypeUtils.isComponentClass(node, isJSXContext);
            const typeInfo = TypeUtils_1.TypeUtils.getClassTypeInfo(isComponent);
            return {
                id: `${typeInfo.idPrefix}:${entityName}`,
                type: typeInfo.type,
                idPrefix: typeInfo.idPrefix
            };
        }
        if (node.getKind() === ts_morph_1.SyntaxKind.VariableStatement) {
            const varStatement = node;
            const declarations = varStatement.getDeclarations();
            if (declarations.length > 0) {
                const declaration = declarations[0];
                const isComponent = TypeUtils_1.TypeUtils.isComponentVariable(declaration, isJSXContext);
                const isFunction = TypeUtils_1.TypeUtils.isFunctionVariable(declaration);
                const isConstant = TypeUtils_1.TypeUtils.isConstantVariable(declaration);
                const typeInfo = TypeUtils_1.TypeUtils.getEntityTypeInfo(isComponent, isFunction, isConstant);
                return {
                    id: `${typeInfo.idPrefix}:${entityName}`,
                    type: typeInfo.type,
                    idPrefix: typeInfo.idPrefix
                };
            }
        }
        // 默认为函数
        return {
            id: `Function:${entityName}`,
            type: 'function',
            idPrefix: 'Function'
        };
    }
    /**
     * 通过文件内容分析实体类型
     */
    static analyzeEntityTypeFromFile(filePath, entityName, isDefaultExport, isJSXContext) {
        // 检查缓存
        const cacheKey = `${filePath}:${entityName}:${isDefaultExport}`;
        const cached = this.fileTypeCache.get(filePath)?.get(cacheKey);
        if (cached) {
            const fileName = path_1.default.basename(filePath, path_1.default.extname(filePath));
            const finalName = isDefaultExport ? fileName : entityName;
            return {
                id: `${cached}:${finalName}`,
                type: cached.toLowerCase(),
                idPrefix: cached
            };
        }
        // 自动检测JSX上下文
        if (isJSXContext === undefined) {
            isJSXContext = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
        }
        try {
            if (!fs_1.default.existsSync(filePath)) {
                return this.fallbackTypeGeneration(filePath, entityName, isDefaultExport);
            }
            // 检查是否是目录，如果是目录需要找到入口文件
            const stat = fs_1.default.statSync(filePath);
            let actualFilePath = filePath;
            if (stat.isDirectory()) {
                // 查找入口文件
                const entryFile = this.findEntryFile(filePath);
                if (!entryFile) {
                    console.warn(`无法找到目录 ${filePath} 的入口文件`);
                    return this.fallbackTypeGeneration(filePath, entityName, isDefaultExport);
                }
                actualFilePath = entryFile;
            }
            const content = fs_1.default.readFileSync(actualFilePath, 'utf-8');
            const tsProjectManager = (0, TSProjectManager_1.getTSProjectManager)();
            const sf = tsProjectManager.getSourceFile(actualFilePath, content);
            if (!sf) {
                return this.fallbackTypeGeneration(filePath, entityName, isDefaultExport);
            }
            let result;
            // 分析文件中的声明
            sf.forEachChild((node) => {
                if (result)
                    return; // 已找到结果
                if (isDefaultExport) {
                    // 分析默认导出
                    if (node.getKind() === ts_morph_1.SyntaxKind.FunctionDeclaration && node.hasDefaultKeyword()) {
                        result = this.analyzeNodeType(node, entityName, isJSXContext);
                    }
                    else if (node.getKind() === ts_morph_1.SyntaxKind.ClassDeclaration && node.hasDefaultKeyword()) {
                        result = this.analyzeNodeType(node, entityName, isJSXContext);
                    }
                    else if (node.getKind() === ts_morph_1.SyntaxKind.VariableStatement && node.hasDefaultKeyword()) {
                        result = this.analyzeNodeType(node, entityName, isJSXContext);
                    }
                    else if (node.getKind() === ts_morph_1.SyntaxKind.ExportAssignment) {
                        // export = 形式的默认导出
                        const expression = node.getExpression();
                        if (expression && expression.getText) {
                            const exportedName = expression.getText();
                            const foundEntity = this.findEntityInFile(sf, exportedName);
                            if (foundEntity) {
                                result = foundEntity;
                            }
                        }
                    }
                }
                else {
                    // 分析命名导出
                    if (node.getKind() === ts_morph_1.SyntaxKind.FunctionDeclaration) {
                        const funcNode = node;
                        if (funcNode.getName() === entityName && funcNode.hasExportKeyword()) {
                            result = this.analyzeNodeType(node, entityName, isJSXContext);
                        }
                    }
                    else if (node.getKind() === ts_morph_1.SyntaxKind.ClassDeclaration) {
                        const classNode = node;
                        if (classNode.getName() === entityName && classNode.hasExportKeyword()) {
                            result = this.analyzeNodeType(node, entityName, isJSXContext);
                        }
                    }
                    else if (node.getKind() === ts_morph_1.SyntaxKind.VariableStatement) {
                        const varStatement = node;
                        if (varStatement.hasExportKeyword()) {
                            const declarations = varStatement.getDeclarations();
                            for (const decl of declarations) {
                                if (decl.getName() === entityName) {
                                    result = this.analyzeNodeType(varStatement, entityName, isJSXContext);
                                    break;
                                }
                            }
                        }
                    }
                }
            });
            if (result) {
                // 缓存结果（使用原始路径作为key）
                if (!this.fileTypeCache.has(filePath)) {
                    this.fileTypeCache.set(filePath, new Map());
                }
                this.fileTypeCache.get(filePath).set(cacheKey, result.idPrefix);
                return result;
            }
        }
        catch (error) {
            console.warn(`分析文件 ${filePath} 中实体 ${entityName} 的类型失败:`, error);
        }
        // 回退到基于命名规范的类型推断
        return this.fallbackTypeGeneration(filePath, entityName, isDefaultExport);
    }
    /**
     * 在父路径中搜索实体（处理嵌套导出的情况）
     */
    static searchInParentPaths(relativePath, entityName, isDefaultExport, rootDir) {
        // 第二层缓存：检查最终结果缓存
        const finalCacheKey = `${relativePath}:${entityName}:${isDefaultExport}`;
        if (this.finalResultCache.has(finalCacheKey)) {
            const cachedResult = this.finalResultCache.get(finalCacheKey);
            if (cachedResult) {
                console.log(`从最终结果缓存中找到: ${entityName} -> ${cachedResult}`);
            }
            return cachedResult;
        }
        const pathParts = relativePath.split(path_1.default.sep);
        // 从当前路径的父目录开始，逐级向上搜索，包括根目录（i >= 0）
        for (let i = pathParts.length - 1; i >= 0; i--) {
            const parentPath = i === 0 ? '' : pathParts.slice(0, i).join(path_1.default.sep);
            // 第一层缓存：获取该父路径下的候选实体
            const candidateEntities = this.getParentPathCandidates(parentPath);
            // 在候选实体中查找匹配的实体
            const matchedEntity = this.findMatchingEntity(candidateEntities, entityName, isDefaultExport);
            if (matchedEntity) {
                console.log(`在父路径 ${parentPath === '' ? '根目录' : parentPath} 中找到匹配实体: ${matchedEntity.id}`);
                // 缓存最终结果
                this.finalResultCache.set(finalCacheKey, matchedEntity.id);
                return matchedEntity.id;
            }
        }
        // 缓存未找到的结果
        this.finalResultCache.set(finalCacheKey, null);
        return null;
    }
    /**
     * 获取指定父路径下的候选实体（带第一层缓存）
     */
    static getParentPathCandidates(parentPath) {
        // 第一层缓存：检查父路径候选实体缓存
        if (this.parentPathCandidatesCache.has(parentPath)) {
            const cachedCandidates = this.parentPathCandidatesCache.get(parentPath);
            console.log(`从父路径缓存中获取: ${parentPath === '' ? '根目录' : parentPath} -> ${cachedCandidates.length} 个候选实体`);
            return cachedCandidates;
        }
        const candidates = [];
        // 收集该父路径下的所有实体
        for (const [filePath, entities] of this.entityMap) {
            // 检查文件路径是否在当前父路径下
            let isInParentPath = false;
            if (parentPath === '') {
                // 根目录情况，检查所有文件
                isInParentPath = true;
            }
            else {
                // 子目录情况
                isInParentPath = filePath.startsWith(parentPath + path_1.default.sep) || filePath === parentPath;
            }
            if (isInParentPath) {
                for (const entity of entities.values()) {
                    candidates.push(entity);
                }
            }
        }
        console.log(`为父路径 ${parentPath === '' ? '根目录' : parentPath} 收集到 ${candidates.length} 个候选实体`);
        // 缓存父路径候选实体
        this.parentPathCandidatesCache.set(parentPath, candidates);
        return candidates;
    }
    /**
     * 在候选实体中查找匹配的实体
     */
    static findMatchingEntity(candidates, entityName, isDefaultExport) {
        // 精确匹配rawName
        for (const entity of candidates) {
            if (entity.rawName === entityName) {
                console.log(`精确匹配到实体: ${entityName} -> ${entity.id}`);
                return entity;
            }
        }
        // 如果没有精确匹配，尝试其他匹配策略
        if (isDefaultExport) {
            // 查找名为 'default' 的实体
            for (const entity of candidates) {
                if (entity.rawName === 'default') {
                    console.log(`通过默认导出匹配到实体: ${entityName} -> ${entity.id}`);
                    return entity;
                }
            }
            // 查找ID中包含实体名称的实体（可能是通过文件名推断的默认导出）
            for (const entity of candidates) {
                if (entity.id.includes(`:${entityName}`)) {
                    console.log(`通过ID包含匹配到实体: ${entityName} -> ${entity.id}`);
                    return entity;
                }
            }
            // 查找文件名与实体名称匹配的实体
            for (const entity of candidates) {
                const fileName = path_1.default.basename(entity.file, path_1.default.extname(entity.file));
                if (fileName === entityName) {
                    console.log(`通过文件名匹配到实体: ${entityName} -> ${entity.id}`);
                    return entity;
                }
            }
            // 对于默认导出，如果上面都没找到，尝试返回第一个default实体或其他合适的实体
            const defaultEntity = candidates.find(entity => entity.rawName === 'default');
            if (defaultEntity) {
                console.log(`通过第一个默认实体匹配: ${entityName} -> ${defaultEntity.id}`);
                return defaultEntity;
            }
            // 如果没有default实体，可能是以文件名为实体名的情况，尝试通过文件名匹配
            const entitiesByFileName = candidates.filter(entity => {
                const fileName = path_1.default.basename(entity.file, path_1.default.extname(entity.file));
                return entity.id.includes(`:${fileName}`) || entity.rawName === fileName;
            });
            if (entitiesByFileName.length > 0) {
                console.log(`通过文件名模式匹配到实体: ${entityName} -> ${entitiesByFileName[0].id}`);
                return entitiesByFileName[0];
            }
        }
        else {
            // 对于命名导出，查找ID中包含实体名称的实体
            for (const entity of candidates) {
                if (entity.id.includes(`:${entityName}`) || entity.id.endsWith(`:${entityName}`)) {
                    console.log(`通过命名导出匹配到实体: ${entityName} -> ${entity.id}`);
                    return entity;
                }
            }
        }
        console.log(`未找到匹配的实体: ${entityName}`);
        return null;
    }
    /**
     * 查找目录的入口文件
     */
    static findEntryFile(dirPath) {
        // 尝试不同的入口文件名
        const entryFiles = ['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.vue'];
        for (const entryFile of entryFiles) {
            const fullPath = path_1.default.join(dirPath, entryFile);
            if (fs_1.default.existsSync(fullPath)) {
                return fullPath;
            }
        }
        // 检查package.json的main字段
        const packageJsonPath = path_1.default.join(dirPath, 'package.json');
        if (fs_1.default.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs_1.default.readFileSync(packageJsonPath, 'utf-8'));
                if (packageJson.main) {
                    const mainPath = path_1.default.resolve(dirPath, packageJson.main);
                    if (fs_1.default.existsSync(mainPath)) {
                        return mainPath;
                    }
                }
            }
            catch (error) {
                // 忽略package.json解析错误
            }
        }
        return null;
    }
    /**
     * 在文件中查找特定实体
     */
    static findEntityInFile(sf, entityName) {
        let result = null;
        sf.forEachChild((node) => {
            if (result)
                return;
            if (node.getKind() === ts_morph_1.SyntaxKind.FunctionDeclaration && node.getName() === entityName) {
                result = this.analyzeNodeType(node, entityName, false);
            }
            else if (node.getKind() === ts_morph_1.SyntaxKind.ClassDeclaration && node.getName() === entityName) {
                result = this.analyzeNodeType(node, entityName, false);
            }
            else if (node.getKind() === ts_morph_1.SyntaxKind.VariableStatement) {
                const declarations = node.getDeclarations();
                for (const decl of declarations) {
                    if (decl.getName() === entityName) {
                        result = this.analyzeNodeType(node, entityName, false);
                        break;
                    }
                }
            }
        });
        return result;
    }
    /**
     * 回退类型生成（基于命名规范）
     */
    static fallbackTypeGeneration(filePath, entityName, isDefaultExport) {
        const fileName = path_1.default.basename(filePath, path_1.default.extname(filePath));
        const finalName = isDefaultExport ? fileName : entityName;
        // 基于文件类型和命名规范判断
        if (filePath.endsWith('.vue')) {
            return { id: `Component:${finalName}`, type: 'component', idPrefix: 'Component' };
        }
        // 常量命名规范（全大写下划线）
        if (/^[A-Z_][A-Z0-9_]*$/.test(finalName)) {
            return { id: `Variable:${finalName}`, type: 'variable', idPrefix: 'Variable' };
        }
        // 组件命名规范（大写开头）
        if (/^[A-Z][a-zA-Z0-9]*$/.test(finalName)) {
            if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
                return { id: `Component:${finalName}`, type: 'component', idPrefix: 'Component' };
            }
            else {
                // 对于TS文件中的大写开头名称，根据上下文判断
                // 如果实体名称看起来像组件（例如包含Component、Button、Card等），优先判断为组件
                const componentKeywords = ['Component', 'Button', 'Card', 'Modal', 'Icon', 'Form', 'Input', 'Dialog', 'Panel', 'Header', 'Footer'];
                const isLikelyComponent = componentKeywords.some(keyword => finalName.includes(keyword));
                if (isLikelyComponent) {
                    return { id: `Component:${finalName}`, type: 'component', idPrefix: 'Component' };
                }
                else {
                    return { id: `Class:${finalName}`, type: 'class', idPrefix: 'Class' };
                }
            }
        }
        // 默认为函数
        return { id: `Function:${finalName}`, type: 'function', idPrefix: 'Function' };
    }
    /**
     * 清理缓存
     */
    static clearCache() {
        this.fileTypeCache.clear();
        this.parentPathCandidatesCache.clear();
        this.finalResultCache.clear();
    }
}
exports.EntityIdGenerator = EntityIdGenerator;
EntityIdGenerator.entityMap = new Map();
EntityIdGenerator.fileTypeCache = new Map();
// 第一层缓存：父路径候选实体缓存，key为parentPath，value为该父路径下的候选实体数组
EntityIdGenerator.parentPathCandidatesCache = new Map();
// 第二层缓存：最终结果缓存，key为"relativePath:entityName:isDefaultExport"，value为匹配到的实体ID
EntityIdGenerator.finalResultCache = new Map();
