import path from 'path';
import fs from 'fs';
import { SyntaxKind, FunctionDeclaration, ClassDeclaration, VariableStatement, ExportDeclaration, ArrowFunction, ImportDeclaration } from 'ts-morph';
import { TypeUtils } from './TypeUtils';
import { getTSProjectManager } from './TSProjectManager';
import { calculateMd5 } from '../utils';

// 使用本地接口定义
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

export class TSXExtractor {
  private static readonly EXTRACTOR_TYPE = 'TSXExtractor';
  private static tsManager = getTSProjectManager();

  static extract(filePath: string, rootDir: string): BaseEntity[] {
    const startTime = Date.now();
    console.log(`🔍 [TSXExtractor] 开始提取: ${filePath}`);

    // 检查缓存
    const cached = this.tsManager.getCachedExtraction<BaseEntity>(filePath, this.EXTRACTOR_TYPE);
    if (cached) {
      console.log(`💨 [TSXExtractor] 使用缓存: ${filePath} (${cached.length} 个实体)`);
      return cached;
    }

    try {
      // 读取文件内容
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // 获取源文件
      const sourceFile = this.tsManager.getSourceFile(filePath, content);
      if (!sourceFile) {
        console.warn(`⚠️  [TSXExtractor] 无法创建源文件: ${filePath}`);
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
      console.log(`✅ [TSXExtractor] ${filePath} 提取完成: ${entities.length} 个实体, 耗时: ${extractTime}ms`);

      // 缓存结果
      this.tsManager.setCachedExtraction(filePath, this.EXTRACTOR_TYPE, entities);

      return entities;
    } catch (error) {
      console.error(`❌ [TSXExtractor] 提取失败 ${filePath}: ${(error as Error).message}`);
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
   * 获取提取器缓存统计
   */
  static getCacheStats() {
    return this.tsManager.getCacheStats();
  }
  
  /**
   * 清理特定文件的缓存
   * @param filePath 文件路径
   */
  static clearFileCache(filePath: string): void {
    // 使用TSProjectManager的方法清除特定文件的缓存
    this.tsManager.clearFileExtractorCache(filePath);
    console.log(`🧹 [TSXExtractor] 清理文件缓存: ${filePath}`);
  }

  /**
   * 提取函数声明
   */
  private static extractFunctions(sourceFile: any, relativePath: string, entities: BaseEntity[]): void {
    const fileName = path.basename(relativePath, path.extname(relativePath));
    
    sourceFile.forEachChild((node: any) => {
      if (node.getKind() === SyntaxKind.FunctionDeclaration) {
        const funcNode = node as FunctionDeclaration;
        const isExported = funcNode.hasExportKeyword();
        const isDefault = funcNode.hasDefaultKeyword();
        const funcName = funcNode.getName() || 'default';
        
        if (isExported && isDefault) {
          const isComponent = TypeUtils.isComponentFunction(funcNode, true);
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
          const isComponent = TypeUtils.isComponentFunction(funcNode, true);
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

  /**
   * 提取类声明
   */
  private static extractClasses(sourceFile: any, relativePath: string, entities: BaseEntity[]): void {
    const fileName = path.basename(relativePath, path.extname(relativePath));
    
    sourceFile.forEachChild((node: any) => {
      if (node.getKind() === SyntaxKind.ClassDeclaration) {
        const classNode = node as ClassDeclaration;
        const isExported = classNode.hasExportKeyword();
        const isDefault = classNode.hasDefaultKeyword();
        const className = classNode.getName() || 'default';
        
        if (isExported && isDefault) {
          const isComponent = TypeUtils.isComponentClass(classNode, true);
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
          const isComponent = TypeUtils.isComponentClass(classNode, true);
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

  /**
   * 提取变量声明
   */
  private static extractVariables(sourceFile: any, relativePath: string, entities: BaseEntity[]): void {
    const fileName = path.basename(relativePath, path.extname(relativePath));
    
    sourceFile.forEachChild((node: any) => {
      if (node.getKind() === SyntaxKind.VariableStatement) {
        const varStatement = node as VariableStatement;
        const isExported = varStatement.hasExportKeyword();
        const isDefault = varStatement.hasDefaultKeyword();
        
        if (varStatement.getDeclarations().length > 0) {
          varStatement.getDeclarations().forEach(declaration => {
            const varName = declaration.getName();
            const isComponent = TypeUtils.isComponentVariable(declaration, true);
            const isFunction = TypeUtils.isFunctionVariable(declaration);
            const isConstant = TypeUtils.isConstantVariable(declaration);
            
            if (isExported && isDefault) {
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

  /**
   * 提取导出声明
   */
  private static extractExports(sourceFile: any, relativePath: string, entities: BaseEntity[]): void {
    const fileName = path.basename(relativePath, path.extname(relativePath));
    
    sourceFile.forEachChild((node: any) => {
      if (node.getKind() === SyntaxKind.ExportAssignment) {
        // 获取导出的表达式
        const expression = node.getExpression();
        
        // 如果是标识符（变量名），检查是否已经在变量声明中提取过
        if (expression && expression.getKind() === SyntaxKind.Identifier) {
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
          rawName: 'default',
          codeMd5: calculateMd5(node.getText())
        });
      }
      
      if (node.getKind() === SyntaxKind.ExportDeclaration) {
        const exportDecl = node as ExportDeclaration;
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
                rawName: aliasName,
                codeMd5: calculateMd5(node.getText())
              });
            }
          });
        }
      }
      
      if (node.getKind() === SyntaxKind.ImportDeclaration) {
        const importNode = node as ImportDeclaration;
        const modulePath = importNode.getModuleSpecifierValue();
        if (modulePath.endsWith('.vue')) {
          const namedImports = importNode.getNamedImports();
          const names = namedImports?.map((n: any) => n.getName()) || [];
          names.forEach((name: string) => {
            entities.push({
              id: `Component:${name}`,
              type: 'component-import',
              file: relativePath,
              loc: {
                start: node.getStartLineNumber(),
                end: node.getEndLineNumber()
              },
              rawName: name,
              codeMd5: calculateMd5(node.getText())
            });
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
      if (node.getKind() === SyntaxKind.FunctionDeclaration) {
        const funcNode = node as FunctionDeclaration;
        if (funcNode.getName() === entityName) {
          const isComponent = TypeUtils.isComponentFunction(funcNode, true);
          result = {
            type: isComponent ? 'component' : 'function',
            idPrefix: isComponent ? 'Component' : 'Function'
          };
        }
      }
      
      if (node.getKind() === SyntaxKind.ClassDeclaration) {
        const classNode = node as ClassDeclaration;
        if (classNode.getName() === entityName) {
          const isComponent = TypeUtils.isComponentClass(classNode, true);
          const typeInfo = TypeUtils.getClassTypeInfo(isComponent);
          result = typeInfo;
        }
      }
      
      if (node.getKind() === SyntaxKind.VariableStatement) {
        const varStatement = node as VariableStatement;
        varStatement.getDeclarations().forEach(decl => {
          if (decl.getName() === entityName) {
            const isComponent = TypeUtils.isComponentVariable(decl, true);
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

// CommonJS导出支持
module.exports = { TSXExtractor };
