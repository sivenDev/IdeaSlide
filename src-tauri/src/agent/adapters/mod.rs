mod acp_schema;
mod codex_app_server;
mod codex_schema;
mod contract;
mod grok_acp;
mod process;
pub(crate) mod stdio_json_rpc;

pub(crate) use codex_app_server::PINNED_CODEX_VERSION;

use std::{collections::VecDeque, fmt, path::PathBuf, time::Duration};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::types::{AgentTokenUsageBreakdown, AgentToolDescriptor};
use stdio_json_rpc::JsonRpcId;
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
    PublicActivityDelta(String),
    PlanUpdated {
        title: String,
        steps: Vec<String>,
    },
    ToolStarted {
        call_id: String,
        name: String,
        arguments: Value,
        editor_only: bool,
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
    ContextUsage {
        total: AgentTokenUsageBreakdown,
        last: AgentTokenUsageBreakdown,
        model_context_window: Option<u64>,
    },
    ContextCompacted,
    Diagnostic {
        code: String,
        message: String,
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
    pub turn_event_timeout: Duration,
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

pub(crate) enum RuntimeDriverEvent {
    Event(RuntimeEvent),
    ToolRequest {
        request_id: JsonRpcId,
        call: super::types::AgentToolCall,
    },
}

pub(crate) struct CodexTurnDriver {
    adapter: codex_app_server::CodexAppServerAdapter,
    process: process::LocalRuntimeProcess,
    conversation_id: String,
    queued: VecDeque<RuntimeDriverEvent>,
}

impl CodexTurnDriver {
    pub(crate) async fn start(input: &RuntimeTurnInput) -> Result<Self, RuntimeAdapterError> {
        let executable = resolve_executable("codex").ok_or_else(|| {
            RuntimeAdapterError::unavailable("Codex app-server is not installed.")
        })?;
        let adapter = codex_app_server::CodexAppServerAdapter::new(executable);
        let mut process = process::LocalRuntimeProcess::spawn(adapter.command()).await?;
        let initialized = process.request(&adapter.initialize()).await?;
        if let Some(error) = process::response_error(&initialized) {
            return Err(RuntimeAdapterError::unavailable(error));
        }
        if let Some(notification) = adapter.initialized() {
            process.send(&notification).await?;
        }
        let started = if let Some(conversation_id) = input.conversation_id.as_deref() {
            process
                .request(&adapter.resume_conversation(conversation_id, &input.cwd))
                .await?
        } else {
            process.request(&adapter.start_conversation(input)).await?
        };
        if let Some(error) = process::response_error(&started) {
            return Err(RuntimeAdapterError::unavailable(error));
        }
        let conversation_id = response_result(&started)
            .and_then(|result| {
                ["/thread/id", "/threadId", "/id"]
                    .into_iter()
                    .find_map(|pointer| result.pointer(pointer).and_then(Value::as_str))
            })
            .ok_or_else(|| RuntimeAdapterError::protocol("Codex did not return a Thread id."))?
            .to_string();
        process
            .send(&adapter.start_turn(&conversation_id, input))
            .await?;
        Ok(Self {
            adapter,
            process,
            conversation_id,
            queued: VecDeque::new(),
        })
    }

    pub(crate) fn capabilities(&self) -> RuntimeCapabilities {
        self.adapter.capabilities()
    }

    pub(crate) fn conversation_id(&self) -> &str {
        &self.conversation_id
    }

    pub(crate) async fn next_event(&mut self) -> Result<RuntimeDriverEvent, RuntimeAdapterError> {
        loop {
            if let Some(event) = self.queued.pop_front() {
                return Ok(event);
            }
            let message = self.process.next_message().await?;
            if message.method() == Some("item/tool/call") {
                let request_id = message.id().cloned().ok_or_else(|| {
                    RuntimeAdapterError::protocol("Codex Tool request is missing an id.")
                })?;
                for event in self.adapter.map_message(&message)? {
                    if let RuntimeEvent::ToolStarted {
                        call_id,
                        name,
                        arguments,
                        editor_only: true,
                    } = event
                    {
                        return Ok(RuntimeDriverEvent::ToolRequest {
                            request_id,
                            call: super::types::AgentToolCall {
                                call_id,
                                name,
                                arguments,
                            },
                        });
                    }
                }
                continue;
            }
            if message.method().is_some_and(|method| {
                matches!(
                    method,
                    "item/commandExecution/requestApproval" | "item/fileChange/requestApproval"
                )
            }) {
                if let Some(request_id) = message.id().cloned() {
                    self.process
                        .send(&self.adapter.approval_result(&request_id, false))
                        .await?;
                }
            }
            self.queued.extend(
                self.adapter
                    .map_message(&message)?
                    .into_iter()
                    .map(RuntimeDriverEvent::Event),
            );
        }
    }

    pub(crate) async fn tool_result(
        &mut self,
        request_id: &JsonRpcId,
        result: Value,
        success: bool,
    ) -> Result<(), RuntimeAdapterError> {
        self.process
            .send(&self.adapter.tool_result(request_id, result, success))
            .await
    }

    pub(crate) async fn cancel(&mut self) -> Result<(), RuntimeAdapterError> {
        self.process
            .send(&self.adapter.cancel_turn(&self.conversation_id))
            .await
    }

    pub(crate) async fn shutdown(self) -> Result<String, RuntimeAdapterError> {
        self.process.shutdown().await
    }
}

fn response_result(message: &JsonRpcMessage) -> Option<&Value> {
    match message {
        JsonRpcMessage::Response { result, .. } => result.as_ref(),
        _ => None,
    }
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

    #[tokio::test]
    async fn installed_codex_executes_dynamic_editor_tool_smoke_when_enabled() {
        if std::env::var("IDEANOTE_CODEX_SMOKE").ok().as_deref() != Some("1") {
            return;
        }
        let model = std::env::var("IDEANOTE_CODEX_SMOKE_MODEL")
            .unwrap_or_else(|_| "gpt-5.6-terra".to_string());
        let input = RuntimeTurnInput {
            conversation_id: None,
            prompt: "Call read_document exactly once, then answer with the returned title."
                .to_string(),
            model,
            cwd: std::env::temp_dir(),
            tools: vec![AgentToolDescriptor {
                name: "read_document".to_string(),
                description: "Read the active editor document.".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {},
                    "additionalProperties": false
                }),
                requires: Vec::new(),
                ..Default::default()
            }],
        };
        let mut driver =
            tokio::time::timeout(Duration::from_secs(30), CodexTurnDriver::start(&input))
                .await
                .expect("Codex startup should not time out")
                .expect("Codex should start");
        let mut saw_tool = false;
        let mut answer = String::new();
        loop {
            let event = tokio::time::timeout(Duration::from_secs(90), driver.next_event())
                .await
                .expect("Codex event should not time out")
                .expect("Codex event should map");
            match event {
                RuntimeDriverEvent::ToolRequest { request_id, call } => {
                    assert_eq!(call.name, "read_document");
                    saw_tool = true;
                    driver
                        .tool_result(
                            &request_id,
                            serde_json::json!({
                                "kind": "read",
                                "callId": call.call_id,
                                "name": call.name,
                                "success": true,
                                "summary": "Read active document",
                                "content": {"title": "Native Tool Bridge Verified"},
                                "truncated": false,
                                "persistable": false
                            }),
                            true,
                        )
                        .await
                        .expect("Tool result should return to Codex");
                }
                RuntimeDriverEvent::Event(RuntimeEvent::TextDelta(delta)) => {
                    answer.push_str(&delta);
                }
                RuntimeDriverEvent::Event(RuntimeEvent::TurnCompleted) => break,
                RuntimeDriverEvent::Event(RuntimeEvent::RuntimeError(message)) => {
                    panic!("Codex runtime failed: {message}");
                }
                RuntimeDriverEvent::Event(_) => {}
            }
        }
        assert!(saw_tool, "Codex should request the dynamic editor Tool");
        assert!(
            answer.contains("Native Tool Bridge Verified"),
            "Codex should use the dynamic Tool result"
        );
        driver.shutdown().await.expect("Codex should shut down");
    }

    #[tokio::test]
    async fn installed_codex_respects_editor_tool_prerequisites_when_enabled() {
        if std::env::var("IDEANOTE_CODEX_SMOKE").ok().as_deref() != Some("1") {
            return;
        }
        let model = std::env::var("IDEANOTE_CODEX_SMOKE_MODEL")
            .unwrap_or_else(|_| "gpt-5.6-terra".to_string());
        let input = RuntimeTurnInput {
            conversation_id: None,
            prompt: concat!(
                "Optimize the active Page by replacing its elements. ",
                "Tool descriptors declare prerequisites: replace_page_elements requires ",
                "read_active_page. Complete required Tools in order and then summarize the change."
            )
            .to_string(),
            model,
            cwd: std::env::temp_dir(),
            tools: vec![
                AgentToolDescriptor {
                    name: "read_active_page".to_string(),
                    description: "Read the bounded active Page scene.".to_string(),
                    input_schema: serde_json::json!({
                        "type": "object",
                        "properties": {},
                        "additionalProperties": false
                    }),
                    requires: Vec::new(),
                    ..Default::default()
                },
                AgentToolDescriptor {
                    name: "replace_page_elements".to_string(),
                    description:
                        "After read_active_page succeeds, replace the active Page elements."
                            .to_string(),
                    input_schema: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "pageId": {"type": "string"},
                            "elements": {"type": "array", "items": {"type": "object"}}
                        },
                        "required": ["pageId", "elements"],
                        "additionalProperties": false
                    }),
                    requires: vec!["read_active_page".to_string()],
                    ..Default::default()
                },
            ],
        };
        let mut driver =
            tokio::time::timeout(Duration::from_secs(30), CodexTurnDriver::start(&input))
                .await
                .expect("Codex startup should not time out")
                .expect("Codex should start");
        let mut tool_order = Vec::new();
        let mut answer = String::new();
        loop {
            let event = tokio::time::timeout(Duration::from_secs(90), driver.next_event())
                .await
                .expect("Codex event should not time out")
                .expect("Codex event should map");
            match event {
                RuntimeDriverEvent::ToolRequest { request_id, call } => {
                    tool_order.push(call.name.clone());
                    let result = match call.name.as_str() {
                        "read_active_page" => serde_json::json!({
                            "kind": "read", "callId": call.call_id, "name": call.name,
                            "success": true, "summary": "Read active Page",
                            "content": {"id": "page-1", "title": "Overview", "elements": []},
                            "truncated": false, "persistable": false
                        }),
                        "replace_page_elements" => {
                            assert_eq!(
                                tool_order,
                                ["read_active_page", "replace_page_elements"],
                                "Codex must complete the declared read prerequisite first"
                            );
                            serde_json::json!({
                                "kind": "mutation", "callId": call.call_id, "name": call.name,
                                "success": true, "summary": "Replaced active Page elements",
                                "changeSet": {"id": "change-1", "summary": "Optimize Page", "status": "applied"},
                                "truncated": false, "persistable": true
                            })
                        }
                        name => panic!("Codex requested an unexpected Tool: {name}"),
                    };
                    driver
                        .tool_result(&request_id, result, true)
                        .await
                        .expect("Tool result should return to Codex");
                }
                RuntimeDriverEvent::Event(RuntimeEvent::TextDelta(delta)) => {
                    answer.push_str(&delta);
                }
                RuntimeDriverEvent::Event(RuntimeEvent::TurnCompleted) => break,
                RuntimeDriverEvent::Event(RuntimeEvent::RuntimeError(message)) => {
                    panic!("Codex runtime failed: {message}");
                }
                RuntimeDriverEvent::Event(_) => {}
            }
        }
        assert_eq!(tool_order, ["read_active_page", "replace_page_elements"]);
        assert!(
            !answer.trim().is_empty(),
            "Codex should produce a final answer"
        );
        driver.shutdown().await.expect("Codex should shut down");
    }
}
