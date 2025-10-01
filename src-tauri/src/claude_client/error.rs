use std::fmt;

#[derive(Debug)]
pub enum ClaudeError {
    /// API 密钥未设置
    ApiKeyNotSet,
    /// HTTP 请求错误
    HttpError(reqwest::Error),
    /// JSON 解析错误
    JsonError(serde_json::Error),
    /// API 返回错误
    ApiError { status: u16, message: String },
    /// 流式响应错误
    StreamError(String),
    /// 其他错误
    Other(String),
}

impl fmt::Display for ClaudeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ClaudeError::ApiKeyNotSet => {
                write!(f, "ANTHROPIC_API_KEY 环境变量未设置")
            }
            ClaudeError::HttpError(e) => write!(f, "HTTP 请求错误: {}", e),
            ClaudeError::JsonError(e) => write!(f, "JSON 解析错误: {}", e),
            ClaudeError::ApiError { status, message } => {
                write!(f, "API 错误 ({}): {}", status, message)
            }
            ClaudeError::StreamError(msg) => write!(f, "流式响应错误: {}", msg),
            ClaudeError::Other(msg) => write!(f, "{}", msg),
        }
    }
}

impl std::error::Error for ClaudeError {}

impl From<reqwest::Error> for ClaudeError {
    fn from(err: reqwest::Error) -> Self {
        ClaudeError::HttpError(err)
    }
}

impl From<serde_json::Error> for ClaudeError {
    fn from(err: serde_json::Error) -> Self {
        ClaudeError::JsonError(err)
    }
}

impl From<std::env::VarError> for ClaudeError {
    fn from(_: std::env::VarError) -> Self {
        ClaudeError::ApiKeyNotSet
    }
}
