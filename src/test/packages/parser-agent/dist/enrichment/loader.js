"use strict";
/**
 * Enrichment Agent 实体加载器
 * 从JSON文件加载实体数据
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEntities = loadEntities;
exports.validateEntities = validateEntities;
const fs_1 = __importDefault(require("fs"));
const util_1 = require("util");
const config_1 = require("./config");
const readFileAsync = (0, util_1.promisify)(fs_1.default.readFile);
/**
 * 从JSON文件加载实体列表
 * @param filePath 实体JSON文件路径
 * @param rootDir 可选的根目录，用于解析相对路径
 * @returns 实体列表
 */
async function loadEntities(filePath, rootDir) {
    try {
        const resolvedPath = (0, config_1.resolveFilePath)(filePath, rootDir);
        const data = await readFileAsync(resolvedPath, 'utf-8');
        const entities = JSON.parse(data);
        console.log(`加载了 ${entities.length} 个实体，从 ${resolvedPath}`);
        return entities;
    }
    catch (error) {
        console.error(`加载实体失败: ${error.message}`);
        throw new Error(`加载实体失败: ${error.message}`);
    }
}
/**
 * 验证实体列表，确保包含所有必要的字段
 * @param entities 要验证的实体列表
 * @returns 过滤后的有效实体列表
 */
function validateEntities(entities) {
    const validEntities = entities.filter(entity => {
        const hasRequiredFields = entity.id &&
            entity.type &&
            entity.file &&
            entity.loc &&
            entity.rawName;
        if (!hasRequiredFields) {
            console.warn(`实体 ${entity.id || 'unknown'} 缺少必要字段`);
        }
        return hasRequiredFields;
    });
    if (validEntities.length < entities.length) {
        console.warn(`移除了 ${entities.length - validEntities.length} 个无效实体`);
    }
    return validEntities;
}
