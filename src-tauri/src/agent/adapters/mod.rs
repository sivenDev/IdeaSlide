#![allow(dead_code)] // Rich runtimes stay capability-gated until F033-04 wires persistent execution.

mod acp_schema;
mod codex_app_server;
mod codex_schema;
mod contract;
mod grok_acp;
mod process;
mod stdio_json_rpc;

use std::{fmt, path::PathBuf, time::Duration};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::types::AgentToolDescriptor;
use stdio_json_rpc::JsonRpcMessage;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum RuntimeKind {
    Compatibility,
    CodexAppServer,
    GrokAcp,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeCapabilities {
    pub text_streaming: bool,
    pub reasoning_summary: bool,
    pub plans: bool,
    pub tool_events: bool,
    pub approvals: bool,
    pub cancellation: bool,
    pub steering: bool,
    pub retry: bool,
    pub persistence: bool,
    pub editor_tools: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) enum RuntimeEvent {
    TextDelta(String),
    ReasoningSummaryDelta(String),
    PlanUpdated {
        title: String,
        steps: Vec<String>,
    },
    ToolStarted {
        call_id: String,
        name: String,
        arguments: Value,
        proposal_only: bool,
    },
    ToolCompleted {
        call_id: String,
        name: String,
        success: bool,
    },
    ApprovalRequested {
        request_id: String,
        title: String,
        description: String,
    },
    TurnCompleted,
    TurnCancelled,
    RuntimeError(String),
}

#[derive(Clone, Debug)]
pub(crate) struct RuntimeTurnInput {
    pub conversation_id: Option<String>,
    pub prompt: String,
    pub model: String,
    pub cwd: PathBuf,
    pub tools: Vec<AgentToolDescriptor>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct RuntimeCommandSpec {
    pub executable: PathBuf,
    pub args: Vec<String>,
    pub expected_version: Option<String>,
    pub version_args: Vec<String>,
    pub request_timeout: Duration,
    pub max_frame_bytes: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct RuntimeAdapterError {
    pub message: String,
    pub recoverable: bool,
}

impl RuntimeAdapterError {
    pub(crate) fn protocol(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            recoverable: false,
        }
    }

    pub(crate) fn unavailable(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            recoverable: true,
        }
    }
}

impl fmt::Display for RuntimeAdapterError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for RuntimeAdapterError {}

pub(crate) trait AgentRuntimeAdapter {
    fn kind(&self) -> RuntimeKind;
    fn label(&self) -> &'static str;
    fn command(&self) -> RuntimeCommandSpec;
    fn capabilities(&self) -> RuntimeCapabilities;
    fn initialize(&self) -> JsonRpcMessage;
    fn initialized(&self) -> Option<JsonRpcMessage>;
    fn start_conversation(&self, input: &RuntimeTurnInput) -> JsonRpcMessage;
    fn resume_conversation(&self, conversation_id: &str, cwd: &std::path::Path) -> JsonRpcMessage;
    fn start_turn(&self, conversation_id: &str, input: &RuntimeTurnInput) -> JsonRpcMessage;
    fn cancel_turn(&self, conversation_id: &str) -> JsonRpcMessage;
    fn steer_turn(&self, conversation_id: &str, prompt: &str) -> Option<JsonRpcMessage>;
    fn tool_result(
        &self,
        request_id: &stdio_json_rpc::JsonRpcId,
        output: Value,
        success: bool,
    ) -> JsonRpcMessage;
    fn approval_result(
        &self,
        request_id: &stdio_json_rpc::JsonRpcId,
        approved: bool,
    ) -> JsonRpcMessage;
    fn map_message(
        &self,
        message: &JsonRpcMessage,
    ) -> Result<Vec<RuntimeEvent>, RuntimeAdapterError>;
}

#[derive(Clone, Debug)]
pub(crate) struct RuntimeAvailability {
    pub kind: RuntimeKind,
    pub installed: bool,
    pub compatible: bool,
    pub enabled: bool,
    pub capabilities: RuntimeCapabilities,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeDescriptor {
    pub kind: RuntimeKind,
    pub label: String,
    pub installed: bool,
    pub compatible: bool,
    pub experimental: bool,
    pub capabilities: RuntimeCapabilities,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostic: Option<String>,
}

pub(crate) async fn discover_runtime_catalog() -> Vec<RuntimeDescriptor> {
    let compatibility_capabilities = RuntimeCapabilities {
        text_streaming: true,
        reasoning_summary: false,
        plans: false,
        tool_events: false,
        approvals: false,
        cancellation: true,
        steering: false,
        retry: true,
        persistence: false,
        editor_tools: true,
    };
    let mut catalog = vec![RuntimeDescriptor {
        kind: RuntimeKind::Compatibility,
        label: "OpenAI-compatible".to_string(),
        installed: true,
        compatible: true,
        experimental: false,
        capabilities: compatibility_capabilities,
        diagnostic: None,
    }];

    let codex_path = resolve_executable("codex");
    let codex = codex_app_server::CodexAppServerAdapter::new(
        codex_path
            .clone()
            .unwrap_or_else(|| PathBuf::from("/nonexistent/codex")),
    );
    let codex_probe = if let Some(path) = codex_path.as_ref() {
        match tokio::process::Command::new(path)
            .arg("--version")
            .output()
            .await
        {
            Ok(output) => {
                let text = format!(
                    "{}{}",
                    String::from_utf8_lossy(&output.stdout),
                    String::from_utf8_lossy(&output.stderr)
                );
                match codex_app_server::CodexAppServerAdapter::verify_version(&text) {
                    Ok(()) => (true, None),
                    Err(error) => (false, Some(error.message)),
                }
            }
            Err(_) => (
                false,
                Some("Codex version could not be inspected.".to_string()),
            ),
        }
    } else {
        (
            false,
            Some("Codex app-server is not installed.".to_string()),
        )
    };
    catalog.push(RuntimeDescriptor {
        kind: codex.kind(),
        label: codex.label().to_string(),
        installed: codex_path.is_some(),
        compatible: codex_probe.0,
        experimental: true,
        capabilities: codex.capabilities(),
        diagnostic: codex_probe.1,
    });

    let grok_path = resolve_executable("grok");
    let grok = grok_acp::GrokAcpAdapter::new(
        grok_path
            .clone()
            .unwrap_or_else(|| PathBuf::from("/nonexistent/grok")),
    );
    catalog.push(RuntimeDescriptor {
        kind: grok.kind(),
        label: grok.label().to_string(),
        installed: grok_path.is_some(),
        compatible: false,
        experimental: true,
        capabilities: grok.capabilities(),
        diagnostic: if grok_path.is_some() {
            Some(format!(
                "ACP protocol {} is gated by handshake; editor Tools remain disabled (source {}).",
                grok_acp::PINNED_ACP_PROTOCOL_VERSION,
                grok_acp::PINNED_GROK_SOURCE_REV
            ))
        } else {
            Some("Grok Build is not installed; compatibility fallback remains active.".to_string())
        },
    });
    catalog
}

fn resolve_executable(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .map(|directory| directory.join(name))
        .find(|candidate| candidate.is_file())
}

pub(crate) fn select_runtime(
    candidates: &[RuntimeAvailability],
    requires_editor_tools: bool,
) -> RuntimeKind {
    let eligible = |candidate: &&RuntimeAvailability| {
        candidate.enabled
            && candidate.installed
            && candidate.compatible
            && (!requires_editor_tools || candidate.capabilities.editor_tools)
    };
    for preferred in [RuntimeKind::CodexAppServer, RuntimeKind::GrokAcp] {
        if candidates
            .iter()
            .filter(eligible)
            .any(|candidate| candidate.kind == preferred)
        {
            return preferred;
        }
    }
    RuntimeKind::Compatibility
}

#[cfg(test)]
mod tests {
    use super::*;

    fn availability(kind: RuntimeKind, editor_tools: bool) -> RuntimeAvailability {
        RuntimeAvailability {
            kind,
            installed: true,
            compatible: true,
            enabled: true,
            capabilities: RuntimeCapabilities {
                text_streaming: true,
                reasoning_summary: true,
                plans: true,
                tool_events: true,
                approvals: true,
                cancellation: true,
                steering: true,
                retry: true,
                persistence: true,
                editor_tools,
            },
        }
    }

    #[test]
    fn selection_prefers_codex_but_respects_editor_tool_gate() {
        let grok = availability(RuntimeKind::GrokAcp, false);
        let codex = availability(RuntimeKind::CodexAppServer, true);
        assert_eq!(
            select_runtime(&[grok.clone(), codex.clone()], false),
            RuntimeKind::CodexAppServer
        );
        assert_eq!(select_runtime(&[grok], true), RuntimeKind::Compatibility);
        assert_eq!(select_runtime(&[codex], true), RuntimeKind::CodexAppServer);
    }

    #[tokio::test]
    async fn installed_codex_app_server_completes_the_pinned_handshake() {
        let Some(path) = resolve_executable("codex") else {
            return;
        };
        let adapter = codex_app_server::CodexAppServerAdapter::new(path);
        let mut process = process::LocalRuntimeProcess::spawn(adapter.command())
            .await
            .expect("installed Codex should match the pinned version");
        let response = process
            .request(&adapter.initialize())
            .await
            .expect("Codex initialize should complete");
        assert!(process::response_error(&response).is_none());
        process
            .send(&adapter.initialized().expect("Codex requires initialized"))
            .await
            .expect("initialized notification should send");
        let stderr = process.shutdown().await.expect("Codex should shut down");
        assert!(!stderr.to_ascii_lowercase().contains("bearer "));
    }
}
