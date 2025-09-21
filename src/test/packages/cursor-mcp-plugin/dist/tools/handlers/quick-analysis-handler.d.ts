import { BaseHandler, ToolResult } from "./base-handler";
export declare class QuickAnalysisHandler extends BaseHandler {
    handle(input: string, componentIndex?: number, includeRelated?: boolean, maxRelated?: number, additionalContext?: string): Promise<ToolResult>;
}
