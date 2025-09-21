#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("./index.js");
console.info('=== 启动 MCP 服务器 ===');
console.info('正在导入 run 函数...');
(0, index_js_1.run)().catch((error) => {
    console.error('启动服务器失败:', error);
    process.exit(1);
});
