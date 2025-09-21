"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFileSchema = void 0;
exports.createReadFileTool = createReadFileTool;
exports.createTools = createTools;
exports.createToolsMap = createToolsMap;
const zod_1 = require("zod");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ai_1 = require("ai");
// 读取文件工具的参数schema
exports.readFileSchema = zod_1.z.object({
    file_path: zod_1.z.string().describe('要读取的文件路径，相对于项目根目录')
});
/**
 * 创建读取文件工具
 * @param projectRoot 项目根目录
 */
function createReadFileTool(projectRoot) {
    return {
        name: 'read_file',
        description: '读取指定文件的内容',
        schema: exports.readFileSchema,
        execute: async (args) => {
            try {
                console.log(`正在读取文件: ${args.file_path}`);
                const filePath = path_1.default.resolve(projectRoot, args.file_path);
                if (!fs_1.default.existsSync(filePath)) {
                    return `错误: 文件 ${args.file_path} 不存在`;
                }
                const content = fs_1.default.readFileSync(filePath, 'utf-8');
                return content;
            }
            catch (error) {
                console.error(`读取文件失败: ${error.message}`);
                return `读取文件失败: ${error.message}`;
            }
        }
    };
}
/**
 * 创建所有可用工具
 * @param projectRoot 项目根目录
 */
function createTools(projectRoot) {
    return [
        createReadFileTool(projectRoot)
    ];
}
/**
 * @param tools 工具数组
 */
function createToolsMap(tools) {
    return tools.reduce((acc, toolItem) => {
        acc[toolItem.name] = (0, ai_1.tool)({
            parameters: toolItem.schema,
            description: toolItem.description,
            execute: toolItem.execute
        });
        return acc;
    }, {});
}
