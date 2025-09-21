import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { tool } from 'ai';

// 读取文件工具的参数schema
export const readFileSchema = z.object({
  file_path: z.string().describe('要读取的文件路径，相对于项目根目录')
});

// 工具类型定义
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
export function createReadFileTool(projectRoot: string): Tool {
  return {
    name: 'read_file',
    description: '读取指定文件的内容',
    schema: readFileSchema,
    execute: async (args: z.infer<typeof readFileSchema>) => {
      try {
        console.log(`正在读取文件: ${args.file_path}`);
        const filePath = path.resolve(projectRoot, args.file_path);
        
        if (!fs.existsSync(filePath)) {
          return `错误: 文件 ${args.file_path} 不存在`;
        }
        
        const content = fs.readFileSync(filePath, 'utf-8');
        return content;
      } catch (error) {
        console.error(`读取文件失败: ${(error as Error).message}`);
        return `读取文件失败: ${(error as Error).message}`;
      }
    }
  };
}

/**
 * 创建所有可用工具
 * @param projectRoot 项目根目录
 */
export function createTools(projectRoot: string): Tool[] {
  return [
    createReadFileTool(projectRoot)
  ];
}

/**
 * @param tools 工具数组
 */
export function createToolsMap(tools: Tool[]): Record<string, any> {
  return tools.reduce((acc, toolItem) => {
    acc[toolItem.name] = tool({
        parameters: toolItem.schema,
        description: toolItem.description,
        execute: toolItem.execute
    })
    return acc;
  }, {} as Record<string, any>);
} 