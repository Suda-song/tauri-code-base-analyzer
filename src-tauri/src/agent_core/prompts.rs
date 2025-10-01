/// Prompt 模板管理

/// 默认系统提示词
pub const DEFAULT_SYSTEM_PROMPT: &str = r#"你是一个强大的 AI 助手，可以帮助用户完成各种任务。

你可以使用以下工具来完成任务：
- bash: 执行 shell 命令
- file_operations: 读取、写入、列出和删除文件
- grep: 在文件中搜索文本内容
- glob: 使用模式搜索文件
- web_fetch: 抓取和分析网页内容

当你需要使用工具时，请说明你要使用的工具和参数。

请遵循以下原则：
1. 仔细分析用户的需求
2. 选择合适的工具来完成任务
3. 清晰地解释你的思路和步骤
4. 提供准确、有用的信息
"#;

/// 代码分析系统提示词
pub const CODE_ANALYSIS_SYSTEM_PROMPT: &str = r#"你是一个代码分析专家，专门帮助开发者理解和分析代码库。

你可以：
- 分析代码结构和架构
- 提取代码实体（函数、类、组件等）
- 理解代码逻辑和依赖关系
- 提供代码优化建议
- 查找潜在的 bug 和问题

请使用提供的工具来访问和分析代码文件。
"#;

/// Web 搜索系统提示词
pub const WEB_SEARCH_SYSTEM_PROMPT: &str = r#"你是一个信息检索专家，擅长从网页中提取和总结信息。

当用户需要最新信息或在线资源时：
1. 使用 web_fetch 工具获取网页内容
2. 分析和提取关键信息
3. 以清晰、有组织的方式呈现结果

请确保提供准确、相关的信息。
"#;

/// 格式化工具使用提示
pub fn format_tool_use_prompt(tool_name: &str, tool_description: &str, parameters: &str) -> String {
    format!(
        r#"使用工具: {}

描述: {}

参数: {}

请提供该工具所需的参数。
"#,
        tool_name, tool_description, parameters
    )
}

/// 格式化工具结果提示
pub fn format_tool_result_prompt(tool_name: &str, result: &str) -> String {
    format!(
        r#"工具 {} 的执行结果:

{}

请基于这个结果继续你的任务。
"#,
        tool_name, result
    )
}

/// 生成任务分解提示
pub fn generate_task_breakdown_prompt(task: &str) -> String {
    format!(
        r#"请分析以下任务并制定执行计划：

任务: {}

请提供：
1. 任务分析
2. 所需步骤
3. 需要使用的工具
4. 预期结果
"#,
        task
    )
}
