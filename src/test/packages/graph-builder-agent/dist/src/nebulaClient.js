"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNebulaClient = getNebulaClient;
exports.executeNgql = executeNgql;
exports.releaseResources = releaseResources;
/**
 * Nebula Graph 客户端封装
 */
const nebula_nodejs_1 = require("@nebula-contrib/nebula-nodejs");
const dotenv_1 = __importDefault(require("dotenv"));
// 加载环境变量
dotenv_1.default.config();
// 获取连接配置
const NEBULA_SERVERS = (process.env.NEBULA_SERVERS || '120.26.220.144:9669');
const NEBULA_USER = process.env.NEBULA_USER || 'root';
const NEBULA_PASSWORD = process.env.NEBULA_PASSWORD || 'FrJzjtZY8P';
const NEBULA_SPACE = process.env.NEBULA_SPACE || 'code_graph';
// 创建客户端实例
let client = null;
/**
 * 获取或创建Nebula Graph客户端
 */
async function getNebulaClient() {
    if (!client) {
        // 配置连接选项
        const options = {
            servers: [NEBULA_SERVERS],
            userName: NEBULA_USER,
            password: NEBULA_PASSWORD,
            space: NEBULA_SPACE,
            poolSize: 5,
            bufferSize: 2000,
            executeTimeout: 15000,
            pingInterval: 60000
        };
        try {
            // 创建客户端
            client = (0, nebula_nodejs_1.createClient)(options);
            // 注册事件处理程序
            client.on('ready', ({ sender }) => {
                console.log('Nebula Graph client ready');
            });
            client.on('error', ({ sender, error }) => {
                console.error('Nebula Graph client error:', error);
            });
            client.on('connected', ({ sender }) => {
                console.log('Connected to Nebula Graph server');
            });
            client.on('authorized', ({ sender }) => {
                console.log('Authorized with Nebula Graph server');
            });
            client.on('reconnecting', ({ sender, retryInfo }) => {
                console.log(`Reconnecting to Nebula Graph server, attempt: ${retryInfo.attempt}, delay: ${retryInfo.delay}ms`);
            });
            client.on('close', ({ sender }) => {
                console.log('Connection to Nebula Graph server closed');
            });
            console.log(`Nebula Graph client created with space: ${NEBULA_SPACE}`);
        }
        catch (error) {
            console.error('Failed to create Nebula Graph client:', error);
            throw error;
        }
    }
    return client;
}
/**
 * 执行NGQL查询
 * @param query NGQL查询语句
 * @returns 查询结果
 */
async function executeNgql(query) {
    const nebulaClient = await getNebulaClient();
    try {
        // 执行查询，并获取解析后的结果
        const result = await nebulaClient.execute(query);
        // 根据结果检查是否有错误
        if (result && result.error) {
            console.warn(`Query warning: ${result.error}`, { query });
        }
        return result;
    }
    catch (error) {
        console.error(`Query error for: ${query}`, error);
        throw error;
    }
}
/**
 * 释放客户端资源
 */
async function releaseResources() {
    if (client) {
        try {
            // 等待所有查询完成并关闭连接
            await client.close();
            console.log('Nebula Graph resources released');
            client = null;
        }
        catch (error) {
            console.error('Error releasing Nebula Graph resources:', error);
            throw error;
        }
    }
}
