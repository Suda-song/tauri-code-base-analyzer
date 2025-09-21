/**
 * workspace实体格式处理工具函数
 */
/**
 * 解析workspaceEntities字符串为Map
 * 格式: "workspace1:entity1,entity2;workspace2:entity3,entity4"
 */
export declare function parseWorkspaceEntities(workspaceEntities: string): Map<string, string[]>;
/**
 * 构建示例选择（单workspace和跨workspace）
 */
export declare function buildExampleSelections(workspaceResults: Map<string, any>): {
    single: string;
    cross: string;
};
