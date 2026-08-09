use std::{
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::Duration,
};

use serde_json::{json, Value};

use super::{
    acp_schema,
    stdio_json_rpc::{redact_text, JsonRpcId, JsonRpcMessage, DEFAULT_MAX_FRAME_BYTES},
    AgentRuntimeAdapter, RuntimeAdapterError, RuntimeCapabilities, RuntimeCommandSpec,
    RuntimeEvent, RuntimeKind, RuntimeTurnInput,
};

pub(crate) const PINNED_ACP_PROTOCOL_VERSION: u64 = 1;
pub(crate) const PINNED_GROK_SOURCE_REV: &str = "3e620a76a5f374ce644dc7c87f7e990c68348218";

pub(crate) struct GrokAcpAdapter {
    executable: PathBuf,
    next_id: AtomicU64,
}

impl GrokAcpAdapter {
    pub(crate) fn new(executable: PathBuf) -> Self {
        Self {
            executable,
            next_id: AtomicU64::new(1),
        }
    }

    fn request(&self, method: &str, params: Value) -> JsonRpcMessage {
        JsonRpcMessage::request(self.next_id.fetch_add(1, Ordering::Relaxed), method, params)
    }

    pub(crate) fn authenticate(&self, method_id: &str) -> JsonRpcMessage {
        self.request(
            acp_schema::AUTHENTICATE,
            json!({"methodId": method_id, "_meta": {"headless": true}}),
        )
    }

    pub(crate) fn supports_protocol(result: &Value) -> bool {
        result
            .get("protocolVersion")
            .and_then(Value::as_u64)
            .is_some_and(|version| version == PINNED_ACP_PROTOCOL_VERSION)
    }
}

impl AgentRuntimeAdapter for GrokAcpAdapter {
    fn kind(&self) -> RuntimeKind {
        RuntimeKind::GrokAcp
    }

    fn label(&self) -> &'static str {
        "Grok Build ACP"
    }

    fn command(&self) -> RuntimeCommandSpec {
        RuntimeCommandSpec {
            executable: self.executable.clone(),
            args: vec![
                "--no-auto-update".to_string(),
                "agent".to_string(),
                "stdio".to_string(),
            ],
            expected_version: None,
            version_args: vec!["--version".to_string()],
            request_timeout: Duration::from_secs(30),
            turn_event_timeout: Duration::from_secs(300),
            max_frame_bytes: DEFAULT_MAX_FRAME_BYTES,
        }
    }

    fn capabilities(&self) -> RuntimeCapabilities {
        RuntimeCapabilities {
            text_streaming: true,
            reasoning_summary: false,
            plans: true,
            tool_events: true,
            approvals: true,
            cancellation: true,
            steering: false,
            retry: false,
            persistence: true,
            editor_tools: false,
        }
    }

    fn initialize(&self) -> JsonRpcMessage {
        self.request(
            acp_schema::INITIALIZE,
            json!({
                "protocolVersion": PINNED_ACP_PROTOCOL_VERSION,
                "clientInfo": {"name": "IdeaNote", "version": env!("CARGO_PKG_VERSION")},
                "clientCapabilities": {
                    "fs": {"readTextFile": false, "writeTextFile": false},
                    "terminal": false
                }
            }),
        )
    }

    fn initialized(&self) -> Option<JsonRpcMessage> {
        None
    }

    fn start_conversation(&self, input: &RuntimeTurnInput) -> JsonRpcMessage {
        self.request(
            acp_schema::SESSION_NEW,
            json!({
                "cwd": input.cwd,
                "mcpServers": [],
                "model": input.model,
            }),
        )
    }

    fn resume_conversation(&self, conversation_id: &str, cwd: &Path) -> JsonRpcMessage {
        self.request(
            acp_schema::SESSION_LOAD,
            json!({"sessionId": conversation_id, "cwd": cwd, "mcpServers": []}),
        )
    }

    fn start_turn(&self, conversation_id: &str, input: &RuntimeTurnInput) -> JsonRpcMessage {
        self.request(
            acp_schema::SESSION_PROMPT,
            json!({
                "sessionId": conversation_id,
                "prompt": [{"type": "text", "text": input.prompt}]
            }),
        )
    }

    fn cancel_turn(&self, conversation_id: &str) -> JsonRpcMessage {
        JsonRpcMessage::notification(
            acp_schema::SESSION_CANCEL,
            json!({"sessionId": conversation_id}),
        )
    }

    fn steer_turn(&self, _conversation_id: &str, _prompt: &str) -> Option<JsonRpcMessage> {
        None
    }

    fn tool_result(
        &self,
        request_id: &JsonRpcId,
        _output: Value,
        _success: bool,
    ) -> JsonRpcMessage {
        JsonRpcMessage::response(
            request_id.clone(),
            json!({"outcome": {"outcome": "cancelled"}}),
        )
    }

    fn approval_result(&self, request_id: &JsonRpcId, approved: bool) -> JsonRpcMessage {
        JsonRpcMessage::response(
            request_id.clone(),
            json!({
                "outcome": if approved {
                    json!({"outcome": "selected", "optionId": "allow_once"})
                } else {
                    json!({"outcome": "cancelled"})
                }
            }),
        )
    }

    fn map_message(
        &self,
        message: &JsonRpcMessage,
    ) -> Result<Vec<RuntimeEvent>, RuntimeAdapterError> {
        if let JsonRpcMessage::Response { result, error, .. } = message {
            if let Some(error) = error {
                return Ok(vec![RuntimeEvent::RuntimeError(redact_text(
                    error
                        .get("message")
                        .and_then(Value::as_str)
                        .unwrap_or("Grok ACP request failed."),
                ))]);
            }
            if let Some(stop_reason) = result
                .as_ref()
                .and_then(|result| result.get("stopReason"))
                .and_then(Value::as_str)
            {
                return Ok(vec![if stop_reason == "cancelled" {
                    RuntimeEvent::TurnCancelled
                } else {
                    RuntimeEvent::TurnCompleted
                }]);
            }
            return Ok(Vec::new());
        }

        let Some(method) = message.method() else {
            return Ok(Vec::new());
        };
        let params = message.params().cloned().unwrap_or_else(|| json!({}));
        if method == acp_schema::SESSION_UPDATE {
            return Ok(match acp_schema::update_kind(&params) {
                Some("agent_message_chunk") => acp_schema::text_chunk(&params)
                    .map(|text| vec![RuntimeEvent::TextDelta(text.to_string())])
                    .unwrap_or_default(),
                Some("agent_thought_summary_chunk") => acp_schema::text_chunk(&params)
                    .map(|text| vec![RuntimeEvent::PublicActivityDelta(text.to_string())])
                    .unwrap_or_default(),
                Some("plan") => vec![RuntimeEvent::PlanUpdated {
                    title: "Plan".to_string(),
                    steps: acp_schema::plan_steps(&params),
                }],
                Some("tool_call") => acp_schema::tool_update(&params)
                    .map(|(call_id, name, arguments)| {
                        vec![RuntimeEvent::ToolStarted {
                            call_id: call_id.to_string(),
                            name: name.to_string(),
                            arguments,
                            editor_only: false,
                        }]
                    })
                    .unwrap_or_default(),
                Some("tool_call_update") => acp_schema::tool_update(&params)
                    .map(|(call_id, name, _)| {
                        let success = params
                            .get("update")
                            .and_then(|update| update.get("status"))
                            .and_then(Value::as_str)
                            .is_none_or(|status| status != "failed");
                        vec![RuntimeEvent::ToolCompleted {
                            call_id: call_id.to_string(),
                            name: name.to_string(),
                            success,
                        }]
                    })
                    .unwrap_or_default(),
                _ => Vec::new(),
            });
        }
        if matches!(
            method,
            "session/request_permission" | "session/requestPermission"
        ) {
            let request_id = message
                .id()
                .map(id_label)
                .unwrap_or_else(|| "permission".to_string());
            return Ok(vec![RuntimeEvent::ApprovalRequested {
                request_id,
                title: "Grok requested permission".to_string(),
                description: "The request remains blocked unless the host explicitly approves it."
                    .to_string(),
            }]);
        }
        Ok(Vec::new())
    }
}

fn id_label(id: &JsonRpcId) -> String {
    match id {
        JsonRpcId::Number(value) => value.to_string(),
        JsonRpcId::String(value) => value.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn adapter() -> GrokAcpAdapter {
        GrokAcpAdapter::new(PathBuf::from("/usr/local/bin/grok"))
    }

    fn input() -> RuntimeTurnInput {
        RuntimeTurnInput {
            conversation_id: None,
            prompt: "Summarize the document".to_string(),
            model: "grok-code-fast-1".to_string(),
            cwd: PathBuf::from("/tmp/project"),
            tools: Vec::new(),
        }
    }

    #[test]
    fn pins_acp_and_disables_mcp_and_host_mutation_capabilities() {
        assert_eq!(PINNED_GROK_SOURCE_REV.len(), 40);
        let adapter = adapter();
        let init = adapter.initialize();
        assert_eq!(
            init.params().expect("init params")["protocolVersion"],
            PINNED_ACP_PROTOCOL_VERSION
        );
        let session = adapter.start_conversation(&input());
        assert_eq!(
            session.params().expect("session params")["mcpServers"],
            json!([])
        );
        assert!(!adapter.capabilities().editor_tools);
    }

    #[test]
    fn maps_streams_and_marks_grok_tools_as_non_editor_tools() {
        let adapter = adapter();
        let text = JsonRpcMessage::notification(
            "session/update",
            json!({
                "update": {
                    "sessionUpdate": "agent_message_chunk",
                    "content": {"type": "text", "text": "Hello"}
                }
            }),
        );
        assert_eq!(
            adapter.map_message(&text).expect("text should map"),
            [RuntimeEvent::TextDelta("Hello".to_string())]
        );
        let tool = JsonRpcMessage::notification(
            "session/update",
            json!({
                "update": {
                    "sessionUpdate": "tool_call",
                    "toolCallId": "tool-1",
                    "title": "write_file",
                    "rawInput": {"path": "document.is"}
                }
            }),
        );
        assert!(matches!(
            adapter
                .map_message(&tool)
                .expect("tool should map")
                .as_slice(),
            [RuntimeEvent::ToolStarted {
                editor_only: false,
                ..
            }]
        ));
    }

    #[test]
    fn protocol_mismatch_is_rejected() {
        assert!(GrokAcpAdapter::supports_protocol(
            &json!({"protocolVersion": 1})
        ));
        assert!(!GrokAcpAdapter::supports_protocol(
            &json!({"protocolVersion": 2})
        ));
    }
}
