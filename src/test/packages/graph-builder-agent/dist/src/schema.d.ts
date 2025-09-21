/**
 * Nebula Graph 数据库Schema配置
 */
/** 图空间名称 */
export declare const SPACE = "code_graph";
/** 文件标签 */
export declare const FILE_TAG = "Code";
/** 实体标签 */
export declare const ENTITY_TAG = "CodeEntity";
/** 包含关系(文件包含实体) */
export declare const REL_CONTAINS = "CONTAINS";
/** 导入关系 */
export declare const REL_IMPORTS = "IMPORTS";
/** 调用关系 */
export declare const REL_CALLS = "CALLS";
/**
 * 创建图空间和Schema的NGQL语句
 */
export declare const CREATE_SCHEMA_STATEMENTS: string[];
