"use strict";
/**
 * Nebula Graph 数据库Schema配置
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CREATE_SCHEMA_STATEMENTS = exports.REL_CALLS = exports.REL_IMPORTS = exports.REL_CONTAINS = exports.ENTITY_TAG = exports.FILE_TAG = exports.SPACE = void 0;
/** 图空间名称 */
exports.SPACE = 'code_graph';
/** 文件标签 */
exports.FILE_TAG = 'Code';
/** 实体标签 */
exports.ENTITY_TAG = 'CodeEntity';
/** 包含关系(文件包含实体) */
exports.REL_CONTAINS = 'CONTAINS';
/** 导入关系 */
exports.REL_IMPORTS = 'IMPORTS';
/** 调用关系 */
exports.REL_CALLS = 'CALLS';
/**
 * 创建图空间和Schema的NGQL语句
 */
exports.CREATE_SCHEMA_STATEMENTS = [
    // 创建图空间
    `CREATE SPACE IF NOT EXISTS ${exports.SPACE}(partition_num=10, replica_factor=1, vid_type=FIXED_STRING(200))`,
    // 切换到创建的图空间
    `USE ${exports.SPACE}`,
    // 创建标签
    `CREATE TAG IF NOT EXISTS ${exports.FILE_TAG}(path string, name string, extension string)`,
    `CREATE TAG IF NOT EXISTS ${exports.ENTITY_TAG}(entity_type string, file_path string, location string, raw_name string, description string, tag_list string)`,
    // 创建边类型
    `CREATE EDGE IF NOT EXISTS ${exports.REL_CONTAINS}()`,
    `CREATE EDGE IF NOT EXISTS ${exports.REL_IMPORTS}()`,
    `CREATE EDGE IF NOT EXISTS ${exports.REL_CALLS}()`,
    // 创建基本索引
    `CREATE TAG INDEX IF NOT EXISTS entity_name_index ON ${exports.ENTITY_TAG}(raw_name(100))`
];
