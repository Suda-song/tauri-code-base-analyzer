import {
  Model,
  Table,
  Column,
  AllowNull,
  Comment,
  AutoIncrement,
  PrimaryKey,
  CreatedAt,
  UpdatedAt,
  Default,
  DataType,
  Index,
} from "sequelize-typescript";

// 定义模型属性接口
export interface CommitRecordAttributes {
  createdAt: Date;
  updatedAt: Date;
  commitHash: string;
  branchName: string;
  authorEmail: string;
  authorName: string;
  commitSummary: string;
  commitType: string;
  commitVersion: string;
  commitWorkspaceName: string;
  commitEntities: string;
  commitAt: Date;
  filesChanged: string;
  codeLinesAdded: number;
  codeLinesDeleted: number;
  linkedDocsUrls: string;
  linkedContext: string;
  totalFiles: number;
  includeAiCodeFiles: number;
  aiCodeFiles: number;
  fileAcceptanceRate: number;
  totalCodeLines: number;
  includeAiCodeLines: number;
  aiCodeLines: number;
  codeAcceptanceRate: number;
  lastCommitHash: string;
}

// 定义创建时的必需属性
export interface CommitRecordCreationAttributes extends Partial<CommitRecordAttributes> {
  commitHash: string; // 主键，必需
}

@Table({
  tableName: "commit_records",
  freezeTableName: true,
  indexes: [
    { fields: ["commit_hash"] },
    { fields: ["branch_name"] },
    { fields: ["author_email"] },
    { fields: ["commit_type"] },
    { fields: ["commit_workspace_name"] },
    { fields: ["commit_at"] },
  ],
})
export class CommitRecordModel extends Model<CommitRecordAttributes, CommitRecordCreationAttributes> {
  @CreatedAt
  @Comment("记录创建时间")
  @AllowNull(false)
  @Column({
    field: "created_at",
  })
  createdAt: Date = new Date();

  @UpdatedAt
  @Comment("记录更新时间")
  @AllowNull(false)
  @Column({
    field: "updated_at",
  })
  updatedAt: Date = new Date();

  @Comment("commit哈希值，主键")
  @AllowNull(false)
  @PrimaryKey
  @Column({
    type: DataType.STRING(40),
    field: "commit_hash",
  })
  commitHash: string;

  @Comment("分支名称")
  @AllowNull(false)
  @Index
  @Column({
    type: DataType.STRING(100),
    field: "branch_name",
  })
  branchName: string;

  @Default("")
  @Comment("开发者邮箱")
  @AllowNull(false)
  @Index
  @Column({
    type: DataType.STRING(100),
    field: "author_email",
  })
  authorEmail: string;

  @Default("")
  @Comment("开发者姓名")
  @AllowNull(false)
  @Column({
    type: DataType.STRING(50),
    field: "author_name",
  })
  authorName: string;

  @Comment("智能生成的commit摘要")
  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
    field: "commit_summary",
  })
  commitSummary: string;

  @Default("feat")
  @Comment("commit类型（feat/fix/refactor/docs等）")
  @AllowNull(false)
  @Index
  @Column({
    type: DataType.STRING(20),
    field: "commit_type",
  })
  commitType: string;

  @Default("")
  @Comment("commit时workspace下package.json的version")
  @AllowNull(false)
  @Column({
    type: DataType.STRING(20),
    field: "commit_version",
  })
  commitVersion: string;

  @Default("")
  @Comment("commit时workspace下package.json的name")
  @AllowNull(false)
  @Index
  @Column({
    type: DataType.STRING(100),
    field: "commit_workspace_name",
  })
  commitWorkspaceName: string;

  @Default("[]")
  @Comment("涉及的实体ID列表（JSON格式）")
  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
    field: "commit_entities",
  })
  commitEntities: string;

  @Comment("commit时间（ISO字符串）")
  @AllowNull(false)
  @Index
  @Column({
    type: DataType.DATE,
    field: "commit_at",
  })
  commitAt: Date = new Date();

  @Default("[]")
  @Comment("本次改动的文件路径列表（JSON格式）")
  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
    field: "files_changed",
  })
  filesChanged: string;

  @Default(0)
  @Comment("新增代码行数")
  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    field: "code_lines_added",
  })
  codeLinesAdded: number;

  @Default(0)
  @Comment("删除代码行数")
  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    field: "code_lines_deleted",
  })
  codeLinesDeleted: number;

  @Default("[]")
  @Comment("关联文档URL列表")
  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
    field: "linked_docs_urls",
  })
  linkedDocsUrls: string;

  @Default("")
  @Comment("关联的上下文信息")
  @AllowNull(false)
  @Column({
    type: DataType.TEXT,
    field: "linked_context",
  })
  linkedContext: string;

  // 文件级统计字段
  @Default(0)
  @Comment("Commit中总变更文件数")
  @Column({
    type: DataType.BIGINT,
    field: "total_files",
  })
  totalFiles: number;

  @Default(0)
  @Comment("Commit中包含AI代码的文件数")
  @Column({
    type: DataType.BIGINT,
    field: "include_ai_code_files",
  })
  includeAiCodeFiles: number;

  @Default(0)
  @Comment("AI变更总文件数")
  @Column({
    type: DataType.BIGINT,
    field: "ai_code_files",
  })
  aiCodeFiles: number;

  @Default(0)
  @Comment("Commit阶段AI代码文件级采纳率百分比")
  @Column({
    type: DataType.DECIMAL(5, 2),
    field: "file_acceptance_rate",
  })
  fileAcceptanceRate: number;

  // 代码行级统计字段
  @Default(0)
  @Comment("Commit中总变更代码行数")
  @Column({
    type: DataType.BIGINT,
    field: "total_code_lines",
  })
  totalCodeLines: number;

  @Default(0)
  @Comment("Commit中被接受的代码行数")
  @Column({
    type: DataType.BIGINT,
    field: "include_ai_code_lines",
  })
  includeAiCodeLines: number;

  @Default(0)
  @Comment("AI变更总代码行数")
  @Column({
    type: DataType.BIGINT,
    field: "ai_code_lines",
  })
  aiCodeLines: number;

  @Default(0)
  @Comment("Commit阶段AI代码级采纳率百分比")
  @Column({
    type: DataType.DECIMAL(5, 2),
    field: "code_acceptance_rate",
  })
  codeAcceptanceRate: number;

  @Default("")
  @Comment("上一次提交的哈希值")
  @Column({
    type: DataType.STRING(64),
    field: "last_commit_hash",
  })
  lastCommitHash: string;
}

export type ICommitRecordModel = typeof CommitRecordModel;
