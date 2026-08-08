use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentRunRequest {
    pub run_id: String,
    pub prompt: String,
    pub base_url: String,
    pub model: String,
    pub system_prompt: String,
    pub skill_id: Option<String>,
    pub context: serde_json::Value,
    pub tools: Vec<AgentToolDescriptor>,
    pub messages: Vec<AgentMessageInput>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentMessageInput {
    pub role: AgentMessageRole,
    pub content: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AgentMessageRole {
    User,
    Assistant,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentToolDescriptor {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentToolCall {
    pub call_id: String,
    pub name: String,
    pub arguments: serde_json::Value,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentRunResponse {
    pub run_id: String,
    pub text: String,
    pub skill_id: Option<String>,
    pub capabilities: AgentProviderCapabilities,
    pub telemetry: AgentStreamingTelemetry,
    pub tool_calls: Vec<AgentToolCall>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AgentProviderStrategy {
    Responses,
    ChatCompletions,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentProviderCapabilities {
    pub strategy: AgentProviderStrategy,
    pub text_streaming: bool,
    pub reasoning_summary: bool,
    pub tool_events: bool,
    pub cancellation: bool,
    pub retry: bool,
    pub timing: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AgentErrorCode {
    ConfigurationRequired,
    AuthenticationFailed,
    PermissionDenied,
    RateLimited,
    NetworkUnavailable,
    TlsFailure,
    RequestTimeout,
    ProviderUnavailable,
    ProviderProtocolError,
    ModelUnavailable,
    ContextLimit,
    ToolValidationFailed,
    ToolExecutionFailed,
    RuntimeUnavailable,
    Cancelled,
    Unknown,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentErrorDiagnostic {
    pub code: AgentErrorCode,
    pub message: String,
    pub recovery: Option<String>,
    pub diagnostic_id: String,
    pub retryable: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum StreamingBehavior {
    Incremental,
    Buffered,
    Indeterminate,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentStreamingTelemetry {
    pub strategy: AgentProviderStrategy,
    pub attempts: u8,
    pub request_ms: u64,
    pub first_event_ms: Option<u64>,
    pub first_text_ms: Option<u64>,
    pub event_span_ms: u64,
    pub total_ms: u64,
    pub event_count: u32,
    pub behavior: StreamingBehavior,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub(crate) enum AgentRunEvent {
    Started {
        run_id: String,
    },
    Capabilities {
        run_id: String,
        capabilities: AgentProviderCapabilities,
    },
    StrategyFallback {
        run_id: String,
        from: AgentProviderStrategy,
        to: AgentProviderStrategy,
        reason: String,
    },
    RetryScheduled {
        run_id: String,
        attempt: u8,
        delay_ms: u64,
        diagnostic: AgentErrorDiagnostic,
    },
    ReasoningSummaryDelta {
        run_id: String,
        text: String,
    },
    TextDelta {
        run_id: String,
        text: String,
    },
    ToolStarted {
        run_id: String,
        call_id: String,
        name: String,
    },
    ToolCompleted {
        run_id: String,
        call_id: String,
        name: String,
        arguments: serde_json::Value,
    },
    Telemetry {
        run_id: String,
        telemetry: AgentStreamingTelemetry,
    },
    Completed {
        run_id: String,
        text: String,
        skill_id: Option<String>,
    },
    Cancelled {
        run_id: String,
    },
    Error {
        run_id: String,
        error: AgentErrorDiagnostic,
    },
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSkillMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
}
