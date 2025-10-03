use crate::tool_execution::codebase::CodeEntity;
use serde::{Deserialize, Serialize};

/// 富化后的实体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrichedEntity {
    /// 基础实体信息
    #[serde(flatten)]
    pub base: CodeEntity,

    /// 导入的实体ID列表
    #[serde(rename = "IMPORTS")]
    pub imports: Vec<String>,

    /// 调用的函数/方法ID列表
    #[serde(rename = "CALLS")]
    pub calls: Vec<String>,

    /// 触发的事件列表
    #[serde(rename = "EMITS")]
    pub emits: Vec<String>,

    /// 模板中使用的组件列表（仅Vue组件）
    #[serde(
        rename = "TEMPLATE_COMPONENTS",
        skip_serializing_if = "Option::is_none"
    )]
    pub template_components: Option<Vec<String>>,

    /// 注释/文档
    #[serde(rename = "ANNOTATION", skip_serializing_if = "Option::is_none")]
    pub annotation: Option<String>,

    /// LLM 生成的摘要
    pub summary: String,

    /// LLM 生成的标签
    pub tags: Vec<String>,
}

/// 静态分析结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StaticAnalysisResult {
    /// 导入的实体ID列表
    #[serde(rename = "IMPORTS")]
    pub imports: Vec<String>,

    /// 调用的函数/方法ID列表
    #[serde(rename = "CALLS")]
    pub calls: Vec<String>,

    /// 触发的事件列表
    #[serde(rename = "EMITS")]
    pub emits: Vec<String>,

    /// 模板中使用的组件列表（仅Vue组件）
    #[serde(
        rename = "TEMPLATE_COMPONENTS",
        skip_serializing_if = "Option::is_none"
    )]
    pub template_components: Option<Vec<String>>,

    /// 注释/文档
    #[serde(rename = "ANNOTATION", skip_serializing_if = "Option::is_none")]
    pub annotation: Option<String>,
}

/// LLM 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMResponse {
    /// 摘要
    pub summary: String,

    /// 标签列表
    pub tags: Vec<String>,
}

/// Enrichment 配置
#[derive(Debug, Clone)]
pub struct EnrichmentConfig {
    /// 并发数
    pub concurrency: usize,

    /// 最大重试次数
    pub max_retries: usize,

    /// 重试延迟（毫秒）
    pub retry_delay: u64,

    /// 输入路径
    pub input_path: String,

    /// 输出路径
    pub output_path: String,

    /// 是否预初始化
    pub pre_initialize: bool,
}

impl Default for EnrichmentConfig {
    fn default() -> Self {
        Self {
            concurrency: 1,
            max_retries: 3,
            retry_delay: 1000,
            input_path: "entities.json".to_string(),
            output_path: "entities.enriched.json".to_string(),
            pre_initialize: false,
        }
    }
}
