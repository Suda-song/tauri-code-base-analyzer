/**
 * 通用性能配置模块
 * 提供统一的性能参数和缓存管理策略
 */

export interface ExtractorPerformanceConfig {
  // 缓存相关配置
  enableCache: boolean;
  maxCacheSize: number;
  cacheCleanupThreshold: number;
  
  // 并行处理配置
  maxParallelFiles: number;
  batchSize: number;
  
  // 监控和日志配置
  enableDetailedLogs: boolean;
  enablePerformanceMonitoring: boolean;
  logLevel: 'minimal' | 'normal' | 'verbose';
}

/**
 * 默认性能配置
 */
export const DEFAULT_PERFORMANCE_CONFIG: ExtractorPerformanceConfig = {
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
export const PERFORMANCE_CONFIGS = {
  development: {
    ...DEFAULT_PERFORMANCE_CONFIG,
    enableDetailedLogs: true,
    logLevel: 'verbose' as const,
    maxCacheSize: 50 * 1024 * 1024, // 开发环境减少缓存
  },
  
  production: {
    ...DEFAULT_PERFORMANCE_CONFIG,
    enableDetailedLogs: false,
    logLevel: 'minimal' as const,
    maxCacheSize: 200 * 1024 * 1024, // 生产环境增加缓存
    maxParallelFiles: 16,
  },
  
  test: {
    ...DEFAULT_PERFORMANCE_CONFIG,
    enableDetailedLogs: false,
    logLevel: 'minimal' as const,
    maxCacheSize: 20 * 1024 * 1024, // 测试环境最小缓存
    maxParallelFiles: 4,
  }
};

/**
 * 获取当前环境的性能配置
 */
export function getPerformanceConfig(env?: string): ExtractorPerformanceConfig {
  const environment = env || process.env.NODE_ENV || 'development';
  
  if (environment in PERFORMANCE_CONFIGS) {
    return PERFORMANCE_CONFIGS[environment as keyof typeof PERFORMANCE_CONFIGS];
  }
  
  return DEFAULT_PERFORMANCE_CONFIG;
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private startTime: number;
  private checkpoints: Map<string, number> = new Map();
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
    this.startTime = Date.now();
  }

  /**
   * 记录检查点
   */
  checkpoint(name: string): void {
    if (this.enabled) {
      this.checkpoints.set(name, Date.now());
    }
  }

  /**
   * 获取从开始到现在的总时间
   */
  getTotalTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * 获取检查点之间的时间
   */
  getTimeBetween(start: string, end: string): number {
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
  getReport(): {
    totalTime: number;
    checkpoints: Array<{ name: string; time: number; delta: number }>;
  } {
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
  printReport(prefix: string = ''): void {
    if (!this.enabled) return;

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
export class CacheManager<T = any> {
  private cache = new Map<string, { value: T; timestamp: number; size: number }>();
  private hitCount = 0;
  private missCount = 0;
  private maxSize: number;
  private cleanupThreshold: number;

  constructor(maxSize: number, cleanupThreshold: number = 0.8) {
    this.maxSize = maxSize;
    this.cleanupThreshold = cleanupThreshold;
  }

  /**
   * 获取缓存项
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (item) {
      this.hitCount++;
      return item.value;
    } else {
      this.missCount++;
      return null;
    }
  }

  /**
   * 设置缓存项
   */
  set(key: string, value: T, estimatedSize: number = 1024): void {
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
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清理缓存
   */
  cleanup(): void {
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
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * 获取当前缓存大小
   */
  getCurrentSize(): number {
    return Array.from(this.cache.values())
      .reduce((sum, item) => sum + item.size, 0);
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
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