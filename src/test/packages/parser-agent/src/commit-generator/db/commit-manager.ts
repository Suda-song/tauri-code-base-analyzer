import { Op } from "sequelize";
import { CommitDB } from "./index";
import { CommitDBConfig } from "./config";
import { EntityMatcher } from "../utils/entity-matcher";
import { BaseEntity } from "../../enrichment/interfaces";
import { CommitRecordModel, CommitRecordAttributes } from "../models/commit-record";
import { CommitEntityIndexModel } from "../models/commit-entity-index";

export interface CommitRecordData {
  commitHash: string;
  branchName: string;
  authorEmail: string;
  authorName: string;
  commitSummary: string;
  commitType: string;
  commitVersion: string;
  commitWorkspaceName: string;
  commitEntities: string[];
  commitAt: string;
  filesChanged: string[];
  codeLinesAdded: number;
  codeLinesDeleted: number;
  linkedDocsUrls?: string[];
  linkedContext?: string;
  entities?: BaseEntity[];
  parsedDiff?: any;
  entityWorkspaceMapping?: Map<string, string>; // 实体ID到工作区名称的映射
  
  // 文件级采纳率统计字段
  totalFiles?: number;
  includeAiCodeFiles?: number;
  aiCodeFiles?: number;
  fileAcceptanceRate?: number;
  
  // 代码行级采纳率统计字段
  totalCodeLines?: number;
  includeAiCodeLines?: number;
  aiCodeLines?: number;
  codeAcceptanceRate?: number;
  
  // 其他字段
  lastCommitHash?: string;
}

/**
 * Commit管理器 - 统一的API
 * 整合了数据库操作和便捷接口
 */
export class CommitManager {
  private static isInitialized: boolean = false;
  
  // 提供静态方法检查是否初始化
  public static isInitializedCheck(): boolean {
    return CommitManager.isInitialized;
  }

  /**
   * 初始化管理器和数据库连接
   */
  static async initialize(): Promise<void> {
    if (CommitManager.isInitialized) {
      return;
    }

    console.log("🚀 初始化CommitManager...");

    // 获取数据库配置并初始化连接
    const { config, debug } = CommitDBConfig.getInitConfig();
    await CommitDB.initDB(config, debug);

    CommitManager.isInitialized = true;
    console.log("✅ CommitManager初始化完成", config, debug);
  }

  /**
   * 保存commit记录
   */
  static async saveCommitRecord(data: CommitRecordData): Promise<string> {
    if (!CommitManager.isInitialized) {
      await CommitManager.initialize();
    }

    console.log(`💾 保存commit记录: ${data.commitHash}`);
    console.log("🚀🚀🚀 ~ CommitManager ~ saveCommitRecord ~ data=====>", JSON.stringify(data,null,2))

    const transaction = await CommitDB.sequelize.transaction();

    try {
      // 1. 保存主记录
      await CommitRecordModel.upsert(
        {
          commitHash: data.commitHash,
          branchName: data.branchName,
          authorEmail: data.authorEmail,
          authorName: data.authorName,
          commitSummary: data.commitSummary,
          commitType: data.commitType,
          commitVersion: data.commitVersion,
          commitWorkspaceName: data.commitWorkspaceName || 'unknown',
          commitEntities: JSON.stringify(data.commitEntities || []),
          commitAt: new Date(data.commitAt),
          filesChanged: JSON.stringify(data.filesChanged),
          codeLinesAdded: data.codeLinesAdded,
          codeLinesDeleted: data.codeLinesDeleted,
          linkedDocsUrls: JSON.stringify(data.linkedDocsUrls || []),
          linkedContext: data.linkedContext || "",
          
          // 文件级采纳率统计字段
          totalFiles: data.totalFiles || 0,
          includeAiCodeFiles: data.includeAiCodeFiles || 0,
          aiCodeFiles: data.aiCodeFiles || 0,
          fileAcceptanceRate: data.fileAcceptanceRate || 0,
          
          // 代码行级采纳率统计字段
          totalCodeLines: data.totalCodeLines || 0,
          includeAiCodeLines: data.includeAiCodeLines || 0,
          aiCodeLines: data.aiCodeLines || 0,
          codeAcceptanceRate: data.codeAcceptanceRate || 0,
          
          // 其他字段
          lastCommitHash: data.lastCommitHash || "",
        } as Partial<CommitRecordAttributes>,
        { transaction }
      );

      // 2. 删除旧的实体索引记录
      await CommitEntityIndexModel.destroy({
        where: { commitHash: data.commitHash },
        transaction,
      });

      // 3. 插入新的实体索引记录
      if (data.entities && data.entities.length > 0) {
        const entityIndexRecords = data.entities.map((entity) => {
          // 根据实体ID或文件路径匹配正确的工作区名称
          let entityWorkspaceName = data.commitWorkspaceName; // 默认值

          if (
            data.entityWorkspaceMapping &&
            data.entityWorkspaceMapping.has(entity.id)
          ) {
            entityWorkspaceName = data.entityWorkspaceMapping.get(entity.id)!;
          }

          console.log(
            `🏷️ 实体 ${entity.id} (${entity.rawName}) -> 工作区: ${entityWorkspaceName}`
          );

          return {
            entityId: entity.id,
            commitHash: data.commitHash,
            entityType: entity.type,
            entityName: entity.rawName,
            filePath: entity.file,
            branchName: data.branchName,
            workspaceName: entityWorkspaceName, // 使用匹配到的具体工作区名称
            relatedChanges: CommitManager.extractRelatedChanges(
              entity,
              data.parsedDiff
            ),
          };
        });

        // 使用upsert处理复合主键冲突
        for (const record of entityIndexRecords) {
          await CommitEntityIndexModel.upsert(record as Partial<CommitEntityIndexModel>, {
            transaction,
          });
        }
      }

      await transaction.commit();
      console.log(`✅ commit记录保存成功: ${data.commitHash}`);
      return data.commitHash;
    } catch (error) {
      await transaction.rollback();
      console.error(`❌ commit记录保存失败: ${data.commitHash}`, error);
      throw new Error(`保存commit记录失败: ${error}`);
    }
  }

  /**
   * 查询实体的变更记录
   */
  static async getEntitiesCommitHistory(
    entityIds: string[],
    options: {
      groupBy?: "commit_hash" | "entity_id" | "none";
      orderBy?: OrderByField;
      orderDirection?: OrderDirection;
      where?: WhereConditions;
    } = {}
  ): Promise<Record<string, any[]>> {
    if (!entityIds || entityIds.length === 0) {
      return {};
    }

    if (!CommitManager.isInitialized) {
      await CommitManager.initialize();
    }

    const {
      groupBy = "commit_hash",
      orderBy = "commitAt",
      orderDirection = "DESC",
      where = {},
    } = options;

    console.log(`🔍 查询 ${entityIds.length} 个实体的变更记录...`);

    // 构建查询条件
    const whereClause: any = {
      entityId: { [Op.in]: entityIds },
    };

    // 处理额外的where条件
    if (where.branchName) {
      whereClause.branchName = where.branchName;
    }
    if (where.entityType) {
      whereClause.entityType = where.entityType;
    }
    if (where.entityName) {
      whereClause.entityName = where.entityName;
    }
    if (where.filePath) {
      whereClause.filePath = { [Op.like]: `%${where.filePath}%` };
    }
    if (where.workspaceName) {
      whereClause.workspaceName = where.workspaceName;
    }

    // 构建include的where条件（针对CommitRecord字段）
    const commitRecordWhere: any = {};
    if (where.authorEmail) {
      commitRecordWhere.authorEmail = where.authorEmail;
    }
    if (where.authorName) {
      commitRecordWhere.authorName = where.authorName;
    }
    if (where.commitType) {
      commitRecordWhere.commitType = where.commitType;
    }
    if (where.commitWorkspaceName) {
      commitRecordWhere.commitWorkspaceName = where.commitWorkspaceName;
    }

    // 构建排序条件
    let orderClause: any[];
    if (orderBy === "commitAt" || orderBy === "createdAt") {
      orderClause = [["commitRecord", orderBy, orderDirection]];
    } else {
      orderClause = [[orderBy, orderDirection]];
    }

    // 查询实体索引和关联的commit记录
    const records = await CommitEntityIndexModel.findAll({
      where: whereClause,
      include: [
        {
          model: CommitRecordModel,
          required: true,
          where:
            Object.keys(commitRecordWhere).length > 0
              ? commitRecordWhere
              : undefined,
        },
      ],
      order: orderClause,
    });

    console.log(`📊 查询到 ${records.length} 条记录`);

    // 转换数据格式
    const rawResult: Record<string, any[]> = {};
    entityIds.forEach((id) => {
      rawResult[id] = [];
    });

    records.forEach((record) => {
      const commitRecord = record.commitRecord;
      const entityData = {
        commit_hash: record.commitHash,
        branch_name: record.branchName,
        author_email: commitRecord.authorEmail,
        author_name: commitRecord.authorName,
        commit_summary: commitRecord.commitSummary,
        commit_type: commitRecord.commitType,
        commit_version: commitRecord.commitVersion,
        commit_workspace_name: commitRecord.commitWorkspaceName,
        commit_at: commitRecord.commitAt,
        code_lines_added: commitRecord.codeLinesAdded,
        code_lines_deleted: commitRecord.codeLinesDeleted,
        linked_docs_urls: commitRecord.linkedDocsUrls,
        linked_context: commitRecord.linkedContext,
        entity_id: record.entityId,
        entity_type: record.entityType,
        entity_name: record.entityName,
        entity_file_path: record.filePath,
        entity_workspace_name: record.workspaceName,
        entity_related_changes: record.relatedChanges,
        entity_index_created_at: record.createdAt,
      };

      if (rawResult[record.entityId]) {
        rawResult[record.entityId].push(entityData);
      }
    });

    // 根据groupBy参数处理结果
    const result = CommitManager.processGroupByResult(rawResult, groupBy);

    const totalRecords = Object.values(result).reduce(
      (sum: number, records: any[]) => sum + records.length,
      0
    );
    const entitiesWithRecords = Object.keys(result).filter(
      (id) => result[id].length > 0
    ).length;

    console.log(
      `✅ 查询完成: ${entitiesWithRecords}/${entityIds.length} 个实体有变更记录，共 ${totalRecords} 条记录`
    );

    return result;
  }

  /**
   * 关闭数据库连接
   */
  static async close(): Promise<void> {
    if (CommitDB.sequelize) {
      await CommitDB.close();
      CommitManager.isInitialized = false;
    }
  }

  /**
   * 提取实体相关的变更内容
   * 根据实体的位置信息和变更行号范围进行精确匹配
   */
  private static extractRelatedChanges(
    entity: BaseEntity,
    parsedDiff?: any
  ): string {
    if (!parsedDiff || !parsedDiff.files) {
      return "";
    }

    const relatedDiffContents: string[] = [];

    for (const [filePath, fileInfo] of Object.entries(parsedDiff.files) as [
      string,
      any
    ][]) {
      if (
        filePath.endsWith(entity.file) ||
        filePath.includes(`/${entity.file}`)
      ) {
        if (fileInfo.diffContent) {
          // 使用EntityMatcher中的方法来解析变更范围并判断实体是否相关
          const changeRanges = EntityMatcher.parseDiffToChangeRanges(
            fileInfo.diffContent
          );

          // 检查实体是否在变更范围内
          if (
            changeRanges.length === 0 ||
            EntityMatcher.checkEntityInChangedRange(entity, changeRanges)
          ) {
            // 提取与实体相关的diff片段
            const entityRelatedDiff =
              EntityMatcher.extractEntityRelatedDiffSegments(
                entity,
                fileInfo.diffContent
              );
            if (entityRelatedDiff) {
              relatedDiffContents.push(entityRelatedDiff);
            }
          }
        }
      }
    }

    return relatedDiffContents.join("\n\n");
  }

  /**
   * 根据groupBy参数处理查询结果
   */
  private static processGroupByResult(
    rawResult: Record<string, any[]>,
    groupBy: "commit_hash" | "entity_id" | "none"
  ): Record<string, any[]> {
    if (groupBy === "none") {
      return rawResult;
    }

    const processedResult: Record<string, any[]> = {};

    Object.keys(rawResult).forEach((entityId) => {
      processedResult[entityId] = [];
    });

    Object.entries(rawResult).forEach(([entityId, records]) => {
      if (groupBy === "commit_hash") {
        // 按commit_hash分组合并
        const groupedByCommit = new Map<string, any>();

        records.forEach((record) => {
          const commitHash = record.commit_hash;
          if (!groupedByCommit.has(commitHash)) {
            groupedByCommit.set(commitHash, {
              ...record,
              related_entities: [record.entity_id],
              entity_details: [
                {
                  entity_id: record.entity_id,
                  entity_type: record.entity_type,
                  entity_name: record.entity_name,
                  entity_file_path: record.entity_file_path,
                  entity_related_changes: record.entity_related_changes,
                },
              ],
            });
          } else {
            const existing = groupedByCommit.get(commitHash);
            if (!existing.related_entities.includes(record.entity_id)) {
              existing.related_entities.push(record.entity_id);
              existing.entity_details.push({
                entity_id: record.entity_id,
                entity_type: record.entity_type,
                entity_name: record.entity_name,
                entity_file_path: record.entity_file_path,
                entity_related_changes: record.entity_related_changes,
              });
            }
          }
        });

        processedResult[entityId] = Array.from(groupedByCommit.values());
      } else if (groupBy === "entity_id") {
        processedResult[entityId] = records;
      }
    });

    return processedResult;
  }
}

/**
 * 便捷函数：保存commit记录
 */
export async function saveCommitRecord(
  data: CommitRecordData
): Promise<string> {
  return await CommitManager.saveCommitRecord(data);
}

/**
 * 便捷函数：查询实体变更历史
 */
export async function getEntitiesCommitHistory(
  entityIds: string[],
  groupBy: "commit_hash" | "entity_id" | "none" = "commit_hash",
  orderBy?: OrderByField,
  orderDirection?: OrderDirection,
  where?: WhereConditions
): Promise<Record<string, any[]>> {
  return await CommitManager.getEntitiesCommitHistory(entityIds, {
    groupBy,
    orderBy,
    orderDirection,
    where,
  });
}

export { CommitDB, CommitDBConfig };
export type OrderByField = "commitAt" | "createdAt" | "entityId" | "commitHash";
export type OrderDirection = "ASC" | "DESC";
export type WhereConditions = Partial<
  Pick<
    CommitRecordData,
    | "branchName"
    | "authorEmail"
    | "authorName"
    | "commitType"
    | "commitWorkspaceName"
  > &
    Pick<
      CommitEntityIndexModel,
      "entityType" | "entityName" | "filePath" | "workspaceName"
    >
>;
