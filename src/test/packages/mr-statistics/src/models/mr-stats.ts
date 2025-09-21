/**
 * mr-stats.ts
 * MR统计数据库模型定义
 */

import {
  Table,
  Column,
  Model,
  PrimaryKey,
  DataType,
  CreatedAt,
  UpdatedAt,
  AllowNull,
  Default,
  Comment
} from 'sequelize-typescript';

/**
 * MR统计数据模型
 * 用于存储MR阶段的代码采纳率统计数据
 */
@Table({
  tableName: 'modular_dev_mr_stats',
  timestamps: true,
  comment: 'MR阶段代码统计数据表'
})
export class MRStatsModel extends Model {
  @PrimaryKey
  @AllowNull(false)
  @Column({
    type: DataType.STRING(255),
    field: 'id',
    comment: 'MR统计唯一标识符'
  })
  id!: string;

  @AllowNull(true)
  @Column({
    type: DataType.STRING(255),
    field: 'app_name',
    comment: '应用名称'
  })
  appName?: string;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(255),
    field: 'source_branch',
    comment: '开发分支名称'
  })
  sourceBranch!: string;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(255),
    field: 'target_branch',
    comment: '目标分支名称'
  })
  targetBranch!: string;

  // MR级别 AI代码文件采纳率
  @Default(0)
  @AllowNull(false)
  @Comment('MR阶段变更的总文件数')
  @Column({
    type: DataType.BIGINT,
    field: 'total_mr_files',
  })
  totalMRFiles!: number;

  @Default(0)
  @AllowNull(false)
  @Comment('MR阶段包含AI代码的文件数')
  @Column({
    type: DataType.BIGINT,
    field: 'include_ai_code_files',
  })
  includeAiCodeFiles!: number;
  
  @Default(0)
  @AllowNull(false)
  @Comment('AI生成的文件总数')
  @Column({
    type: DataType.BIGINT,
    field: 'ai_code_files',
  })
  aiCodeFiles!: number;

  @Default(0)
  @AllowNull(false)
  @Comment('MR阶段AI变更文件维度采纳率百分比')
  @Column({
    type: DataType.DECIMAL(5, 2),
    field: 'mr_file_acceptance_rate',
  })
  mrFileAcceptanceRate!: number;

  // MR级别 AI代码采纳率
  @Default(0)
  @AllowNull(false)
  @Comment('MR中总代码行数')
  @Column({
    type: DataType.BIGINT,
    field: 'total_mr_code_lines',
  })
  totalMRCodeLines!: number;

  @Default(0)
  @AllowNull(false)
  @Comment('MR中包含AI代码的行数')
  @Column({
    type: DataType.BIGINT,
    field: 'include_ai_code_lines',
  })
  includeAiCodeLines!: number;

  @Default(0)
  @AllowNull(false)
  @Comment('MR阶段AI代码采纳率百分比')
  @Column({
    type: DataType.DECIMAL(5, 2),
    field: 'mr_code_acceptance_rate',
  })
  mrCodeAcceptanceRate!: number;

  @AllowNull(false)
  @Comment('相关提交哈希列表')
  @Column({
    type: DataType.TEXT('long'),
    field: 'related_commits',
    get() {
      const rawValue = this.getDataValue('relatedCommits');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value: any) {
      this.setDataValue('relatedCommits', JSON.stringify(value));
    }
  })
  relatedCommits!: string;

  @CreatedAt
  @AllowNull(false)
  @Comment('MR创建时间')
  @Column({
    type: DataType.DATE,
    field: 'created_at',
  })
  createdAt!: Date;

  @AllowNull(true)
  @Comment('MR合并时间')
  @Column({
    type: DataType.DATE,
    field: 'merged_at',
  })
  mergedAt?: Date;

  @UpdatedAt
  @AllowNull(false)
  @Comment('记录更新时间')
  @Column({
    type: DataType.DATE,
    field: 'updated_at',
  })
  updatedAt!: Date;
}

export default MRStatsModel;