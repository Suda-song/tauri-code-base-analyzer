/**
 * 图构建器模块
 */
import { FileEntity, EnrichedEntity, PreparedData, FlowEntity } from "./types";
import { NebulaClient, getDefaultClient } from "@xhs/nebula-client";
import {
  FILE_TAG,
  ENTITY_TAG,
  REL_CONTAINS,
  REL_IMPORTS,
  REL_CALLS,
  REL_EMITS,
  FLOW_TAG,
  createSchemaStatements,
} from "./schema";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { json } from "stream/consumers";

/**
 * 转义字符串中的特殊字符，并对超长字符串进行哈希处理
 * @description 处理输入字符串，如果长度超过250字符则进行MD5哈希，并转义反斜杠、引号、换行符等特殊字符
 * @param {string} str - 需要处理的原始字符串
 * @returns {string} 处理后的安全字符串，适合在数据库查询中使用
 * @business 在构建代码知识图谱时，确保字符串在Nebula Graph数据库查询中的安全性和符合长度限制
 */

export function escapeString(str: string): string {
  let processedStr = str;
  if (processedStr.length > 250) {
    processedStr = crypto.createHash("md5").update(processedStr).digest("hex");
  }

  return processedStr
    .replace(/\\/g, "\\\\") // 转义反斜杠
    .replace(/"/g, '\\"') // 转义双引号
    .replace(/'/g, "\\'") // 转义单引号
    .replace(/\n/g, "\\n") // 转义换行符
    .replace(/\r/g, "\\r") //  转义回车符
    .replace(/\t/g, "\\t"); // 转义制表符
}
export function escapeString2(str: string): string {
  let processedStr = str;

  return processedStr
    .replace(/\\/g, "") // 移除反斜杠
    .replace(/"/g, "") // 移除双引号
    .replace(/'/g, "") // 移除单引号
    .replace(/\n/g, " ") // 将换行符替换为空格
    .replace(/\r/g, "") // 移除回车符
    .replace(/\t/g, " ") // 将制表符替换为空格
    .replace(/\*\*/g, "") // 移除XML格式的**
    .replace(/[<>]/g, "") // 移除XML标签字符
    .replace(/[{}[\]]/g, "") // 移除JSON特殊字符
    .replace(/[|\\]/g, "") // 移除管道符和其他特殊字符
    .replace(/\s+/g, " ") // 将多个连续空格合并为单个空格
    .trim(); // 移除首尾空格
}
/**
 * @description 函数: escapeString2
 */

export function logQuery(query: string) {
  console.log(query);
}

/**
 * 执行NGQL查询并实现自动重试机制，处理常见的数据库临时错误
 * @description 使用指数退避策略执行NebulaGraph查询，自动重试特定类型的临时错误，如连接问题、存储错误和并发冲突
 * @param {NebulaClient} client - NebulaGraph客户端实例
 * @param {string} query - 要执行的NGQL查询语句
 * @param {number} maxRetries - 最大重试次数，默认为3次
 * @param {number} initialDelay - 初始重试延迟时间(毫秒)，默认为100ms
 * @returns {Promise<any>} 查询执行结果
 * @business 代码知识图谱构建 - 提供稳定的数据库操作，确保在网络不稳定或并发冲突情况下能够可靠地构建和更新图数据
 * @example
 * // 执行一个插入查询并自动处理临时错误
 * const result = await executeNgqlWithRetry(client, 'INSERT VERTEX CodeEntity(...) VALUES "id":(...)');
 */
export async function executeNgqlWithRetry(
  client: NebulaClient,
  query: string,
  maxRetries = 3,
  initialDelay = 100
): Promise<any> {
  let retries = 0;
  let delay = initialDelay;

  while (retries < maxRetries) {
    try {
      const result = await client.executeNgql(query);
      return result || null; // Success
    } catch (error: any) {
      const errorMessage = error.message || "";

      // 检查是否是可重试的错误
      const isRetryableError =
        errorMessage.includes("leader has changed") ||
        errorMessage.includes(
          "More than one request trying to add/update/delete"
        ) ||
        errorMessage.includes("Storage Error") ||
        errorMessage.includes("Connection refused") ||
        errorMessage.includes("RPC failure");

      if (isRetryableError && retries < maxRetries - 1) {
        // 根据错误类型调整延迟时间
        let currentDelay = delay;
        if (
          errorMessage.includes(
            "More than one request trying to add/update/delete"
          )
        ) {
          // 并发冲突错误使用更长的延迟和随机化
          currentDelay = delay + Math.random() * delay;
        }

        console.error(
          `数据库操作失败，将在 ${currentDelay}ms 后重试... (尝试 ${
            retries + 1
          }/${maxRetries}) 错误: ${errorMessage.substring(0, 100)}...`
        );

        await new Promise((resolve) => setTimeout(resolve, currentDelay));
        delay *= 2; // Exponential backoff
        retries++;
      } else {
        console.error(`数据库操作最终失败:${errorMessage}`);
        throw error; // Rethrow other errors or on final retry
      }
    }
  }
}

/**
 * 构建代码知识图谱
 * @param files 文件实体列表
 * @param entities 增强实体列表
 * @param client 可选的 Nebula 客户端实例，如果不提供则使用默认客户端
 */
let building = false;
/**
 * 构建代码知识图谱
 * @description 将文件实体、代码实体和流程实体导入到Nebula Graph数据库中，创建节点和它们之间的关系。
 * 支持创建文件节点、实体节点、流程节点，以及它们之间的包含、导入、调用和事件发出关系。
 * @param {FileEntity[]} files - 文件实体列表
 * @param {EnrichedEntity[]} entities - 增强实体列表，包含代码中的函数、类、组件等
 * @param {FlowEntity[]} [flows] - 可选的流程实体列表，表示业务流程
 * @param {NebulaClient} [client] - 可选的Nebula客户端实例，如果不提供则使用默认客户端
 * @returns {Promise<void>} 无返回值
 * @business 代码知识图谱构建，用于代码分析、理解和可视化
 */
export async function buildGraph(
  files: FileEntity[],
  entities: EnrichedEntity[],
  flows?: FlowEntity[],
  client?: NebulaClient
): Promise<void> {
  if (building) {
    console.log("buildGraph is building, skip");
    return;
  }
  building = true;
  const nebulaClient = client || getDefaultClient();

  try {
    console.log(
      `开始构建知识图谱，处理 ${files.length} 个文件和 ${entities.length} 个实体...`
    );
    if (!nebulaClient.isConnected) {
      await nebulaClient.connect();
    }
    // 1. 使用指定图空间
    const currentSpace = nebulaClient.getConfig().space;
    console.log(`🚀🚀🚀 currentSpace: ${currentSpace}`);
    // 判断图空间是否存在
    await checkAndRecreateSpaceIfNeeded(currentSpace, nebulaClient);
    await nebulaClient.executeNgql(`USE ${currentSpace}`);
    for (const stmt of createSchemaStatements(currentSpace)) {
      // console.log(`创建schema: ${stmt}`);
      await nebulaClient.executeNgql(stmt);
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
    // 2. 插入或更新所有文件节点
    const queue = [];
    for (const file of files) {
      queue.push(addOrUpdateFile(file, nebulaClient));
    }

    // 3. 插入或更新所有实体节点
    for (const entity of entities) {
      queue.push(addOrUpdateEntity(entity, nebulaClient));
    }

    // 3. 插入或更新所有流程节点
    if (flows && flows.length > 0) {
      console.log(`存在flows: ${JSON.stringify(flows)}`);
      for (const flow of flows) {
        if (flow.contains.length > 0) {
          queue.push(addOrUpdateFlow(flow, nebulaClient));
        }
      }
    }
    const edgeBatchSize = 512;
    for (let i = 0; i < queue.length; i += edgeBatchSize) {
      const batch = queue.slice(i, i + edgeBatchSize);
      if (batch.length > 0) {
        const fullQuery = batch.join("; ");
        // console.log(`创建节点: ${fullQuery}`);
        try {
          await executeNgqlWithRetry(nebulaClient, fullQuery);
        } catch (error) {
          console.error(
            `创建节点失败: (批次 ${Math.floor(i / edgeBatchSize) + 1}):${error}`
          );
          // 可以选择继续或抛出错误
          throw JSON.stringify(error, null, 2);
        }
      }
    }

    // 4. 创建关系（包括 Flow 的 CONTAINS 关系）
    await createRelationships(entities, nebulaClient, flows);

    console.log("图谱构建完成!");
  } catch (error) {
    console.error(`构建图谱时发生错误:${error}`);
    throw error;
  } finally {
    building = false;
  }
}

/**
 * 插入或更新文件节点到Nebula图数据库
 * @description 将文件实体转换为NGQL查询语句，用于在图数据库中创建或更新文件节点，处理文件路径、名称和扩展名等属性
 * @param {FileEntity} file - 文件实体对象，包含id、path、name和extension属性
 * @param {NebulaClient} client - Nebula图数据库客户端实例，用于执行查询
 * @returns {string} 生成的NGQL查询语句，用于执行UPSERT操作
 * @business 代码知识图谱构建，文件节点是代码实体的容器，通过CONTAINS关系与代码实体相连
 */
export function addOrUpdateFile(file: FileEntity, client: NebulaClient) {
  const { id, path, name, extension } = file;
  const escapedId = escapeString(id);
  const escapedPath = escapeString(path);
  const escapedName = escapeString(name);
  const escapedExtension = escapeString(extension);
  const query = `
    UPSERT VERTEX "${escapedId}"
    SET ${FILE_TAG}.path = "${escapedPath}", 
        ${FILE_TAG}.name = "${escapedName}", 
        ${FILE_TAG}.extension = "${escapedExtension}"
  `;
  logQuery(query);
  return query;
}

/**
 * @description 函数: addOrUpdateEntity
 */
export function addOrUpdateEntity(
  entity: EnrichedEntity,
  client: NebulaClient
) {
  const {
    id,
    type,
    file,
    rawName,
    summary,
    tags,
    EMITS,
    loc,
    isWorkspace,
    isDDD,
    ANNOTATION,
  } = entity;

  const escapedId = escapeString(id);
  const escapedType = escapeString(type);
  const escapedFile = escapeString(file);
  const escapedRawName = escapeString(rawName || "");
  const escapedSummary = escapeString2(summary || "");
  const escapedTags = escapeString(Array.isArray(tags) ? tags.join(",") : "");
  const escapedEmits = escapeString(
    Array.isArray(EMITS) ? EMITS.join(",") : ""
  );
  const locationStr = loc
    ? typeof loc === "object"
      ? `${loc.start}-${loc.end || loc.start}`
      : String(loc)
    : "";
  const escapedLocation = escapeString(locationStr);
  const escapedAnnotation = escapeString(ANNOTATION || "");
  const query = `
    UPSERT VERTEX "${escapedId}"
    SET ${ENTITY_TAG}.entity_type = "${escapedType}", 
        ${ENTITY_TAG}.file_path = "${escapedFile}", 
        ${ENTITY_TAG}.location = "${escapedLocation}", 
        ${ENTITY_TAG}.raw_name = "${escapedRawName}", 
        ${ENTITY_TAG}.description = "${escapedSummary}", 
        ${ENTITY_TAG}.tag_list = "${escapedTags}",
        ${ENTITY_TAG}.emits_list = "${escapedEmits}",
        ${ENTITY_TAG}.is_workspace = ${isWorkspace},
        ${ENTITY_TAG}.is_ddd = ${isDDD},
        ${ENTITY_TAG}.annotation = "${escapedAnnotation}"
  `;

  logQuery(query);
  return query;
}

/**
 * @description 函数: addOrUpdateFlow
 */
export function addOrUpdateFlow(flow: FlowEntity, client: NebulaClient) {
  const { id, description, contains } = flow;
  const escapedDescription = escapeString2(description || "");
  const escapedContains = escapeString(
    Array.isArray(contains) ? contains.join(",") : ""
  );
  const query = `
    UPSERT VERTEX "${escapeString(id)}"
    SET ${FLOW_TAG}.description = "${escapedDescription}",
        ${FLOW_TAG}.contains = "${escapedContains}"
  `;
  logQuery(query);
  return query;
}

// 会话级缓存，避免重复查询
const nodeExistenceCache = new Map<string, boolean>();

/**
 * @description 函数: createRelationships
 */
export async function createRelationships(
  entities: EnrichedEntity[],
  client: NebulaClient,
  flows?: FlowEntity[]
): Promise<void> {
  console.log("创建关系...");

  // 1. 收集所有被引用的实体ID（包括 Flow 中的）
  const allReferencedIds = new Set<string>();

  // 现有逻辑：收集 entities 中的引用
  for (const entity of entities) {
    // 收集IMPORTS中的实体ID
    if (entity.IMPORTS) {
      entity.IMPORTS.forEach((id: string) => {
        if (id.includes(":")) allReferencedIds.add(id);
      });
    }
    // 收集CALLS中的实体ID
    if (entity.CALLS) {
      entity.CALLS.forEach((id: string) => {
        const baseId = id.split(".")[0]; // 处理"Function:getName.method"格式
        if (baseId.includes(":")) allReferencedIds.add(baseId);
      });
    }
  }

  // 新增逻辑：收集 Flow 中包含的实体ID
  if (flows) {
    for (const flow of flows) {
      if (flow.contains && flow.contains.length > 0) {
        flow.contains.forEach((entityId) => {
          if (entityId.includes(":")) allReferencedIds.add(entityId);
        });
      }
    }
  }

  console.log(`发现 ${allReferencedIds.size} 个被引用的实体ID`);

  // 2-4. 现有的节点检查和占位符创建逻辑保持不变
  const currentBatchIds = new Set(entities.map((e) => e.id));
  const uncachedIds: string[] = [];

  for (const id of allReferencedIds) {
    if (!currentBatchIds.has(id) && !nodeExistenceCache.has(id)) {
      uncachedIds.push(id);
    }
  }

  if (uncachedIds.length > 0) {
    console.log(`需要检查 ${uncachedIds.length} 个未缓存的节点`);
    const existingNodes = await batchCheckNodesExist(uncachedIds, client);

    for (const id of uncachedIds) {
      nodeExistenceCache.set(id, existingNodes.has(id));
    }
  }

  const edgeQueries: string[] = [];
  let placeholderCount = 0;

  for (const refId of allReferencedIds) {
    const existsInBatch = currentBatchIds.has(refId);
    const existsInDB = nodeExistenceCache.get(refId) || false;

    if (!existsInBatch && !existsInDB) {
      const placeholderQuery = createPlaceholderNode(refId);
      edgeQueries.push(placeholderQuery);
      placeholderCount++;
    }
  }

  console.log(`需要创建 ${placeholderCount} 个占位符节点`);

  // 5. 创建边关系（包括 Flow 的 CONTAINS 边）
  await createEdges(entities, edgeQueries, client, flows);

  console.log("关系创建完成");
}

/**
 * 批量检查节点是否存在
 */
async function batchCheckNodesExist(
  nodeIds: string[],
  client: NebulaClient
): Promise<Set<string>> {
  if (nodeIds.length === 0) return new Set();

  const existingNodes = new Set<string>();
  const batchSize = 100; // 每批查询100个节点

  for (let i = 0; i < nodeIds.length; i += batchSize) {
    const batch = nodeIds.slice(i, i + batchSize);

    try {
      //使用UNION查询
      const queries = batch.map(
        (id) =>
          `FETCH PROP ON ${ENTITY_TAG} "${escapeString(
            id
          )}" YIELD id(vertex) as node_id`
      );

      const unionQuery = queries.join(" UNION ");
      const result = await executeNgqlWithRetry(client, unionQuery);

      if (result?.data?.tables?.length > 0) {
        result.data.tables.forEach((row: any) => {
          if (row.node_id) {
            existingNodes.add(row.node_id);
          }
        });
      }
    } catch (error) {
      console.warn(
        `UNION查询失败，回退到逐个检查 (批次 ${
          Math.floor(i / batchSize) + 1
        }):`,
        error
      );

      // 回退到逐个检查
      for (const id of batch) {
        try {
          const singleQuery = `FETCH PROP ON ${ENTITY_TAG} "${escapeString(
            id
          )}" YIELD id(vertex) as node_id`;
          const singleResult = await executeNgqlWithRetry(client, singleQuery);
          if (singleResult?.data?.length > 0) {
            existingNodes.add(id);
          }
        } catch (singleError) {
          // 单个查询失败，假设节点不存在
          console.debug(`节点 ${id} 检查失败，假设不存在`);
        }
      }
    }
  }

  console.log(
    `批量检查结果: ${nodeIds.length} 个节点中，${existingNodes.size} 个已存在`
  );
  return existingNodes;
}

/**
 * 创建占位符节点
 */
function createPlaceholderNode(refId: string): string {
  const [type, name] = refId.split(":");
  console.log("createPlaceholderNode", refId, type, name);
  return `
    UPSERT VERTEX "${escapeString(refId)}"
    SET ${ENTITY_TAG}.entity_type = "${escapeString(type.toLowerCase())}", 
        ${ENTITY_TAG}.raw_name = "${escapeString(name)}", 
        ${ENTITY_TAG}.description = "外部引用的占位符实体",
        ${ENTITY_TAG}.file_path = "",
        ${ENTITY_TAG}.location = "",
        ${ENTITY_TAG}.tag_list = "占位符,外部引用",
        ${ENTITY_TAG}.emits_list = "",
        ${ENTITY_TAG}.is_workspace = false,
        ${ENTITY_TAG}.is_ddd = false,
        ${ENTITY_TAG}.annotation = "系统自动创建的占位符节点"
  `;
}

/**
 * 创建边关系
 */
async function createEdges(
  entities: EnrichedEntity[],
  edgeQueries: string[],
  client: NebulaClient,
  flows?: FlowEntity[]
): Promise<void> {
  // 先执行占位符节点创建查询
  if (edgeQueries.length > 0) {
    console.log("创建占位符节点...");
    const batchSize = 50;
    for (let i = 0; i < edgeQueries.length; i += batchSize) {
      const batch = edgeQueries.slice(i, i + batchSize);
      const batchQuery = batch.join("; ");

      try {
        await executeNgqlWithRetry(client, batchQuery);
      } catch (error) {
        console.error(
          `创建占位符节点失败 (批次 ${Math.floor(i / batchSize) + 1}):${error}`
        );
        // 尝试逐个执行
        for (const query of batch) {
          try {
            await executeNgqlWithRetry(client, query);
          } catch (singleError) {
            console.error(`单个占位符创建失败:${singleError}`);
          }
        }
      }
    }
  }

  // 创建边关系
  console.log("创建边关系...");
  const edgeCommands: string[] = [];

  // 现有逻辑：处理 Entity 的边关系
  for (const entity of entities) {
    const escapedFileId = escapeString(entity.file);
    const escapedEntityId = escapeString(entity.id);

    // 包含关系 (文件包含实体)
    edgeCommands.push(
      `INSERT EDGE ${REL_CONTAINS}() VALUES "${escapedFileId}"->"${escapedEntityId}":()`
    );

    // 2. 导入关系 + EMITS边创建逻辑
    if (entity.IMPORTS) {
      for (const importedEntityId of entity.IMPORTS) {
        if (!importedEntityId.includes(":")) continue;

        const escapedImportedId = escapeString(importedEntityId);

        // 创建IMPORTS边
        edgeCommands.push(
          `INSERT EDGE ${REL_IMPORTS}() VALUES "${escapedEntityId}"->"${escapedImportedId}":()`
        );

        // 检查被导入实体是否有EMITS，如果有则创建EMITS边
        const importedEntity = findEntityById(importedEntityId, entities);
        if (
          importedEntity &&
          importedEntity.EMITS &&
          importedEntity.EMITS.length > 0
        ) {
          // 为每个emit参数创建一条EMITS边（从被导入实体指向当前实体）
          for (const emitParam of importedEntity.EMITS) {
            const emitsEdgeCommand = createEmitsEdge(
              importedEntityId,
              entity.id,
              emitParam
            );
            edgeCommands.push(emitsEdgeCommand);
          }
        }
      }
    }

    // 调用关系
    if (entity.CALLS) {
      for (const calledEntityId of entity.CALLS) {
        const baseEntityId = calledEntityId.split(".")[0];
        if (!baseEntityId.includes(":")) continue;
        const escapedCalledId = escapeString(baseEntityId);
        edgeCommands.push(
          `INSERT EDGE ${REL_CALLS}() VALUES "${escapedEntityId}"->"${escapedCalledId}":()`
        );
      }
    }
  }

  // 现有逻辑：处理 Flow 的 CONTAINS 边关系（到实体）
  if (flows) {
    console.log(`处理 ${flows.length} 个 Flow 的 CONTAINS 关系123...`);
    for (const flow of flows) {
      if (flow.contains && flow.contains.length > 0) {
        const escapedFlowId = escapeString(flow.id);

        for (const entityId of flow.contains) {
          if (entityId.includes(":")) {
            // 只处理有效的实体ID
            const escapedEntityId = escapeString(entityId);
            edgeCommands.push(
              `INSERT EDGE ${REL_CONTAINS}() VALUES "${escapedFlowId}"->"${escapedEntityId}":()`
            );
          }
        }

        console.log(
          `Flow ${flow.id} 将创建 ${flow.contains.length} 条 CONTAINS 边`
        );
      }
    }
  }

  // 新增逻辑：处理 Flow 到 File 的 CONTAINS 关系
  if (flows) {
    console.log(
      `处理 ${flows.length} 个 Flow 到 File 的 CONTAINS 关系...`,
      flows
    );
    for (const flow of flows) {
      console.log(`${flow.id} 找到flow`);
      if (flow.contains && flow.contains.length > 0) {
        console.log(`${flow.id} 找到flow.contains`);
        const escapedFlowId = escapeString(flow.id);
        const processedFiles = new Set<string>(); // 防止重复的文件边

        for (const entityId of flow.contains) {
          console.log(`${flow.id} 开始处理entityId: ${entityId}`);
          if (entityId.includes(":")) {
            // 找到这个entity对应的file
            const entity = entities.find((e) => e.id === entityId);
            if (entity && entity.file) {
              // entity.file包含文件路径
              console.log(`${flow.id} 找到对应entity: ${entityId}`);
              const fileId = escapeString(entity.file);

              if (fileId && !processedFiles.has(fileId)) {
                console.log(`${flow.id} 找到对应file: ${fileId}`);
                const escapedFileId = escapeString(fileId);
                edgeCommands.push(
                  `INSERT EDGE ${REL_CONTAINS}() VALUES "${escapedFlowId}"->"${escapedFileId}":()`
                );
                processedFiles.add(fileId);
                console.log(
                  `创建Flow到File的CONTAINS边123: ${flow.id} -> ${fileId}`
                );
              } else if (!fileId) {
                console.error(`⚠️ 无法找到文件路径 ${fileId} 对应的文件ID`);
              }
            }
          }
        }

        console.log(
          `Flow ${flow.id} 将创建 ${processedFiles.size} 条到文件的 CONTAINS 边`
        );
      }
    }
  }

  // 批量执行边创建命令
  const edgeBatchSize = 512;
  for (let i = 0; i < edgeCommands.length; i += edgeBatchSize) {
    const batch = edgeCommands.slice(i, i + edgeBatchSize);
    if (batch.length > 0) {
      const fullQuery = batch.join("; ");

      try {
        await executeNgqlWithRetry(client, fullQuery);
      } catch (error) {
        console.error(
          `创建边关系失败 (批次 ${Math.floor(i / edgeBatchSize) + 1}):${error}`
        );
        // 可以选择继续或抛出错误
        throw error;
      }
    }
  }

  console.log(`成功创建 ${edgeCommands.length} 条边关系`);
}

/**
 * @description 函数: clearNodeExistenceCache
 */
export function clearNodeExistenceCache(): void {
  nodeExistenceCache.clear();
  console.error("节点存在性缓存已清除");
}

/**
 * 根据实体ID查找实体
 */
function findEntityById(
  entityId: string,
  entities: EnrichedEntity[]
): EnrichedEntity | null {
  return entities.find((entity) => entity.id === entityId) || null;
}

/**
 * 创建EMITS边命令
 * @param fromEntityId 发出者实体ID（被导入的实体）
 * @param toEntityId 接收者实体ID（当前实体）
 * @param emitParam 发出的参数信息
 */
function createEmitsEdge(
  fromEntityId: string,
  toEntityId: string,
  emitParam: string
): string {
  const escapedFromId = escapeString(fromEntityId);
  const escapedToId = escapeString(toEntityId);

  // 解析emit参数，假设格式为 "eventName" 或 "eventName:eventType" 或 "eventName:eventType:description"
  const [eventName, eventType = "unknown", description = ""] =
    emitParam.split(":");
  const escapedEventName = escapeString(eventName);
  const escapedEventType = escapeString(eventType);
  const escapedDescription = escapeString(description);
  const escapedParameters = escapeString(emitParam); // 将完整参数作为parameters存储

  return `INSERT EDGE ${REL_EMITS}(event_name, event_type, parameters, description) 
          VALUES "${escapedFromId}"->"${escapedToId}":
          ("${escapedEventName}", "${escapedEventType}", "${escapedParameters}", "${escapedDescription}")`;
}
/**
 * @description 函数: prepareDataFromFile
 */

/**
 * 数据准备器
 * 从 entities.enriched.json 文件加载和预处理数据
 */

/**
 * 从 entities.enriched.json 文件准备图构建所需的数据
 * @param entitiesFilePath entities.enriched.json 文件的完整路径
 * @returns 准备好的文件和实体数据
 */
export async function prepareDataFromFile(
  entitiesFilePath: string
): Promise<PreparedData> {
  try {
    // 1. 验证文件是否存在
    if (!fs.existsSync(entitiesFilePath)) {
      throw new Error(`实体文件不存在: ${entitiesFilePath}`);
    }

    console.log(`📖 正在加载实体文件: ${entitiesFilePath}`);

    // 2. 读取并解析 JSON 文件
    const jsonData = fs.readFileSync(entitiesFilePath, "utf-8");
    let entities: EnrichedEntity[];

    try {
      entities = JSON.parse(jsonData);
    } catch (parseError) {
      throw new Error(`解析 JSON 文件失败: ${parseError}`);
    }

    if (!Array.isArray(entities)) {
      throw new Error("实体文件格式错误：应该是一个数组");
    }

    console.log(`✅ 成功加载 ${entities.length} 个实体`);

    // 3. 准备文件实体映射
    const fileMap = new Map<string, FileEntity>();
    const processedEntities: EnrichedEntity[] = [];

    for (const entity of entities) {
      const filePath = entity.file;

      // 如果是新文件，创建文件实体
      if (!fileMap.has(filePath)) {
        const fileId = crypto.createHash("md5").update(filePath).digest("hex");
        const fileEntity: FileEntity = {
          id: fileId,
          path: filePath,
          name: path.basename(filePath),
          extension: path.extname(filePath),
        };

        fileMap.set(filePath, fileEntity);
      }

      // 更新实体的文件引用为文件ID
      const processedEntity: EnrichedEntity = {
        ...entity,
        file: fileMap.get(filePath)!.id,
      };

      processedEntities.push(processedEntity);
    }

    const files = Array.from(fileMap.values());
    console.log(`📁 识别到 ${files.length} 个唯一文件`);

    return {
      files,
      entities: processedEntities,
    };
  } catch (error) {
    console.error("❌ 数据准备失败:", error);
    throw error;
  }
}
/**
 * 检查图空间是否存在以及是否有数据，如果有数据则删除重新创建
 * @param spaceName 图空间名称
 * @param client Nebula客户端
 */
async function checkAndRecreateSpaceIfNeeded(
  spaceName: string,
  client: NebulaClient
): Promise<void> {
  // 添加参数验证
  if (!spaceName || spaceName.trim() === "") {
    throw new Error("图空间名称不能为空");
  }
  try {
    console.log(`🔍 检查图空间: ${spaceName}`);

    // 1. 检查图空间是否存在
    const spaceExistsResult = await client.executeNgql(`SHOW SPACES`);
    console.log(`所有图空间:${spaceExistsResult}`);

    let spaceExists = false;
    // @ts-ignore
    if (spaceExistsResult?.data?.tables?.length > 0) {
      // @ts-ignore
      spaceExists = spaceExistsResult.data.tables.some((space: any) => {
        // 检查空间名称是否匹配（处理可能的引号）
        const spaceName_clean = space.Name || space[0] || space.name;
        return (
          spaceName_clean === spaceName || spaceName_clean === `"${spaceName}"`
        );
      });
    }

    if (!spaceExists) {
      console.log(`📝 图空间 ${spaceName} 不存在，创建新的图空间`);
      const createSpaceStatement = `CREATE SPACE IF NOT EXISTS ${spaceName}(partition_num=10, replica_factor=1, vid_type=FIXED_STRING(256))`;
      await client.executeNgql(createSpaceStatement);
      // 等待图空间创建生效
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return;
    }

    console.log(`✅ 图空间 ${spaceName} 已存在，检查是否有数据`);

    // 2. 切换到目标图空间检查数据
    await client.executeNgql(`USE ${spaceName}`);

    // 3. 检查是否有数据（检查顶点和边）
    const hasData = await checkSpaceHasData(spaceName, client);

    if (hasData) {
      console.log(`🗑️ 图空间 ${spaceName} 有数据，删除并重新创建`);
      await dropAndRecreateSpace(spaceName, client);
    } else {
      console.log(`📭 图空间 ${spaceName} 无数据，直接使用`);
    }
  } catch (error) {
    console.error(`❌ 检查图空间失败:${error}`);
    // 如果检查失败，尝试创建新的图空间
    console.log(`🔄 尝试创建新的图空间: ${spaceName}`);
    try {
      await client.executeNgql(
        `CREATE SPACE IF NOT EXISTS ${spaceName}(partition_num=10, replica_factor=1, vid_type=FIXED_STRING(256))`
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (createError) {
      console.error(`❌ 创建图空间失败:${createError}`);
      throw createError;
    }
  }
}

/**
 * 检查图空间是否有数据
 * @param spaceName 图空间名称
 * @param client Nebula客户端
 * @returns 是否有数据
 */
async function checkSpaceHasData(
  spaceName: string,
  client: NebulaClient
): Promise<boolean> {
  try {
    // 检查是否有顶点数据
    const vertexCountResult = await client.executeNgql(
      `LOOKUP ON ${ENTITY_TAG} YIELD id(vertex) | LIMIT 1`
    );

    // @ts-ignore
    if (vertexCountResult?.data?.tables?.length > 0) {
      console.log(
        // @ts-ignore
        `📊 发现顶点数据: ${vertexCountResult.data.tables.length} 条`
      );
      return true;
    }

    // 检查是否有文件顶点数据
    const fileVertexResult = await client.executeNgql(
      `LOOKUP ON ${FILE_TAG} YIELD id(vertex) | LIMIT 1`
    );
    // @ts-ignore
    if (fileVertexResult?.data?.tables?.length > 0) {
      console.log(
        // @ts-ignore
        `📊 发现文件顶点数据: ${fileVertexResult.data.tables.length} 条`
      );
      return true;
    }

    console.log(`📭 图空间 ${spaceName} 无数据`);
    return false;
  } catch (error) {
    console.error(`⚠️ 检查数据时出错 (可能是Schema不存在):`, error);
    // 如果检查出错，可能是Schema还不存在，认为无数据
    return false;
  }
}

/**
 * 删除并重新创建图空间
 * @param spaceName 图空间名称
 * @param client Nebula客户端
 */
async function dropAndRecreateSpace(
  spaceName: string,
  client: NebulaClient
): Promise<void> {
  try {
    console.log(`🗑️ 开始删除并重新创建图空间: ${spaceName}`);

    // 1. 切换到系统默认空间（避免在要删除的空间内操作）
    try {
      await client.executeNgql("USE `code_graph`");
    } catch (error) {
      // 如果默认空间不存在，创建一个临时空间
      console.error("默认空间不存在，创建临时空间");
      await client.executeNgql(
        "CREATE SPACE IF NOT EXISTS temp_rebuild_space(partition_num=1, replica_factor=1, vid_type=FIXED_STRING(64))"
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await client.executeNgql("USE temp_rebuild_space");
    }

    // 2. 删除目标图空间（增加重试机制）
    let deleteSuccess = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`🗑️ 删除图空间 (尝试 ${attempt + 1}/3): ${spaceName}`);
        await client.executeNgql(`DROP SPACE IF EXISTS \`${spaceName}\``);

        // 3. 等待删除操作生效并验证
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // 验证删除是否成功
        const spaceExistsResult = await client.executeNgql(`SHOW SPACES`);
        let spaceExists = false;
        // @ts-ignore
        if (spaceExistsResult?.data?.tables?.length > 0) {
          // @ts-ignore
          spaceExists = spaceExistsResult.data.tables.some((space: any) => {
            const spaceName_clean = space.Name || space[0] || space.name;
            return (
              spaceName_clean === spaceName ||
              spaceName_clean === `"${spaceName}"`
            );
          });
        }

        if (!spaceExists) {
          console.log(`✅ 图空间 ${spaceName} 删除成功`);
          deleteSuccess = true;
          break;
        } else {
          console.log(`⚠️ 图空间 ${spaceName} 删除尚未生效，继续等待...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (deleteError) {
        console.error(`删除尝试 ${attempt + 1} 失败:`, deleteError);
        if (attempt === 2) throw deleteError;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!deleteSuccess) {
      console.error(`无法删除图空间 ${spaceName}`);
    }

    // 4. 重新创建图空间并切换
    let success = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        console.log(
          `🆕 创建并切换图空间 (尝试 ${attempt + 1}/3): ${spaceName}`
        );

        // 先尝试创建图空间
        await client.executeNgql(
          `CREATE SPACE IF NOT EXISTS ${spaceName}(partition_num=10, replica_factor=1, vid_type=FIXED_STRING(256))`
        );

        // 等待创建生效
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // 尝试切换到图空间
        await client.executeNgql(`USE ${spaceName}`);

        console.log(`✅ 图空间 ${spaceName} 创建并切换成功`);
        success = true;
        break;
      } catch (error) {
        console.error(`创建并切换尝试 ${attempt + 1} 失败:`, error);

        // 如果是最后一次尝试，抛出错误
        if (attempt === 2) {
          throw error;
        }

        // 等待一段时间后重试
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!success) {
      throw new Error(`无法创建并切换到图空间 ${spaceName}`);
    }

    console.log(`✅ 图空间 ${spaceName} 重建完成，等待 buildGraph 创建 Schema`);
  } catch (error) {
    console.error(`❌ 删除并重新创建图空间 ${spaceName} 失败:`, error);
    throw error;
  }
}
/**
 * @description 函数: buildGraphFromFile
 */

export async function buildGraphFromFile(
  entitiesFilePath: string,
  client: NebulaClient,
  flows?: FlowEntity[]
): Promise<void> {
  const preparedData = await prepareDataFromFile(entitiesFilePath);
  await buildGraph(preparedData.files, preparedData.entities, flows, client);
}
