/**
 * Nebula Graph 数据库Schema配置
 */

/** 默认图空间名称 */
export const DEFAULT_SPACE = "code_graph";

/** 文件标签 */
export const FILE_TAG = "CodeFile";

/** 实体标签 */
export const ENTITY_TAG = "CodeEntity";

/** flow类型 */
export const FLOW_TAG = "Flow";

/** 包含关系(文件包含实体) */
export const REL_CONTAINS = "CONTAINS";

/** 导入关系 */
export const REL_IMPORTS = "IMPORTS";

/** 调用关系 */
export const REL_CALLS = "CALLS";

/** 发出关系 */
export const REL_EMITS = "EMITS";

/**
 * 🎯 获取当前图空间名称（从全局客户端管理器）
 */
export function getCurrentSpace(): string {
  // 动态从全局客户端管理器获取当前空间
  const { clientManager } = require("./client-manager");
  const status = clientManager.getStatus();
  console.error(
    "🚀🚀🚀 动态从全局客户端管理器获取当前空间:",
    status.currentSpace
  );
  return status.currentSpace || "";
}

/**
 * 创建图空间和Schema的NGQL语句
 * @param spaceName 可选的图空间名称，默认使用当前设置的空间
 */
export function createSchemaStatements(spaceName?: string): string[] {
  const space = spaceName || getCurrentSpace();

  return [
    // 创建图空间
    `CREATE SPACE IF NOT EXISTS ${space}(partition_num=10, replica_factor=1, vid_type=FIXED_STRING(256))`,
    // 切换到创建的图空间
    `USE ${space}`,
    // 创建标签
    `CREATE TAG IF NOT EXISTS ${FILE_TAG}(path string, name string, extension string)`,
    `CREATE TAG IF NOT EXISTS ${ENTITY_TAG}(entity_type string, file_path string, location string, raw_name string, description string, tag_list string, emits_list string, is_workspace bool, is_ddd bool, annotation string)`,
    `CREATE TAG IF NOT EXISTS ${FLOW_TAG}(description string, contains string)`,
    // 创建边类型
    `CREATE EDGE IF NOT EXISTS ${REL_CONTAINS}()`,
    `CREATE EDGE IF NOT EXISTS ${REL_IMPORTS}()`,
    `CREATE EDGE IF NOT EXISTS ${REL_CALLS}()`,
    `CREATE EDGE IF NOT EXISTS ${REL_EMITS}(event_name string, event_type string, parameters string DEFAULT "", description string DEFAULT "")`,
    // 创建基本索引
    `CREATE TAG INDEX IF NOT EXISTS entity_name_index ON ${ENTITY_TAG}(raw_name(128))`,
    `CREATE TAG INDEX IF NOT EXISTS codefile_path_index ON ${FILE_TAG}(path(256))`,
    `CREATE TAG INDEX IF NOT EXISTS flow_description_index ON ${FLOW_TAG}(description(256))`,
  ];
}
