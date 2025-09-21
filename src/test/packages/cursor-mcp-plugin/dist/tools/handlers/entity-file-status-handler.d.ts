import { BaseHandler, ToolResult } from "./base-handler";
/**
 * 实体文件状态管理处理器
 */
export declare class EntityFileStatusHandler extends BaseHandler {
    constructor(hasEntitiesFile: boolean);
    /**
     * 处理实体文件状态管理
     * @param action 操作类型：'status' 或 'reload'
     * @returns 处理结果
     */
    handle(action: string): Promise<ToolResult>;
    /**
     * 获取实体文件状态（多workspace支持）
     */
    private getFileStatus;
    /**
     * 手动重新加载实体文件（多workspace支持）
     */
    private reloadEntities;
}
