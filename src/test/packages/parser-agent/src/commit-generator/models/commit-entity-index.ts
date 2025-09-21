import {
  Model,
  Table,
  Column,
  AllowNull,
  Comment,
  PrimaryKey,
  CreatedAt,
  UpdatedAt,
  Default,
  DataType,
  Index,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { CommitRecordModel } from "./commit-record";

@Table({
  tableName: "commit_entity_index",
  freezeTableName: true,
  indexes: [
    { fields: ["commit_hash"] },
    { fields: ["entity_type"] },
    { fields: ["branch_name"] },
    { fields: ["file_path"] },
  ],
})
export class CommitEntityIndexModel extends Model<CommitEntityIndexModel> {
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

  @Comment("实体ID - 主键之一")
  @AllowNull(false)
  @PrimaryKey
  @Column({
    type: DataType.STRING(100),
    field: "entity_id",
  })
  entityId: string;

  @Comment("commit哈希值，外键")
  @AllowNull(false)
  @Index
  @ForeignKey(() => CommitRecordModel)
  @Column({
    type: DataType.STRING(40),
    field: "commit_hash",
  })
  commitHash: string;

  @Comment("实体类型")
  @AllowNull(false)
  @Index
  @Column({
    type: DataType.STRING(50),
    field: "entity_type",
  })
  entityType: string;

  @Comment("实体名称")
  @AllowNull(false)
  @Column({
    type: DataType.STRING(200),
    field: "entity_name",
  })
  entityName: string;

  @Comment("文件路径")
  @AllowNull(false)
  @Index
  @Column({
    type: DataType.STRING(500),
    field: "file_path",
  })
  filePath: string;

  @Comment("分支名称")
  @AllowNull(false)
  @Index
  @Column({
    type: DataType.STRING(100),
    field: "branch_name",
  })
  branchName: string;

  @Default("")
  @Comment("工作空间名称 - 主键之一")
  @AllowNull(false)
  @PrimaryKey
  @Column({
    type: DataType.STRING(100),
    field: "workspace_name",
  })
  workspaceName: string;

  @Comment("相关变更内容")
  @Column({
    type: DataType.TEXT,
    field: "related_changes",
  })
  relatedChanges: string;

  // 关联关系
  @BelongsTo(() => CommitRecordModel)
  commitRecord!: CommitRecordModel;
}

export type ICommitEntityIndexModel = typeof CommitEntityIndexModel;
