//@ts-nocheck
/**
 * 图数据库CRUD操作模块
 */
import { FileEntity, EnrichedEntity, EntityType } from "./types";
import { NebulaClient, getDefaultClient } from "@xhs/nebula-client";

import {
  FILE_TAG,
  ENTITY_TAG,
  REL_CONTAINS,
  REL_IMPORTS,
  REL_CALLS,
  REL_EMITS,
  getCurrentSpace,
} from "./schema";
import {
  addOrUpdateFile,
  addOrUpdateEntity,
  buildGraph,
  createRelationships,
  escapeString,
  logQuery,
  executeNgqlWithRetry,
} from "./builder";
import * as crypto from "crypto";

/**
 * 识别实体类型
 */
function identifyEntityType(entity: any): EntityType {
  console.error("entityentityentityentity", JSON.stringify(entity, null, 2));
  if (entity.path && entity.name && entity.extension) {
    return EntityType.FILE_ENTITY;
  } else if (entity.id && entity.type && entity.rawName) {
    return EntityType.ENRICHED_ENTITY;
  } else {
    console.error(`无法识别实体类型: ${JSON.stringify(entity)}`);
    return EntityType.ENRICHED_ENTITY;
  }
}

// ================================
// CREATE/UPDATE 操作
// ================================

/**
 * 创建实体（统一入口，引用builder功能）
 * @param entity 文件实体或代码实体
 * @param client 可选的Nebula客户端
 */
async function create(
  entity: FileEntity | EnrichedEntity,
  client?: NebulaClient
): Promise<void> {
  const nebulaClient = client || getDefaultClient();
  await nebulaClient.executeNgql(`USE ${SPACE}`);

  const entityType = identifyEntityType(entity);

  console.error(
    `创建${entityType === EntityType.FILE_ENTITY ? "文件" : "代码"}实体: ${
      (entity as any).id
    }`
  );

  switch (entityType) {
    case EntityType.FILE_ENTITY:
      await addOrUpdateFile(entity as FileEntity, nebulaClient);
      break;
    case EntityType.ENRICHED_ENTITY:
      await addOrUpdateEntity(entity as EnrichedEntity, nebulaClient);
      await createRelationships([entity as EnrichedEntity], nebulaClient);
      break;
    default:
      throw new Error(`不支持的实体类型: ${entityType}`);
  }

  console.error(`创建完成: ${(entity as any).id}`);
}

/**
 * 更新实体（统一入口，引用builder功能）
 * @param entity 文件实体或代码实体
 * @param client 可选的Nebula客户端
 */
async function update(
  entity: FileEntity | EnrichedEntity,
  client?: NebulaClient
): Promise<void> {
  const nebulaClient = client || getDefaultClient();
  await nebulaClient.executeNgql(`USE ${SPACE}`);

  const entityType = identifyEntityType(entity);

  console.error(
    `更新${entityType === EntityType.FILE_ENTITY ? "文件" : "代码"}实体: ${
      (entity as any).id
    }`
  );

  switch (entityType) {
    case EntityType.FILE_ENTITY:
      await addOrUpdateFile(entity as FileEntity, nebulaClient);
      break;
    case EntityType.ENRICHED_ENTITY:
      await addOrUpdateEntity(entity as EnrichedEntity, nebulaClient);
      break;
    default:
      throw new Error(`不支持的实体类型: ${entityType}`);
  }

  console.error(`更新完成: ${(entity as any).id}`);
}

// ================================
// READ 操作
// ================================

/**
 * 读取文件实体
 * @param fileId 文件ID
 * @param client Nebula客户端
 * @returns 文件实体或null
 */
async function readFileEntity(
  fileId: string,
  client: NebulaClient
): Promise<FileEntity | null> {
  const escapedId = escapeString(fileId);

  const query = `
FETCH PROP ON ${FILE_TAG} "${escapedId}" YIELD vertex as file
  `;

  logQuery(query);
  const result = await client.executeNgql(query);
  console.error(
    "readFileEntityreadFileEntityreadFileEntity",
    JSON.stringify(result, null, 2),
    //@ts-ignore
    result?.data?.tables?.length > 0
  );
  //@ts-ignore
  if (result?.data?.tables?.length > 0) {
    //@ts-ignore
    const row = result.data.tables[0];
    const props = row._verticesParsedList[0].properties;
    console.error("propspropspropsprops");
    if (props) {
      return {
        id: row.VertexID,
        path: props.CodeFile.path || "",
        name: props.CodeFile.name || "",
        extension: props.CodeFile.extension || "",
      };
    }
  }

  return null;
}

/**
 * 读取代码实体
 * @param entityId 实体ID
 * @param client Nebula客户端
 * @returns 代码实体或null
 */
async function readCodeEntity(
  entityId: string,
  client: NebulaClient
): Promise<EnrichedEntity[]> {
  const escapedId = escapeString(entityId);

  // 使用NebulaGraph的正确语法查询实体
  const query = `
FETCH PROP ON ${ENTITY_TAG} "${escapedId}" YIELD vertex as entity
  `;

  logQuery(query);
  const result = await client.executeNgql(query);
  console.error("resultresultresultresult", JSON.stringify(result, null, 2));
  const entities: EnrichedEntity[] = [];
  //@ts-ignore
  if (result?.data?.tables?.length > 0) {
    //@ts-ignore
    const rows = result.data.tables;
    for (const row of rows) {
      const vertex = row._verticesParsedList[0];
      // 解析location
      let loc: { start: number; end?: number } | number = 0;
      if (vertex.properties.location) {
        const parts = vertex.properties.location.split("-");
        if (parts.length === 2) {
          loc = { start: parseInt(parts[0]), end: parseInt(parts[1]) };
        } else {
          loc = parseInt(parts[0]) || 0;
        }
      }

      // 查询关系
      const imports = await getEntityImports(entityId, client);
      const calls = await getEntityCalls(entityId, client);
      console.error("vertexvertexvertexvertex", vertex);
      entities.push({
        id: row.VertexID,
        type: vertex.properties.CodeEntity.type || "",
        file: vertex.properties.CodeEntity.file_path || "",
        loc,
        rawName: vertex.properties.CodeEntity.raw_name || "",
        isWorkspace: vertex.properties.CodeEntity.is_workspace || false,
        isDDD: vertex.properties.CodeEntity.is_ddd || false,
        IMPORTS: imports,
        CALLS: calls,
        EMITS: vertex.properties.CodeEntity.emits_list
          ? vertex.properties.CodeEntity.emits_list.split(",")
          : [],
        TEMPLATE_COMPONENTS: [],
        summary: vertex.properties.CodeEntity.description || "",
        tags: vertex.properties.CodeEntity.tag_list
          ? vertex.properties.CodeEntity.tag_list.split(",")
          : [],
        ANNOTATION: vertex.properties.CodeEntity.annotation || "",
      });
    }
  }

  return entities;
}

/**
 * 获取实体的导入关系
 */
async function getEntityImports(
  entityId: string,
  client: NebulaClient
): Promise<string[]> {
  const escapedId = escapeString(entityId);
  const query = `
    GO FROM "${escapedId}" OVER ${REL_IMPORTS}
    YIELD dst(edge) as imported_entity
  `;

  logQuery(query);
  const result = await client.executeNgql(query);
  const imports: string[] = [];
  if (result?.data?.tables?.length > 0) {
    for (const row of result.data.tables) {
      imports.push(row.imported_entity);
    }
  }

  return imports;
}

/**
 * 获取实体的调用关系
 */
async function getEntityCalls(
  entityId: string,
  client: NebulaClient
): Promise<string[]> {
  const escapedId = escapeString(entityId);
  const query = `
    GO FROM "${escapedId}" OVER ${REL_CALLS}
    YIELD dst(edge) as called_entity
  `;

  logQuery(query);
  const result = await client.executeNgql(query);
  //@ts-ignore
  const calls: string[] = [];
  //@ts-ignore
  if (result?.data?.tables?.length > 0) {
    //@ts-ignore
    for (const row of result.data.tables) {
      calls.push(row.called_entity);
    }
  }

  return calls;
}

/**
 * 读取实体（统一入口）
 * @param id 实体ID
 * @param entityType 实体类型，如果不提供则尝试自动识别
 * @param client 可选的Nebula客户端
 */
async function read(
  id: string,
  entityType?: EntityType,
  client?: NebulaClient
): Promise<FileEntity | EnrichedEntity[] | null> {
  const nebulaClient = client || getDefaultClient();
  await nebulaClient.executeNgql(`USE ${SPACE}`);

  console.error(`读取实体: ${id}`);

  // 如果没有指定类型，尝试两种类型都查询
  if (!entityType) {
    // 先尝试作为代码实体查询
    const codeEntity = await readCodeEntity(id, nebulaClient);
    if (codeEntity) {
      console.error(`读取完成123（代码实体）: ${id}`);
      return codeEntity;
    }

    // 再尝试作为文件实体查询
    const fileEntity = await readFileEntity(id, nebulaClient);
    if (fileEntity) {
      console.error(`读取完成（文件实体）: ${id}`);
      return fileEntity;
    }

    console.error(`实体不存在: ${id}`);
    return null;
  }

  // 指定了类型，直接查询
  console.error("entityTypeentityTypeentityType", entityType);
  switch (entityType) {
    case EntityType.FILE_ENTITY:
      const fileEntity = await readFileEntity(id, nebulaClient);
      console.error(`读取完成（文件实体）: ${id} ${fileEntity} `);
      return fileEntity;
    case EntityType.ENRICHED_ENTITY:
      const codeEntity = await readCodeEntity(id, nebulaClient);
      console.error(`读取完成（代码实体）: ${id}`);
      return codeEntity;
    default:
      throw new Error(`不支持的实体类型: ${entityType}`);
  }
}

async function readAllSummary(client: NebulaClient): Promise<string[]> {
  const query = `MATCH (v:${ENTITY_TAG}) RETURN v.description as summary, id(v) as id`;
  logQuery(query);
  console.error("queryqueryqueryquery", query);
  const result = await client.executeNgql(query);
  console.error(
    "readAllSummaryreadAllSummaryreadAllSummary",
    JSON.stringify(result, null, 2)
  );
  //@ts-ignore
  return result.data.tables;
}

// ================================
// DELETE 操作
// ================================

/**
 * 删除文件实体
 * @param fileId 文件ID
 * @param client Nebula客户端
 */
async function deleteFileEntity(
  fileId: string,
  client: NebulaClient
): Promise<void> {
  const escapedId = escapeString(fileId);

  // 先删除所有相关的边
  const deleteEdgesQuery = `
    DELETE EDGE ${REL_CONTAINS} "${escapedId}" -> *
  `;

  // 再删除顶点
  const deleteVertexQuery = `
    DELETE VERTEX "${escapedId}"
  `;

  logQuery(deleteEdgesQuery);
  await client.executeNgql(deleteEdgesQuery);

  logQuery(deleteVertexQuery);
  await client.executeNgql(deleteVertexQuery);
}

/**
 * 删除代码实体
 * @param entityId 实体ID
 * @param client Nebula客户端
 */
async function deleteCodeEntity(
  entityId: string,
  client: NebulaClient
): Promise<void> {
  const escapedId = escapeString(entityId);

  try {
    // 直接删除顶点，NebulaGraph会自动删除相关的边
    const deleteVertexQuery = `DELETE VERTEX "${escapedId}"`;
    logQuery(deleteVertexQuery);
    await client.executeNgql(deleteVertexQuery);
  } catch (error) {
    console.error(`删除代码实体 ${entityId} 时发生错误:`, error);
    throw error;
  }
}

/**
 * 删除实体（统一入口）
 * @param id 实体ID
 * @param entityType 实体类型，如果不提供则尝试自动识别
 * @param client 可选的Nebula客户端
 */
async function remove(
  id: string,
  entityType?: EntityType,
  client?: NebulaClient
): Promise<boolean> {
  const nebulaClient = client || getDefaultClient();
  await nebulaClient.executeNgql(`USE ${SPACE}`);

  console.error(`删除实体: ${id}`);

  // 如果没有指定类型，先读取实体确定类型
  if (!entityType) {
    const entity = await read(id, undefined, nebulaClient);
    if (!entity) {
      console.error(`实体不存在，无法删除: ${id}`);
      return false;
    }
    entityType = identifyEntityType(entity);
  }

  try {
    switch (entityType) {
      case EntityType.FILE_ENTITY:
        await deleteFileEntity(id, nebulaClient);
        break;
      case EntityType.ENRICHED_ENTITY:
        await deleteCodeEntity(id, nebulaClient);
        break;
      default:
        throw new Error(`不支持的实体类型: ${entityType}`);
    }

    console.error(`删除完成: ${id}`);
    return true;
  } catch (error) {
    console.error(`删除失败: ${id}`, error);
    return false;
  }
}

// ================================
// 批量操作函数
// ================================

/**
 * 批量创建实体
 */
async function batchCreate(
  entities: (FileEntity | EnrichedEntity)[],
  client?: NebulaClient
): Promise<void> {
  console.error(`开始批量创建 ${entities.length} 个实体...`);

  // 分离文件和代码实体
  const files: FileEntity[] = [];
  const codeEntities: EnrichedEntity[] = [];

  for (const entity of entities) {
    const entityType = identifyEntityType(entity);
    if (entityType === EntityType.FILE_ENTITY) {
      files.push(entity as FileEntity);
    } else {
      codeEntities.push(entity as EnrichedEntity);
    }
  }

  // 使用builder的批量功能
  if (files.length > 0 || codeEntities.length > 0) {
    await buildGraph(files, codeEntities, client);
  }

  console.error("批量创建完成");
}

/**
 * 批量更新实体
 */
async function batchUpdate(
  entities: (FileEntity | EnrichedEntity)[],
  client?: NebulaClient
): Promise<void> {
  await batchCreate(entities, client);
}

/**
 * 批量删除实体
 */
async function batchRemove(
  ids: string[],
  entityType?: EntityType,
  client?: NebulaClient
): Promise<number> {
  const nebulaClient = client || getDefaultClient();
  console.error(`开始批量删除 ${ids.length} 个实体...`);

  let successCount = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    console.error(`删除进度: ${i + 1}/${ids.length} - ${id}`);

    try {
      const success = await remove(id, entityType, nebulaClient);
      if (success) successCount++;
    } catch (error) {
      console.error(`删除实体 ${id} 失败:`, error);
      // 继续处理其他实体
    }
  }

  console.error(`批量删除完成，成功删除 ${successCount} 个实体`);
  return successCount;
}

// ================================
// 查询辅助函数
// ================================

/**
 * 查询文件包含的所有实体
 */
async function getEntitiesInFile(
  fileId: string,
  client?: NebulaClient
): Promise<EnrichedEntity[]> {
  const nebulaClient = client || getDefaultClient();
  await nebulaClient.executeNgql(`USE ${SPACE}`);

  const escapedFileId = escapeString(fileId);
  const query = `
    GO FROM "${escapedFileId}" OVER ${REL_CONTAINS}
    YIELD dst(edge) as entity_id
  `;

  logQuery(query);
  const result = await nebulaClient.executeNgql(query);
  console.error(
    "getEntitiesInFilegetEntitiesInFilegetEntitiesInFile",
    JSON.stringify(result, null, 2)
  );
  const entities: EnrichedEntity[] = [];
  if (result?.data?.tables?.length > 0) {
    for (const row of result.data.tables) {
      const entityId = row.entity_id;
      const entity = await readCodeEntity(entityId, nebulaClient);
      if (entity) {
        entities.push(...entity);
      }
    }
  }

  return entities;
}

/**
 * 根据条件查询实体
 */
async function queryEntities(
  conditions: {
    entityType?: string;
    filePattern?: string;
    namePattern?: string;
    tagPattern?: string;
  },
  limit: number = 100,
  client?: NebulaClient
): Promise<EnrichedEntity[]> {
  const nebulaClient = client || getDefaultClient();
  await nebulaClient.executeNgql(`USE ${SPACE}`);

  // 构建查询条件
  const whereConditions: string[] = [];

  if (conditions.entityType) {
    whereConditions.push(
      `$$.${ENTITY_TAG}.entity_type == "${escapeString(conditions.entityType)}"`
    );
  }
  if (conditions.filePattern) {
    whereConditions.push(
      `$$.${ENTITY_TAG}.file_path CONTAINS "${escapeString(
        conditions.filePattern
      )}"`
    );
  }
  if (conditions.namePattern) {
    whereConditions.push(
      `$$.${ENTITY_TAG}.raw_name CONTAINS "${escapeString(
        conditions.namePattern
      )}"`
    );
  }
  if (conditions.tagPattern) {
    whereConditions.push(
      `$$.${ENTITY_TAG}.tag_list CONTAINS "${escapeString(
        conditions.tagPattern
      )}"`
    );
  }

  let whereClause = "";
  if (whereConditions.length > 0) {
    whereClause = ` WHERE ${whereConditions.join(" AND ")}`;
  }

  const query = `
    LOOKUP ON ${ENTITY_TAG}${whereClause}
    YIELD id(vertex) as entity_id
    | LIMIT ${limit}
  `;

  logQuery(query);
  const result = await nebulaClient.executeNgql(query);
  //@ts-ignore
  const entities: EnrichedEntity[] = [];
  if (result?.data?.tables?.length > 0) {
    for (const row of result.data.tables) {
      const entityId = row.id;
      const entity = await readCodeEntity(entityId, nebulaClient);
      if (entity) {
        entities.push(...entity);
      }
    }
  }

  return entities;
}

/**
 * 构建完整的代码知识图谱 (引用builder功能)
 */
export { buildGraph } from "./builder";

/**
 * 根据实体ID和边类型查询相关实体
 * @param entityId 源实体ID
 * @param edgeType 边类型：'IMPORTS', 'CALLS', 'CONTAINS' 或 'ALL'
 * @param direction 查询方向：'OUT'(出边), 'IN'(入边), 'BOTH'(双向)
 * @param client 可选的Nebula客户端
 * @returns 相关实体列表
 */
async function getRelatedEntities(
  entityId: string,
  edgeType: "IMPORTS" | "CALLS" | "CONTAINS" | "ALL" = "ALL",
  direction: "OUT" | "IN" | "BOTH" = "OUT",
  client?: NebulaClient
): Promise<
  {
    entityId: string;
    entityType: string;
    rawName: string;
    description: string;
    relationshipType: string;
    direction: "OUT" | "IN";
  }[]
> {
  const nebulaClient = client || getDefaultClient();
  await nebulaClient.executeNgql(`USE ${SPACE}`);

  const escapedId = escapeString(entityId);
  const results: any[] = [];

  // 构建边类型列表
  const edgeTypes =
    edgeType === "ALL"
      ? [REL_IMPORTS, REL_CALLS, REL_CONTAINS]
      : edgeType === "IMPORTS"
      ? [REL_IMPORTS]
      : edgeType === "CALLS"
      ? [REL_CALLS]
      : [REL_CONTAINS];

  // 查询出边
  if (direction === "OUT" || direction === "BOTH") {
    for (const edge of edgeTypes) {
      try {
        const query = `
          GO FROM "${escapedId}" OVER ${edge}
          YIELD 
            dst(edge) as target_id,
            $$.${ENTITY_TAG}.entity_type as target_type,
            $$.${ENTITY_TAG}.raw_name as target_name,
            $$.${ENTITY_TAG}.description as target_desc
        `;

        logQuery(query);
        const result = await nebulaClient.executeNgql(query);
        //@ts-ignore
        if (result?.data?.tables?.length > 0) {
          //@ts-ignore
          for (const row of result.data.tables) {
            results.push({
              entityId: row.target_id,
              entityType: row.target_type || "",
              rawName: row.target_name || "",
              description: row.target_desc || "",
              relationshipType: edge,
              direction: "OUT" as const,
            });
          }
        }
      } catch (error) {
        console.warn(`查询${edge}出边时出错:`, error);
      }
    }
  }

  // 查询入边
  if (direction === "IN" || direction === "BOTH") {
    for (const edge of edgeTypes) {
      try {
        const query = `
          GO FROM "${escapedId}" OVER ${edge} REVERSELY
          YIELD 
            dst(edge) as source_id,
            $$.${ENTITY_TAG}.entity_type as source_type,
            $$.${ENTITY_TAG}.raw_name as source_name,
            $$.${ENTITY_TAG}.description as source_desc
        `;

        logQuery(query);
        const result = await nebulaClient.executeNgql(query);
        //@ts-ignore
        if (result?.data?.tables?.length > 0) {
          //@ts-ignore
          for (const row of result.data.tables) {
            results.push({
              entityId: row.source_id,
              entityType: row.source_type || "",
              rawName: row.source_name || "",
              description: row.source_desc || "",
              relationshipType: edge,
              direction: "IN" as const,
            });
          }
        }
      } catch (error) {
        console.warn(`查询${edge}入边时出错:`, error);
      }
    }
  }

  return results;
}

/**
 * 查询实体的多跳关系（依赖链分析）
 * @param entityId 源实体ID
 * @param maxHops 最大跳数，默认为2
 * @param edgeTypes 查询的边类型
 * @param client 可选的Nebula客户端
 * @returns 多跳关系结果
 */
async function getEntityDependencyChain(
  entityId: string,
  maxHops: number = 2,
  edgeTypes: string[] = [REL_IMPORTS, REL_CALLS, REL_EMITS, REL_CONTAINS],
  client?: NebulaClient
): Promise<
  {
    path: string[];
    entities: any[];
    hops: number;
  }[]
> {
  const nebulaClient = client || getDefaultClient();
  const currentSpace = nebulaClient.getConfig().space;
  await nebulaClient.executeNgql(`USE ${currentSpace}`);
  const escapedId = escapeString(entityId);
  const edgeList = edgeTypes.join(",");

  try {
    const query = `
      GET SUBGRAPH WITH PROP ${maxHops} STEPS FROM "${escapedId}" 
      OUT ${edgeList}
      YIELD VERTICES AS nodes, EDGES AS relationships
    `;

    logQuery(query);
    const result = await nebulaClient.executeNgql(query);

    // 🔥 构建完整的路径映射
    const pathMap = new Map<string, string[]>(); // nodeId -> 从源节点到该节点的完整路径
    const nodeEntities = new Map<string, any>(); // nodeId -> entity data
    const allPaths: { path: string[]; entities: any[]; hops: number }[] = [];

    // 🔥 初始化源节点路径
    pathMap.set(entityId, [entityId]);

    if (result?.data?.tables?.length > 0) {
      // 🔥 Step 1: 收集所有顶点信息
      for (
        let stepIndex = 0;
        stepIndex < result.data.tables.length;
        stepIndex++
      ) {
        const stepData = result.data.tables[stepIndex];

        if (
          stepData._verticesParsedList &&
          stepData._verticesParsedList.length > 0
        ) {
          // 并行处理所有顶点
          const vertexPromises = stepData._verticesParsedList
            .filter((vertex: any) => vertex.vid !== entityId) // 排除源节点
            .map(async (vertex: any) => {
              const enrichedEntity = await convertVertexToEnrichedEntity(
                vertex,
                nebulaClient
              );
              if (enrichedEntity) {
                return { vid: vertex.vid, entity: enrichedEntity };
              }
              return null;
            });

          const resolvedVertices = await Promise.all(vertexPromises);

          // 将结果存储到 nodeEntities
          resolvedVertices.forEach((result) => {
            if (result) {
              nodeEntities.set(result.vid, result.entity);
            }
          });
        }
      }

      // 🔥 Step 2: 按跳数顺序处理边信息，构建多跳路径
      for (
        let stepIndex = 0;
        stepIndex < result.data.tables.length;
        stepIndex++
      ) {
        const stepData = result.data.tables[stepIndex];

        if (stepData._edgesParsedList && stepData._edgesParsedList.length > 0) {
          console.log(`=== 处理第 ${stepIndex} 跳的边信息 ===`);

          stepData._edgesParsedList.forEach((edge: any) => {
            const sourceNode = edge.srcID;
            const targetNode = edge.dstID;
            const edgeType = edge.edgeName;

            // 🔥 关键：只有当源节点已经有路径时，才能构建到目标节点的路径
            if (pathMap.has(sourceNode)) {
              const sourcePath = pathMap.get(sourceNode);

              // 🔥 构建到目标节点的新路径：源路径 + 边类型 + 目标节点
              const targetPath = [...sourcePath, edgeType, targetNode];

              // 🔥 如果目标节点没有路径，或者新路径更短，则更新
              if (
                !pathMap.has(targetNode) ||
                targetPath.length < pathMap.get(targetNode).length
              ) {
                pathMap.set(targetNode, targetPath);
                console.error(`构建路径: ${targetPath.join(" -> ")}`);
              }
            }
          });
        }
      }

      // 🔥 Step 3: 为所有找到的节点生成最终路径结果
      for (const [nodeId, path] of pathMap.entries()) {
        if (nodeId !== entityId && nodeEntities.has(nodeId)) {
          const hops = Math.floor((path.length - 1) / 2); // 计算跳数
          allPaths.push({
            path: path, // 完整路径：[源节点, 边类型, 节点, 边类型, 节点, ...]
            entities: [nodeEntities.get(nodeId)],
            hops: hops,
          });
        }
      }
    }

    // 🔥 按跳数排序，方便查看
    allPaths.sort((a, b) => a.hops - b.hops);

    console.error(`构建的所有路径数量: ${allPaths.length}`);
    allPaths.forEach((pathInfo, index) => {
      console.error(
        `路径 ${index + 1} (${pathInfo.hops}跳): ${pathInfo.path.join(" -> ")}`
      );
    });
    console.error("allPaths", allPaths);

    return allPaths;
  } catch (error) {
    console.error("GET SUBGRAPH 查询失败:", error);
    return [];
  }
}

/**
 * 查询两个实体之间的关系路径
 * @param sourceId 源实体ID
 * @param targetId 目标实体ID
 * @param maxHops 最大跳数，默认为3
 * @param client 可选的Nebula客户端
 * @returns 关系路径
 */
async function findRelationshipPath(
  sourceId: string,
  targetId: string,
  maxHops: number = 3,
  client?: NebulaClient
): Promise<{
  found: boolean;
  path?: string[];
  length?: number;
}> {
  const nebulaClient = client || getDefaultClient();
  await nebulaClient.executeNgql(`USE ${SPACE}`);

  const escapedSourceId = escapeString(sourceId);
  const escapedTargetId = escapeString(targetId);

  try {
    const query = `
      FIND PATH FROM "${escapedSourceId}" TO "${escapedTargetId}" 
      OVER ${REL_IMPORTS},${REL_CALLS},${REL_CONTAINS}
      UPTO ${maxHops} STEPS
      YIELD path
    `;

    logQuery(query);
    const result = await nebulaClient.executeNgql(query);
    //@ts-ignore
    if (result?.data?.tables?.length > 0) {
      //@ts-ignore
      // 解析第一条路径
      const firstPath = result.data.tables[0];
      return {
        found: true,
        path: [], // 待实现路径解析
        length: 0, // 待实现长度计算
      };
    }

    return { found: false };
  } catch (error) {
    console.error("查询关系路径时出错:", error);
    return { found: false };
  }
}

async function convertVertexToEnrichedEntity(
  vertex: any,
  client: NebulaClient
): Promise<EnrichedEntity | null> {
  try {
    const props = vertex.properties?.CodeEntity;
    if (!props && !vertex.vid) {
      return null;
    }

    // 从 vid 解析基本信息
    const [entityType, rawName] = vertex.vid.split(":");

    // 并行获取导入和调用关系
    const [imports, calls] = await Promise.all([
      getEntityImports(vertex.vid, client),
      getEntityCalls(vertex.vid, client),
    ]);

    return {
      id: vertex.vid,
      type: props?.entity_type || entityType?.toLowerCase() || "",
      file: props?.file_path || "",
      loc: parseLocation(props?.location),
      rawName: props?.raw_name || rawName || "",
      summary: props?.description || "",
      tags: parseStringArray(props?.tag_list),
      EMITS: parseStringArray(props?.emits_list),
      TEMPLATE_COMPONENTS: [],
      isWorkspace: props?.is_workspace || false,
      isDDD: props?.is_ddd || false,
      ANNOTATION: props?.annotation || "",
      IMPORTS: imports,
      CALLS: calls,
    };
  } catch (error) {
    console.warn("转换顶点数据失败:", error);
    return null;
  }
}
/**
 * 解析位置信息
 */
function parseLocation(
  locationStr: string
): { start: number; end: number } | string {
  if (!locationStr) return "";

  try {
    if (locationStr.includes("-")) {
      const [start, end] = locationStr.split("-").map(Number);
      return { start, end };
    }
    return locationStr;
  } catch {
    return locationStr;
  }
}

/**
 * 解析逗号分隔的字符串数组
 */
function parseStringArray(str: string): string[] {
  if (!str) return [];
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export {
  /* 创建实体 */
  create,
  /* 更新实体 */
  update,
  /* 读取实体 */
  read,
  /* 删除实体 */
  remove,
  /* 批量创建实体 */
  batchCreate,
  /* 批量更新实体 */
  batchUpdate,
  /* 批量删除实体 */
  batchRemove,
  /* 获取文件中的实体 */
  getEntitiesInFile,
  /* 查询实体 */
  queryEntities,
  /* 获取实体的依赖关系 */
  getRelatedEntities,
  /* 获取实体的依赖链 */
  getEntityDependencyChain,
  /* 查询两个实体之间的关系路径 */
  findRelationshipPath,
  /* 获取实体的导入关系 */
  getEntityImports,
  /* 获取实体的调用关系 */
  getEntityCalls,
};
