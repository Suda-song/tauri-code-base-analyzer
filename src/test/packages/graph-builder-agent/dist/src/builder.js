"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGraph = buildGraph;
const nebula_client_1 = require("@xhs/nebula-client");
const schema_1 = require("./schema");
/**
 * 构建代码知识图谱
 * @param files 文件实体列表
 * @param entities 增强实体列表
 * @param client 可选的 Nebula 客户端实例，如果不提供则使用默认客户端
 */
async function buildGraph(files, entities, client) {
    const nebulaClient = client || (0, nebula_client_1.getDefaultClient)();
    try {
        console.log(`开始构建知识图谱，处理 ${files.length} 个文件和 ${entities.length} 个实体...`);
        // 1. 使用指定图空间
        await nebulaClient.executeNgql(`USE ${schema_1.SPACE}`);
        // 2. 插入所有文件节点
        await insertFileNodes(files, nebulaClient);
        // 3. 插入所有实体节点
        await insertEntityNodes(entities, nebulaClient);
        // 4. 创建文件与实体的包含关系
        await createContainsRelationships(entities, nebulaClient);
        // 5. 创建实体之间的导入关系
        await createImportsRelationships(entities, nebulaClient);
        // 6. 创建实体之间的调用关系
        await createCallsRelationships(entities, nebulaClient);
        console.log('图谱构建完成!');
    }
    catch (error) {
        console.error('构建图谱时发生错误:', error);
        throw error;
    }
}
/**
 * 转义字符串中的特殊字符
 */
function escapeString(str) {
    return str.replace(/\\/g, '\\\\') // 转义反斜杠
        .replace(/"/g, '\\"') // 转义双引号  
        .replace(/'/g, "\\'"); // 转义单引号
}
/**
 * 插入文件节点
 */
async function insertFileNodes(files, client) {
    console.log(`插入 ${files.length} 个文件节点...`);
    for (const file of files) {
        const { id, path, name, extension } = file;
        // 转义特殊字符
        const escapedId = escapeString(id);
        const escapedPath = escapeString(path);
        const escapedName = escapeString(name);
        const escapedExtension = escapeString(extension);
        const query = `
      INSERT VERTEX ${schema_1.FILE_TAG}(path, name, extension) 
      VALUES "${escapedId}":("${escapedPath}", "${escapedName}", "${escapedExtension}")
    `;
        await client.executeNgql(query);
    }
    console.log('文件节点插入完成');
}
/**
 * 插入实体节点
 */
async function insertEntityNodes(entities, client) {
    console.log(`插入 ${entities.length} 个实体节点...`);
    for (const entity of entities) {
        const { id, type, file, rawName, summary, tags } = entity;
        // 转义所有字符串字段
        const escapedId = escapeString(id);
        const escapedType = escapeString(type);
        const escapedFile = escapeString(file);
        const escapedRawName = escapeString(rawName || '');
        const escapedSummary = escapeString(summary || '');
        const escapedTags = escapeString(Array.isArray(tags) ? tags.join(',') : '');
        const locationStr = entity.loc ?
            (typeof entity.loc === 'object' ? `${entity.loc.start}-${entity.loc.end || entity.loc.start}` : entity.loc.toString())
            : '';
        const escapedLocation = escapeString(locationStr);
        const query = `
      INSERT VERTEX ${schema_1.ENTITY_TAG}(entity_type, file_path, location, raw_name, description, tag_list) 
      VALUES "${escapedId}":("${escapedType}", "${escapedFile}", "${escapedLocation}", "${escapedRawName}", "${escapedSummary}", "${escapedTags}")
    `;
        await client.executeNgql(query);
    }
    console.log('实体节点插入完成');
}
/**
 * 创建文件包含实体的关系
 */
async function createContainsRelationships(entities, client) {
    console.log('创建文件-实体包含关系...');
    for (const entity of entities) {
        // 提取文件路径作为文件ID
        const fileId = getFileIdFromPath(entity.file);
        const escapedFileId = escapeString(fileId);
        const escapedEntityId = escapeString(entity.id);
        const query = `
      INSERT EDGE ${schema_1.REL_CONTAINS}() 
      VALUES "${escapedFileId}"->"${escapedEntityId}":()
    `;
        await client.executeNgql(query);
    }
    console.log('包含关系创建完成');
}
/**
 * 创建实体之间的导入关系
 */
async function createImportsRelationships(entities, client) {
    console.log('创建实体间导入关系...');
    for (const entity of entities) {
        if (!entity.IMPORTS || entity.IMPORTS.length === 0)
            continue;
        // 对每个导入创建关系
        for (const importedEntityId of entity.IMPORTS) {
            // 跳过格式不正确的ID
            if (!importedEntityId.includes(':'))
                continue;
            const escapedEntityId = escapeString(entity.id);
            const escapedImportedId = escapeString(importedEntityId);
            const query = `
        INSERT EDGE ${schema_1.REL_IMPORTS}() 
        VALUES "${escapedEntityId}"->"${escapedImportedId}":()
      `;
            await client.executeNgql(query);
        }
    }
    console.log('导入关系创建完成');
}
/**
 * 创建实体之间的调用关系
 */
async function createCallsRelationships(entities, client) {
    console.log('创建实体间调用关系...');
    for (const entity of entities) {
        if (!entity.CALLS || entity.CALLS.length === 0)
            continue;
        // 对每个调用创建关系
        for (const calledEntityId of entity.CALLS) {
            // 处理可能包含方法调用的格式(如 Type:Name.method)
            const baseEntityId = calledEntityId.split('.')[0];
            // 跳过格式不正确的ID
            if (!baseEntityId.includes(':'))
                continue;
            const escapedEntityId = escapeString(entity.id);
            const escapedCalledId = escapeString(baseEntityId);
            const query = `
        INSERT EDGE ${schema_1.REL_CALLS}() 
        VALUES "${escapedEntityId}"->"${escapedCalledId}":()
      `;
            await client.executeNgql(query);
        }
    }
    console.log('调用关系创建完成');
}
/**
 * 从文件路径获取文件ID
 */
function getFileIdFromPath(filePath) {
    // 简化处理：将文件路径作为ID
    // 实际应用中可能需要匹配文件实体ID的生成规则
    return filePath;
}
