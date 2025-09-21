/**
 * SQLite数据库管理工具类（支持多workspace）
 */
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { BaseEntity } from "../../enrichment/interfaces";
import { WorkspaceManager, WorkspaceContext } from "./workspace-manager";

export interface WorkspaceDatabaseInfo {
  workspace: WorkspaceContext;
  dbManager: DatabaseManager;
  dbPath: string;
}

export class DatabaseManager {
  private currentBranch: string;
  private isInitialized: boolean = false;
  private workspaceManager: WorkspaceManager;
  private workspaceDbs: Map<string, Database> = new Map();

  constructor(workspaceManager: WorkspaceManager, branch?: string) {
    this.currentBranch = branch || "main";
    this.workspaceManager = workspaceManager;

    console.log(`💾 DatabaseManager初始化 - 多工作区模式`);
  }

  /**
   * 生成workspace特定的数据库文件路径
   */
  private generateWorkspaceDBPath(
    workspacePath: string,
    branch: string
  ): string {
    // 清理分支名，移除特殊字符
    const cleanBranch = branch.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dbFileName = `commits_${cleanBranch}.commit.db`;
    return path.join(workspacePath, "data", dbFileName);
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.initializeWorkspaceDatabases();
    this.isInitialized = true;
  }

  /**
   * 初始化所有workspace数据库
   */
  private async initializeWorkspaceDatabases(): Promise<void> {
    // 确保WorkspaceManager已初始化
    if (!this.workspaceManager.initialized) {
      await this.workspaceManager.initialize();
    }

    const workspaces = this.workspaceManager.getActiveWorkspaces();

    console.log(`💾 初始化 ${workspaces.length} 个workspace的数据库...`);

    for (const workspace of workspaces) {
      // 为每个workspace创建数据库连接
      const workspaceDbPath = this.generateWorkspaceDBPath(
        workspace.rootPath,
        this.currentBranch
      );

      // 确保数据目录存在
      const dataDir = path.dirname(workspaceDbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // 打开数据库连接
      const workspaceDb = await open({
        filename: workspaceDbPath,
        driver: sqlite3.Database,
      });

      // 创建表结构
      await this.createTablesForDatabase(workspaceDb);

      this.workspaceDbs.set(workspace.rootPath, workspaceDb);

      console.log(
        `📦 workspace ${workspace.name} 数据库初始化完成: ${workspaceDbPath}`
      );
    }

    console.log(
      `✅ workspace数据库初始化完成，共 ${this.workspaceDbs.size} 个数据库`
    );
  }

  /**
   * 检查是否已初始化
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * 创建数据库表结构
   */
  private async createTablesForDatabase(database: Database): Promise<void> {
    // 主表：commit_records
    await database.exec(`
      CREATE TABLE IF NOT EXISTS commit_records (
        commit_hash TEXT PRIMARY KEY,                    -- commit 唯一标识 (hash)
        branch_name TEXT NOT NULL,                       -- 迭代分支名称  
        author_email TEXT DEFAULT '',                    -- 开发者唯一标识
        author_name TEXT DEFAULT '',                     -- 开发者姓名
        commit_summary TEXT NOT NULL,                    -- 智能生成的 commit summary
        commit_type TEXT DEFAULT 'feat',                 -- 类型（feat/fix/refactor/docs等）
        commit_version TEXT DEFAULT '',                  -- commit提交时workspace下package.json的version
        commit_project_name TEXT DEFAULT '',             -- commit提交时workspace下package.json的name
        commit_entities TEXT DEFAULT '[]',               -- 涉及的实体id列表 (JSON)
        commit_at TEXT NOT NULL,                         -- commit 时间 (ISO string)
        files_changed TEXT DEFAULT '[]',                 -- 本次改动的文件路径列表 (JSON)
        diff_summary TEXT DEFAULT '',                    -- Diff 摘要描述
        diff_content TEXT DEFAULT '',                    -- Diff 原始内容 
        code_lines_added INTEGER DEFAULT 0,             -- 新增代码行数
        code_lines_deleted INTEGER DEFAULT 0,           -- 删除代码行数
        linked_docs_urls TEXT DEFAULT '[]',             -- 关联文档（如设计文档）的URL列表 (JSON)
        linked_context TEXT DEFAULT '',                 -- 关联的上下文信息（一个大的md？）
        created_at TEXT DEFAULT CURRENT_TIMESTAMP       -- 记录创建时间
      )
    `);

    // 实体索引表：用于根据实体ID快速查询
    await database.exec(`
      CREATE TABLE IF NOT EXISTS commit_entity_index (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        commit_hash TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        branch_name TEXT NOT NULL,
        project_name TEXT DEFAULT '',                   -- 项目名称
        related_changes TEXT DEFAULT '{}',              -- 相关变更内容 (JSON格式)
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (commit_hash) REFERENCES commit_records(commit_hash)
      )
    `);

    // 创建索引
    await this.createIndexesForDatabase(database);
  }

  /**
   * 为指定数据库创建索引
   */
  private async createIndexesForDatabase(database: Database): Promise<void> {
    const indexes = [
      // 主表索引
      "CREATE INDEX IF NOT EXISTS idx_commit_records_commit_hash ON commit_records(commit_hash)",
      "CREATE INDEX IF NOT EXISTS idx_commit_records_commit_at ON commit_records(commit_at)",
      "CREATE INDEX IF NOT EXISTS idx_commit_records_branch ON commit_records(branch_name)",
      "CREATE INDEX IF NOT EXISTS idx_commit_records_author ON commit_records(author_email)",
      "CREATE INDEX IF NOT EXISTS idx_commit_records_type ON commit_records(commit_type)",
      "CREATE INDEX IF NOT EXISTS idx_commit_records_project_name ON commit_records(commit_project_name)",

      // 实体索引表索引
      "CREATE INDEX IF NOT EXISTS idx_commit_entity_index_entity_id ON commit_entity_index(entity_id)",
      "CREATE INDEX IF NOT EXISTS idx_commit_entity_index_commit_hash ON commit_entity_index(commit_hash)",
      "CREATE INDEX IF NOT EXISTS idx_commit_entity_index_entity_type ON commit_entity_index(entity_type)",
      "CREATE INDEX IF NOT EXISTS idx_commit_entity_index_branch ON commit_entity_index(branch_name)",
      "CREATE INDEX IF NOT EXISTS idx_commit_entity_index_file_path ON commit_entity_index(file_path)",
      "CREATE INDEX IF NOT EXISTS idx_commit_entity_index_project_name ON commit_entity_index(project_name)",
    ];

    for (const indexSql of indexes) {
      await database.exec(indexSql);
    }
  }

  /**
   * 保存提交记录到所有相关的workspace数据库
   */
  async saveCommitRecord(data: {
    commitHash: string;
    branchName: string;
    authorEmail: string;
    authorName: string;
    commitSummary: string;
    commitType: string;
    commitVersion: string;
    commitProjectName: string;
    commitEntities: string[];
    commitAt: string;
    filesChanged: string[];
    diffSummary?: string;
    diffContent?: string;
    parsedDiff?: any; // 新增：结构化diff数据
    codeLinesAdded: number;
    codeLinesDeleted: number;
    linkedDocsUrls?: string[];
    linkedContext?: string;
    entities?: BaseEntity[];
  }): Promise<string> {
    if (!this.workspaceManager) {
      throw new Error("WorkspaceManager未初始化");
    }

    // 获取涉及的workspace
    const affectedWorkspaces =
      await this.workspaceManager.buildContextsForFiles(data.filesChanged);

    console.log(
      `💾 提交记录涉及 ${affectedWorkspaces.length} 个workspace，开始保存...`
    );

    const saveResults: string[] = [];

    for (const workspace of affectedWorkspaces) {
      const workspaceDb = this.workspaceDbs.get(workspace.rootPath);
      if (!workspaceDb) {
        console.warn(
          `⚠️  workspace ${workspace.name} 的数据库连接未找到，跳过保存`
        );
        continue;
      }

      // 过滤出属于当前workspace的文件和实体
      const workspaceFiles = data.filesChanged.filter((file) =>
        WorkspaceManager.isFileInWorkspace(file, workspace)
      );

      // 过滤实体：检查workspaceFiles中是否有文件包含实体的file路径
      const workspaceEntities = (data.entities || []).filter((entity) =>
        workspaceFiles.some(
          (file) =>
            file.endsWith(entity.file) || file.includes(`/${entity.file}`)
        )
      );

      if (workspaceFiles.length === 0 && workspaceEntities.length === 0) {
        continue;
      }

      console.log("workspace文件", workspaceFiles);
      console.log("workspace实体", workspaceEntities);

      // 构造workspace特定的数据
      const workspaceData = {
        ...data,
        filesChanged: workspaceFiles,
        entities: workspaceEntities,
        commitEntities: workspaceEntities.map((e) => e.id),
      };

      try {
        const result = await this.saveCommitRecordToDatabase(
          workspaceDb,
          workspaceData
        );
        saveResults.push(result);
        console.log(`📦 workspace ${workspace.name} 提交记录保存成功`);
      } catch (error) {
        console.error(
          `❌ workspace ${workspace.name} 提交记录保存失败:`,
          error
        );
      }
    }

    console.log(
      `✅ workspace提交记录保存完成，成功保存到 ${saveResults.length}/${affectedWorkspaces.length} 个workspace`
    );
    return data.commitHash;
  }

  /**
   * 保存提交记录到指定数据库
   */
  private async saveCommitRecordToDatabase(
    database: Database,
    data: {
      commitHash: string;
      branchName: string;
      authorEmail: string;
      authorName: string;
      commitSummary: string;
      commitType: string;
      commitVersion: string;
      commitProjectName: string;
      commitEntities: string[];
      commitAt: string;
      filesChanged: string[];
      diffSummary?: string;
      diffContent?: string;
      parsedDiff?: any; // 新增：结构化diff数据
      codeLinesAdded: number;
      codeLinesDeleted: number;
      linkedDocsUrls?: string[];
      linkedContext?: string;
      entities?: BaseEntity[];
    }
  ): Promise<string> {
    await database.run("BEGIN TRANSACTION");

    try {
      // 插入主记录
      await database.run(
        `INSERT OR REPLACE INTO commit_records (
          commit_hash, branch_name, author_email, author_name, commit_summary,
          commit_type, commit_version, commit_project_name, commit_entities, commit_at, files_changed,
          diff_summary, diff_content, code_lines_added, code_lines_deleted,
          linked_docs_urls, linked_context
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.commitHash,
          data.branchName,
          data.authorEmail,
          data.authorName,
          data.commitSummary,
          data.commitType,
          data.commitVersion,
          data.commitProjectName,
          JSON.stringify(data.commitEntities),
          data.commitAt,
          JSON.stringify(data.filesChanged),
          data.diffSummary || "",
          data.diffContent || "", // 原始diff内容
          data.codeLinesAdded,
          data.codeLinesDeleted,
          JSON.stringify(data.linkedDocsUrls || []),
          data.linkedContext || "",
        ]
      );

      // 删除旧的实体索引记录
      await database.run(
        `DELETE FROM commit_entity_index WHERE commit_hash = ?`,
        [data.commitHash]
      );

      // 插入实体索引记录
      if (data.entities && data.entities.length > 0) {
        for (const entity of data.entities) {
          // 为每个实体查找相关的变更内容（返回字符串）
          const relatedChanges = this.extractRelatedChanges(
            entity,
            data.parsedDiff
          );

          await database.run(
            `INSERT INTO commit_entity_index (
              id, entity_id, commit_hash, entity_type, entity_name, file_path, branch_name, project_name, related_changes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              this.generateId(),
              entity.id,
              data.commitHash,
              entity.type,
              entity.rawName,
              entity.file,
              data.branchName,
              data.commitProjectName,
              relatedChanges,
            ]
          );
        }
      }

      await database.run("COMMIT");
      return data.commitHash;
    } catch (error) {
      await database.run("ROLLBACK");
      throw new Error(`💥 数据库操作失败: ${error}`);
    }
  }

  /**
   * 提取实体相关的变更内容
   */
  private extractRelatedChanges(entity: BaseEntity, parsedDiff?: any): string {
    if (!parsedDiff || !parsedDiff.files) {
      return "";
    }

    // 查找与实体文件相关的变更，合并所有相关文件的diff内容
    const relatedDiffContents: string[] = [];

    for (const [filePath, fileInfo] of Object.entries(parsedDiff.files) as [
      string,
      any
    ][]) {
      // 检查文件路径是否与实体相关
      if (
        filePath.endsWith(entity.file) ||
        filePath.includes(`/${entity.file}`)
      ) {
        if (fileInfo.diffContent) {
          relatedDiffContents.push(fileInfo.diffContent);
        }
      }
    }

    // 将所有相关的diff内容合并成一个字符串
    return relatedDiffContents.join("\n\n");
  }

  /**
   * 批量查询多个实体ID的相关变更记录
   * @param entityIds 实体ID数组
   * @param branch 可选的分支名称
   * @returns 对象，实体ID作为key，value是该实体的变更记录数组
   */
  async getCommitsByEntityIds(
    entityIds: string[],
    branch?: string
  ): Promise<Record<string, any[]>> {
    if (!entityIds || entityIds.length === 0) {
      return {};
    }

    // 获取所有workspace的数据库
    const result: Record<string, any[]> = {};

    // 初始化结果对象
    entityIds.forEach((id) => {
      result[id] = [];
    });

    // 查询所有workspace数据库
    for (const [workspacePath, workspaceDb] of this.workspaceDbs.entries()) {
      try {
        const records = await this.getCommitsByEntityIdsFromDatabase(
          workspaceDb,
          entityIds,
          branch
        );
        this.mergeCommitRecords(result, records);
      } catch (error) {
        console.warn(`查询workspace ${workspacePath} 数据库失败:`, error);
      }
    }

    // 对每个实体的记录按时间排序
    Object.keys(result).forEach((entityId) => {
      result[entityId].sort(
        (a, b) =>
          new Date(b.commit_at).getTime() - new Date(a.commit_at).getTime()
      );
    });

    return result;
  }

  /**
   * 从指定数据库查询多个实体的变更记录
   */
  private async getCommitsByEntityIdsFromDatabase(
    database: Database,
    entityIds: string[],
    branch?: string
  ): Promise<any[]> {
    const placeholders = entityIds.map(() => "?").join(",");
    let whereClause = `WHERE ei.entity_id IN (${placeholders})`;
    let params: any[] = [...entityIds];

    if (branch) {
      whereClause += " AND ei.branch_name = ?";
      params.push(branch);
    }

    return database.all(
      `SELECT 
         cr.commit_hash,
         cr.branch_name,
         cr.author_email,
         cr.author_name,
         cr.commit_summary,
         cr.commit_type,
         cr.commit_version,
         cr.commit_project_name,
         cr.commit_at,
         cr.code_lines_added,
         cr.code_lines_deleted,
         cr.linked_docs_urls,
         cr.linked_context,
         ei.entity_id,
         ei.entity_type,
         ei.entity_name,
         ei.file_path as entity_file_path,
         ei.project_name as entity_project_name,
         ei.related_changes as entity_related_changes,
         ei.created_at as entity_index_created_at
       FROM commit_records cr
       INNER JOIN commit_entity_index ei ON cr.commit_hash = ei.commit_hash
       ${whereClause}
       ORDER BY cr.commit_at DESC`,
      params
    );
  }

  /**
   * 合并查询结果到结果对象中
   */
  private mergeCommitRecords(
    result: Record<string, any[]>,
    records: any[]
  ): void {
    records.forEach((record) => {
      const entityId = record.entity_id;
      if (result[entityId]) {
        // 检查是否已存在相同的commit记录（避免重复）
        const existingCommit = result[entityId].find(
          (existing) => existing.commit_hash === record.commit_hash
        );

        if (!existingCommit) {
          result[entityId].push(record);
        }
      }
    });
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * 获取当前分支
   */
  getCurrentBranch(): string {
    return this.currentBranch;
  }

  /**
   * 查询所有分支数据库中的实体变更记录
   * @param workspaceManager workspace管理器
   * @param entityIds 实体ID数组
   * @returns 对象，实体ID作为key，value是该实体的变更记录数组
   */
  static async queryAllBranchDatabases(
    workspaceManager: WorkspaceManager,
    entityIds: string[]
  ): Promise<Record<string, any[]>> {
    if (!entityIds || entityIds.length === 0) {
      return {};
    }

    // 确保WorkspaceManager已初始化
    if (!workspaceManager.initialized) {
      await workspaceManager.initialize();
    }

    const workspaces = workspaceManager.getActiveWorkspaces();
    const result: Record<string, any[]> = {};

    // 初始化结果对象
    entityIds.forEach((id) => {
      result[id] = [];
    });

    console.log(`🔍 扫描 ${workspaces.length} 个workspace的所有分支数据库...`);

    for (const workspace of workspaces) {
      const dataDir = path.join(workspace.rootPath, "data");

      if (!fs.existsSync(dataDir)) {
        console.log(`💡 workspace ${workspace.name} 没有data目录，跳过`);
        continue;
      }

      // 查找所有的数据库文件 (commits_*.commit.db)
      const dbFiles = fs
        .readdirSync(dataDir)
        .filter(
          (file) => file.startsWith("commits_") && file.endsWith(".commit.db")
        );

      console.log(
        `📂 workspace ${workspace.name} 发现 ${
          dbFiles.length
        } 个分支数据库: ${dbFiles.join(", ")}`
      );

      for (const dbFile of dbFiles) {
        const dbPath = path.join(dataDir, dbFile);
        const branchName = dbFile
          .replace("commits_", "")
          .replace(".commit.db", "");

        try {
          console.log(`🔎 查询数据库: ${dbFile} (分支: ${branchName})`);

          // 打开数据库连接
          const database = await open({
            filename: dbPath,
            driver: sqlite3.Database,
          });

          // 查询实体记录
          const records = await DatabaseManager.queryEntityRecordsFromDatabase(
            database,
            entityIds
          );

          console.log(`📊 从 ${dbFile} 查询到 ${records.length} 条记录`);

          // 合并结果
          DatabaseManager.mergeCommitRecordsStatic(result, records);

          // 关闭数据库连接
          await database.close();
        } catch (error) {
          console.warn(`⚠️ 查询数据库 ${dbFile} 失败:`, error);
        }
      }
    }

    // 对每个实体的记录按时间排序
    Object.keys(result).forEach((entityId) => {
      result[entityId].sort(
        (a, b) =>
          new Date(b.commit_at).getTime() - new Date(a.commit_at).getTime()
      );
    });

    return result;
  }

  /**
   * 从指定数据库查询实体记录（静态方法）
   */
  private static async queryEntityRecordsFromDatabase(
    database: Database,
    entityIds: string[]
  ): Promise<any[]> {
    const placeholders = entityIds.map(() => "?").join(",");
    const whereClause = `WHERE ei.entity_id IN (${placeholders})`;

    return database.all(
      `SELECT 
         cr.commit_hash,
         cr.branch_name,
         cr.author_email,
         cr.author_name,
         cr.commit_summary,
         cr.commit_type,
         cr.commit_version,
         cr.commit_project_name,
         cr.commit_at,
         cr.code_lines_added,
         cr.code_lines_deleted,
         cr.linked_docs_urls,
         cr.linked_context,
         ei.entity_id,
         ei.entity_type,
         ei.entity_name,
         ei.file_path as entity_file_path,
         ei.project_name as entity_project_name,
         ei.related_changes as entity_related_changes,
         ei.created_at as entity_index_created_at
       FROM commit_records cr
       INNER JOIN commit_entity_index ei ON cr.commit_hash = ei.commit_hash
       ${whereClause}
       ORDER BY cr.commit_at DESC`,
      entityIds
    );
  }

  /**
   * 合并查询结果到结果对象中（静态方法）
   */
  private static mergeCommitRecordsStatic(
    result: Record<string, any[]>,
    records: any[]
  ): void {
    records.forEach((record) => {
      const entityId = record.entity_id;
      if (result[entityId]) {
        // 检查是否已存在相同的commit记录（避免重复）
        const existingCommit = result[entityId].find(
          (existing) => existing.commit_hash === record.commit_hash
        );

        if (!existingCommit) {
          result[entityId].push(record);
        }
      }
    });
  }

  /**
   * 获取workspace数据库信息
   */
  getWorkspaceDatabases(): WorkspaceDatabaseInfo[] {
    const result: WorkspaceDatabaseInfo[] = [];

    for (const [workspacePath, db] of this.workspaceDbs.entries()) {
      const workspace = this.workspaceManager
        .getActiveWorkspaces()
        .find((ws) => ws.rootPath === workspacePath);

      if (workspace) {
        const dbPath = this.generateWorkspaceDBPath(
          workspacePath,
          this.currentBranch
        );
        result.push({
          workspace,
          dbManager: this,
          dbPath,
        });
      }
    }

    return result;
  }

  /**
   * 关闭所有数据库连接
   */
  async close(): Promise<void> {
    console.log(`💾 关闭 ${this.workspaceDbs.size} 个workspace数据库连接...`);

    for (const [workspacePath, db] of this.workspaceDbs.entries()) {
      try {
        await db.close();
        console.log(`📦 关闭workspace数据库: ${workspacePath}`);
      } catch (error) {
        console.warn(`⚠️ 关闭workspace数据库失败 ${workspacePath}:`, error);
      }
    }

    this.workspaceDbs.clear();
    this.isInitialized = false;
    console.log(`✅ 所有workspace数据库连接已关闭`);
  }
}
