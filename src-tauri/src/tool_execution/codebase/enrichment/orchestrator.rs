use super::interfaces::{EnrichedEntity, EnrichmentConfig, LLMResponse, StaticAnalysisResult};
use super::loader::{load_entities, validate_entities};
use super::persistence::save_enriched_entities;
use super::static_analyzer::StaticAnalyzer;
use crate::claude_client::{ClaudeClient, Message};
use crate::tool_execution::codebase::CodeEntity;
use anyhow::{Context, Result};
use futures::stream::{self, StreamExt};
use std::sync::Arc;
use tokio::time::{sleep, Duration};

/// Enrichment 编排器
///
/// 协调实体加载、静态分析、LLM标注和结果持久化
pub struct EnrichmentOrchestrator {
    config: EnrichmentConfig,
    root_dir: String,
    static_analyzer: Option<Arc<StaticAnalyzer>>,
    full_entities: Option<Vec<CodeEntity>>,
    claude_client: Option<Arc<ClaudeClient>>,
}

impl EnrichmentOrchestrator {
    /// 创建编排器
    pub fn new(
        root_dir: String,
        config: Option<EnrichmentConfig>,
        full_entities: Option<Vec<CodeEntity>>,
    ) -> Self {
        let config = config.unwrap_or_default();
        let static_analyzer = if config.pre_initialize && full_entities.is_some() {
            Some(Arc::new(StaticAnalyzer::new(
                &root_dir,
                full_entities.clone().unwrap(),
            )))
        } else {
            None
        };

        // 尝试创建 Claude 客户端
        let claude_client = match ClaudeClient::new() {
            Ok(client) => {
                println!("✅ Claude 客户端初始化成功");
                Some(Arc::new(client))
            }
            Err(e) => {
                println!("⚠️  Claude 客户端初始化失败: {}，将使用回退逻辑", e);
                None
            }
        };

        Self {
            config,
            root_dir,
            static_analyzer,
            full_entities,
            claude_client,
        }
    }

    /// 运行完整的富化流程
    pub async fn run(&mut self) -> Result<String> {
        println!("🚀 开始实体富化流程...");

        // 步骤1: 加载实体
        let entities = self.load_and_validate_entities(&self.config.input_path.clone())?;

        if entities.is_empty() {
            println!("⚠️  没有有效实体可处理，流程终止");
            return Ok(String::new());
        }

        // 创建静态分析器
        let entities_to_use = self
            .full_entities
            .clone()
            .unwrap_or_else(|| entities.clone());
        let static_analyzer = Arc::new(StaticAnalyzer::new(&self.root_dir, entities_to_use));
        self.static_analyzer = Some(static_analyzer.clone());

        // 步骤2: 为每个实体执行富化
        let enriched_entities = self.enrich_entities(entities, static_analyzer).await?;

        // 步骤3: 保存结果
        let output_path = save_enriched_entities(
            enriched_entities,
            &self.config.output_path,
            Some(&self.root_dir),
        )?;

        println!("🎉 富化流程完成!");
        Ok(output_path)
    }

    /// 直接处理实体数组（无需文件I/O）
    pub async fn enrich_entities_directly(
        &mut self,
        entities_to_enrich: Vec<CodeEntity>,
        full_entities: Vec<CodeEntity>,
    ) -> Result<Vec<EnrichedEntity>> {
        if entities_to_enrich.is_empty() {
            println!("⚠️  没有实体需要富化");
            return Ok(vec![]);
        }

        println!(
            "🚀 开始直接富化 {} 个实体，上下文包含 {} 个实体",
            entities_to_enrich.len(),
            full_entities.len()
        );

        // 确保分析器实例存在
        let static_analyzer = if let Some(analyzer) = &self.static_analyzer {
            analyzer.clone()
        } else {
            let analyzer = Arc::new(StaticAnalyzer::new(&self.root_dir, full_entities));
            self.static_analyzer = Some(analyzer.clone());
            analyzer
        };

        // 执行富化处理
        let enriched_entities = self
            .enrich_entities(entities_to_enrich, static_analyzer)
            .await?;

        println!("✅ 直接富化完成，处理了 {} 个实体", enriched_entities.len());
        Ok(enriched_entities)
    }

    /// 加载并验证实体
    fn load_and_validate_entities(&self, input_path: &str) -> Result<Vec<CodeEntity>> {
        let entities = load_entities(input_path, Some(&self.root_dir))?;
        Ok(validate_entities(entities))
    }

    /// 批量富化实体
    async fn enrich_entities(
        &self,
        entities: Vec<CodeEntity>,
        static_analyzer: Arc<StaticAnalyzer>,
    ) -> Result<Vec<EnrichedEntity>> {
        println!("📦 开始处理 {} 个实体...", entities.len());

        let concurrency = self.config.concurrency;
        let max_retries = self.config.max_retries;
        let retry_delay = self.config.retry_delay;
        let claude_client = self.claude_client.clone();

        // 使用 futures 流处理并发
        let results: Vec<EnrichedEntity> = stream::iter(entities)
            .map(|entity| {
                let analyzer = static_analyzer.clone();
                let client = claude_client.clone();
                let retries = max_retries;
                let delay = retry_delay;

                async move {
                    Self::enrich_entity_with_retry(entity, analyzer, client, retries, delay).await
                }
            })
            .buffer_unordered(concurrency)
            .collect()
            .await;

        println!("✅ 完成 {} 个实体的富化", results.len());
        Ok(results)
    }

    /// 富化单个实体（带重试）
    async fn enrich_entity_with_retry(
        entity: CodeEntity,
        static_analyzer: Arc<StaticAnalyzer>,
        claude_client: Option<Arc<ClaudeClient>>,
        mut retries_left: usize,
        retry_delay: u64,
    ) -> EnrichedEntity {
        loop {
            match Self::enrich_entity(&entity, &static_analyzer, &claude_client).await {
                Ok(enriched) => return enriched,
                Err(e) => {
                    if retries_left > 0 {
                        println!(
                            "⚠️  处理实体 {} 失败，剩余重试次数: {}，错误: {}",
                            entity.id, retries_left, e
                        );
                        retries_left -= 1;
                        sleep(Duration::from_millis(retry_delay)).await;
                    } else {
                        println!("❌ 处理实体 {} 最终失败: {}", entity.id, e);
                        // 返回带有错误信息的部分富化实体
                        return EnrichedEntity {
                            base: entity.clone(),
                            imports: vec![],
                            calls: vec![],
                            emits: vec![],
                            template_components: None,
                            annotation: None,
                            summary: format!("处理失败: {}", e),
                            tags: vec!["处理失败".to_string()],
                        };
                    }
                }
            }
        }
    }

    /// 富化单个实体
    async fn enrich_entity(
        entity: &CodeEntity,
        static_analyzer: &StaticAnalyzer,
        claude_client: &Option<Arc<ClaudeClient>>,
    ) -> Result<EnrichedEntity> {
        println!("🔍 处理实体: {}", entity.id);

        // 步骤1: 执行静态分析
        let analysis_result = static_analyzer
            .analyze_entity(entity)
            .await
            .context("静态分析失败")?;

        // 步骤2: 调用LLM生成摘要和标签
        let llm_response = if let Some(client) = claude_client {
            match Self::generate_labels_with_llm(entity, &analysis_result, client).await {
                Ok(response) => {
                    println!("✅ LLM 分析成功: {}", entity.id);
                    response
                }
                Err(e) => {
                    // 详细打印错误信息
                    eprintln!("\n❌ ========== LLM 调用失败 ==========");
                    eprintln!("🆔 实体 ID: {}", entity.id);
                    eprintln!("📄 文件路径: {}", entity.file);
                    eprintln!("📝 实体名称: {}", entity.raw_name);
                    eprintln!(
                        "📍 位置: {}:{}-{}",
                        entity.file, entity.loc.start_line, entity.loc.end_line
                    );
                    eprintln!("\n🔍 错误详情:");

                    // 解析错误链，打印所有层级的错误
                    eprintln!("   主错误: {}", e);
                    if let Some(source) = e.source() {
                        eprintln!("   原因: {}", source);
                        if let Some(root_cause) = source.source() {
                            eprintln!("   根本原因: {}", root_cause);
                        }
                    }

                    // 如果错误链中包含完整的错误调试信息
                    eprintln!("\n🐛 调试信息:");
                    eprintln!("{:#?}", e);
                    eprintln!("=====================================\n");

                    Self::generate_labels_fallback(entity, &analysis_result)
                }
            }
        } else {
            println!("ℹ️  使用回退逻辑生成标签: {}", entity.id);
            Self::generate_labels_fallback(entity, &analysis_result)
        };

        // 返回富化后的实体
        Ok(EnrichedEntity {
            base: entity.clone(),
            imports: analysis_result.imports,
            calls: analysis_result.calls,
            emits: analysis_result.emits,
            template_components: analysis_result.template_components,
            annotation: analysis_result.annotation,
            summary: llm_response.summary,
            tags: llm_response.tags,
        })
    }

    /// 使用 LLM 生成标签和摘要
    async fn generate_labels_with_llm(
        entity: &CodeEntity,
        analysis: &StaticAnalysisResult,
        claude_client: &ClaudeClient,
    ) -> Result<LLMResponse> {
        // 1. 构建提示词
        let prompt = Self::build_llm_prompt(entity, analysis);

        // 2. 构建系统提示
        let system_prompt = r#"你是一个代码理解助手。请为以下代码实体生成简洁的业务摘要和标签。

在分析完成后，必须以下列JSON格式回复：
{
  "summary": "不超过160个字符的功能摘要",
  "tags": ["标签1", "标签2", "标签3", "标签4", "标签5"]
}

注意：
1. 不要解释你的分析过程，直接返回JSON格式的结果。
2. 确保你的回复可以被JSON.parse()解析。
3. 如果存在注释信息，请优先参考注释内容来生成摘要和标签。
4. 摘要必须在160个字符以内。
5. 标签数量为3-5个。"#;

        // 3. 调用 Claude API
        let response = claude_client
            .send_message(
                vec![Message::user(prompt)],
                Some(system_prompt.to_string()),
                2048,
                None, // 暂时不使用工具，后续可以扩展
            )
            .await
            .context("Claude API 调用失败")?;

        // 4. 解析响应
        let response_text = response.get_text();
        Self::parse_llm_response(&response_text, entity, analysis)
    }

    /// 构建 LLM 提示词
    fn build_llm_prompt(entity: &CodeEntity, analysis: &StaticAnalysisResult) -> String {
        let imports_text = if analysis.imports.is_empty() {
            "  无".to_string()
        } else {
            analysis
                .imports
                .iter()
                .map(|id| format!("  - {}", id))
                .collect::<Vec<_>>()
                .join("\n")
        };

        let calls_text = if analysis.calls.is_empty() {
            "  无".to_string()
        } else {
            analysis
                .calls
                .iter()
                .map(|id| format!("  - {}", id))
                .collect::<Vec<_>>()
                .join("\n")
        };

        let emits_text = if analysis.emits.is_empty() {
            "无".to_string()
        } else {
            analysis.emits.join(", ")
        };

        let annotation_text = if let Some(annotation) = &analysis.annotation {
            format!("- 注释: {}\n", annotation)
        } else {
            String::new()
        };

        let template_components_text = if let Some(components) = &analysis.template_components {
            if !components.is_empty() {
                format!("- 模板组件: {}\n", components.join(", "))
            } else {
                String::new()
            }
        } else {
            String::new()
        };

        format!(
            r#"实体信息:
- 类型: {}
- 名称: {}
- 文件: {}
{}
代码分析:
- 导入:
{}

- 调用:
{}

- 事件: {}
{}
请按照以下要求生成摘要和标签：

1. 摘要要求：
   - 必须控制在160个字符以内
   - 简明扼要地描述实体的主要功能和用途
   - 使用中文描述
   - 避免使用"这个组件"、"该函数"等指代词
   - 如果注释中包含业务信息，请优先使用注释内容来生成摘要

2. 标签要求：
   - 生成3-5个标签
   - 每个标签使用1-3个词语
   - 标签应该反映实体的功能、类型、用途等特征
   - 优先使用业务相关的标签
   - 避免过于宽泛的标签（如"组件"、"函数"等）
   - 如果注释中包含业务信息，请优先使用注释内容来生成标签"#,
            entity.entity_type,
            entity.raw_name,
            entity.file,
            annotation_text,
            imports_text,
            calls_text,
            emits_text,
            template_components_text
        )
    }

    /// 解析 LLM 响应
    fn parse_llm_response(
        text: &str,
        entity: &CodeEntity,
        analysis: &StaticAnalysisResult,
    ) -> Result<LLMResponse> {
        use regex::Regex;

        // 尝试提取 JSON 部分
        let json_regex = Regex::new(r"\{[\s\S]*?\}").unwrap();

        if let Some(json_match) = json_regex.find(text) {
            let json_text = json_match.as_str();

            // 尝试解析 JSON
            match serde_json::from_str::<LLMResponse>(json_text) {
                Ok(mut response) => {
                    // 确保摘要不超过 160 个字符
                    if response.summary.chars().count() > 160 {
                        response.summary = response.summary.chars().take(160).collect();
                    }

                    // 确保标签数量在 3-5 个
                    if response.tags.is_empty() {
                        response.tags = vec![entity.entity_type.clone()];
                    }
                    response.tags.truncate(5);

                    Ok(response)
                }
                Err(e) => {
                    println!("⚠️  解析 LLM 响应失败: {}", e);
                    Ok(Self::generate_labels_fallback(entity, analysis))
                }
            }
        } else {
            println!("⚠️  LLM 响应中未找到 JSON 格式");
            Ok(Self::generate_labels_fallback(entity, analysis))
        }
    }

    /// LLM 标签生成的回退逻辑（简化版本）
    fn generate_labels_fallback(
        entity: &CodeEntity,
        analysis: &StaticAnalysisResult,
    ) -> LLMResponse {
        // 生成简单的摘要
        let summary = if let Some(annotation) = &analysis.annotation {
            // 如果有注释，使用注释作为摘要
            annotation.chars().take(160).collect()
        } else {
            // 否则生成简单描述
            format!(
                "{}: {}，导入{}个依赖，调用{}个函数",
                entity.entity_type,
                entity.raw_name,
                analysis.imports.len(),
                analysis.calls.len()
            )
        };

        // 生成标签
        let mut tags = vec![entity.entity_type.clone()];

        if analysis.imports.len() > 5 {
            tags.push("复杂依赖".to_string());
        }

        if analysis.calls.len() > 10 {
            tags.push("多调用".to_string());
        }

        if !analysis.emits.is_empty() {
            tags.push("事件触发".to_string());
        }

        if let Some(components) = &analysis.template_components {
            if !components.is_empty() {
                tags.push("UI组件".to_string());
            }
        }

        LLMResponse { summary, tags }
    }
}
