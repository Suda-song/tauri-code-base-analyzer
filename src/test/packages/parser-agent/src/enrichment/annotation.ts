import path from "path";
import { EnrichedEntity } from "./interfaces";
import fs from 'fs';
import { Project, SourceFile, Node } from 'ts-morph';
import { parse } from '@vue/compiler-sfc';

interface WriteAnnotationOptions {
    /**
     * 写入方式：前置或后置
     */
    insertMode?: 'before' | 'after';
    
    /**
     * 是否覆写现有注释
     */
    overwriteExisting?: boolean;

    /**
     * 文件路径
     */
    filePath: string;

    /**
     * 旧注释
     */
    oldAnnotation: string;
  }

  /**
   * 定位原始注释在文件中的位置
   * @param content 文件内容
   * @param annotationText 纯文本形式的注释内容（已移除注释标记）
   * @returns 注释的开始和结束位置 {start: number, end: number} 或 null
   */
  function locateCommentPosition(content: string, annotationText: string): { start: number, end: number }
   | null {
    // 1. 尝试定位多行注释
    const multiLinePattern = new RegExp(`\\/\\*(?:\\*)?([\\s\\S]*?)\\*\\/`, 'g');
    let match: RegExpExecArray | null;

    while ((match = multiLinePattern.exec(content)) !== null) {
      const fullComment = match[0]; // 包含注释标记的完整注释
      const commentBody = match[1]; // 注释内部内容

      // 处理注释内容 - 移除每行开头的 * 和空格
      const processedComment = commentBody
        .replace(/^\s*\*\s?/gm, '')
        .trim();

      // 如果处理后的内容与给定的注释文本匹配
      if (processedComment === annotationText) {
        return {
          start: match.index,
          end: match.index + fullComment.length
        };
      }
    }

    // 2. 尝试定位单行注释块（可能跨越多行）
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      // 如果当前行是单行注释
      if (lines[i].trim().startsWith('//')) {
        let commentStart = i;
        let commentLines = [];

        // 收集连续的单行注释
        while (i < lines.length && lines[i].trim().startsWith('//')) {
          commentLines.push(lines[i].replace(/^\/\/\s?/, '').trim());
          i++;
        }

        // 将收集到的注释行合并
        const processedComment = commentLines.join('\n');

        if (processedComment === annotationText) {
          // 计算注释的开始和结束位置
          const start = lines.slice(0, commentStart).join('\n').length + (commentStart > 0 ? 1 : 0);
          const end = start + lines.slice(commentStart, i).join('\n').length;

          return { start, end };
        }

        // 回退一行，因为外层循环会再次自增
        i--;
      }
    }

    return null;
  }

/**
 * 写入注释到文件中
 * @param entities 富化后的实体
 * @param options 写入选项
 * @returns 是否成功写入（修改了文件）
 */
export async function writeAnnotations(entities: EnrichedEntity, options: WriteAnnotationOptions): Promise<boolean> {
  const { insertMode = 'before', overwriteExisting = true, filePath, oldAnnotation } = options;
  const { ANNOTATION = '' } = entities;
  console.log(`需要写入注释的文件: ${filePath}`);

  // 如果没有注释内容，直接返回
  if (!ANNOTATION) {
    console.warn('没有注释内容可写入');
    return false;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // 检查内容是否相同，避免不必要的文件修改
    if (oldAnnotation && oldAnnotation === ANNOTATION) {
      console.log(`注释内容未变化，无需更新: ${filePath}`);
      return false;
    }
    
    // 如果有旧注释，精确定位并替换
    if (oldAnnotation) {
      const commentPos = locateCommentPosition(content, oldAnnotation);
      if (commentPos) {
        const { start, end } = commentPos;
        // 格式化新注释
        let formattedAnnotation = formatAnnotationForInsertion(ANNOTATION, insertMode);

        // 精确替换
        const newContent =
          content.substring(0, start) +
          formattedAnnotation +
          content.substring(end);

        fs.writeFileSync(filePath, newContent);
        console.log(`成功替换注释: ${filePath}`);
        return true;
      }
    }
    
    // More complex case: need to insert annotation
    const isVueFile = filePath.endsWith('.vue');
    
    if (isVueFile) {
      // Handle Vue files
      await writeVueFileAnnotation(filePath, ANNOTATION, insertMode, overwriteExisting, entities);
    } else {
      // Handle TS/TSX files
      await writeTSFileAnnotation(filePath, ANNOTATION, insertMode, overwriteExisting, entities);
    }
    
    console.log(`成功插入注释: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`写入注释失败: ${filePath}`, error);
    return false;
  }
}

/**
 * 将注释插入到Vue文件中
 */
async function writeVueFileAnnotation(
  filePath: string, 
  annotation: string, 
  insertMode: 'before' | 'after',
  _overwriteExisting: boolean, // Prefix with underscore to indicate it's not used
  _entity: EnrichedEntity // Prefix with underscore to indicate it's not used
): Promise<boolean> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { descriptor } = parse(content);
  
  // 创建一个新的文件内容
  let newContent = content;
  
  // 处理script部分的注释
  if (descriptor.script || descriptor.scriptSetup) {
    // 优先处理 scriptSetup
    if (descriptor.scriptSetup) {
      const scriptContent = descriptor.scriptSetup.content;
      const scriptOffset = content.indexOf(scriptContent, descriptor.scriptSetup.loc.start.offset);
      
      // 创建临时项目和源文件
      const project = new Project({
        useInMemoryFileSystem: true,
        skipFileDependencyResolution: true
      });
      const tempSf = project.createSourceFile('temp.ts', scriptContent);
      
      // 获取所有语句
      const statements = tempSf.getStatements();
      if (statements.length > 0) {
        const firstStatement = statements[0];
        
        // 确定注释应该插入的位置
        let insertPos = 0;
        if (insertMode === 'before') {
          insertPos = firstStatement.getPos();
        } else {
          insertPos = firstStatement.getEnd();
        }
        
        // 准备注释文本（确保格式正确）
        let commentText = formatAnnotationForInsertion(annotation, insertMode);
        
        // 计算最终插入位置（在源文件中）
        const finalInsertPos = scriptOffset + insertPos;
        
        // 将注释插入到内容中
        newContent = 
          content.substring(0, finalInsertPos) + 
          commentText + 
          content.substring(finalInsertPos);
      }
    } 
    // 如果没有 scriptSetup，尝试处理 script
    else if (descriptor.script) {
      const scriptContent = descriptor.script.content;
      const scriptOffset = content.indexOf(scriptContent, descriptor.script.loc.start.offset);
      
      // 创建临时项目和源文件
      const project = new Project({
        useInMemoryFileSystem: true,
        skipFileDependencyResolution: true
      });
      const tempSf = project.createSourceFile('temp.ts', scriptContent);
      
      // 获取所有语句
      const statements = tempSf.getStatements();
      if (statements.length > 0) {
        const firstStatement = statements[0];
        
        // 确定注释应该插入的位置
        let insertPos = 0;
        if (insertMode === 'before') {
          insertPos = firstStatement.getPos();
        } else {
          insertPos = firstStatement.getEnd();
        }
        
        // 准备注释文本（确保格式正确）
        let commentText = formatAnnotationForInsertion(annotation, insertMode);
        
        // 计算最终插入位置（在源文件中）
        const finalInsertPos = scriptOffset + insertPos;
        
        // 将注释插入到内容中
        newContent = 
          content.substring(0, finalInsertPos) + 
          commentText + 
          content.substring(finalInsertPos);
      }
    }
  } 
  // 如果没有找到script，尝试处理template
  else if (descriptor.template) {
    const templateContent = descriptor.template.content;
    const templateOffset = content.indexOf(templateContent, descriptor.template.loc.start.offset);
    
    // 准备注释文本（确保HTML注释格式正确）
    let commentText = `<!-- ${annotation} -->`;
    
    if (insertMode === 'before') {
      // 将注释插入到template内容之前
      const insertPos = templateOffset;
      newContent = 
        content.substring(0, insertPos) + 
        commentText + "\n" + 
        content.substring(insertPos);
    } else {
      // 将注释插入到template内容之后
      const insertPos = templateOffset + templateContent.length;
      newContent = 
        content.substring(0, insertPos) + 
        "\n" + commentText + 
        content.substring(insertPos);
    }
  }
  
  // 如果内容有变化，写入更新后的内容
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent);
    return true;
  }
  
  return false; // 内容没有变化，返回false
}

/**
 * 将注释插入到TS/TSX文件中
 */
async function writeTSFileAnnotation(
  filePath: string, 
  annotation: string, 
  insertMode: 'before' | 'after',
  overwriteExisting: boolean,
  entity: EnrichedEntity
): Promise<boolean> {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 创建临时项目和源文件
  const project = new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true
  });
  const sf = project.createSourceFile('temp' + path.extname(filePath), content);
  
  // 尝试找到实体对应的节点
  const entityNode = findEntityNode(sf, entity);
  
  if (entityNode) {
    // 确定注释应该插入的位置
    let insertPos = 0;
    if (insertMode === 'before') {
      insertPos = entityNode.getPos();
    } else {
      insertPos = entityNode.getEnd();
    }
    
    // 准备注释文本（确保格式正确）
    let commentText = formatAnnotationForInsertion(annotation, insertMode);
    
    // 将注释插入到内容中
    const newContent = 
      content.substring(0, insertPos) + 
      commentText + 
      content.substring(insertPos);
    
    // 检查内容是否有变化
    if (newContent !== content) {
      // 写入更新后的内容
      fs.writeFileSync(filePath, newContent);
      return true;
    }
    
    return false;
  } else {
    console.warn(`未能找到实体节点，使用后备方法`);
    // 如果找不到节点，使用后备方法
    const newContent = insertAnnotation(content, annotation, insertMode, overwriteExisting);
    
    // 检查内容是否有变化
    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent);
      return true;
    }
    
    return false;
  }
}

/**
 * 查找实体对应的节点
 */
function findEntityNode(sf: SourceFile, entity: EnrichedEntity): Node | undefined {
  // 根据实体类型和名称查找对应的节点
  const { rawName, type, loc } = entity;
  
  // 尝试不同的查找策略
  
  // 1. 尝试查找导出声明
  const exportDecls = sf.getExportDeclarations();
  for (const exportDecl of exportDecls) {
    const namedExports = exportDecl.getNamedExports();
    for (const namedExport of namedExports) {
      if (namedExport.getName() === rawName) {
        return exportDecl;
      }
    }
  }
  
  // 2. 尝试查找类声明
  if (type === 'component' || type === 'class') {
    const classDecl = sf.getClass(rawName);
    if (classDecl) {
      return classDecl;
    }
  }
  
  // 3. 尝试查找函数声明
  if (type === 'function') {
    const functionDecl = sf.getFunction(rawName);
    if (functionDecl) {
      return functionDecl;
    }
  }
  
  // 4. 尝试查找变量声明
  const variableDecl = sf.getVariableDeclaration(rawName);
  if (variableDecl) {
    return variableDecl;
  }
  
  // 5. 尝试查找接口声明
  const interfaceDecl = sf.getInterface(rawName);
  if (interfaceDecl) {
    return interfaceDecl;
  }
  
  // 6. 尝试查找类型别名
  const typeAlias = sf.getTypeAlias(rawName);
  if (typeAlias) {
    return typeAlias;
  }
  
  // 7. 尝试查找枚举
  const enumDecl = sf.getEnum(rawName);
  if (enumDecl) {
    return enumDecl;
  }
  
  // 8. 尝试通过位置信息查找
  if (loc && typeof loc.start === 'object' && 'line' in loc.start && 'column' in loc.start) {
    try {
      // 获取行内容
      const lineIndex = (loc.start as { line: number }).line - 1;
      const fileLines = sf.getFullText().split('\n');
      
      if (lineIndex >= 0 && lineIndex < fileLines.length) {
        // 获取行开始的位置
        let lineStartPos = 0;
        for (let i = 0; i < lineIndex; i++) {
          lineStartPos += fileLines[i].length + 1; // +1 是换行符
        }
        
        // 添加列偏移
        const columnOffset = Math.min(
          (loc.start as { column: number }).column, 
          fileLines[lineIndex].length
        );
        const pos = lineStartPos + columnOffset;
        
        // 查找节点
        const node = sf.getDescendantAtPos(pos);
        if (node) {
          return node;
        }
      }
    } catch (error) {
      console.warn('通过位置查找节点失败:', error);
    }
  }
  
  return undefined;
}

/**
 * 格式化注释文本以便插入
 */
function formatAnnotationForInsertion(annotation: string, insertMode: 'before' | 'after'): string {
  // 确保注释使用正确的格式
  let commentText = annotation.trim();
  
  // 如果不是以注释标记开头，添加注释标记
  if (!commentText.startsWith('/*') && !commentText.startsWith('//')) {
    commentText = '/*\n * ' + commentText.replace(/\n/g, '\n * ') + '\n */';
  }
  
  // 添加适当的空白行
  // if (insertMode === 'before') {
  //   commentText = commentText + '\n';
  // } else {
  //   commentText = '\n' + commentText;
  // }
  
  return commentText;
}

/**
 * 后备方法：简单地在内容开头或末尾插入注释
 */
function insertAnnotation(content: string, annotation: string, insertMode: 'before' | 'after', overwriteExisting: boolean): string {
  // 格式化注释文本
  let commentText = formatAnnotationForInsertion(annotation, insertMode);
  
  if (overwriteExisting) {
    return commentText + (insertMode === 'before' ? content : '');
  }
  
  if (insertMode === 'before') {
    return commentText + content;
  } else {
    return content + commentText;
  }
}