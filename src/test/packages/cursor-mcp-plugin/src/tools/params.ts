import { z } from "zod";

export const TOOL_PARAMS = {
  startAnalysis: {
    input: z
      .string()
      .describe(
        "用户的开发需求描述。可以是功能开发、Bug修复、性能优化、代码重构等任何编程相关需求。例如：'实现登录功能'、'修复购物车bug'、'优化列表性能'、'重构用户模块'等。"
      ),
    sessionId: z.string().optional().describe("可选的会话ID，用于多轮对话跟踪"),
  },
  selectCoreComponent: {
    sessionId: z.string().describe("当前分析会话的唯一标识符"),
    maxRelated: z
      .number()
      .optional()
      .describe("最大关联实体数量，默认为1，可设置1-10"),
    workspaceEntities: z
      .string()
      .optional()
      .describe(
        "跨workspace实体选择格式，例如：'workspace1:entity1,entity2;workspace2:entity3,entity4'。支持单workspace或跨workspace多选"
      ),
  },
  modifyEntitySelection: {
    sessionId: z.string().describe("当前分析会话的唯一标识符"),
    maxRelated: z
      .number()
      .optional()
      .describe("获取相关实体时的最大数量，默认为3，可设置1-20"),
    workspaceEntities: z
      .string()
      .optional()
      .describe(
        "跨workspace实体选择格式，例如：'workspace1:entity1,entity2;workspace2:entity3,entity4'。支持单workspace或跨workspace多选"
      ),
  },
  generateCodePrompt: {
    sessionId: z.string().describe("当前分析会话的唯一标识符"),
    additionalContext: z
      .string()
      .optional()
      .describe(
        "额外的上下文信息或特殊要求，将添加到生成的代码prompt中。例如：'需要兼容移动端'、'使用TypeScript'、'遵循无障碍设计原则'等"
      ),
    workspaceEntities: z
      .string()
      .optional()
      .describe(
        "跨workspace实体选择格式，例如：'workspace1:entity1,entity2;workspace2:entity3,entity4'。支持单workspace或跨workspace多选"
      ),
  },
  quickAnalysis: {
    input: z.string().describe("业务需求描述"),
    componentIndex: z
      .number()
      .optional()
      .describe("选择第几个推荐组件（从0开始），默认为0（第一个）"),
    includeRelated: z
      .boolean()
      .optional()
      .describe("是否包含相关实体，默认为true"),
    maxRelated: z
      .number()
      .optional()
      .describe("最大关联实体数量，默认为1，可设置1-10"),
    additionalContext: z.string().optional().describe("额外上下文信息"),
  },
  entityFileStatus: {
    action: z
      .enum(["status", "reload"])
      .describe(
        "操作类型：'status'显示实体文件状态信息, 'reload'手动重新加载实体文件"
      ),
  },
} as const;

export const TOOL_NAMES = {
  START_ANALYSIS: "start-analysis",
  SELECT_CORE_COMPONENT: "select-core-component",
  MODIFY_ENTITY_SELECTION: "modify-entity-selection",
  GENERATE_CODE_PROMPT: "generate-code-prompt",
  QUICK_ANALYSIS: "quick-analysis",
  ENTITY_FILE_STATUS: "entity-file-status",
} as const;

export const TOOL_DESCRIPTIONS = {
  [TOOL_NAMES.START_ANALYSIS]:
    "🚀 智能代码分析助手：分析任何编程需求，推荐相关的代码组件。这是开始代码开发、修复或优化的首选工具。支持功能开发、Bug修复、性能优化、代码重构等所有编程场景。",
  [TOOL_NAMES.SELECT_CORE_COMPONENT]:
    "🎯 组件选择器：从分析结果中选择核心组件，AI自动关联相关实体。适合在start-analysis之后使用。",
  [TOOL_NAMES.MODIFY_ENTITY_SELECTION]:
    "🔧 精确实体控制：手动调整代码实体选择，支持添加、移除、替换操作。适合需要精确控制的高级用户。",
  [TOOL_NAMES.GENERATE_CODE_PROMPT]:
    "📝 代码生成器：基于选定的实体生成完整的代码实现提示词。这是生成最终代码的工具。",
  [TOOL_NAMES.QUICK_ANALYSIS]:
    "⚡ 一键出码：跳过所有交互，直接从需求生成代码提示词。适合简单需求的快速开发。",
  [TOOL_NAMES.ENTITY_FILE_STATUS]:
    "📁 实体文件管理：查看实体文件状态或手动重新加载。当实体文件更新后可以使用此工具刷新数据。",
} as const;

// 工具使用时机说明 - 用于在工具注册时提供额外的使用指导
export const TOOL_USAGE_HINTS = {
  [TOOL_NAMES.START_ANALYSIS]:
    "🎯 使用时机：用户提到任何编程相关需求时都应该首先调用此工具，包括功能开发、Bug修复、性能优化、代码重构等。这是代码分析的主要入口点。",
  [TOOL_NAMES.SELECT_CORE_COMPONENT]:
    "💡 使用时机：在start-analysis完成后，选择最合适的核心组件进行深入分析。",
  [TOOL_NAMES.MODIFY_ENTITY_SELECTION]:
    "⚙️ 使用时机：需要精确控制代码实体选择时使用，适合高级用户。",
  [TOOL_NAMES.GENERATE_CODE_PROMPT]:
    "✨ 使用时机：完成实体选择后，生成最终的代码实现提示词。",
  [TOOL_NAMES.QUICK_ANALYSIS]:
    "🚀 使用时机：用户明确要求快速解决方案或一键生成代码时使用。",
  [TOOL_NAMES.ENTITY_FILE_STATUS]:
    "🔄 使用时机：当实体文件被parser-agent更新后，或需要检查实体文件加载状态时使用。",
} as const;

// 完整的工具描述 - 包含基础描述和使用时机
export const getFullToolDescription = (
  toolName: keyof typeof TOOL_DESCRIPTIONS
) => {
  return `${TOOL_DESCRIPTIONS[toolName]}\n\n${TOOL_USAGE_HINTS[toolName]}`;
};
