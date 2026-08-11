use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentRunRequest {
    pub run_id: String,
    pub thread_id: String,
    #[serde(default)]
    pub retry_of_turn_id: Option<String>,
    #[serde(default)]
    pub upstream_thread_id: Option<String>,
    pub prompt: String,
    pub binding: serde_json::Value,
    pub base_url: String,
    pub model: String,
    #[serde(default)]
    pub available_models: Vec<String>,
    #[serde(default = "default_reasoning_effort")]
    pub reasoning_effort: String,
    pub system_prompt: String,
    #[serde(default)]
    pub retry: AgentRetryPolicy,
    #[serde(default)]
    pub policy: AgentPolicySettings,
    pub skill_id: Option<String>,
    #[serde(default)]
    pub selected_skill_ids: Vec<String>,
    pub context: serde_json::Value,
    pub tools: Vec<AgentToolDescriptor>,
    pub messages: Vec<AgentMessageInput>,
}

fn default_reasoning_effort() -> String {
    "standard".to_string()
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentRetryPolicy {
    pub enabled: bool,
    pub max_attempts: u8,
}

impl Default for AgentRetryPolicy {
    fn default() -> Self {
        Self {
            enabled: true,
            max_attempts: 3,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentPolicySettings {
    pub max_steps: u8,
    pub context_warning_percent: u8,
    pub new_thread_percent: u8,
    pub diagnostic_retention: u16,
    pub compatibility_replay_message_limit: u16,
    pub show_delivery_telemetry: bool,
}

impl Default for AgentPolicySettings {
    fn default() -> Self {
        Self {
            max_steps: 8,
            context_warning_percent: 75,
            new_thread_percent: 90,
            diagnostic_retention: 20,
            compatibility_replay_message_limit: 60,
            show_delivery_telemetry: true,
        }
    }
}

impl AgentPolicySettings {
    pub(crate) fn normalized(self) -> Self {
        let context_warning_percent = self.context_warning_percent.clamp(50, 90);
        let requested_new_thread = self.new_thread_percent.clamp(60, 100);
        Self {
            max_steps: self.max_steps.clamp(1, 20),
            context_warning_percent,
            new_thread_percent: if requested_new_thread > context_warning_percent {
                requested_new_thread
            } else {
                context_warning_percent.saturating_add(1).min(100)
            },
            diagnostic_retention: self.diagnostic_retention.clamp(5, 100),
            compatibility_replay_message_limit: self
                .compatibility_replay_message_limit
                .clamp(10, 200),
            show_delivery_telemetry: self.show_delivery_telemetry,
        }
    }
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
    #[serde(default)]
    pub requires: Vec<String>,
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
    pub next_sequence: u64,
    pub assistant_item_id: String,
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
    Burst,
    Atomic,
    Unknown,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentStreamingTelemetry {
    pub strategy: AgentProviderStrategy,
    pub attempts: u8,
    pub request_ms: u64,
    pub first_event_ms: Option<u64>,
    pub first_text_ms: Option<u64>,
    pub text_span_ms: u64,
    pub total_ms: u64,
    pub text_delta_count: u32,
    pub text_character_count: u32,
    pub p50_inter_delta_ms: Option<u64>,
    pub p95_inter_delta_ms: Option<u64>,
    pub densest_window_percent: u8,
    pub behavior: StreamingBehavior,
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentTokenUsageBreakdown {
    pub total_tokens: u64,
    pub input_tokens: u64,
    pub cached_input_tokens: u64,
    pub cache_write_input_tokens: u64,
    pub output_tokens: u64,
    pub reasoning_output_tokens: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub(crate) enum AgentRunEvent {
    Event { event: serde_json::Value },
    ToolExecutionRequested { run_id: String, call: AgentToolCall },
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSkillMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
    pub origin: AgentSkillOrigin,
    pub source_label: String,
    pub enabled: bool,
    pub implicit_invocation: bool,
    pub editor_scopes: Vec<String>,
    pub digest: String,
    pub valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validation_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_refreshed_at: Option<u64>,
    pub resources: Vec<AgentSkillResourceMetadata>,
    pub required_tools: Vec<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AgentSkillOrigin {
    Bundled,
    Custom,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSkillResourceMetadata {
    pub id: String,
    pub label: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AgentSkillActivationMode {
    Mandatory,
    Explicit,
    Implicit,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSkillProvenance {
    pub id: String,
    pub name: String,
    pub origin: AgentSkillOrigin,
    pub digest: String,
    pub activation_mode: AgentSkillActivationMode,
    pub editor_scope: String,
}
