export interface ToolResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
    [key: string]: any;
}
/**
 * 基础处理器类，提供通用功能
 */
export declare abstract class BaseHandler {
    protected hasEntitiesFile: boolean;
    protected multiWorkspaceManager: import("../../utils/multi-workspace-utils").MultiWorkspaceManager;
    constructor(hasEntitiesFile: boolean);
    protected checkEntitiesFile(): ToolResult | null;
}
