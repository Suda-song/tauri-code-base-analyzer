import { BaseHandler, ToolResult } from "./base-handler";
export declare class ModifyEntityHandler extends BaseHandler {
    constructor(hasEntitiesFile: boolean);
    /**
     * 处理workspaceEntities格式的实体选择
     */
    private handleWorkspaceEntities;
    /**
     * 格式化下一步操作选项
     */
    private formatNextStepsActions;
    handle(sessionId: string, maxRelated?: number, workspaceEntities?: string): Promise<ToolResult>;
}
