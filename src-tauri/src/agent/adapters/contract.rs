#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use serde_json::json;

    use super::super::{
        codex_app_server::CodexAppServerAdapter,
        grok_acp::GrokAcpAdapter,
        stdio_json_rpc::{JsonRpcId, JsonRpcMessage},
        AgentRuntimeAdapter, RuntimeEvent, RuntimeTurnInput,
    };

    struct ContractCase {
        text_message: JsonRpcMessage,
        completed_message: JsonRpcMessage,
    }

    fn input() -> RuntimeTurnInput {
        RuntimeTurnInput {
            conversation_id: None,
            prompt: "Read the document".to_string(),
            model: "test-model".to_string(),
            cwd: PathBuf::from("/tmp/ideanote-contract"),
            tools: vec![crate::agent::types::AgentToolDescriptor {
                name: "edit_document".to_string(),
                description: "Apply a reversible editor mutation".to_string(),
                input_schema: json!({"type": "object"}),
                requires: Vec::new(),
                ..Default::default()
            }],
        }
    }

    fn assert_shared_contract(adapter: &dyn AgentRuntimeAdapter, case: ContractCase) {
        assert!(adapter.initialize().id().is_some());
        assert!(adapter.start_conversation(&input()).id().is_some());
        assert!(adapter
            .start_turn("conversation-1", &input())
            .id()
            .is_some());
        assert!(adapter.capabilities().text_streaming);
        assert!(adapter.capabilities().cancellation);
        assert!(matches!(
            adapter
                .map_message(&case.text_message)
                .expect("text event should map")
                .as_slice(),
            [RuntimeEvent::TextDelta(text)] if text == "Hello"
        ));
        assert!(matches!(
            adapter
                .map_message(&case.completed_message)
                .expect("completion should map")
                .as_slice(),
            [RuntimeEvent::TurnCompleted]
        ));
        let tool_result = adapter.tool_result(
            &JsonRpcId::String("request-1".to_string()),
            json!({"mutationId": "mutation-1"}),
            true,
        );
        assert!(matches!(tool_result, JsonRpcMessage::Response { .. }));
        let approval = adapter.approval_result(&JsonRpcId::String("approval-1".to_string()), false);
        assert!(matches!(approval, JsonRpcMessage::Response { .. }));
    }

    #[test]
    fn codex_and_grok_share_the_normalized_runtime_contract() {
        let codex = CodexAppServerAdapter::new(PathBuf::from("/usr/local/bin/codex"));
        assert_shared_contract(
            &codex,
            ContractCase {
                text_message: JsonRpcMessage::notification(
                    "item/agentMessage/delta",
                    json!({"delta": "Hello"}),
                ),
                completed_message: JsonRpcMessage::notification(
                    "turn/completed",
                    json!({"turn": {"status": "completed"}}),
                ),
            },
        );

        let grok = GrokAcpAdapter::new(PathBuf::from("/usr/local/bin/grok"));
        assert_shared_contract(
            &grok,
            ContractCase {
                text_message: JsonRpcMessage::notification(
                    "session/update",
                    json!({
                        "update": {
                            "sessionUpdate": "agent_message_chunk",
                            "content": {"text": "Hello"}
                        }
                    }),
                ),
                completed_message: JsonRpcMessage::Response {
                    id: JsonRpcId::Number(7),
                    result: Some(json!({"stopReason": "end_turn"})),
                    error: None,
                },
            },
        );
    }
}
