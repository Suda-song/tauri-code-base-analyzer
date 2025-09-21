import { BaseEntity } from '../enrichment/interfaces';
export interface TaskProgress {
    totalFiles: number;
    processedFiles: number;
    processingFiles: string[];
    pendingFiles: number;
    percentage: number;
}
export interface ProcessOptions {
    rootDir?: string;
    concurrency?: number;
    maxRetries?: number;
    retryDelay?: number;
    batchSize?: number;
    baseFileCount?: number;
}
export interface FileEntityMapping {
    file: string;
    entities: BaseEntity[];
    relativePath: string;
}
