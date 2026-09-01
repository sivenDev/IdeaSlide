use std::{
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::Duration,
};

use serde_json::{json, Value};

use super::{
    codex_schema,
    stdio_json_rpc::{redact_text, JsonRpcId, JsonRpcMessage, DEFAULT_MAX_FRAME_BYTES},
    AgentRuntimeAdapter, RuntimeAdapterError, RuntimeCapabilities, RuntimeCommandSpec,
    RuntimeEvent, RuntimeKind, RuntimeTurnInput,
};

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
            "item/reasoning/summaryTextDelta" => Vec::new(),
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
                        editor_only: true,
                    }]
                })
                .unwrap_or_default(),
            "item/completed" => {
                if codex_schema::string_at(&params, &["item", "type"])
                    .is_some_and(|kind| kind == "contextCompaction")
                {
                    vec![RuntimeEvent::ContextCompacted]
                } else {
                    codex_schema::dynamic_tool(&params)
                        .map(|(call_id, name, _)| {
                            vec![RuntimeEvent::ToolCompleted {
                                call_id: call_id.to_string(),
                                name: name.to_string(),
                                success: codex_schema::bool_at(&params, &["item", "success"])
                                    .unwrap_or(true),
                            }]
                        })
                        .unwrap_or_default()
                }
            }
            "thread/tokenUsage/updated" => {
                let usage = params.get("tokenUsage");
                match usage.and_then(|usage| {
                    Some(RuntimeEvent::ContextUsage {
                        total: codex_schema::token_usage_breakdown(usage.get("total")?)?,
                        last: codex_schema::token_usage_breakdown(usage.get("last")?)?,
                        model_context_window: usage
                            .get("modelContextWindow")
                            .and_then(Value::as_u64),
                    })
                }) {
                    Some(event) => vec![event],
                    None => vec![RuntimeEvent::Diagnostic {
                        code: "runtime.invalidTokenUsage".to_string(),
                        message: "Codex supplied an invalid token-usage notification; context usage remains unavailable."
                            .to_string(),
                    }],
                }
            }
            "thread/compacted" => vec![RuntimeEvent::ContextCompacted],
            "model/rerouted" => {
                let from = codex_schema::string_at(&params, &["fromModel"])
                    .unwrap_or("the requested model");
                let to = codex_schema::string_at(&params, &["toModel"])
                    .unwrap_or("another compatible model");
                vec![RuntimeEvent::Diagnostic {
                    code: "runtime.modelRerouted".to_string(),
                    message: redact_text(&format!("Codex rerouted this Turn from {from} to {to}.")),
                }]
            }
            "warning" => codex_schema::string_at(&params, &["message"])
                .map(|message| {
                    vec![RuntimeEvent::Diagnostic {
                        code: "runtime.warning".to_string(),
                        message: redact_text(message),
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
    fn command_does_not_pin_a_cli_version() {
        let adapter = CodexAppServerAdapter::new(std::path::PathBuf::from("/usr/bin/codex"));
        assert!(adapter.command().expected_version.is_none());
    }

    #[test]
    fn thread_start_is_read_only_and_exposes_only_dynamic_editor_tools() {
        let input = RuntimeTurnInput {
            conversation_id: None,
            prompt: "Change the title".to_string(),
            model: "gpt-5.6-terra".to_string(),
            cwd: PathBuf::from("/tmp/project"),
            tools: vec![super::super::super::types::AgentToolDescriptor {
                name: "edit_document".to_string(),
                description: "Apply a reversible editor mutation".to_string(),
                input_schema: json!({"type": "object"}),
                requires: Vec::new(),
                ..Default::default()
            }],
        };
        let message = adapter().start_conversation(&input);
        let params = message.params().expect("request should have params");
        assert_eq!(params["sandbox"], "read-only");
        assert_eq!(params["approvalPolicy"], "never");
        assert_eq!(params["dynamicTools"][0]["name"], "edit_document");
        assert!(params.get("mcpServers").is_none());
    }

    #[test]
    fn maps_rich_lifecycle_and_dynamic_tool_requests() {
        let adapter = adapter();
        let reasoning = JsonRpcMessage::notification(
            "item/reasoning/summaryTextDelta",
            json!({"delta": "Inspected the document"}),
        );
        assert!(adapter
            .map_message(&reasoning)
            .expect("message should map")
            .is_empty());
        let tool = JsonRpcMessage::Request {
            id: JsonRpcId::Number(9),
            method: "item/tool/call".to_string(),
            params: json!({
                "callId": "call-1",
                "tool": "edit_document",
                "arguments": {"title": "New"}
            }),
        };
        assert!(matches!(
            adapter
                .map_message(&tool)
                .expect("tool should map")
                .as_slice(),
            [RuntimeEvent::ToolStarted {
                editor_only: true,
                ..
            }]
        ));
    }

    #[test]
    fn maps_exact_usage_and_both_compaction_forms() {
        let adapter = adapter();
        let usage = JsonRpcMessage::notification(
            "thread/tokenUsage/updated",
            json!({
                "threadId": "thread-1",
                "turnId": "turn-1",
                "tokenUsage": {
                    "total": {
                        "totalTokens": 120,
                        "inputTokens": 90,
                        "cachedInputTokens": 30,
                        "cacheWriteInputTokens": 4,
                        "outputTokens": 30,
                        "reasoningOutputTokens": 8
                    },
                    "last": {
                        "totalTokens": 20,
                        "inputTokens": 12,
                        "cachedInputTokens": 2,
                        "cacheWriteInputTokens": 0,
                        "outputTokens": 8,
                        "reasoningOutputTokens": 3
                    },
                    "modelContextWindow": 200
                }
            }),
        );
        let events = adapter.map_message(&usage).expect("usage should map");
        assert!(matches!(
            events.as_slice(),
            [RuntimeEvent::ContextUsage {
                total,
                last,
                model_context_window: Some(200),
            }] if total.total_tokens == 120 && last.reasoning_output_tokens == 3
        ));

        let current = JsonRpcMessage::notification(
            "item/completed",
            json!({"item": {"type": "contextCompaction", "id": "compact-1"}}),
        );
        assert_eq!(
            adapter.map_message(&current).unwrap(),
            vec![RuntimeEvent::ContextCompacted]
        );
        let legacy = JsonRpcMessage::notification(
            "thread/compacted",
            json!({"threadId": "thread-1", "turnId": "turn-1"}),
        );
        assert_eq!(
            adapter.map_message(&legacy).unwrap(),
            vec![RuntimeEvent::ContextCompacted]
        );
    }
}
