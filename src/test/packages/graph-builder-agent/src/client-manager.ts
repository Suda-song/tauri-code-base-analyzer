/**
 * 全局 Nebula 客户端管理器
 * 提供单例模式的客户端连接管理，可被多个应用（MCP、CLI等）共享使用
 */

import { NebulaClient } from "@xhs/nebula-client";
import { buildGraphFromFile } from "./builder";
import { FlowEntity } from "./types";

export interface ClientManagerConfig {
  // 连接配置
  gatewayHost?: string;
  nebulaHost?: string;
  nebulaPort?: number;
  username?: string;
  password?: string;

  // 图空间配置
  defaultSpace?: string;

  // 连接管理配置
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  healthCheckInterval?: number;

  // 日志配置
  enableLogging?: boolean;
}

export interface ClientStatus {
  isConnected: boolean;
  currentSpace: string | null;
  sessionId: string | null;
  lastConnectTime: Date | null;
  reconnectAttempts: number;
  isHealthy: boolean;
}
/**
 * @description 函数: GlobalClientManager
 */

export class GlobalClientManager {
  private static instance: GlobalClientManager | null = null;
  private client: NebulaClient | null = null;
  private config: Required<ClientManagerConfig>;
  private currentSpace: string | null = null;
  private lastConnectTime: Date | null = null;
  private reconnectAttempts: number = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  private mcpHandler: any = null;

  public constructor() {
    // 默认配置
    this.config = {
      gatewayHost:
        process.env.NEBULA_GATEWAY_HOST || "http://192.168.132.44:8080",
      nebulaHost: process.env.NEBULA_HOST || "10.4.44.78",
      nebulaPort: parseInt(process.env.NEBULA_PORT || "9669"),
      username: process.env.NEBULA_USERNAME || "root",
      password: process.env.NEBULA_PASSWORD || "nebula",
      defaultSpace: process.env.NEBULA_DEFAULT_SPACE || "code_graph",
      autoReconnect: true,
      reconnectDelay: 3000,
      maxReconnectAttempts: 5,
      healthCheckInterval: 30000, // 30秒检查一次
      enableLogging: true,
    };
  }

  /**
   * 获取全局客户端管理器实例（单例模式）
   */
  public static getInstance(): GlobalClientManager {
    if (!GlobalClientManager.instance) {
      GlobalClientManager.instance = new GlobalClientManager();
    }
    return GlobalClientManager.instance;
  }

  /**
   * 初始化客户端管理器
   * @param config 可选配置，会与默认配置合并
   */
  public async initialize(
    config?: Partial<ClientManagerConfig>
  ): Promise<void> {
    if (this.isInitialized) {
      this.log("客户端管理器已初始化，跳过重复初始化");
      return;
    }

    // 合并配置
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.log("🔌 正在初始化全局 Nebula Graph 连接管理器...");

    try {
      await this.connect();
      this.startHealthCheck();
      this.isInitialized = true;
      this.log("✅ 全局 Nebula Graph 连接管理器初始化完成");
    } catch (error) {
      this.logError("❌ 全局 Nebula Graph 连接管理器初始化失败:", error);
      throw error;
    }
  }

  /**
   * 建立连接
   */
  private async connect(): Promise<void> {
    try {
      if (this.client && this.client.isConnected()) {
        this.log("连接已存在，跳过重复连接");
        return;
      }

      this.log("🔗 正在建立 Nebula Graph 连接...");

      this.client = new NebulaClient({
        gatewayHost: this.config.gatewayHost,
        nebulaHost: this.config.nebulaHost,
        nebulaPort: this.config.nebulaPort,
        username: this.config.username,
        password: this.config.password,
        space: this.config.defaultSpace,
      });
      await this.client.connect();

      // 检查并创建默认图空间
      if (this.config.defaultSpace) {
        await this.ensureSpaceExists(this.config.defaultSpace);
        this.currentSpace = this.config.defaultSpace;
        this.log(`📊 已切换到图空间: ${this.config.defaultSpace}`);
      }

      this.lastConnectTime = new Date();
      this.reconnectAttempts = 0;
      this.log("✅ Nebula Graph 连接已建立");
    } catch (error) {
      this.logError("❌ Nebula Graph 连接失败:", error);
      throw error;
    }
  }

  /**
   * 确保图空间存在，如果不存在则创建
   */
  private async ensureSpaceExists(spaceName: string): Promise<void> {
    if (!this.client) {
      throw new Error("客户端未初始化");
    }

    try {
      this.log(`🔍 检查图空间是否存在: ${spaceName}`);

      // 1. 首先尝试列出所有图空间
      const showSpacesResult = await this.client.executeNgql("SHOW SPACES");

      let spaceExists = false;
      if (showSpacesResult?.data && Array.isArray(showSpacesResult.data)) {
        // 检查图空间是否已存在
        spaceExists = showSpacesResult.data.some((row: any) => {
          // Nebula Graph返回的空间名称通常在第一列
          const spaceNameInRow = Array.isArray(row) ? row[0] : row.Name;
          return spaceNameInRow === spaceName;
        });
      }

      if (spaceExists) {
        this.log(`✅ 图空间 ${spaceName} 已存在`);
        // 直接使用已存在的图空间
        await this.client.executeNgql(`USE ${spaceName}`);
      } else {
        this.log(`🚀 图空间 ${spaceName} 不存在，正在创建...`);

        // 2. 创建图空间
        const createSpaceStatement = `CREATE SPACE IF NOT EXISTS ${spaceName}(partition_num=10, replica_factor=1, vid_type=FIXED_STRING(256))`;
        await this.client.executeNgql(createSpaceStatement);
        this.log(`✅ 图空间 ${spaceName} 创建完成`);

        // 3. 等待图空间创建生效
        this.log("⏳ 等待图空间创建生效...");
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // 4. 切换到新创建的图空间
        await this.client.executeNgql(`USE ${spaceName}`);
        this.log(`📊 已切换到新创建的图空间: ${spaceName}`);

        // // 5. 创建基础Schema
        // await this.createBasicSchema(spaceName);
      }
    } catch (error) {
      this.logError(`❌ 确保图空间 ${spaceName} 存在时失败:`, error);
      throw error;
    }
  }

  /**
   * 创建基础Schema（仅在新建图空间时调用）
   */
  private async createBasicSchema(spaceName: string): Promise<void> {
    if (!this.client) {
      throw new Error("客户端未初始化");
    }

    try {
      console.log(
        JSON.stringify({
          message: `🏗️ 为图空间 ${spaceName} 创建基础Schema...`,
        })
      );

      // 导入createSchemaStatements - 注意要避免循环依赖
      const { createSchemaStatements } = require("./schema");
      const schemaStatements = createSchemaStatements(spaceName);
      const schemasToExecute = schemaStatements.slice(2);

      for (let i = 0; i < schemasToExecute.length; i++) {
        const statement = schemasToExecute[i];
        this.log(`   执行Schema语句 ${i + 1}/${schemasToExecute.length}`);
        await this.client.executeNgql(statement);
      }

      this.log(`✅ 基础Schema创建完成`);

      // 等待Schema生效
      this.log("⏳ 等待Schema生效...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      this.logError(`❌ 创建基础Schema失败:`, error);
      throw error;
    }
  }

  /**
   * 获取客户端实例
   * 如果连接断开且启用自动重连，会尝试重新连接
   */
  public async getClient(): Promise<NebulaClient | null> {
    if (!this.isInitialized) {
      this.logError("❌ 客户端管理器未初始化，请先调用 initialize()");
      return null;
    }

    if (!this.client || !this.client.isConnected()) {
      if (
        this.config.autoReconnect &&
        this.reconnectAttempts < this.config.maxReconnectAttempts
      ) {
        this.log("🔄 检测到连接断开，尝试自动重连...");
        try {
          await this.connect();
          return this.client;
        } catch (error) {
          this.reconnectAttempts++;
          this.logError(
            `❌ 自动重连失败 (${this.reconnectAttempts}/${this.config.maxReconnectAttempts}):`,
            error
          );

          if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            this.logError("❌ 达到最大重连次数，停止自动重连");
          }
          return null;
        }
      } else {
        this.logError("❌ Nebula 客户端未连接且无法自动重连");
        return null;
      }
    }

    return this.client;
  }

  /**
   * @description 函数: useSpace
   */
  public async useSpace(spaceName: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client) {
      return false;
    }

    try {
      await client.executeNgql(`USE ${spaceName}`);
      this.currentSpace = spaceName;
      this.logError(`📊 已切换到图空间: ${spaceName}`);
      return true;
    } catch (error) {
      this.logError(`❌ 切换图空间失败 [${spaceName}]:`, error);
      return false;
    }
  }

  /**
   * @description 函数: executeQuery
   */
  public async executeQuery(query: string): Promise<any> {
    const client = await this.getClient();
    if (!client) {
      throw new Error("Nebula 客户端不可用");
    }

    return await client.executeNgql(query);
  }

  /**
   * @description 函数: getClientStatus
   */
  public getStatus(): ClientStatus {
    return {
      isConnected: this.client?.isConnected() || false,
      currentSpace: this.currentSpace,
      sessionId: this.client?.getSessionId() || null,
      lastConnectTime: this.lastConnectTime,
      reconnectAttempts: this.reconnectAttempts,
      isHealthy: this.isInitialized && (this.client?.isConnected() || false),
    };
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        if (this.client && this.client.isConnected()) {
          // 简单的健康检查查询
          await this.client.executeNgql("SHOW HOSTS");
        }
      } catch (error) {
        this.logError("❌ 健康检查失败，连接可能已断开:", error);
        // 健康检查失败时，下次 getClient() 会尝试重连
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * @description 函数: reconnectClient
   */
  public async reconnect(): Promise<boolean> {
    try {
      if (this.client && this.client.isConnected()) {
        await this.client.disconnect();
      }

      this.reconnectAttempts = 0; // 重置重连计数
      await this.connect();
      return true;
    } catch (error) {
      this.logError("❌ 手动重连失败:", error);
      return false;
    }
  }

  /**
   * 删除指定的图空间
   * @param spaceName 要删除的图空间名称
   */
  public async dropSpace(spaceName: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client) {
      this.logError("❌ 无法获取客户端连接，无法删除图空间");
      return false;
    }

    try {
      this.log(`🗑️ 正在删除图空间: ${spaceName}`);

      // 1. 先切换到系统默认空间（通常是没有名称的默认空间或其他空间）
      // 因为不能删除当前正在使用的空间
      try {
        await client.executeNgql("SHOW SPACES");
        // 切换到一个默认空间，如果不存在则创建一个临时空间
        await client.executeNgql("USE `default`");
      } catch (error) {
        // 如果默认空间不存在，创建一个临时空间
        await client.executeNgql(
          "CREATE SPACE IF NOT EXISTS temp_cleanup_space(partition_num=1, replica_factor=1, vid_type=FIXED_STRING(64))"
        );
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待创建生效
        await client.executeNgql("USE temp_cleanup_space");
      }

      // 2. 删除目标图空间
      await client.executeNgql(`DROP SPACE IF EXISTS \`${spaceName}\``);
      this.log(
        JSON.stringify({
          message: `✅ 图空间 ${spaceName} 删除成功`,
        })
      );

      // 3. 清理可能创建的临时空间
      try {
        await client.executeNgql("DROP SPACE IF EXISTS temp_cleanup_space");
      } catch (error) {
        // 忽略临时空间删除错误
      }

      return true;
    } catch (error) {
      this.logError(`❌ 删除图空间 ${spaceName} 失败:`, error);
      return false;
    }
  }

  /**
   * 断开连接并清理资源（可选择是否删除当前图空间）
   * @param dropCurrentSpace 是否删除当前使用的图空间
   */
  public async destroy(dropCurrentSpace: boolean = false): Promise<void> {
    this.log("🔌 正在关闭全局 Nebula Graph 连接...");

    try {
      // 如果需要删除当前图空间
      if (dropCurrentSpace && this.currentSpace) {
        this.log(`🗑️ 准备删除当前图空间: ${this.currentSpace}`);
        const dropSuccess = await this.dropSpace(this.currentSpace);
        if (dropSuccess) {
          this.log(`✅ 当前图空间 ${this.currentSpace} 已删除`);
        } else {
          this.logError(`❌ 删除当前图空间 ${this.currentSpace} 失败`);
        }
      }

      // 停止健康检查
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }

      // 断开连接
      if (this.client && this.client.isConnected()) {
        await this.client.disconnect();
      }

      // 重置状态
      this.client = null;
      this.currentSpace = null;
      this.lastConnectTime = null;
      this.reconnectAttempts = 0;
      this.isInitialized = false;

      this.log("✅ 全局 Nebula Graph 连接已关闭");
    } catch (error) {
      this.logError("❌ 关闭连接时发生错误:", error);
    }
  }

  /**
   * 日志输出
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[NebulaClientManager] ${message}`);
    }
  }

  private logError(message: string, error?: any): void {
    if (this.config.enableLogging) {
      console.error(
        `[NebulaClientManager] ${message}`,
        error?.message || error || ""
      );
    }
  }

  /**
   * �� 全局切换图空间（影响所有后续操作）
   * 这个方法会同时：
   * 1. 切换客户端连接的图空间
   * 2. 更新全局图空间状态
   * 3. 确保所有模块使用相同的图空间
   */
  public async switchGlobalSpace(spaceName: string): Promise<boolean> {
    const success = await this.useSpace(spaceName);
    if (success) {
      this.log(`🔧 全局图空间已切换为: ${spaceName}`);
      // 更新配置中的默认空间
      this.config.defaultSpace = spaceName;
    }
    return success;
  }

  /**
   * 获取当前图空间名称
   */
  public getCurrentSpace(): string {
    return this.currentSpace || this.config.defaultSpace;
  }

  public buildGraphFromFile(
    entitiesFilePath: string,
    client: NebulaClient,
    flows?: FlowEntity[]
  ): Promise<void> {
    return buildGraphFromFile(entitiesFilePath, client, flows);
  }
}
