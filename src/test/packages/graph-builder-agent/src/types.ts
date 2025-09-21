/**
 * 代码文件实体接口定义
 */
export interface FileEntity {
  id: string;
  path: string;
  name: string;
  extension: string;
}

/**
 * 基础实体接口定义
 */
export interface BaseEntity {
  id: string;
  type: string;
  file: string;
  loc: { start: number; end?: number };
  rawName: string;
  isDDD?: boolean;
  isWorkspace?: boolean;
  codeMd5?: string; // 实体代码的MD5值
}

/**
 * 丰富化实体接口定义（避免循环依赖，直接定义）
 */
export interface EnrichedEntity extends BaseEntity {
  IMPORTS: string[];
  CALLS: string[];
  EMITS: string[];
  TEMPLATE_COMPONENTS?: string[];
  summary: string;
  tags: string[];
  projectDesc?: string;
  ANNOTATION?: string;
  annotationMd5?: string; // 注释的MD5值
  isDDD?: boolean;
  isWorkspace?: boolean;
  publishTag?: string; // 基于历史commit的需求迭代描述
}

export interface FlowEntity {
  id: string;
  description: string;
  contains: string[];
}

/**
 * 实体类型枚举
 */
export enum EntityType {
  ENRICHED_ENTITY = "EnrichedEntity",
  FILE_ENTITY = "FileEntity",
  FLOW_ENTITY = "FlowEntity",
}

/**
 * 图实体接口定义
 */
export interface GraphEntity {
  entityType: EntityType;
  data: FileEntity | EnrichedEntity;
}

export interface PreparedData {
  files: FileEntity[];
  entities: EnrichedEntity[];
}
