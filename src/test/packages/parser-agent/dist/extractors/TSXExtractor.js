"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TSXExtractor = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const ts_morph_1 = require("ts-morph");
const TypeUtils_1 = require("./TypeUtils");
const TSProjectManager_1 = require("./TSProjectManager");
class TSXExtractor {
    static extract(filePath, rootDir) {
        const startTime = Date.now();
        console.log(`🔍 [TSXExtractor] 开始提取: ${filePath}`);
        // 检查缓存
        const cached = this.tsManager.getCachedExtraction(filePath, this.EXTRACTOR_TYPE);
        if (cached) {
            console.log(`💨 [TSXExtractor] 使用缓存: ${filePath} (${cached.length} 个实体)`);
            return cached;
        }
        try {
            // 读取文件内容
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            // 获取源文件
            const sourceFile = this.tsManager.getSourceFile(filePath, content);
            if (!sourceFile) {
                console.warn(`⚠️  [TSXExtractor] 无法创建源文件: ${filePath}`);
                return [];
            }
            const entities = [];
            const relativePath = path_1.default.relative(rootDir, filePath);
            // 提取各种实体类型
            this.extractFunctions(sourceFile, relativePath, entities);
            this.extractClasses(sourceFile, relativePath, entities);
            this.extractVariables(sourceFile, relativePath, entities);
            this.extractExports(sourceFile, relativePath, entities);
            const extractTime = Date.now() - startTime;
            console.log(`✅ [TSXExtractor] ${filePath} 提取完成: ${entities.length} 个实体, 耗时: ${extractTime}ms`);
            // 缓存结果
            this.tsManager.setCachedExtraction(filePath, this.EXTRACTOR_TYPE, entities);
            return entities;
        }
        catch (error) {
            console.error(`❌ [TSXExtractor] 提取失败 ${filePath}: ${error.message}`);
            return [];
        }
    }
    /**
     * 清理提取器缓存
     */
    static clearCache() {
        this.tsManager.clearExtractorCache(this.EXTRACTOR_TYPE);
    }
    /**
     * 获取提取器缓存统计
     */
    static getCacheStats() {
        return this.tsManager.getCacheStats();
    }
    /**
     * 提取函数声明
     */
    static extractFunctions(sourceFile, relativePath, entities) {
        const fileName = path_1.default.basename(relativePath, path_1.default.extname(relativePath));
        sourceFile.forEachChild((node) => {
            if (node.getKind() === ts_morph_1.SyntaxKind.FunctionDeclaration) {
                const funcNode = node;
                const isExported = funcNode.hasExportKeyword();
                const isDefault = funcNode.hasDefaultKeyword();
                const funcName = funcNode.getName() || 'default';
                if (isExported && isDefault) {
                    const isComponent = TypeUtils_1.TypeUtils.isComponentFunction(funcNode, true);
                    entities.push({
                        id: isComponent ? `Component:${fileName}` : `Function:${fileName}`,
                        type: isComponent ? 'component' : 'function',
                        file: relativePath,
                        loc: {
                            start: node.getStartLineNumber(),
                            end: node.getEndLineNumber()
                        },
                        rawName: funcName === 'default' ? fileName : funcName
                    });
                }
                else if (isExported && !isDefault) {
                    const isComponent = TypeUtils_1.TypeUtils.isComponentFunction(funcNode, true);
                    entities.push({
                        id: isComponent ? `Component:${funcName}` : `Function:${funcName}`,
                        type: isComponent ? 'component' : 'function',
                        file: relativePath,
                        loc: {
                            start: node.getStartLineNumber(),
                            end: node.getEndLineNumber()
                        },
                        rawName: funcName
                    });
                }
            }
        });
    }
    /**
     * 提取类声明
     */
    static extractClasses(sourceFile, relativePath, entities) {
        const fileName = path_1.default.basename(relativePath, path_1.default.extname(relativePath));
        sourceFile.forEachChild((node) => {
            if (node.getKind() === ts_morph_1.SyntaxKind.ClassDeclaration) {
                const classNode = node;
                const isExported = classNode.hasExportKeyword();
                const isDefault = classNode.hasDefaultKeyword();
                const className = classNode.getName() || 'default';
                if (isExported && isDefault) {
                    const isComponent = TypeUtils_1.TypeUtils.isComponentClass(classNode, true);
                    const typeInfo = TypeUtils_1.TypeUtils.getClassTypeInfo(isComponent);
                    entities.push({
                        id: `${typeInfo.idPrefix}:${fileName}`,
                        type: typeInfo.type,
                        file: relativePath,
                        loc: {
                            start: node.getStartLineNumber(),
                            end: node.getEndLineNumber()
                        },
                        rawName: className === 'default' ? fileName : className
                    });
                }
                else if (isExported && !isDefault) {
                    const isComponent = TypeUtils_1.TypeUtils.isComponentClass(classNode, true);
                    const typeInfo = TypeUtils_1.TypeUtils.getClassTypeInfo(isComponent);
                    entities.push({
                        id: `${typeInfo.idPrefix}:${className}`,
                        type: typeInfo.type,
                        file: relativePath,
                        loc: {
                            start: node.getStartLineNumber(),
                            end: node.getEndLineNumber()
                        },
                        rawName: className
                    });
                }
            }
        });
    }
    /**
     * 提取变量声明
     */
    static extractVariables(sourceFile, relativePath, entities) {
        const fileName = path_1.default.basename(relativePath, path_1.default.extname(relativePath));
        sourceFile.forEachChild((node) => {
            if (node.getKind() === ts_morph_1.SyntaxKind.VariableStatement) {
                const varStatement = node;
                const isExported = varStatement.hasExportKeyword();
                const isDefault = varStatement.hasDefaultKeyword();
                if (varStatement.getDeclarations().length > 0) {
                    varStatement.getDeclarations().forEach(declaration => {
                        const varName = declaration.getName();
                        const isComponent = TypeUtils_1.TypeUtils.isComponentVariable(declaration, true);
                        const isFunction = TypeUtils_1.TypeUtils.isFunctionVariable(declaration);
                        const isConstant = TypeUtils_1.TypeUtils.isConstantVariable(declaration);
                        if (isExported && isDefault) {
                            const typeInfo = TypeUtils_1.TypeUtils.getEntityTypeInfo(isComponent, isFunction, isConstant);
                            entities.push({
                                id: `${typeInfo.idPrefix}:${fileName}`,
                                type: typeInfo.type,
                                file: relativePath,
                                loc: {
                                    start: node.getStartLineNumber(),
                                    end: node.getEndLineNumber()
                                },
                                rawName: varName
                            });
                        }
                        else if (isExported && !isDefault) {
                            const typeInfo = TypeUtils_1.TypeUtils.getEntityTypeInfo(isComponent, isFunction, isConstant);
                            entities.push({
                                id: `${typeInfo.idPrefix}:${varName}`,
                                type: typeInfo.type,
                                file: relativePath,
                                loc: {
                                    start: node.getStartLineNumber(),
                                    end: node.getEndLineNumber()
                                },
                                rawName: varName
                            });
                        }
                    });
                }
            }
        });
    }
    /**
     * 提取导出声明
     */
    static extractExports(sourceFile, relativePath, entities) {
        const fileName = path_1.default.basename(relativePath, path_1.default.extname(relativePath));
        sourceFile.forEachChild((node) => {
            if (node.getKind() === ts_morph_1.SyntaxKind.ExportAssignment) {
                // 获取导出的表达式
                const expression = node.getExpression();
                // 如果是标识符（变量名），检查是否已经在变量声明中提取过
                if (expression && expression.getKind() === ts_morph_1.SyntaxKind.Identifier) {
                    const exportedName = expression.getText();
                    // 检查是否已经有同名的实体被提取过
                    const existingEntity = entities.find(entity => entity.rawName === exportedName);
                    if (existingEntity) {
                        // 如果已经提取过，将其标记为默认导出，更新ID
                        existingEntity.id = existingEntity.id.replace(`:${exportedName}`, `:${fileName}`);
                        existingEntity.rawName = 'default';
                        return; // 避免重复添加
                    }
                }
                // 如果没有找到已存在的实体，或者不是简单的变量导出，则创建新实体
                entities.push({
                    id: `Component:${fileName}`,
                    type: 'component',
                    file: relativePath,
                    loc: {
                        start: node.getStartLineNumber(),
                        end: node.getEndLineNumber()
                    },
                    rawName: 'default'
                });
            }
            if (node.getKind() === ts_morph_1.SyntaxKind.ExportDeclaration) {
                const exportDecl = node;
                const moduleSpecifier = exportDecl.getModuleSpecifier();
                if (!moduleSpecifier) {
                    const namedExports = exportDecl.getNamedExports();
                    namedExports.forEach(namedExport => {
                        const exportName = namedExport.getName();
                        const aliasName = namedExport.getAliasNode()?.getText() || exportName;
                        const entityInfo = this.findLocalEntity(sourceFile, exportName);
                        if (entityInfo) {
                            entities.push({
                                id: `${entityInfo.idPrefix}:${aliasName}`,
                                type: entityInfo.type,
                                file: relativePath,
                                loc: {
                                    start: node.getStartLineNumber(),
                                    end: node.getEndLineNumber()
                                },
                                rawName: aliasName
                            });
                        }
                    });
                }
            }
            if (node.getKind() === ts_morph_1.SyntaxKind.ImportDeclaration) {
                const importNode = node;
                const modulePath = importNode.getModuleSpecifierValue();
                if (modulePath.endsWith('.vue')) {
                    const namedImports = importNode.getNamedImports();
                    const names = namedImports?.map((n) => n.getName()) || [];
                    names.forEach((name) => {
                        entities.push({
                            id: `Component:${name}`,
                            type: 'component-import',
                            file: relativePath,
                            loc: {
                                start: node.getStartLineNumber(),
                                end: node.getEndLineNumber()
                            },
                            rawName: name
                        });
                    });
                }
            }
        });
    }
    /**
     * 在当前文件中查找本地实体信息
     */
    static findLocalEntity(sf, entityName) {
        let result = null;
        sf.forEachChild((node) => {
            if (node.getKind() === ts_morph_1.SyntaxKind.FunctionDeclaration) {
                const funcNode = node;
                if (funcNode.getName() === entityName) {
                    const isComponent = TypeUtils_1.TypeUtils.isComponentFunction(funcNode, true);
                    result = {
                        type: isComponent ? 'component' : 'function',
                        idPrefix: isComponent ? 'Component' : 'Function'
                    };
                }
            }
            if (node.getKind() === ts_morph_1.SyntaxKind.ClassDeclaration) {
                const classNode = node;
                if (classNode.getName() === entityName) {
                    const isComponent = TypeUtils_1.TypeUtils.isComponentClass(classNode, true);
                    const typeInfo = TypeUtils_1.TypeUtils.getClassTypeInfo(isComponent);
                    result = typeInfo;
                }
            }
            if (node.getKind() === ts_morph_1.SyntaxKind.VariableStatement) {
                const varStatement = node;
                varStatement.getDeclarations().forEach(decl => {
                    if (decl.getName() === entityName) {
                        const isComponent = TypeUtils_1.TypeUtils.isComponentVariable(decl, true);
                        const isFunction = TypeUtils_1.TypeUtils.isFunctionVariable(decl);
                        const isConstant = TypeUtils_1.TypeUtils.isConstantVariable(decl);
                        result = TypeUtils_1.TypeUtils.getEntityTypeInfo(isComponent, isFunction, isConstant);
                    }
                });
            }
        });
        return result;
    }
}
exports.TSXExtractor = TSXExtractor;
TSXExtractor.EXTRACTOR_TYPE = 'TSXExtractor';
TSXExtractor.tsManager = (0, TSProjectManager_1.getTSProjectManager)();
// CommonJS导出支持
module.exports = { TSXExtractor };
