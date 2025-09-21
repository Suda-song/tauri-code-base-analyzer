"use strict";
/**
 * Enrichment Agent 持久化模块
 * 负责将生成的结果保存到文件
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveEnrichedEntities = saveEnrichedEntities;
const fs_1 = __importDefault(require("fs"));
const util_1 = require("util");
const config_1 = require("./config");
const writeFileAsync = (0, util_1.promisify)(fs_1.default.writeFile);
const mkdirAsync = (0, util_1.promisify)(fs_1.default.mkdir);
/**
 * 将丰富化后的实体保存到JSON文件
 * @param entities 丰富化后的实体数组
 * @param outputPath 输出文件路径
 * @param rootDir 可选的根目录，用于解析相对路径
 */
async function saveEnrichedEntities(entities, outputPath, rootDir) {
    try {
        const resolvedPath = (0, config_1.resolveFilePath)(outputPath, rootDir);
        // 确保输出目录存在
        const dir = resolvedPath.substring(0, resolvedPath.lastIndexOf('/'));
        if (dir && !fs_1.default.existsSync(dir)) {
            await mkdirAsync(dir, { recursive: true });
        }
        // 按需格式化实体数据
        const formattedEntities = entities.map(formatEntity);
        // 写入文件
        await writeFileAsync(resolvedPath, JSON.stringify(formattedEntities, null, 2), 'utf-8');
        console.log(`保存了 ${entities.length} 个丰富化实体到 ${resolvedPath}`);
        return resolvedPath;
    }
    catch (error) {
        console.error(`保存丰富化实体失败: ${error.message}`);
        throw new Error(`保存丰富化实体失败: ${error.message}`);
    }
}
/**
 * 格式化实体
 */
function formatEntity(entity) {
    return {
        // 基础字段,来自收集器
        id: entity.id,
        type: entity.type,
        file: entity.file,
        loc: entity.loc,
        rawName: entity.rawName,
        // 标识字段
        isDDD: entity.isDDD || false,
        isWorkspace: entity.isWorkspace || false,
        // 丰富字段
        IMPORTS: entity.IMPORTS || [],
        CALLS: entity.CALLS || [],
        EMITS: entity.EMITS || [],
        TEMPLATE_COMPONENTS: entity.TEMPLATE_COMPONENTS || [],
        summary: entity.summary || '',
        tags: entity.tags || [],
        ANNOTATION: entity.ANNOTATION || ''
    };
}
