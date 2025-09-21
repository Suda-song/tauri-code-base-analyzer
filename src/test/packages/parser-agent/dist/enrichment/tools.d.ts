import { z } from 'zod';
export declare const readFileSchema: z.ZodObject<{
    file_path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    file_path: string;
}, {
    file_path: string;
}>;
export interface Tool {
    name: string;
    description: string;
    schema: z.ZodType<any>;
    execute: (args: any) => Promise<string>;
}
/**
 * 创建读取文件工具
 * @param projectRoot 项目根目录
 */
export declare function createReadFileTool(projectRoot: string): Tool;
/**
 * 创建所有可用工具
 * @param projectRoot 项目根目录
 */
export declare function createTools(projectRoot: string): Tool[];
/**
 * @param tools 工具数组
 */
export declare function createToolsMap(tools: Tool[]): Record<string, any>;
