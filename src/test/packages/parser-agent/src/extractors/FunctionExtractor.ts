import path from 'path';
import fs from 'fs';
import { SyntaxKind, FunctionDeclaration, ClassDeclaration, VariableStatement, ExportDeclaration, ExportAssignment } from 'ts-morph';
import { TypeUtils } from './TypeUtils';
import { getTSProjectManager } from './TSProjectManager';
import { calculateMd5 } from '../utils';

// 使用正确的接口路径
interface BaseEntity {
  id: string;
  type: string;
  file: string;
  loc: {
    start: number;
    end: number;
  };
  rawName: string;
  codeMd5: string;
}

export class FunctionExtractor {
  private static readonly EXTRACTOR_TYPE = 'FunctionExtractor';
  private static tsManager = getTSProjectManager();

  static extract(filePath: string, rootDir: string): BaseEntity[] {
    const startTime = Date.now();
    console.log(`🔍 [FunctionExtractor] 开始提取: ${filePath}`);

    // 检查缓存
    const cached = this.tsManager.getCachedExtraction<BaseEntity>(filePath, this.EXTRACTOR_TYPE);
    if (cached) {
      console.log(`💨 [FunctionExtractor] 使用缓存: ${filePath} (${cached.length} 个实体)`);
      return cached;
    }

    try {
      // 读取文件内容
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // 获取源文件
      const sourceFile = this.tsManager.getSourceFile(filePath, content);
      if (!sourceFile) {
        console.warn(`⚠️  [FunctionExtractor] 无法创建源文件: ${filePath}`);
        return [];
      }

      const entities: BaseEntity[] = [];
      const relativePath = path.relative(rootDir, filePath);

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
    } catch (error) {
      console.error(`❌ [FunctionExtractor] 提取失败 ${filePath}: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 清理提取器缓存
   */
  static clearCache(): void {
    this.tsManager.clearExtractorCache(this.EXTRACTOR_TYPE);
  }
  
  /**
   * 清理特定文件的缓存
   * @param filePath 文件路径
   */
  static clearFileCache(filePath: string): void {
    // 使用TSProjectManager的方法清除特定文件的缓存
    this.tsManager.clearFileExtractorCache(filePath);
    console.log(`🧹 [FunctionExtractor] 清理文件缓存: ${filePath}`);
  }

  /**
   * 获取提取器缓存统计
   */
  static getCacheStats() {
    return this.tsManager.getCacheStats();
  }

  static extractFunctions(sourceFile: any, relativePath: string, entities: BaseEntity[]): void {
    const fileName = path.basename(relativePath, path.extname(relativePath));
    
    sourceFile.forEachChild((node: any) => {
      // 处理 export default function 和 export function 语法
      if (node.getKind() === SyntaxKind.FunctionDeclaration) {
        const funcNode = node as FunctionDeclaration;
        const isExported = funcNode.hasExportKeyword();
        const isDefault = funcNode.hasDefaultKeyword();
        const funcName = funcNode.getName() || 'default';
        
        if (isExported && isDefault) {
          // 默认导出函数 - 判断是否为组件
          const isComponent = TypeUtils.isComponentFunction(funcNode, false);
          entities.push({
            id: isComponent ? `Component:${fileName}` : `Function:${fileName}`,
            type: isComponent ? 'component' : 'function',
            file: relativePath,
            loc: {
              start: node.getStartLineNumber(),
              end: node.getEndLineNumber()
            },
            rawName: funcName === 'default' ? fileName : funcName,
            codeMd5: calculateMd5(node.getText())
          });
        } else if (isExported && !isDefault) {
          // 命名导出函数
          const isComponent = TypeUtils.isComponentFunction(funcNode, false);
          entities.push({
            id: isComponent ? `Component:${funcName}` : `Function:${funcName}`,
            type: isComponent ? 'component' : 'function',
            file: relativePath,
            loc: {
              start: node.getStartLineNumber(),
              end: node.getEndLineNumber()
            },
            rawName: funcName,
            codeMd5: calculateMd5(node.getText())
          });
        }
      }
    });
  }

  static extractClasses(sourceFile: any, relativePath: string, entities: BaseEntity[]): void {
    const fileName = path.basename(relativePath, path.extname(relativePath));
    
    sourceFile.forEachChild((node: any) => {
      // 处理 export default class 和 export class 语法
      if (node.getKind() === SyntaxKind.ClassDeclaration) {
        const classNode = node as ClassDeclaration;
        const isExported = classNode.hasExportKeyword();
        const isDefault = classNode.hasDefaultKeyword();
        const className = classNode.getName() || 'default';
        
        if (isExported && isDefault) {
          // 默认导出类 - 判断是否为组件
          const isComponent = TypeUtils.isComponentClass(classNode, false);
          const typeInfo = TypeUtils.getClassTypeInfo(isComponent);
          entities.push({
            id: `${typeInfo.idPrefix}:${fileName}`,
            type: typeInfo.type,
            file: relativePath,
            loc: {
              start: node.getStartLineNumber(),
              end: node.getEndLineNumber()
            },
            rawName: className === 'default' ? fileName : className,
            codeMd5: calculateMd5(node.getText())
          });
        } else if (isExported && !isDefault) {
          // 命名导出类
          const isComponent = TypeUtils.isComponentClass(classNode, false);
          const typeInfo = TypeUtils.getClassTypeInfo(isComponent);
          entities.push({
            id: `${typeInfo.idPrefix}:${className}`,
            type: typeInfo.type,
            file: relativePath,
            loc: {
              start: node.getStartLineNumber(),
              end: node.getEndLineNumber()
            },
            rawName: className,
            codeMd5: calculateMd5(node.getText())
          });
        }
      }
    });
  }

  static extractVariables(sourceFile: any, relativePath: string, entities: BaseEntity[]): void {
    const fileName = path.basename(relativePath, path.extname(relativePath));
    
    sourceFile.forEachChild((node: any) => {
      // 处理 export default const/var/let 和 export const/var/let 语法
      if (node.getKind() === SyntaxKind.VariableStatement) {
        const varStatement = node as VariableStatement;
        const isExported = varStatement.hasExportKeyword();
        const isDefault = varStatement.hasDefaultKeyword();
        
        if (varStatement.getDeclarations().length > 0) {
          varStatement.getDeclarations().forEach(declaration => {
            const varName = declaration.getName();
            const isComponent = TypeUtils.isComponentVariable(declaration, false);
            const isFunction = TypeUtils.isFunctionVariable(declaration);
            const isConstant = TypeUtils.isConstantVariable(declaration);
            
            if (isExported && isDefault) {
              // 默认导出变量
              const typeInfo = TypeUtils.getEntityTypeInfo(isComponent, isFunction, isConstant);
              entities.push({
                id: `${typeInfo.idPrefix}:${fileName}`,
                type: typeInfo.type,
                file: relativePath,
                loc: {
                  start: node.getStartLineNumber(),
                  end: node.getEndLineNumber()
                },
                rawName: varName,
                codeMd5: calculateMd5(node.getText())
              });
            } else if (isExported && !isDefault) {
              // 命名导出变量
              const typeInfo = TypeUtils.getEntityTypeInfo(isComponent, isFunction, isConstant);
              entities.push({
                id: `${typeInfo.idPrefix}:${varName}`,
                type: typeInfo.type,
                file: relativePath,
                loc: {
                  start: node.getStartLineNumber(),
                  end: node.getEndLineNumber()
                },
                rawName: varName,
                codeMd5: calculateMd5(node.getText())
              });
            }
          });
        }
      }
    });
  }

  static extractExports(sourceFile: any, relativePath: string, entities: BaseEntity[]): void {
    const fileName = path.basename(relativePath, path.extname(relativePath));
    
    sourceFile.forEachChild((node: any) => {
      // 处理 export = xxx 和 export default xxx 语法
      if (node.getKind() === SyntaxKind.ExportAssignment) {
        const exportAssignment = node as ExportAssignment;
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
        } else if (expressionKind === 'ArrayLiteralExpression') {
          // 数组字面量 - 也是变量类型
          entityType = 'variable';
          idPrefix = 'Variable';
        } else if (expressionKind === 'AsExpression') {
          // 类型断言表达式 - 检查内部表达式
          const children = expression.getChildren();
          if (children.length > 0) {
            const innerExpression = children[0];
            const innerKind = innerExpression.getKindName();
            if (innerKind === 'ObjectLiteralExpression') {
              entityType = 'variable';
              idPrefix = 'Variable';
            } else if (innerKind === 'ArrayLiteralExpression') {
              entityType = 'variable';
              idPrefix = 'Variable';
            }
          }
          // 其他情况保持默认的function类型
        } else if (expressionKind === 'ArrowFunction' || expressionKind === 'FunctionExpression') {
          // 箭头函数或函数表达式
          const isComponent = /^[A-Z]/.test(fileName) && !TypeUtils.isConstantVariable({ getName: () => fileName, getInitializer: () => ({ getText: () => expressionText }) });
          if (isComponent) {
            entityType = 'component';
            idPrefix = 'Component';
          } else {
            entityType = 'function';
            idPrefix = 'Function';
          }
        } else if (expressionKind === 'ClassExpression') {
          // 类表达式
          entityType = 'class';
          idPrefix = 'Class';
        } else if (expressionKind === 'Identifier') {
          // 标识符 - 需要查找原始声明
          const identifierName = expression.getText();
          const entityInfo = this.findLocalEntity(sourceFile, identifierName);
          if (entityInfo) {
            entityType = entityInfo.type;
            idPrefix = entityInfo.idPrefix;
          }
        } else if (/^['"`]/.test(expressionText) || /^\d/.test(expressionText) || /^(true|false|null|undefined)$/.test(expressionText)) {
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
          rawName: 'default',
          codeMd5: calculateMd5(node.getText())
        });
      }
      
      // 处理 export { ... } 本地导出语法
      if (node.getKind() === SyntaxKind.ExportDeclaration) {
        const exportDecl = node as ExportDeclaration;
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
                rawName: aliasName,
                codeMd5: calculateMd5(node.getText())
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
  private static findLocalEntity(sf: any, entityName: string): { type: string; idPrefix: string } | null {
    let result: { type: string; idPrefix: string } | null = null;
    
    sf.forEachChild((node: any) => {
      // 查找函数声明
      if (node.getKind() === SyntaxKind.FunctionDeclaration) {
        const funcNode = node as FunctionDeclaration;
        if (funcNode.getName() === entityName) {
          const isComponent = TypeUtils.isComponentFunction(funcNode, false);
          result = {
            type: isComponent ? 'component' : 'function',
            idPrefix: isComponent ? 'Component' : 'Function'
          };
        }
      }
      
      // 查找类声明
      if (node.getKind() === SyntaxKind.ClassDeclaration) {
        const classNode = node as ClassDeclaration;
        if (classNode.getName() === entityName) {
          const isComponent = TypeUtils.isComponentClass(classNode, false);
          const typeInfo = TypeUtils.getClassTypeInfo(isComponent);
          result = typeInfo;
        }
      }
      
      // 查找变量声明
      if (node.getKind() === SyntaxKind.VariableStatement) {
        const varStatement = node as VariableStatement;
        varStatement.getDeclarations().forEach(decl => {
          if (decl.getName() === entityName) {
            const isComponent = TypeUtils.isComponentVariable(decl, false);
            const isFunction = TypeUtils.isFunctionVariable(decl);
            const isConstant = TypeUtils.isConstantVariable(decl);
            
            result = TypeUtils.getEntityTypeInfo(isComponent, isFunction, isConstant);
          }
        });
      }
    });
    
    return result;
  }
}
