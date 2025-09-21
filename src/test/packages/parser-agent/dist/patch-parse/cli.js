#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const fileWalker_1 = require("../fileWalker");
const enrichment_1 = require("../enrichment");
const git_provider_1 = require("./git-provider");
// 命令行程序
const program = new commander_1.Command();
program
    .name('patch-parse')
    .description('解析 git diff 中的变更文件，提取实体并富化')
    .option('-r, --root <path>', '项目根目录', process.cwd())
    .option('-c, --concurrency <number>', '最大并发数', '5')
    .option('--retries <number>', '失败重试次数', '3')
    .option('--retry-delay <ms>', '重试间隔(毫秒)', '1000')
    .action(async (options) => {
    try {
        // 使用GitChangedFilesProvider获取变更文件
        const gitProvider = new git_provider_1.GitChangedFilesProvider(options.root);
        const changedFiles = await gitProvider.getGitChangedFiles();
        if (changedFiles.length === 0) {
            console.log('当前目录下没有发现变更文件');
            process.exit(0);
        }
        console.log('变更文件:', changedFiles);
        // 2. 提取实体
        const tempEntitiesPath = path_1.default.join(options.root, 'data/patch-entities.json');
        const entities = await (0, fileWalker_1.extractAllEntities)(options.root, changedFiles);
        // 确保输出目录存在
        const outputDir = path_1.default.dirname(tempEntitiesPath);
        if (!fs_1.default.existsSync(outputDir)) {
            fs_1.default.mkdirSync(outputDir, { recursive: true });
        }
        // 读取完整的 entities 文件
        const fullEntitiesPath = path_1.default.join(options.root, 'data/entities.json');
        let fullEntities = [];
        if (fs_1.default.existsSync(fullEntitiesPath)) {
            const fullEntitiesContent = fs_1.default.readFileSync(fullEntitiesPath, 'utf-8');
            fullEntities = JSON.parse(fullEntitiesContent);
            console.log(`已加载完整实体文件，共 ${fullEntities.length} 个实体`);
        }
        // 合并实体，保持已有实体的ID
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
        entities.forEach(entity => {
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
        // 转换为数组
        const finalEntities = Array.from(mergedEntities.values());
        // 更新 entities.json
        fs_1.default.writeFileSync(fullEntitiesPath, JSON.stringify(finalEntities, null, 2));
        console.log(`更新完整实体文件，共 ${finalEntities.length} 个实体`);
        // 更新 patch-entities.json（只包含变更的实体）
        const patchEntities = finalEntities.filter(entity => changedFiles.some(file => entity.file === path_1.default.relative(options.root, file)));
        fs_1.default.writeFileSync(tempEntitiesPath, JSON.stringify(patchEntities, null, 2));
        console.log(`实体提取完成，保存到: ${tempEntitiesPath}`);
        // 获取删除的文件列表
        const deletedFiles = gitProvider.getDeletedFiles();
        console.log('deletedFiles', deletedFiles.map(file => path_1.default.relative(options.root, file)));
        // 从现有实体中移除已删除文件中的实体
        const entitiesAfterDeletion = deletedFiles.length > 0
            ? finalEntities.filter(entity => {
                if (!entity.file)
                    return true;
                return !deletedFiles.some(deletedFile => entity.file === path_1.default.relative(options.root, deletedFile));
            })
            : finalEntities;
        // 3. 富化实体
        const tempEnrichedPath = path_1.default.join(options.root, 'data/patch-entities.enriched.json');
        if (patchEntities.length > 0) {
            await (0, enrichment_1.enrichEntities)(tempEntitiesPath, tempEnrichedPath, options.root, {
                concurrency: parseInt(options.concurrency, 10),
                maxRetries: parseInt(options.retries, 10),
                retryDelay: parseInt(options.retryDelay, 10)
            }, entitiesAfterDeletion);
            console.log(`实体富化完成，保存到: ${tempEnrichedPath}`);
        }
        else {
            // 如果没有实体，创建一个空的富化文件
            fs_1.default.writeFileSync(tempEnrichedPath, JSON.stringify([], null, 2));
            console.log('没有实体需要富化');
        }
        // 4. 合并到现有的 entities.enriched.json
        const existingEnrichedPath = path_1.default.join(options.root, 'data/entities.enriched.json');
        let existingEntities = [];
        if (fs_1.default.existsSync(existingEnrichedPath)) {
            const existingContent = fs_1.default.readFileSync(existingEnrichedPath, 'utf-8');
            existingEntities = JSON.parse(existingContent);
        }
        // 从现有实体中移除已删除文件中的实体
        const mergedEnrichedEntities = deletedFiles.length > 0
            ? existingEntities.filter(entity => {
                if (!entity.file)
                    return true;
                return !deletedFiles.some(deletedFile => entity.file === path_1.default.relative(options.root, deletedFile));
            })
            : existingEntities;
        // 如果有新的实体，添加或更新它们
        if (patchEntities.length > 0) {
            const newEnrichedContent = fs_1.default.readFileSync(tempEnrichedPath, 'utf-8');
            const newEntities = JSON.parse(newEnrichedContent);
            // 创建现有实体的Map，用于快速查找
            const existingEntitiesMap = new Map(mergedEnrichedEntities.map(entity => [entity.id, entity]));
            // 处理新实体
            for (const newEntity of newEntities) {
                if (existingEntitiesMap.has(newEntity.id)) {
                    // 如果ID存在，更新实体
                    const index = mergedEnrichedEntities.findIndex(e => e.id === newEntity.id);
                    mergedEnrichedEntities[index] = newEntity;
                }
                else {
                    // 如果ID不存在，添加新实体
                    mergedEnrichedEntities.push(newEntity);
                }
            }
        }
        // 保存合并后的结果
        fs_1.default.writeFileSync(existingEnrichedPath, JSON.stringify(mergedEnrichedEntities, null, 2));
        console.log(`合并完成，结果保存到: ${existingEnrichedPath}`);
        // 清理临时文件
        if (patchEntities.length > 0) {
            if (fs_1.default.existsSync(tempEntitiesPath)) {
                fs_1.default.unlinkSync(tempEntitiesPath);
            }
            if (fs_1.default.existsSync(tempEnrichedPath)) {
                fs_1.default.unlinkSync(tempEnrichedPath);
            }
        }
        process.exit(0);
    }
    catch (error) {
        console.error(`处理失败: ${error.message}`);
        process.exit(1);
    }
});
// 执行命令行程序
program.parse();
