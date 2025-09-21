import { BaseHandler, ToolResult } from "./base-handler";
export declare class StartAnalysisHandler extends BaseHandler {
    /**
     * 格式化下一步操作选项（支持跨workspace多选）
     */
    private formatNextStepsActions;
    handle(input: string, sessionId?: string): Promise<ToolResult>;
}
