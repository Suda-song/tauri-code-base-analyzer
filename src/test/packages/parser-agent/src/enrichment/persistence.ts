/**
 * Enrichment Agent 持久化模块
 * 负责将生成的结果保存到文件
 */

import fs from 'fs';
import { promisify } from 'util';
import { EnrichedEntity } from './interfaces';
import { resolveFilePath } from './config';

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

/**
 * 将丰富化后的实体保存到JSON文件
 * @param entities 丰富化后的实体数组
 * @param outputPath 输出文件路径
 * @param rootDir 可选的根目录，用于解析相对路径
 */
export async function saveEnrichedEntities(
  entities: EnrichedEntity[], 
  outputPath: string, 
  rootDir?: string
): Promise<string> {
  try {
    const resolvedPath = resolveFilePath(outputPath, rootDir);
    
    // 确保输出目录存在
    const dir = resolvedPath.substring(0, resolvedPath.lastIndexOf('/'));
    if (dir && !fs.existsSync(dir)) {
      await mkdirAsync(dir, { recursive: true });
    }
    
    // 按需格式化实体数据
    const formattedEntities = entities.map(formatEntity);
    
    // 写入文件
    await writeFileAsync(
      resolvedPath, 
      JSON.stringify(formattedEntities, null, 2), 
      'utf-8'
    );
    
    console.log(`保存了 ${entities.length} 个丰富化实体到 ${resolvedPath}`);
    return resolvedPath;
  } catch (error) {
    console.error(`保存丰富化实体失败: ${(error as Error).message}`);
    throw new Error(`保存丰富化实体失败: ${(error as Error).message}`);
  }
}

/**
 * 格式化实体
 */
function formatEntity(entity: EnrichedEntity): EnrichedEntity {
  const formatted: EnrichedEntity = {
    // 基础字段,来自收集器
    id: entity.id,
    type: entity.type,
    file: entity.file,
    loc: entity.loc,
    rawName: entity.rawName,
    
    // 标识字段
    isDDD: entity.isDDD || false,
    isWorkspace: entity.isWorkspace || false,
    
    // MD5哈希值字段
    codeMd5: entity.codeMd5 || '',
    annotationMd5: entity.annotationMd5 || '',
    
    // 丰富字段
    IMPORTS: entity.IMPORTS || [],
    CALLS: entity.CALLS || [],
    EMITS: entity.EMITS || [],
    TEMPLATE_COMPONENTS: entity.TEMPLATE_COMPONENTS || [],
    summary: entity.summary || '',
    tags: entity.tags || [],
    ANNOTATION: entity.ANNOTATION || ''
  };

  // 🆕 总是包含 publishTag 字段，确保接口一致性
  formatted.publishTag = entity.publishTag || '';

  return formatted;
} 