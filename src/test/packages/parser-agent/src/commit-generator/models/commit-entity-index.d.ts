import { Model } from "sequelize-typescript";
import { CommitRecordModel } from "./commit-record";
export declare class CommitEntityIndexModel extends Model<CommitEntityIndexModel> {
    createdAt: Date;
    updatedAt: Date;
    entityId: string;
    commitHash: string;
    entityType: string;
    entityName: string;
    filePath: string;
    branchName: string;
    workspaceName: string;
    relatedChanges: string;
    commitRecord: CommitRecordModel;
}
export type ICommitEntityIndexModel = typeof CommitEntityIndexModel;
