/**
 * http-client.ts
 * HTTP客户端服务，用于Pod模式下替代直接数据库操作
 */

import axios, { AxiosInstance } from 'axios';
import { MRStatisticsResult } from '../models/interfaces';

export interface HttpClientConfig {
  baseURL: string;
  timeout?: number;
}

export class HttpClient {
  private client: AxiosInstance;

  constructor(config: HttpClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * 保存MR统计记录
   */
  async saveMRStats(data: MRStatisticsResult): Promise<string> {
    try {
      const response = await this.client.post('/mr-stats', {
        ...data,
        relatedCommits: JSON.stringify(data.relatedCommits)
      });
      return response.data.id || data.id;
    } catch (error: any) {
      console.error('HTTP保存MR统计记录失败:', error.message);
      throw new Error(`HTTP保存MR统计记录失败: ${error.message}`);
    }
  }

  /**
   * 获取MR统计记录详情
   */
  async getMRStats(id: string): Promise<MRStatisticsResult | null> {
    try {
      const response = await this.client.get(`/mr-stats/detail?id=${id}`);
      return response.data ? this.convertToMRStatisticsResult(response.data) : null;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      console.error('HTTP获取MR统计记录失败:', error.message);
      throw new Error(`HTTP获取MR统计记录失败: ${error.message}`);
    }
  }

  /**
   * 获取分支的最新MR统计记录
   */
  async getLatestMRStatsByBranch(
    sourceBranch: string,
    targetBranch: string = 'master'
  ): Promise<MRStatisticsResult | null> {
    try {
      const response = await this.client.get('/mr-stats', {
        params: { sourceBranch, targetBranch, page: 1, size: 1 }
      });
      const items = response.data.items;
      return items?.length > 0 ? this.convertToMRStatisticsResult(items[0]) : null;
    } catch (error: any) {
      console.error('HTTP获取分支MR统计记录失败:', error.message);
      return null;
    }
  }

  /**
   * 获取MR统计记录列表
   */
  async getMRStatsList(options: {
    sourceBranch?: string;
    targetBranch?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<MRStatisticsResult[]> {
    try {
      const page = Math.floor((options.offset || 0) / (options.limit || 10)) + 1;
      const response = await this.client.get('/mr-stats', {
        params: {
          sourceBranch: options.sourceBranch,
          targetBranch: options.targetBranch,
          page,
          size: options.limit || 10
        }
      });
      return (response.data.items || []).map((item: any) => this.convertToMRStatisticsResult(item));
    } catch (error: any) {
      console.error('HTTP获取MR统计记录列表失败:', error.message);
      return [];
    }
  }

  /**
   * 删除MR统计记录
   */
  async deleteMRStats(id: string): Promise<boolean> {
    try {
      await this.client.delete(`/mr-stats/${id}`);
      return true;
    } catch (error: any) {
      console.error('HTTP删除MR统计记录失败:', error.message);
      return false;
    }
  }

  /**
   * 根据分支名获取Flow记录
   */
  async getFlowsByBranchName(branchName: string): Promise<any[]> {
    try {
      const response = await this.client.get('/flows/branch', {
        params: {
          branchName,
          page: 1,
          size: 100 // 获取足够多的记录
        }
      });
      return response.data.items || [];
    } catch (error: any) {
      console.error('HTTP获取分支Flow记录失败:', error.message);
      return [];
    }
  }

  /**
   * 根据Flow ID列表获取文件变更记录
   */
  async getFileChangesByFlowIds(flowIds: string[]): Promise<any[]> {
    try {
      if (!flowIds || flowIds.length === 0) {
        return [];
      }

      const response = await this.client.get('/flows/file-changes-batch', {
        params: {
          flowIds: flowIds.join(','),
          page: 1,
          size: 1000 // 获取足够多的记录
        }
      });
      return response.data.items || [];
    } catch (error: any) {
      console.error('HTTP获取Flow文件变更记录失败:', error.message);
      return [];
    }
  }

  /**
   * 转换auroraflow模型数据为mr-statistics接口结构
   */
  private convertToMRStatisticsResult(data: any): MRStatisticsResult {
    let relatedCommits = [];
    try {
      if (typeof data.relatedCommits === 'string') {
        relatedCommits = JSON.parse(data.relatedCommits);
      }
    } catch (error) {
      console.warn('解析relatedCommits失败:', error);
    }

    return {
      id: data.id,
      appName: data.appName,
      sourceBranch: data.sourceBranch,
      targetBranch: data.targetBranch,
      totalMRFiles: data.totalMRFiles || 0,
      includeAiCodeFiles: data.includeAiCodeFiles || 0,
      aiCodeFiles: data.aiCodeFiles || 0,
      mrFileAcceptanceRate: data.mrFileAcceptanceRate || 0,
      totalMRCodeLines: data.totalMRCodeLines || 0,
      includeAiCodeLines: data.includeAiCodeLines || 0,
      mrCodeAcceptanceRate: data.mrCodeAcceptanceRate || 0,
      relatedCommits,
      createdAt: new Date(data.createdAt),
      mergedAt: data.mergedAt ? new Date(data.mergedAt) : undefined
    };
  }
}

let httpClient: HttpClient | null = null;

/**
 * 初始化HTTP客户端
 */
export function initHttpClient(config: HttpClientConfig): void {
  httpClient = new HttpClient(config);
}

/**
 * 获取HTTP客户端实例
 */
export function getHttpClient(): HttpClient {
  if (!httpClient) {
    throw new Error('HTTP客户端未初始化，请先调用initHttpClient');
  }
  return httpClient;
}