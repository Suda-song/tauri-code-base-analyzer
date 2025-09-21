import { serverConfig } from "../config/server-config";
import { Entity, SearchResult } from "../types";
import { EnrichedEntity } from "@xhs/modular-code-analysis-agent";
import path from 'path';

export function generateCombinedPrompt(searchResult: any, allResults: SearchResult[]): string {
  let combinedPrompt = `# 搜索结果\n\n`;
  combinedPrompt += searchResult.prompt;

  combinedPrompt += `\n\n# 二跳查询结果\n\n`;
  for (const result of allResults) {
    const { searchEntity, relevanceScore, relatedEntities } = result;
    combinedPrompt += `## 源组件: ${searchEntity.id} (相关度: ${relevanceScore.toFixed(2)})\n`;
    combinedPrompt += relatedEntities.prompt;
    combinedPrompt += '\n---\n\n';
  }

  return combinedPrompt;
}

export function collectAllEntities(results: SearchResult[]): Entity[] {
  const allEntities = new Set<Entity>();
  results.forEach(result => {
    allEntities.add(result.searchEntity);
    const { imports, calls, templates, similar } = result.relatedEntities.relatedEntities;
    [...imports, ...calls, ...templates, ...similar].forEach(e => allEntities.add(e));
  });
  return Array.from(allEntities);
}

export function generateEntitySummary(allResults: SearchResult[]): string {
  let summary = '';
  
  // 收集所有关联实体按类型分组
  const categorizedEntities = {
    imports: new Set<Entity>(),
    calls: new Set<Entity>(),
    templates: new Set<Entity>(),
    similar: new Set<Entity>(),
  };

  allResults.forEach(result => {
    const { imports, calls, templates, similar } = result.relatedEntities.relatedEntities;
    imports.forEach(e => categorizedEntities.imports.add(e));
    calls.forEach(e => categorizedEntities.calls.add(e));
    templates.forEach(e => categorizedEntities.templates.add(e));
    similar.forEach(e => categorizedEntities.similar.add(e));
  });

  // 生成详细的实体列表
  if (categorizedEntities.imports.size > 0) {
    summary += `#### 📥 导入关系 (${categorizedEntities.imports.size} 个)\n`;
    Array.from(categorizedEntities.imports).forEach(entity => {
      summary += `- \`${entity.id}\` (${entity.type}) - ${entity.file}\n`;
    });
    summary += '\n';
  }

  if (categorizedEntities.calls.size > 0) {
    summary += `#### 🔗 调用关系 (${categorizedEntities.calls.size} 个)\n`;
    Array.from(categorizedEntities.calls).forEach(entity => {
      summary += `- \`${entity.id}\` (${entity.type}) - ${entity.file}\n`;
    });
    summary += '\n';
  }

  if (categorizedEntities.templates.size > 0) {
    summary += `#### 🎨 模板关系 (${categorizedEntities.templates.size} 个)\n`;
    Array.from(categorizedEntities.templates).forEach(entity => {
      summary += `- \`${entity.id}\` (${entity.type}) - ${entity.file}\n`;
    });
    summary += '\n';
  }

  if (categorizedEntities.similar.size > 0) {
    summary += `#### 🏷️ 相似标签 (${categorizedEntities.similar.size} 个)\n`;
    Array.from(categorizedEntities.similar).forEach(entity => {
      summary += `- \`${entity.id}\` (${entity.type}) - ${entity.file}\n`;
    });
    summary += '\n';
  }

  // 添加总计统计
  const totalCount = categorizedEntities.imports.size + categorizedEntities.calls.size + 
                     categorizedEntities.templates.size + categorizedEntities.similar.size;
  
  if (summary === '') {
    summary = '**暂无相关实体**\n';
  } else {
    summary = `**总计**: ${totalCount} 个相关实体\n\n` + summary;
  }

  return summary;
}

/**
 * 类型转换工具函数：将 EnrichedEntity 转换为 Entity
 */
export function enrichedToEntity(enriched: EnrichedEntity): Entity {
  return enriched;
}

/**
 * 判断实体是否来自workspace包
 * 直接使用实体的isWorkspace标识
 */
export function isWorkspaceEntity(entity: Entity): boolean {
  return entity.isWorkspace === true;
}

/**
 * 转换实体文件路径为绝对路径（多workspace支持）
 */
export function convertEntityToAbsolutePath(entity: Entity): Entity {
  // 优先使用实体自身的workspacePath，否则使用第一个配置的workspace
  const workspacePath = entity.workspacePath || serverConfig.workspacePaths[0];
  
  if (!workspacePath) {
    return entity;
  }
  
  // 如果文件路径已经是绝对路径，直接返回
  if (entity.file.startsWith('/') || entity.file.match(/^[A-Z]:/)) {
    return entity;
  }
  
  // 构建绝对路径
  const absolutePath = path.join(workspacePath, entity.file);
  
  return {
    ...entity,
    file: absolutePath
  };
}

/**
 * 批量转换实体列表的路径
 */
export function convertEntitiesToAbsolutePaths(entities: Entity[]): Entity[] {
  return entities.map(entity => convertEntityToAbsolutePath(entity));
} 