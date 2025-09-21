import { BaseEntity } from '../enrichment/interfaces';
import { FileEntityMapping } from './types';
export declare class EntityFileManager {
    private rootDir;
    constructor(rootDir: string);
    /**
     * 解析文件并更新entities.json，返回文件实体映射
     * @param files 要解析的文件列表
     * @param deletedFiles 要删除的文件列表
     */
    parseFilesAndUpdateEntities(files: string[], deletedFiles?: string[]): Promise<FileEntityMapping[]>;
    /**
     * 从实体列表中移除指定文件的实体
     */
    private removeDeletedFileEntities;
    /**
     * 合并实体，保持已有实体的ID（参考cli.ts的逻辑）
     */
    private mergeEntitiesWithIdPreservation;
    /**
     * 创建文件实体映射
     */
    private createFileEntityMappings;
    /**
     * 批量更新富化实体文件（只合并enriched.entities.json）
     */
    batchUpdateEnrichedEntities(enrichedEntities: BaseEntity[], deletedFiles?: string[]): void;
    private mergeEntities;
    /**
     * 获取现有文件数量（不是实体数量）
     */
    getExistingFileCount(): number;
}
