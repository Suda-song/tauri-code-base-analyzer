import { describe, it, expect } from 'vitest';
import { extractAllEntities } from './fileWalker';
import path from 'path';
import fs from 'fs';

// 获取项目根目录
function getProjectRoot() {
  return path.resolve(__dirname, '../../../');
}

describe('Parser Agent', () => {
  const projectRoot = getProjectRoot();
  const fixtureDir = path.join(projectRoot, 'apps/after-sale-demo');
  // 检查目录是否存在
  const dirExists = fs.existsSync(fixtureDir);
  console.log(`Fixture 目录 ${fixtureDir} 存在: ${dirExists}`);

  it('should extract at least one entity from the fixture project', async () => {
    // 打印工作目录和目标目录
    console.log('当前工作目录:', process.cwd());
    console.log('目标目录:', fixtureDir);
    
    const entities = await extractAllEntities(fixtureDir);
    console.log('提取到的实体:', entities);
    
    expect(Array.isArray(entities)).toBe(true);
    expect(entities.length).toBeGreaterThan(0);
    const hasComponent = entities.some(e => e.type === 'component');
    expect(hasComponent).toBe(true);
  });

  it('should ensure all entity IDs are unique', async () => {
    // 如果目录不存在，跳过测试
    if (!dirExists) {
      console.warn('测试目录不存在，跳过测试');
      return;
    }
    
    const entities = await extractAllEntities(fixtureDir);
    
    // 提取所有实体ID
    const entityIds = entities.map(entity => entity.id);
    
    // 创建Set去重，如果去重前后数量相同，表示没有重复
    const uniqueIds = new Set(entityIds);
    
    console.log(`提取到 ${entities.length} 个实体，唯一ID数: ${uniqueIds.size}`);
    expect(uniqueIds.size).toBe(entityIds.length);
    
    // 检查是否有重复ID并列出来
    const idCounts = new Map();
    entityIds.forEach(id => {
      idCounts.set(id, (idCounts.get(id) || 0) + 1);
    });
    
    const duplicates = [...idCounts.entries()]
      .filter(([_, count]) => count > 1)
      .map(([id, count]) => ({ id, count }));
    
    if (duplicates.length > 0) {
      console.warn('发现重复ID:', duplicates);
    }
    
    expect(duplicates.length).toBe(0);
  });
});
