import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface LoggerParams {
  level: "info" | "error" | "warn" | "debug" | "trace";
  mcpName: string;
  data: string;
}

interface NotificationsParams {
  mcpName: string;
  params: string;
  duration?: number;
  icon: Icon;
}
enum Icon {
  //进度和状态类
  sync = "$(sync)", // 同步图标
  syncSpin = "$(sync~spin)", // 旋转的同步图标（适合进度显示）
  loadingSpin = "$(loading~spin)", // 旋转的加载图标
  gearSpin = "$(gear~spin)", // 旋转的齿轮图标
  circleOutline = "$(circle-outline)", // 空心圆圈
  circleFilled = "$(circle-filled)", // 实心圆圈
  //通知和提醒类
  bell = "$(bell)", // 铃铛（当前使用的）
  bellDot = "$(bell-dot)", // 带点的铃铛
  notification = "$(notification)", // 通知图标
  megaphone = "$(megaphone)", // 扩音器
  // 状态指示类
  check = "$(check)", // 成功勾选
  error = "$(error)", // 错误图标
  warning = "$(warning)", // 警告三角形
  info = "$(info)", // 信息图标
  question = "$(question)", // 问号图标
  //工具和操作类
  tools = "$(tools)", // 工具图标
  wrench = "$(wrench)", // 扳手
  settingsGear = "$(settings-gear)", // 设置齿轮
  pulse = "$(pulse)", // 脉冲图标
  zap = "$(zap)", // 闪电图标
  //数据和连接类
  database = "$(database)", // 数据库图标
  server = "$(server)", // 服务器图标
  cloud = "$(cloud)", // 云图标
  plug = "$(plug)", // 插头图标
  radioTower = "$(radio-tower)", // 信号塔
}

interface InformationMessageParams {
  params: string;
}

export class createMcpNotificationHandler {
  private server?: McpServer;
  private initializationHistory: Array<{ key: string; value: any }> = [];
  private sendRetry = 5;
  private sendQueue: Array<{ method: string; params: any }> = []; // 发送队列
  private isSending = false; // 是否正在发送

  constructor() {}

  init(server: McpServer) {
    this.server = server;
  }
  sendNotification(method: string, params: any) {
    // 添加到队列
    if (!this.server?.isConnected()) {
      this.initializationHistory.push({
        key: method,
        value: params,
      });
      return;
    }
    this.sendQueue.push({ method, params });

    // 如果没有在发送，开始处理队列
    if (!this.isSending) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.sendQueue.length === 0) {
      this.isSending = false;
      return;
    }

    this.isSending = true;
    const { method, params } = this.sendQueue.shift()!;

    const notification = {
      jsonrpc: "2.0" as const,
      method,
      params: {
        ...params,
      },
    };

    try {
      await this.server?.server.transport?.send(notification);
      this.sendRetry = 5;
    } catch (error) {
      this.sendRetry--;
      if (this.sendRetry > 0) {
        // 重新加入队列开头
        this.sendQueue.unshift({ method, params });
      }
    }

    // setTimeout(() => {
    this.processQueue();
    // }, 500);
  }
  /**
   * 三个核心方法
   */
  logger(params: LoggerParams) {
    this.sendNotification("logger", params);
  }
  onStatusBarMessage(params: NotificationsParams) {
    this.sendNotification("onStatusBarMessage", params);
  }
  onInformationMessage(params: InformationMessageParams) {
    this.sendNotification("onInformationMessage", params);
  }
  /**
   * 在server连接成功后，会自动调用，发送所有历史记录
   */
  clearHistory() {
    if (this.server?.isConnected()) {
      this.initializationHistory.forEach((item) => {
        this.sendNotification(item.key, item.value);
      });
    }
  }
}

export type { LoggerParams, NotificationsParams, InformationMessageParams };
