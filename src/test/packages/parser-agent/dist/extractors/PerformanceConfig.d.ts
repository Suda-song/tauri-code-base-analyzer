/**
 * 通用性能配置模块
 * 提供统一的性能参数和缓存管理策略
 */
export interface ExtractorPerformanceConfig {
    enableCache: boolean;
    maxCacheSize: number;
    cacheCleanupThreshold: number;
    maxParallelFiles: number;
    batchSize: number;
    enableDetailedLogs: boolean;
    enablePerformanceMonitoring: boolean;
    logLevel: 'minimal' | 'normal' | 'verbose';
}
/**
 * 默认性能配置
 */
export declare const DEFAULT_PERFORMANCE_CONFIG: ExtractorPerformanceConfig;
/**
 * 环境特定配置
 */
export declare const PERFORMANCE_CONFIGS: {
    development: {
        enableDetailedLogs: boolean;
        logLevel: "verbose";
        maxCacheSize: number;
        enableCache: boolean;
        cacheCleanupThreshold: number;
        maxParallelFiles: number;
        batchSize: number;
        enablePerformanceMonitoring: boolean;
    };
    production: {
        enableDetailedLogs: boolean;
        logLevel: "minimal";
        maxCacheSize: number;
        maxParallelFiles: number;
        enableCache: boolean;
        cacheCleanupThreshold: number;
        batchSize: number;
        enablePerformanceMonitoring: boolean;
    };
    test: {
        enableDetailedLogs: boolean;
        logLevel: "minimal";
        maxCacheSize: number;
        maxParallelFiles: number;
        enableCache: boolean;
        cacheCleanupThreshold: number;
        batchSize: number;
        enablePerformanceMonitoring: boolean;
    };
};
/**
 * 获取当前环境的性能配置
 */
export declare function getPerformanceConfig(env?: string): ExtractorPerformanceConfig;
/**
 * 性能监控器
 */
export declare class PerformanceMonitor {
    private startTime;
    private checkpoints;
    private enabled;
    constructor(enabled?: boolean);
    /**
     * 记录检查点
     */
    checkpoint(name: string): void;
    /**
     * 获取从开始到现在的总时间
     */
    getTotalTime(): number;
    /**
     * 获取检查点之间的时间
     */
    getTimeBetween(start: string, end: string): number;
    /**
     * 获取性能报告
     */
    getReport(): {
        totalTime: number;
        checkpoints: Array<{
            name: string;
            time: number;
            delta: number;
        }>;
    };
    /**
     * 打印性能报告
     */
    printReport(prefix?: string): void;
}
/**
 * 缓存统计信息
 */
export interface CacheStats {
    hitCount: number;
    missCount: number;
    hitRate: number;
    totalSize: number;
    itemCount: number;
}
/**
 * 通用缓存管理器
 */
export declare class CacheManager<T = any> {
    private cache;
    private hitCount;
    private missCount;
    private maxSize;
    private cleanupThreshold;
    constructor(maxSize: number, cleanupThreshold?: number);
    /**
     * 获取缓存项
     */
    get(key: string): T | null;
    /**
     * 设置缓存项
     */
    set(key: string, value: T, estimatedSize?: number): void;
    /**
     * 删除缓存项
     */
    delete(key: string): boolean;
    /**
     * 清理缓存
     */
    cleanup(): void;
    /**
     * 清空缓存
     */
    clear(): void;
    /**
     * 获取当前缓存大小
     */
    getCurrentSize(): number;
    /**
     * 获取缓存统计
     */
    getStats(): CacheStats;
}
