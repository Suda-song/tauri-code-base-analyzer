"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fileWalker_1 = require("./fileWalker");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// 获取项目根目录
function getProjectRoot() {
    return path_1.default.resolve(__dirname, '../../../');
}
(0, vitest_1.describe)('Parser Agent', () => {
    const projectRoot = getProjectRoot();
    const fixtureDir = path_1.default.join(projectRoot, 'apps/after-sale-demo');
    // 检查目录是否存在
    const dirExists = fs_1.default.existsSync(fixtureDir);
    console.log(`Fixture 目录 ${fixtureDir} 存在: ${dirExists}`);
    (0, vitest_1.it)('should extract at least one entity from the fixture project', async () => {
        // 打印工作目录和目标目录
        console.log('当前工作目录:', process.cwd());
        console.log('目标目录:', fixtureDir);
        const entities = await (0, fileWalker_1.extractAllEntities)(fixtureDir);
        console.log('提取到的实体:', entities);
        (0, vitest_1.expect)(Array.isArray(entities)).toBe(true);
        (0, vitest_1.expect)(entities.length).toBeGreaterThan(0);
        const hasComponent = entities.some(e => e.type === 'component');
        (0, vitest_1.expect)(hasComponent).toBe(true);
    });
    (0, vitest_1.it)('should ensure all entity IDs are unique', async () => {
        // 如果目录不存在，跳过测试
        if (!dirExists) {
            console.warn('测试目录不存在，跳过测试');
            return;
        }
        const entities = await (0, fileWalker_1.extractAllEntities)(fixtureDir);
        // 提取所有实体ID
        const entityIds = entities.map(entity => entity.id);
        // 创建Set去重，如果去重前后数量相同，表示没有重复
        const uniqueIds = new Set(entityIds);
        console.log(`提取到 ${entities.length} 个实体，唯一ID数: ${uniqueIds.size}`);
        (0, vitest_1.expect)(uniqueIds.size).toBe(entityIds.length);
        // 检查是否有重复ID并列出来
        const idCounts = new Map();
        entityIds.forEach(id => {
            idCounts.set(id, (idCounts.get(id) || 0) + 1);
        });
        const duplicates = [...idCounts.entries()]
            .filter(([_, count]) => count > 1)
            .map(([id, count]) => ({ id, count }));
        if (duplicates.length > 0) {
            console.warn('发现重复ID:', duplicates);
        }
        (0, vitest_1.expect)(duplicates.length).toBe(0);
    });
});
