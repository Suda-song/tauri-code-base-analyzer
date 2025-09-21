import { BaseEntity } from '../enrichment/interfaces';
import { ProcessOptions, FileEntityMapping } from './types';
export declare class FileProcessor {
    private rootDir;
    private options;
    private orchestrator;
    constructor(rootDir: string, options?: ProcessOptions);
    /**
     * 基于文件实体映射批量处理富化（只做富化）
     * @param fileEntityMappings 文件实体映射列表
     * @param fullEntities 完整的实体列表（用于富化上下文）
     */
    processBatchFileEntityMappings(fileEntityMappings: FileEntityMapping[], fullEntities: BaseEntity[]): Promise<BaseEntity[]>;
    /**
     * 清理资源（可选调用）
     */
    dispose(): void;
}
