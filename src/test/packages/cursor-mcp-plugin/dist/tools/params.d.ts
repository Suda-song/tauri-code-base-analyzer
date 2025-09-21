import { z } from "zod";
export declare const TOOL_PARAMS: {
    readonly startAnalysis: {
        readonly input: z.ZodString;
        readonly sessionId: z.ZodOptional<z.ZodString>;
    };
    readonly selectCoreComponent: {
        readonly sessionId: z.ZodString;
        readonly maxRelated: z.ZodOptional<z.ZodNumber>;
        readonly workspaceEntities: z.ZodOptional<z.ZodString>;
    };
    readonly modifyEntitySelection: {
        readonly sessionId: z.ZodString;
        readonly maxRelated: z.ZodOptional<z.ZodNumber>;
        readonly workspaceEntities: z.ZodOptional<z.ZodString>;
    };
    readonly generateCodePrompt: {
        readonly sessionId: z.ZodString;
        readonly additionalContext: z.ZodOptional<z.ZodString>;
        readonly workspaceEntities: z.ZodOptional<z.ZodString>;
    };
    readonly quickAnalysis: {
        readonly input: z.ZodString;
        readonly componentIndex: z.ZodOptional<z.ZodNumber>;
        readonly includeRelated: z.ZodOptional<z.ZodBoolean>;
        readonly maxRelated: z.ZodOptional<z.ZodNumber>;
        readonly additionalContext: z.ZodOptional<z.ZodString>;
    };
    readonly entityFileStatus: {
        readonly action: z.ZodEnum<["status", "reload"]>;
    };
};
export declare const TOOL_NAMES: {
    readonly START_ANALYSIS: "start-analysis";
    readonly SELECT_CORE_COMPONENT: "select-core-component";
    readonly MODIFY_ENTITY_SELECTION: "modify-entity-selection";
    readonly GENERATE_CODE_PROMPT: "generate-code-prompt";
    readonly QUICK_ANALYSIS: "quick-analysis";
    readonly ENTITY_FILE_STATUS: "entity-file-status";
};
export declare const TOOL_DESCRIPTIONS: {
    readonly "start-analysis": "🚀 智能代码分析助手123：分析任何编程需求，推荐相关的代码组件。这是开始代码开发、修复或优化的首选工具。支持功能开发、Bug修复、性能优化、代码重构等所有编程场景。";
    readonly "select-core-component": "🎯 组件选择器：从分析结果中选择核心组件，AI自动关联相关实体。适合在start-analysis之后使用。";
    readonly "modify-entity-selection": "🔧 精确实体控制：手动调整代码实体选择，支持添加、移除、替换操作。适合需要精确控制的高级用户。";
    readonly "generate-code-prompt": "📝 代码生成器：基于选定的实体生成完整的代码实现提示词。这是生成最终代码的工具。";
    readonly "quick-analysis": "⚡ 一键出码：跳过所有交互，直接从需求生成代码提示词。适合简单需求的快速开发。";
    readonly "entity-file-status": "📁 实体文件管理：查看实体文件状态或手动重新加载。当实体文件更新后可以使用此工具刷新数据。";
};
export declare const TOOL_USAGE_HINTS: {
    readonly "start-analysis": "🎯 使用时机：用户提到任何编程相关需求时都应该首先调用此工具，包括功能开发、Bug修复、性能优化、代码重构等。这是代码分析的主要入口点。";
    readonly "select-core-component": "💡 使用时机：在start-analysis完成后，选择最合适的核心组件进行深入分析。";
    readonly "modify-entity-selection": "⚙️ 使用时机：需要精确控制代码实体选择时使用，适合高级用户。";
    readonly "generate-code-prompt": "✨ 使用时机：完成实体选择后，生成最终的代码实现提示词。";
    readonly "quick-analysis": "🚀 使用时机：用户明确要求快速解决方案或一键生成代码时使用。";
    readonly "entity-file-status": "🔄 使用时机：当实体文件被parser-agent更新后，或需要检查实体文件加载状态时使用。";
};
export declare const getFullToolDescription: (toolName: keyof typeof TOOL_DESCRIPTIONS) => string;
