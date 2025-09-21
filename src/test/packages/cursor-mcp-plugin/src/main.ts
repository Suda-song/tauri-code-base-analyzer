#!/usr/bin/env node
import { SimpleLogger } from "@xhs/shared-utils";
import { createMcpNotificationHandler } from "./services/mcpHub";

const logger = new SimpleLogger(process.cwd());
logger.log("=== 启动 MCP 服务器 ===");
logger.log("正在导入 run 函数...");

const mcpHandler = new createMcpNotificationHandler();

const createConsoleRedirect = (level: "info" | "error" | "warn") => {
  return (...args: any[]) => {
    mcpHandler.logger({
      level,
      mcpName: "code-research-mcp",
      data: args.join(" "),
    });
  };
};
console.log = createConsoleRedirect("info");
console.info = createConsoleRedirect("info");
console.error = createConsoleRedirect("error");
console.warn = createConsoleRedirect("warn");

import { run } from "./index.js";

run(mcpHandler).catch(() => process.exit(1));
