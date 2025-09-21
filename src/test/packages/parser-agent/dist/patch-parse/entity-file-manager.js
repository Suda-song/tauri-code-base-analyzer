"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityFileManager = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const fileWalker_1 = require("../fileWalker");
// 实体文件管理器
class EntityFileManager {
    constructor(rootDir) {
        this.rootDir = rootDir;
    }
    /**
     * 解析文件并更新entities.json，返回文件实体映射
     * @param files 要解析的文件列表
     * @param deletedFiles 要删除的文件列表
     */
    async parseFilesAndUpdateEntities(files, deletedFiles = []) {
        console.log(`📄 开始解析 ${files.length} 个文件，删除 ${deletedFiles.length} 个文件的实体`);
        const fullEntitiesPath = path_1.default.join(this.rootDir, 'data/entities.json');
        // 确保目录存在
        const dataDir = path_1.default.dirname(fullEntitiesPath);
        if (!fs_1.default.existsSync(dataDir)) {
            fs_1.default.mkdirSync(dataDir, { recursive: true });
        }
        // 1. 读取现有实体
        let fullEntities = [];
        if (fs_1.default.existsSync(fullEntitiesPath)) {
            const fullEntitiesContent = fs_1.default.readFileSync(fullEntitiesPath, 'utf-8');
            fullEntities = JSON.parse(fullEntitiesContent);
            console.log(`📋 已加载 ${fullEntities.length} 个现有实体`);
        }
        // 2. 处理删除的文件
        if (deletedFiles.length > 0) {
            fullEntities = this.removeDeletedFileEntities(fullEntities, deletedFiles);
            console.log(`🗑️ 删除了 ${deletedFiles.length} 个文件的实体`);
        }
        // 3. 解析新文件
        let newEntities = [];
        if (files.length > 0) {
            newEntities = await (0, fileWalker_1.extractAllEntities)(this.rootDir, files);
            console.log(`🔍 从 ${files.length} 个文件中提取到 ${newEntities.length} 个实体`);
        }
        // 4. 合并实体，保持已有实体的ID
        const mergedEntities = this.mergeEntitiesWithIdPreservation(fullEntities, newEntities);
        // 5. 更新entities.json
        fs_1.default.writeFileSync(fullEntitiesPath, JSON.stringify(mergedEntities, null, 2));
        console.log(`💾 已更新entities.json，共 ${mergedEntities.length} 个实体`);
        // 6. 创建文件实体映射
        const fileEntityMappings = this.createFileEntityMappings(files, mergedEntities);
        return fileEntityMappings;
    }
    /**
     * 从实体列表中移除指定文件的实体
     */
    removeDeletedFileEntities(entities, deletedFiles) {
        if (deletedFiles.length === 0)
            return entities;
        const deletedRelativePaths = deletedFiles.map(file => path_1.default.relative(this.rootDir, file));
        return entities.filter(entity => {
            if (!entity.file)
                return true;
            return !deletedRelativePaths.includes(entity.file);
        });
    }
    /**
     * 合并实体，保持已有实体的ID（参考cli.ts的逻辑）
     */
    mergeEntitiesWithIdPreservation(fullEntities, newEntities) {
        const mergedEntities = new Map();
        // 首先添加所有完整实体
        fullEntities.forEach(entity => {
            if (entity.file && entity.rawName) {
                let key = `${entity.file}:${entity.rawName}`;
                // 如果 key 已存在，添加随机数使其唯一
                if (mergedEntities.has(key)) {
                    key = `${entity.file}:${entity.rawName}:${Math.random().toString(36).slice(2)}`;
                }
                mergedEntities.set(key, entity);
            }
        });
        // 然后处理新的实体
        newEntities.forEach(entity => {
            if (entity.file && entity.rawName) {
                const key = `${entity.file}:${entity.rawName}`;
                if (mergedEntities.has(key)) {
                    // 如果实体已存在，保持原有ID，但更新其他属性
                    const existingEntity = mergedEntities.get(key);
                    mergedEntities.set(key, {
                        ...entity,
                        id: existingEntity.id
                    });
                }
                else {
                    // 如果是新实体，直接添加
                    mergedEntities.set(key, entity);
                }
            }
        });
        return Array.from(mergedEntities.values());
    }
    /**
     * 创建文件实体映射
     */
    createFileEntityMappings(files, allEntities) {
        return files.map(file => {
            const relativePath = path_1.default.relative(this.rootDir, file);
            const fileEntities = allEntities.filter(entity => entity.file === relativePath);
            return {
                file,
                entities: fileEntities,
                relativePath
            };
        });
    }
    /**
     * 批量更新富化实体文件（只合并enriched.entities.json）
     */
    batchUpdateEnrichedEntities(enrichedEntities, deletedFiles = []) {
        const enrichedEntitiesPath = path_1.default.join(this.rootDir, 'data/entities.enriched.json');
        // 确保目录存在
        const dataDir = path_1.default.dirname(enrichedEntitiesPath);
        if (!fs_1.default.existsSync(dataDir)) {
            fs_1.default.mkdirSync(dataDir, { recursive: true });
        }
        // 读取现有富化实体
        let existingEnrichedEntities = [];
        if (fs_1.default.existsSync(enrichedEntitiesPath)) {
            existingEnrichedEntities = JSON.parse(fs_1.default.readFileSync(enrichedEntitiesPath, 'utf-8'));
        }
        // 处理删除的文件
        if (deletedFiles.length > 0) {
            existingEnrichedEntities = this.removeDeletedFileEntities(existingEnrichedEntities, deletedFiles);
        }
        // 合并富化实体
        const mergedEnrichedEntities = this.mergeEntities(existingEnrichedEntities, enrichedEntities);
        // 保存更新后的富化实体
        fs_1.default.writeFileSync(enrichedEntitiesPath, JSON.stringify(mergedEnrichedEntities, null, 2));
        console.log(`📝 批量更新富化实体: entities.enriched.json (${mergedEnrichedEntities.length})`);
    }
    mergeEntities(existing, newEntities) {
        const entityMap = new Map();
        // 添加现有实体
        existing.forEach(entity => {
            if (entity.id) {
                entityMap.set(entity.id, entity);
            }
        });
        // 更新或添加新实体
        newEntities.forEach(entity => {
            if (entity.id) {
                entityMap.set(entity.id, entity);
            }
        });
        return Array.from(entityMap.values());
    }
    /**
     * 获取现有文件数量（不是实体数量）
     */
    getExistingFileCount() {
        const fullEntitiesPath = path_1.default.join(this.rootDir, 'data/entities.json');
        if (!fs_1.default.existsSync(fullEntitiesPath)) {
            return 0;
        }
        try {
            const content = fs_1.default.readFileSync(fullEntitiesPath, 'utf-8');
            const entities = JSON.parse(content);
            if (!Array.isArray(entities)) {
                return 0;
            }
            // 获取唯一的文件路径数量
            const uniqueFiles = new Set();
            entities.forEach((entity) => {
                if (entity.file) {
                    uniqueFiles.add(entity.file);
                }
            });
            return uniqueFiles.size;
        }
        catch (error) {
            console.warn('读取现有实体文件失败:', error);
            return 0;
        }
    }
}
exports.EntityFileManager = EntityFileManager;
