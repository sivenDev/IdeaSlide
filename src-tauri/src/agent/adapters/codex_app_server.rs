use std::{
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::Duration,
};

use serde_json::{json, Value};

use super::{
    codex_schema,
    process::verify_version,
    stdio_json_rpc::{redact_text, JsonRpcId, JsonRpcMessage, DEFAULT_MAX_FRAME_BYTES},
    AgentRuntimeAdapter, RuntimeAdapterError, RuntimeCapabilities, RuntimeCommandSpec,
    RuntimeEvent, RuntimeKind, RuntimeTurnInput,
};

pub(crate) const PINNED_CODEX_VERSION: &str = "0.147.0";

pub(crate) struct CodexAppServerAdapter {
    executable: PathBuf,
    next_id: AtomicU64,
}

impl CodexAppServerAdapter {
    pub(crate) fn new(executable: PathBuf) -> Self {
        Self {
            executable,
            next_id: AtomicU64::new(1),
        }
    }

    fn request(&self, method: &str, params: Value) -> JsonRpcMessage {
        JsonRpcMessage::request(self.next_id.fetch_add(1, Ordering::Relaxed), method, params)
    }

    pub(crate) fn verify_version(output: &str) -> Result<(), RuntimeAdapterError> {
        verify_version(output, PINNED_CODEX_VERSION)
    }
}

impl AgentRuntimeAdapter for CodexAppServerAdapter {
    fn kind(&self) -> RuntimeKind {
        RuntimeKind::CodexAppServer
    }

    fn label(&self) -> &'static str {
        "Codex app-server"
    }

    fn command(&self) -> RuntimeCommandSpec {
        RuntimeCommandSpec {
            executable: self.executable.clone(),
            args: vec![
                "app-server".to_string(),
                "--listen".to_string(),
                "stdio://".to_string(),
            ],
            expected_version: Some(PINNED_CODEX_VERSION.to_string()),
            version_args: vec!["--version".to_string()],
            request_timeout: Duration::from_secs(30),
            turn_event_timeout: Duration::from_secs(300),
            max_frame_bytes: DEFAULT_MAX_FRAME_BYTES,
        }
    }

    fn capabilities(&self) -> RuntimeCapabilities {
        RuntimeCapabilities {
            text_streaming: true,
            reasoning_summary: true,
            plans: true,
            tool_events: true,
            approvals: false,
            cancellation: true,
            steering: false,
            retry: true,
            persistence: true,
            editor_tools: true,
        }
    }

    fn initialize(&self) -> JsonRpcMessage {
        self.request(
            codex_schema::INITIALIZE,
            json!({
                "clientInfo": {
                    "name": "ideanote",
                    "title": "IdeaNote",
                    "version": env!("CARGO_PKG_VERSION")
                },
                "capabilities": {"experimentalApi": true}
            }),
        )
    }

    fn initialized(&self) -> Option<JsonRpcMessage> {
        Some(JsonRpcMessage::notification(
            codex_schema::INITIALIZED,
            json!({}),
        ))
    }

    fn start_conversation(&self, input: &RuntimeTurnInput) -> JsonRpcMessage {
        let dynamic_tools: Vec<Value> = input
            .tools
            .iter()
            .map(|tool| {
                json!({
                    "type": "function",
                    "name": tool.name,
                    "description": tool.description,
                    "inputSchema": tool.input_schema,
                })
            })
            .collect();
        self.request(
            codex_schema::THREAD_START,
            json!({
                "model": input.model,
                "cwd": input.cwd,
                "sandbox": "read-only",
                "approvalPolicy": "never",
                "ephemeral": false,
                "dynamicTools": dynamic_tools,
            }),
        )
    }

    fn resume_conversation(&self, conversation_id: &str, cwd: &Path) -> JsonRpcMessage {
        self.request(
            codex_schema::THREAD_RESUME,
            json!({"threadId": conversation_id, "cwd": cwd}),
        )
    }

    fn start_turn(&self, conversation_id: &str, input: &RuntimeTurnInput) -> JsonRpcMessage {
        self.request(
            codex_schema::TURN_START,
            json!({
                "threadId": conversation_id,
                "input": [{"type": "text", "text": input.prompt}],
                "model": input.model,
                "cwd": input.cwd,
                "approvalPolicy": "never",
                "sandboxPolicy": {"type": "readOnly"},
                "summary": "concise",
            }),
        )
    }

    fn cancel_turn(&self, conversation_id: &str) -> JsonRpcMessage {
        self.request(
            codex_schema::TURN_INTERRUPT,
            json!({"threadId": conversation_id}),
        )
    }

    fn steer_turn(&self, conversation_id: &str, prompt: &str) -> Option<JsonRpcMessage> {
        Some(self.request(
            codex_schema::TURN_STEER,
            json!({
                "threadId": conversation_id,
                "input": [{"type": "text", "text": prompt}]
            }),
        ))
    }

    fn tool_result(&self, request_id: &JsonRpcId, output: Value, success: bool) -> JsonRpcMessage {
        JsonRpcMessage::response(
            request_id.clone(),
            json!({
                "contentItems": [{"type": "inputText", "text": output.to_string()}],
                "success": success
            }),
        )
    }

    fn approval_result(&self, request_id: &JsonRpcId, approved: bool) -> JsonRpcMessage {
        JsonRpcMessage::response(
            request_id.clone(),
            json!({"decision": if approved { "accept" } else { "decline" }}),
        )
    }

    fn map_message(
        &self,
        message: &JsonRpcMessage,
    ) -> Result<Vec<RuntimeEvent>, RuntimeAdapterError> {
        let Some(method) = message.method() else {
            return Ok(Vec::new());
        };
        let params = message.params().cloned().unwrap_or_else(|| json!({}));
        let events = match method {
            "item/agentMessage/delta" => codex_schema::string_at(&params, &["delta"])
                .map(|text| vec![RuntimeEvent::TextDelta(text.to_string())])
                .unwrap_or_default(),
            "item/reasoning/summaryTextDelta" => codex_schema::string_at(&params, &["delta"])
                .map(|text| vec![RuntimeEvent::PublicActivityDelta(text.to_string())])
                .unwrap_or_default(),
            "turn/plan/updated" => vec![RuntimeEvent::PlanUpdated {
                title: codex_schema::string_at(&params, &["explanation"])
                    .unwrap_or("Plan")
                    .to_string(),
                steps: codex_schema::plan_steps(&params),
            }],
            "item/tool/call" => codex_schema::dynamic_tool(&params)
                .map(|(call_id, name, arguments)| {
                    vec![RuntimeEvent::ToolStarted {
                        call_id: call_id.to_string(),
                        name: name.to_string(),
                        arguments,
                        proposal_only: true,
                    }]
                })
                .unwrap_or_default(),
            "item/completed" => codex_schema::dynamic_tool(&params)
                .map(|(call_id, name, _)| {
                    vec![RuntimeEvent::ToolCompleted {
                        call_id: call_id.to_string(),
                        name: name.to_string(),
                        success: codex_schema::bool_at(&params, &["item", "success"])
                            .unwrap_or(true),
                    }]
                })
                .unwrap_or_default(),
            "item/commandExecution/requestApproval" | "item/fileChange/requestApproval" => {
                let request_id = message
                    .id()
                    .map(id_label)
                    .unwrap_or_else(|| "approval".to_string());
                vec![RuntimeEvent::ApprovalRequested {
                    request_id,
                    title: "Runtime approval requested".to_string(),
                    description: "Codex requested a built-in mutation capability that IdeaNote does not auto-approve."
                        .to_string(),
                }]
            }
            "turn/completed" => {
                if codex_schema::string_at(&params, &["turn", "status"])
                    .is_some_and(|status| status == "interrupted")
                {
                    vec![RuntimeEvent::TurnCancelled]
                } else {
                    vec![RuntimeEvent::TurnCompleted]
                }
            }
            "error" => vec![RuntimeEvent::RuntimeError(redact_text(
                codex_schema::string_at(&params, &["error", "message"])
                    .or_else(|| codex_schema::string_at(&params, &["message"]))
                    .unwrap_or("Codex app-server reported an error."),
            ))],
            _ => Vec::new(),
        };
        Ok(events)
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

    fn adapter() -> CodexAppServerAdapter {
        CodexAppServerAdapter::new(PathBuf::from("/usr/local/bin/codex"))
    }

    #[test]
    fn version_is_exactly_pinned() {
        assert!(CodexAppServerAdapter::verify_version("codex-cli 0.147.0").is_ok());
        assert!(CodexAppServerAdapter::verify_version("codex-cli 0.148.0").is_err());
    }

    #[test]
    fn thread_start_is_read_only_and_exposes_only_dynamic_editor_tools() {
        let input = RuntimeTurnInput {
            conversation_id: None,
            prompt: "Change the title".to_string(),
            model: "gpt-5.6-terra".to_string(),
            cwd: PathBuf::from("/tmp/project"),
            tools: vec![super::super::super::types::AgentToolDescriptor {
                name: "propose_change".to_string(),
                description: "Return a proposal".to_string(),
                input_schema: json!({"type": "object"}),
            }],
        };
        let message = adapter().start_conversation(&input);
        let params = message.params().expect("request should have params");
        assert_eq!(params["sandbox"], "read-only");
        assert_eq!(params["approvalPolicy"], "never");
        assert_eq!(params["dynamicTools"][0]["name"], "propose_change");
        assert!(params.get("mcpServers").is_none());
    }

    #[test]
    fn maps_rich_lifecycle_and_dynamic_tool_requests() {
        let adapter = adapter();
        let reasoning = JsonRpcMessage::notification(
            "item/reasoning/summaryTextDelta",
            json!({"delta": "Inspected the document"}),
        );
        assert_eq!(
            adapter.map_message(&reasoning).expect("message should map"),
            [RuntimeEvent::PublicActivityDelta(
                "Inspected the document".to_string()
            )]
        );
        let tool = JsonRpcMessage::Request {
            id: JsonRpcId::Number(9),
            method: "item/tool/call".to_string(),
            params: json!({
                "callId": "call-1",
                "tool": "propose_change",
                "arguments": {"title": "New"}
            }),
        };
        assert!(matches!(
            adapter
                .map_message(&tool)
                .expect("tool should map")
                .as_slice(),
            [RuntimeEvent::ToolStarted {
                proposal_only: true,
                ..
            }]
        ));
    }
}
