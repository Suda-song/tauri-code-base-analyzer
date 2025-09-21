"use strict";
/**
 * 通用性能配置模块
 * 提供统一的性能参数和缓存管理策略
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = exports.PerformanceMonitor = exports.PERFORMANCE_CONFIGS = exports.DEFAULT_PERFORMANCE_CONFIG = void 0;
exports.getPerformanceConfig = getPerformanceConfig;
/**
 * 默认性能配置
 */
exports.DEFAULT_PERFORMANCE_CONFIG = {
    // 缓存配置
    enableCache: true,
    maxCacheSize: 100 * 1024 * 1024, // 100MB
    cacheCleanupThreshold: 0.8, // 80%时开始清理
    // 并行处理配置
    maxParallelFiles: 8,
    batchSize: 50,
    // 监控配置
    enableDetailedLogs: true,
    enablePerformanceMonitoring: true,
    logLevel: 'normal'
};
/**
 * 环境特定配置
 */
exports.PERFORMANCE_CONFIGS = {
    development: {
        ...exports.DEFAULT_PERFORMANCE_CONFIG,
        enableDetailedLogs: true,
        logLevel: 'verbose',
        maxCacheSize: 50 * 1024 * 1024, // 开发环境减少缓存
    },
    production: {
        ...exports.DEFAULT_PERFORMANCE_CONFIG,
        enableDetailedLogs: false,
        logLevel: 'minimal',
        maxCacheSize: 200 * 1024 * 1024, // 生产环境增加缓存
        maxParallelFiles: 16,
    },
    test: {
        ...exports.DEFAULT_PERFORMANCE_CONFIG,
        enableDetailedLogs: false,
        logLevel: 'minimal',
        maxCacheSize: 20 * 1024 * 1024, // 测试环境最小缓存
        maxParallelFiles: 4,
    }
};
/**
 * 获取当前环境的性能配置
 */
function getPerformanceConfig(env) {
    const environment = env || process.env.NODE_ENV || 'development';
    if (environment in exports.PERFORMANCE_CONFIGS) {
        return exports.PERFORMANCE_CONFIGS[environment];
    }
    return exports.DEFAULT_PERFORMANCE_CONFIG;
}
/**
 * 性能监控器
 */
class PerformanceMonitor {
    constructor(enabled = true) {
        this.checkpoints = new Map();
        this.enabled = enabled;
        this.startTime = Date.now();
    }
    /**
     * 记录检查点
     */
    checkpoint(name) {
        if (this.enabled) {
            this.checkpoints.set(name, Date.now());
        }
    }
    /**
     * 获取从开始到现在的总时间
     */
    getTotalTime() {
        return Date.now() - this.startTime;
    }
    /**
     * 获取检查点之间的时间
     */
    getTimeBetween(start, end) {
        const startTime = this.checkpoints.get(start);
        const endTime = this.checkpoints.get(end);
        if (!startTime || !endTime) {
            return 0;
        }
        return endTime - startTime;
    }
    /**
     * 获取性能报告
     */
    getReport() {
        const checkpoints = Array.from(this.checkpoints.entries()).map(([name, time], index, arr) => ({
            name,
            time: time - this.startTime,
            delta: index > 0 ? time - arr[index - 1][1] : time - this.startTime
        }));
        return {
            totalTime: this.getTotalTime(),
            checkpoints
        };
    }
    /**
     * 打印性能报告
     */
    printReport(prefix = '') {
        if (!this.enabled)
            return;
        const report = this.getReport();
        console.log(`${prefix}⏱️  性能报告:`);
        console.log(`${prefix}  总时间: ${report.totalTime}ms`);
        if (report.checkpoints.length > 0) {
            console.log(`${prefix}  检查点:`);
            report.checkpoints.forEach(checkpoint => {
                console.log(`${prefix}    ${checkpoint.name}: ${checkpoint.time}ms (+${checkpoint.delta}ms)`);
            });
        }
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
/**
 * 通用缓存管理器
 */
class CacheManager {
    constructor(maxSize, cleanupThreshold = 0.8) {
        this.cache = new Map();
        this.hitCount = 0;
        this.missCount = 0;
        this.maxSize = maxSize;
        this.cleanupThreshold = cleanupThreshold;
    }
    /**
     * 获取缓存项
     */
    get(key) {
        const item = this.cache.get(key);
        if (item) {
            this.hitCount++;
            return item.value;
        }
        else {
            this.missCount++;
            return null;
        }
    }
    /**
     * 设置缓存项
     */
    set(key, value, estimatedSize = 1024) {
        // 检查是否需要清理
        if (this.getCurrentSize() > this.maxSize * this.cleanupThreshold) {
            this.cleanup();
        }
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            size: estimatedSize
        });
    }
    /**
     * 删除缓存项
     */
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * 清理缓存
     */
    cleanup() {
        const entries = Array.from(this.cache.entries());
        // 按时间排序，删除最旧的50%
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toDelete = entries.slice(0, Math.floor(entries.length / 2));
        toDelete.forEach(([key]) => this.cache.delete(key));
        console.log(`🧹 缓存清理: 删除 ${toDelete.length} 项，剩余 ${this.cache.size} 项`);
    }
    /**
     * 清空缓存
     */
    clear() {
        this.cache.clear();
        this.hitCount = 0;
        this.missCount = 0;
    }
    /**
     * 获取当前缓存大小
     */
    getCurrentSize() {
        return Array.from(this.cache.values())
            .reduce((sum, item) => sum + item.size, 0);
    }
    /**
     * 获取缓存统计
     */
    getStats() {
        const total = this.hitCount + this.missCount;
        return {
            hitCount: this.hitCount,
            missCount: this.missCount,
            hitRate: total > 0 ? this.hitCount / total : 0,
            totalSize: this.getCurrentSize(),
            itemCount: this.cache.size
        };
    }
}
exports.CacheManager = CacheManager;
