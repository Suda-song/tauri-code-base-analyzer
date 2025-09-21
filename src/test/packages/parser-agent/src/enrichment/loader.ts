/**
 * Enrichment Agent 实体加载器
 * 从JSON文件加载实体数据
 */

import fs from 'fs';
import { promisify } from 'util';
import { BaseEntity } from './interfaces';
import { resolveFilePath } from './config';

const readFileAsync = promisify(fs.readFile);

/**
 * 从JSON文件加载实体列表
 * @param filePath 实体JSON文件路径
 * @param rootDir 可选的根目录，用于解析相对路径
 * @returns 实体列表
 */
export async function loadEntities(filePath: string, rootDir?: string): Promise<BaseEntity[]> {
  try {
    const resolvedPath = resolveFilePath(filePath, rootDir);
    const data = await readFileAsync(resolvedPath, 'utf-8');
    const entities = JSON.parse(data) as BaseEntity[];
    
    console.log(`加载了 ${entities.length} 个实体，从 ${resolvedPath}`);
    return entities;
  } catch (error) {
    console.error(`加载实体失败: ${(error as Error).message}`);
    throw new Error(`加载实体失败: ${(error as Error).message}`);
  }
}

/**
 * 验证实体列表，确保包含所有必要的字段
 * @param entities 要验证的实体列表
 * @returns 过滤后的有效实体列表
 */
export function validateEntities(entities: BaseEntity[]): BaseEntity[] {
  const validEntities = entities.filter(entity => {
    const hasRequiredFields = 
      entity.id && 
      entity.type && 
      entity.file && 
      entity.loc && 
      entity.rawName;
    
    if (!hasRequiredFields) {
      console.warn(`实体 ${entity.id || 'unknown'} 缺少必要字段`);
    }
    
    return hasRequiredFields;
  });
  
  if (validEntities.length < entities.length) {
    console.warn(`移除了 ${entities.length - validEntities.length} 个无效实体`);
  }
  
  return validEntities;
} 