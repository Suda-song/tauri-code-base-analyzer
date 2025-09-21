import { BaseHandler, ToolResult } from "./base-handler";
export declare class GeneratePromptHandler extends BaseHandler {
    constructor(hasEntitiesFile: boolean);
    handle(sessionId: string, additionalContext?: string, workspaceEntities?: string): Promise<ToolResult>;
}
