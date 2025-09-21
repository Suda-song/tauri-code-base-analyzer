"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionExtractor = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const ts_morph_1 = require("ts-morph");
const TypeUtils_1 = require("./TypeUtils");
const TSProjectManager_1 = require("./TSProjectManager");
class FunctionExtractor {
    static extract(filePath, rootDir) {
        const startTime = Date.now();
        console.log(`🔍 [FunctionExtractor] 开始提取: ${filePath}`);
        // 检查缓存
        const cached = this.tsManager.getCachedExtraction(filePath, this.EXTRACTOR_TYPE);
        if (cached) {
            console.log(`💨 [FunctionExtractor] 使用缓存: ${filePath} (${cached.length} 个实体)`);
            return cached;
        }
        try {
            // 读取文件内容
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            // 获取源文件
            const sourceFile = this.tsManager.getSourceFile(filePath, content);
            if (!sourceFile) {
                console.warn(`⚠️  [FunctionExtractor] 无法创建源文件: ${filePath}`);
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
            console.log(`✅ [FunctionExtractor] ${filePath} 提取完成: ${entities.length} 个实体, 耗时: ${extractTime}ms`);
            // 缓存结果
            this.tsManager.setCachedExtraction(filePath, this.EXTRACTOR_TYPE, entities);
            return entities;
        }
        catch (error) {
            console.error(`❌ [FunctionExtractor] 提取失败 ${filePath}: ${error.message}`);
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
    static extractFunctions(sourceFile, relativePath, entities) {
        const fileName = path_1.default.basename(relativePath, path_1.default.extname(relativePath));
        sourceFile.forEachChild((node) => {
            // 处理 export default function 和 export function 语法
            if (node.getKind() === ts_morph_1.SyntaxKind.FunctionDeclaration) {
                const funcNode = node;
                const isExported = funcNode.hasExportKeyword();
                const isDefault = funcNode.hasDefaultKeyword();
                const funcName = funcNode.getName() || 'default';
                if (isExported && isDefault) {
                    // 默认导出函数 - 判断是否为组件
                    const isComponent = TypeUtils_1.TypeUtils.isComponentFunction(funcNode, false);
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
                    // 命名导出函数
                    const isComponent = TypeUtils_1.TypeUtils.isComponentFunction(funcNode, false);
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
    static extractClasses(sourceFile, relativePath, entities) {
        const fileName = path_1.default.basename(relativePath, path_1.default.extname(relativePath));
        sourceFile.forEachChild((node) => {
            // 处理 export default class 和 export class 语法
            if (node.getKind() === ts_morph_1.SyntaxKind.ClassDeclaration) {
                const classNode = node;
                const isExported = classNode.hasExportKeyword();
                const isDefault = classNode.hasDefaultKeyword();
                const className = classNode.getName() || 'default';
                if (isExported && isDefault) {
                    // 默认导出类 - 判断是否为组件
                    const isComponent = TypeUtils_1.TypeUtils.isComponentClass(classNode, false);
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
                    // 命名导出类
                    const isComponent = TypeUtils_1.TypeUtils.isComponentClass(classNode, false);
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
    static extractVariables(sourceFile, relativePath, entities) {
        const fileName = path_1.default.basename(relativePath, path_1.default.extname(relativePath));
        sourceFile.forEachChild((node) => {
            // 处理 export default const/var/let 和 export const/var/let 语法
            if (node.getKind() === ts_morph_1.SyntaxKind.VariableStatement) {
                const varStatement = node;
                const isExported = varStatement.hasExportKeyword();
                const isDefault = varStatement.hasDefaultKeyword();
                if (varStatement.getDeclarations().length > 0) {
                    varStatement.getDeclarations().forEach(declaration => {
                        const varName = declaration.getName();
                        const isComponent = TypeUtils_1.TypeUtils.isComponentVariable(declaration, false);
                        const isFunction = TypeUtils_1.TypeUtils.isFunctionVariable(declaration);
                        const isConstant = TypeUtils_1.TypeUtils.isConstantVariable(declaration);
                        if (isExported && isDefault) {
                            // 默认导出变量
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
                            // 命名导出变量
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
    static extractExports(sourceFile, relativePath, entities) {
        const fileName = path_1.default.basename(relativePath, path_1.default.extname(relativePath));
        sourceFile.forEachChild((node) => {
            // 处理 export = xxx 和 export default xxx 语法
            if (node.getKind() === ts_morph_1.SyntaxKind.ExportAssignment) {
                const exportAssignment = node;
                const expression = exportAssignment.getExpression();
                const expressionKind = expression.getKindName();
                const expressionText = expression.getText();
                // 根据导出的表达式类型来判断实体类型
                let entityType = 'function'; // 默认值
                let idPrefix = 'Function';
                if (expressionKind === 'ObjectLiteralExpression') {
                    // 对象字面量 - 应该是变量类型
                    entityType = 'variable';
                    idPrefix = 'Variable';
                }
                else if (expressionKind === 'ArrayLiteralExpression') {
                    // 数组字面量 - 也是变量类型
                    entityType = 'variable';
                    idPrefix = 'Variable';
                }
                else if (expressionKind === 'AsExpression') {
                    // 类型断言表达式 - 检查内部表达式
                    const children = expression.getChildren();
                    if (children.length > 0) {
                        const innerExpression = children[0];
                        const innerKind = innerExpression.getKindName();
                        if (innerKind === 'ObjectLiteralExpression') {
                            entityType = 'variable';
                            idPrefix = 'Variable';
                        }
                        else if (innerKind === 'ArrayLiteralExpression') {
                            entityType = 'variable';
                            idPrefix = 'Variable';
                        }
                    }
                    // 其他情况保持默认的function类型
                }
                else if (expressionKind === 'ArrowFunction' || expressionKind === 'FunctionExpression') {
                    // 箭头函数或函数表达式
                    const isComponent = /^[A-Z]/.test(fileName) && !TypeUtils_1.TypeUtils.isConstantVariable({ getName: () => fileName, getInitializer: () => ({ getText: () => expressionText }) });
                    if (isComponent) {
                        entityType = 'component';
                        idPrefix = 'Component';
                    }
                    else {
                        entityType = 'function';
                        idPrefix = 'Function';
                    }
                }
                else if (expressionKind === 'ClassExpression') {
                    // 类表达式
                    entityType = 'class';
                    idPrefix = 'Class';
                }
                else if (expressionKind === 'Identifier') {
                    // 标识符 - 需要查找原始声明
                    const identifierName = expression.getText();
                    const entityInfo = this.findLocalEntity(sourceFile, identifierName);
                    if (entityInfo) {
                        entityType = entityInfo.type;
                        idPrefix = entityInfo.idPrefix;
                    }
                }
                else if (/^['"`]/.test(expressionText) || /^\d/.test(expressionText) || /^(true|false|null|undefined)$/.test(expressionText)) {
                    // 字面量值
                    entityType = 'variable';
                    idPrefix = 'Variable';
                }
                entities.push({
                    id: `${idPrefix}:${fileName}`,
                    type: entityType,
                    file: relativePath,
                    loc: {
                        start: node.getStartLineNumber(),
                        end: node.getEndLineNumber()
                    },
                    rawName: 'default'
                });
            }
            // 处理 export { ... } 本地导出语法
            if (node.getKind() === ts_morph_1.SyntaxKind.ExportDeclaration) {
                const exportDecl = node;
                const moduleSpecifier = exportDecl.getModuleSpecifier();
                if (!moduleSpecifier) {
                    // export { ... } - 本地导出
                    const namedExports = exportDecl.getNamedExports();
                    namedExports.forEach(namedExport => {
                        const exportName = namedExport.getName();
                        const aliasName = namedExport.getAliasNode()?.getText() || exportName;
                        // 尝试在当前文件中找到对应的声明来确定类型
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
        });
    }
    /**
     * 在当前文件中查找本地实体信息
     */
    static findLocalEntity(sf, entityName) {
        let result = null;
        sf.forEachChild((node) => {
            // 查找函数声明
            if (node.getKind() === ts_morph_1.SyntaxKind.FunctionDeclaration) {
                const funcNode = node;
                if (funcNode.getName() === entityName) {
                    const isComponent = TypeUtils_1.TypeUtils.isComponentFunction(funcNode, false);
                    result = {
                        type: isComponent ? 'component' : 'function',
                        idPrefix: isComponent ? 'Component' : 'Function'
                    };
                }
            }
            // 查找类声明
            if (node.getKind() === ts_morph_1.SyntaxKind.ClassDeclaration) {
                const classNode = node;
                if (classNode.getName() === entityName) {
                    const isComponent = TypeUtils_1.TypeUtils.isComponentClass(classNode, false);
                    const typeInfo = TypeUtils_1.TypeUtils.getClassTypeInfo(isComponent);
                    result = typeInfo;
                }
            }
            // 查找变量声明
            if (node.getKind() === ts_morph_1.SyntaxKind.VariableStatement) {
                const varStatement = node;
                varStatement.getDeclarations().forEach(decl => {
                    if (decl.getName() === entityName) {
                        const isComponent = TypeUtils_1.TypeUtils.isComponentVariable(decl, false);
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
exports.FunctionExtractor = FunctionExtractor;
FunctionExtractor.EXTRACTOR_TYPE = 'FunctionExtractor';
FunctionExtractor.tsManager = (0, TSProjectManager_1.getTSProjectManager)();
