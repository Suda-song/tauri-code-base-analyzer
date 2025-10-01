use async_trait::async_trait;
use serde_json::{json, Value as JsonValue};
use crate::claude_client::{ClaudeClient, Message};
use crate::tool_execution::tool_trait::{AgentTool, ToolResult};

/// Web 内容抓取和分析工具（AI 辅助）
pub struct WebFetchTool {
    /// Claude 客户端（用于分析网页内容）
    claude: ClaudeClient,
}

impl WebFetchTool {
    /// 创建新的 WebFetch 工具
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            claude: ClaudeClient::new()?,
        })
    }

    /// 清理 HTML 内容
    fn clean_html(&self, html: &str) -> String {
        // 简单的 HTML 清理，移除脚本和样式
        let mut cleaned = html.to_string();
        
        // 移除 <script> 标签
        let script_regex = regex::Regex::new(r"<script[^>]*>[\s\S]*?</script>").unwrap();
        cleaned = script_regex.replace_all(&cleaned, "").to_string();
        
        // 移除 <style> 标签
        let style_regex = regex::Regex::new(r"<style[^>]*>[\s\S]*?</style>").unwrap();
        cleaned = style_regex.replace_all(&cleaned, "").to_string();
        
        // 移除 HTML 标签
        let tag_regex = regex::Regex::new(r"<[^>]+>").unwrap();
        cleaned = tag_regex.replace_all(&cleaned, " ").to_string();
        
        // 压缩空白
        let whitespace_regex = regex::Regex::new(r"\s+").unwrap();
        cleaned = whitespace_regex.replace_all(&cleaned, " ").to_string();
        
        cleaned.trim().to_string()
    }
}

#[async_trait]
impl AgentTool for WebFetchTool {
    fn name(&self) -> &str {
        "web_fetch"
    }

    fn description(&self) -> &str {
        "抓取网页内容并使用 AI 分析提取关键信息。适用于获取文档、API 说明等。"
    }

    fn parameters_schema(&self) -> JsonValue {
        json!({
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "要抓取的网页 URL"
                },
                "analysis_prompt": {
                    "type": "string",
                    "description": "可选：分析提示词，指定需要提取什么信息（默认提取摘要）"
                }
            },
            "required": ["url"]
        })
    }

    async fn execute(&self, input: JsonValue) -> Result<ToolResult, Box<dyn std::error::Error>> {
        let url = input["url"].as_str().ok_or("缺少 'url' 参数")?;
        let analysis_prompt = input["analysis_prompt"]
            .as_str()
            .unwrap_or("请总结这个网页的主要内容，提取关键信息");

        // 1. 抓取网页内容
        let response = reqwest::get(url).await?;
        let status = response.status();
        
        if !status.is_success() {
            return Ok(ToolResult::failure(format!(
                "HTTP 请求失败: {} - {}",
                status.as_u16(),
                status.canonical_reason().unwrap_or("Unknown")
            )));
        }

        let html = response.text().await?;
        let cleaned_content = self.clean_html(&html);

        // 限制内容长度（避免超过 API 限制）
        let max_length = 50000;
        let truncated_content = if cleaned_content.len() > max_length {
            format!("{}...[内容已截断]", &cleaned_content[..max_length])
        } else {
            cleaned_content
        };

        // 2. 使用 Claude 分析内容
        let prompt = format!(
            "网页 URL: {}\n\n分析任务: {}\n\n网页内容:\n{}",
            url, analysis_prompt, truncated_content
        );

        let response = self.claude.send_message(
            vec![Message::user(prompt)],
            Some("你是一个网页内容分析助手。请根据用户要求分析网页内容，提取关键信息并以清晰的格式返回。".to_string()),
            2048,
            None, // 无工具
        ).await?;

        let analysis = response.get_text();

        Ok(ToolResult::success(analysis).with_metadata(json!({
            "url": url,
            "status_code": status.as_u16(),
            "content_length": html.len(),
        })))
    }

    fn requires_ai(&self) -> bool {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // 需要 API 密钥和网络连接
    async fn test_web_fetch() {
        let tool = WebFetchTool::new().unwrap();
        let input = json!({
            "url": "https://example.com",
            "analysis_prompt": "这个网页的主题是什么？"
        });

        let result = tool.execute(input).await.unwrap();
        println!("Analysis: {}", result.output);
        assert!(result.success);
    }
}
