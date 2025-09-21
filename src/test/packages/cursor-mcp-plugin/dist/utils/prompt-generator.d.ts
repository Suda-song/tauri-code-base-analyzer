import { Entity } from "../types";
/**
 * 生成代码提示词的辅助函数（支持多workspace）
 * @param userInput 用户输入
 * @param entities 实体列表
 * @param additionalContext 额外上下文
 * @returns 生成的代码提示词
 */
export declare function generateCodePrompt(userInput: string, entities: Entity[], additionalContext?: string): string;
