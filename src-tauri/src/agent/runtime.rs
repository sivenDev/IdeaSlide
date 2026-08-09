use tokio::sync::watch;
use uuid::Uuid;

use super::{
    provider, skills,
    types::{AgentErrorCode, AgentErrorDiagnostic, AgentRunRequest},
};

pub(crate) async fn complete(
    request: AgentRunRequest,
    api_key: String,
    cancelled: watch::Receiver<bool>,
    on_progress: impl FnMut(provider::ProviderProgress) -> Result<(), String>,
) -> Result<provider::ProviderCompletion, provider::ProviderFailure> {
    let preamble = prompt_with_context(&request)?;
    provider::complete(
        provider::ProviderRequest {
            base_url: request.base_url,
            model: request.model,
            preamble,
            prompt: request.prompt,
            messages: request.messages,
            tools: request.tools,
            strategy: super::types::AgentProviderStrategy::Responses,
            retry: request.retry,
        },
        api_key,
        cancelled,
        on_progress,
    )
    .await
}

pub(crate) fn prompt_with_context(
    request: &AgentRunRequest,
) -> Result<String, provider::ProviderFailure> {
    let skill = request
        .skill_id
        .as_deref()
        .map(skills::load_skill)
        .transpose()
        .map_err(runtime_failure)?
        .unwrap_or("");
    let tools = serde_json::to_string_pretty(&request.tools)
        .map_err(|error| runtime_failure(format!("Agent tools could not be encoded: {error}")))?;
    let context = serde_json::to_string_pretty(&request.context)
        .map_err(|error| runtime_failure(format!("Agent context could not be encoded: {error}")))?;
    let preamble = format!(
        "{}\n\nACTIVE EDITOR SKILL:\n{}\n\nAVAILABLE EDITOR TOOLS:\n{}\n\nACTIVE DOCUMENT CONTEXT:\n{}\n\nNever write files directly. Use registered structured editor Tools for reads and mutations. Complete every Tool named in a descriptor's requires list before calling that dependent Tool. Mutation Tools apply through the active editor as reversible transactions and cannot save or bypass editor safety checks. When the user requests a supported reversible editor mutation, do not ask for approval, confirmation, or review; complete its required reads and then call exactly one matching mutation Tool.",
        request.system_prompt, skill, tools, context
    );
    Ok(preamble)
}

fn runtime_failure(message: impl Into<String>) -> provider::ProviderFailure {
    provider::ProviderFailure {
        diagnostic: AgentErrorDiagnostic {
            code: AgentErrorCode::RuntimeUnavailable,
            message: message.into(),
            recovery: Some("Restart the Agent and retry the Turn.".to_string()),
            diagnostic_id: Uuid::new_v4().to_string(),
            retryable: false,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent::{
        provider::ProviderProgress,
        types::{
            AgentErrorCode, AgentMessageInput, AgentMessageRole, AgentProviderStrategy,
            AgentRunRequest, AgentToolDescriptor, StreamingBehavior,
        },
    };
    use std::collections::VecDeque;
    use std::sync::{Arc, Mutex};
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
        sync::watch,
    };

    fn request(base_url: String) -> AgentRunRequest {
        AgentRunRequest {
            run_id: "test-run".to_string(),
            thread_id: "test-thread".to_string(),
            retry_of_turn_id: None,
            upstream_thread_id: None,
            prompt: "Current question".to_string(),
            binding: serde_json::json!({"documentId": "doc", "revision": 1}),
            base_url,
            model: "test-model".to_string(),
            system_prompt: "Follow the editor contract".to_string(),
            retry: Default::default(),
            skill_id: None,
            context: serde_json::json!({"documentType": "test"}),
            tools: vec![AgentToolDescriptor {
                name: "edit_document".to_string(),
                description: "Apply a reversible editor mutation".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {"title": {"type": "string"}},
                    "required": ["title"]
                }),
                requires: Vec::new(),
            }],
            messages: vec![
                AgentMessageInput {
                    role: AgentMessageRole::User,
                    content: "Earlier question".to_string(),
                },
                AgentMessageInput {
                    role: AgentMessageRole::Assistant,
                    content: "Earlier answer".to_string(),
                },
            ],
        }
    }

    #[test]
    fn direct_editor_mutation_prompt_forbids_a_confirmation_gate() {
        let prompt = prompt_with_context(&request("http://localhost".to_string()))
            .expect("prompt should be assembled");
        assert!(prompt.contains("do not ask for approval, confirmation, or review"));
        assert!(prompt.contains("complete its required reads"));
        assert!(prompt.contains("call exactly one matching mutation Tool"));
    }

    struct TestResponse {
        status: u16,
        content_type: &'static str,
        chunks: Vec<(u64, String)>,
    }

    impl TestResponse {
        fn sse(events: Vec<(u64, serde_json::Value)>) -> Self {
            Self {
                status: 200,
                content_type: "text/event-stream",
                chunks: events
                    .into_iter()
                    .map(|(delay, event)| (delay, format!("data: {event}\n\n")))
                    .collect(),
            }
        }

        fn failure(status: u16, body: &str) -> Self {
            Self {
                status,
                content_type: "application/json",
                chunks: vec![(0, body.to_string())],
            }
        }
    }

    async fn provider_server(responses: Vec<TestResponse>) -> (String, Arc<Mutex<Vec<String>>>) {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test listener should bind");
        let address = listener
            .local_addr()
            .expect("listener should have an address");
        let captured = Arc::new(Mutex::new(Vec::<String>::new()));
        let captured_requests = captured.clone();
        tokio::spawn(async move {
            let mut responses = VecDeque::from(responses);
            while let Some(response) = responses.pop_front() {
                let (mut stream, _) = listener.accept().await.expect("request should connect");
                let mut request_bytes = Vec::new();
                let mut buffer = [0_u8; 4096];
                let mut expected_length = None;
                loop {
                    let count = stream.read(&mut buffer).await.expect("request should read");
                    if count == 0 {
                        break;
                    }
                    request_bytes.extend_from_slice(&buffer[..count]);
                    if expected_length.is_none() {
                        if let Some(header_end) = request_bytes
                            .windows(4)
                            .position(|window| window == b"\r\n\r\n")
                        {
                            let headers = String::from_utf8_lossy(&request_bytes[..header_end]);
                            let content_length = headers
                                .lines()
                                .find_map(|line| {
                                    line.strip_prefix("content-length:")
                                        .or_else(|| line.strip_prefix("Content-Length:"))
                                })
                                .and_then(|value| value.trim().parse::<usize>().ok())
                                .unwrap_or(0);
                            expected_length = Some(header_end + 4 + content_length);
                        }
                    }
                    if expected_length.is_some_and(|length| request_bytes.len() >= length) {
                        break;
                    }
                }
                captured_requests
                    .lock()
                    .expect("requests should lock")
                    .push(String::from_utf8_lossy(&request_bytes).to_string());
                let reason = match response.status {
                    200 => "OK",
                    404 => "Not Found",
                    429 => "Too Many Requests",
                    500 => "Internal Server Error",
                    _ => "Error",
                };
                stream
                    .write_all(
                        format!(
                            "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nConnection: close\r\n\r\n",
                            response.status, reason, response.content_type
                        )
                        .as_bytes(),
                    )
                    .await
                    .expect("response headers should write");
                for (delay_ms, chunk) in response.chunks {
                    if delay_ms > 0 {
                        tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                    }
                    if stream.write_all(chunk.as_bytes()).await.is_err() {
                        break;
                    }
                    let _ = stream.flush().await;
                }
            }
        });
        (format!("http://{address}/v1"), captured)
    }

    fn responses_text(text: &str) -> serde_json::Value {
        serde_json::json!({"type": "response.output_text.delta", "delta": text})
    }

    fn chat_text(text: &str) -> serde_json::Value {
        serde_json::json!({
            "choices": [{"delta": {"content": text}, "finish_reason": null}]
        })
    }

    #[tokio::test]
    async fn responses_streams_text_reasoning_and_history_offline() {
        let (base_url, captured_requests) = provider_server(vec![TestResponse::sse(vec![
            (
                0,
                serde_json::json!({
                    "type": "response.reasoning_summary_text.delta",
                    "delta": "Checked the document"
                }),
            ),
            (90, responses_text("Hello")),
            (220, responses_text(" ")),
            (220, responses_text("world")),
            (0, serde_json::json!({"type": "response.completed"})),
        ])])
        .await;
        let (_cancel_sender, cancel_receiver) = watch::channel(false);
        let progress = Arc::new(Mutex::new(Vec::<ProviderProgress>::new()));
        let captured_progress = progress.clone();
        let completion = complete(
            request(base_url),
            "test-key".to_string(),
            cancel_receiver,
            move |event| {
                captured_progress
                    .lock()
                    .expect("progress should lock")
                    .push(event);
                Ok(())
            },
        )
        .await
        .expect("stream should complete");
        assert_eq!(completion.text, "Hello world");
        assert_eq!(
            completion.capabilities.strategy,
            AgentProviderStrategy::Responses
        );
        assert_eq!(
            completion.telemetry.behavior,
            StreamingBehavior::Incremental
        );
        assert!(progress.lock().expect("progress should lock").iter().any(|event| {
            matches!(event, ProviderProgress::PublicActivityDelta(text) if text == "Checked the document")
        }));
        let request_text = captured_requests.lock().expect("requests should lock")[0].clone();
        assert!(request_text.starts_with("POST /v1/responses"));
        assert!(request_text.contains("Earlier question"));
        assert!(request_text.contains("Earlier answer"));
        assert!(request_text.contains("edit_document"));
        assert!(request_text
            .to_ascii_lowercase()
            .contains("authorization: bearer test-key"));
    }

    #[tokio::test]
    async fn unsupported_responses_falls_back_to_chat_completions() {
        let (base_url, captured_requests) = provider_server(vec![
            TestResponse::failure(404, r#"{"error":{"message":"unsupported endpoint"}}"#),
            TestResponse::sse(vec![(0, chat_text("Fallback works"))]),
        ])
        .await;
        let (_cancel_sender, cancel_receiver) = watch::channel(false);
        let progress = Arc::new(Mutex::new(Vec::<ProviderProgress>::new()));
        let captured_progress = progress.clone();
        let completion = complete(
            request(base_url),
            "test-key".to_string(),
            cancel_receiver,
            move |event| {
                captured_progress
                    .lock()
                    .expect("progress should lock")
                    .push(event);
                Ok(())
            },
        )
        .await
        .expect("fallback should complete");
        assert_eq!(completion.text, "Fallback works");
        assert_eq!(
            completion.capabilities.strategy,
            AgentProviderStrategy::ChatCompletions
        );
        assert!(progress
            .lock()
            .expect("progress should lock")
            .iter()
            .any(|event| { matches!(event, ProviderProgress::StrategyFallback { .. }) }));
        let requests = captured_requests.lock().expect("requests should lock");
        assert!(requests[0].starts_with("POST /v1/responses"));
        assert!(requests[1].starts_with("POST /v1/chat/completions"));
    }

    #[tokio::test]
    async fn transient_failure_retries_only_before_visible_output() {
        let (base_url, captured_requests) = provider_server(vec![
            TestResponse::failure(429, r#"{"error":{"message":"slow down"}}"#),
            TestResponse::sse(vec![(0, responses_text("Recovered"))]),
        ])
        .await;
        let (_cancel_sender, cancel_receiver) = watch::channel(false);
        let progress = Arc::new(Mutex::new(Vec::<ProviderProgress>::new()));
        let captured_progress = progress.clone();
        let completion = complete(
            request(base_url),
            "test-key".to_string(),
            cancel_receiver,
            move |event| {
                captured_progress
                    .lock()
                    .expect("progress should lock")
                    .push(event);
                Ok(())
            },
        )
        .await
        .expect("retry should recover");
        assert_eq!(completion.text, "Recovered");
        assert_eq!(completion.telemetry.attempts, 2);
        assert!(progress
            .lock()
            .expect("progress should lock")
            .iter()
            .any(|event| { matches!(event, ProviderProgress::RetryScheduled { attempt: 2, .. }) }));
        assert_eq!(
            captured_requests
                .lock()
                .expect("requests should lock")
                .len(),
            2
        );
    }

    #[tokio::test]
    async fn disabled_automatic_retry_stops_after_the_initial_attempt() {
        let (base_url, captured_requests) = provider_server(vec![TestResponse::failure(
            429,
            r#"{"error":{"message":"slow down"}}"#,
        )])
        .await;
        let (_cancel_sender, cancel_receiver) = watch::channel(false);
        let mut run_request = request(base_url);
        run_request.retry.enabled = false;
        run_request.retry.max_attempts = 5;
        let result = complete(run_request, "test-key".to_string(), cancel_receiver, |_| {
            Ok(())
        })
        .await;
        assert_eq!(
            result
                .expect_err("retry should remain disabled")
                .diagnostic
                .code,
            AgentErrorCode::RateLimited
        );
        assert_eq!(
            captured_requests
                .lock()
                .expect("requests should lock")
                .len(),
            1
        );
    }

    #[tokio::test]
    async fn provider_error_after_text_is_not_retried() {
        let (base_url, captured_requests) = provider_server(vec![TestResponse::sse(vec![
            (0, responses_text("Visible")),
            (
                0,
                serde_json::json!({"type": "error", "message": "temporary provider failure"}),
            ),
        ])])
        .await;
        let (_cancel_sender, cancel_receiver) = watch::channel(false);
        let result = complete(
            request(base_url),
            "test-key".to_string(),
            cancel_receiver,
            |_| Ok(()),
        )
        .await;
        assert_eq!(
            result.expect_err("stream should fail").diagnostic.code,
            AgentErrorCode::ProviderUnavailable
        );
        assert_eq!(
            captured_requests
                .lock()
                .expect("requests should lock")
                .len(),
            1
        );
    }

    #[tokio::test]
    async fn duplicate_tool_call_ids_emit_one_mutation_activity() {
        let tool = serde_json::json!({
            "type": "response.output_item.added",
            "item": {"type": "function_call", "call_id": "call-1", "name": "edit_document", "arguments": "{\"title\":\"New\"}"}
        });
        let tool_done = serde_json::json!({
            "type": "response.output_item.done",
            "item": {"type": "function_call", "call_id": "call-1", "name": "edit_document", "arguments": "{\"title\":\"New\"}"}
        });
        let (base_url, _) = provider_server(vec![TestResponse::sse(vec![
            (0, tool.clone()),
            (0, tool),
            (0, tool_done),
            (0, responses_text("Mutation applied")),
        ])])
        .await;
        let (_cancel_sender, cancel_receiver) = watch::channel(false);
        let progress = Arc::new(Mutex::new(Vec::<ProviderProgress>::new()));
        let captured_progress = progress.clone();
        let completion = complete(
            request(base_url),
            "test-key".to_string(),
            cancel_receiver,
            move |event| {
                captured_progress
                    .lock()
                    .expect("progress should lock")
                    .push(event);
                Ok(())
            },
        )
        .await
        .expect("tool activity stream should complete");
        assert_eq!(completion.tool_calls.len(), 1);
        assert_eq!(completion.tool_calls[0].arguments["title"], "New");
        let progress = progress.lock().expect("progress should lock");
        assert_eq!(
            progress
                .iter()
                .filter(|event| matches!(event, ProviderProgress::ToolStarted { call_id, .. } if call_id == "call-1"))
                .count(),
            1
        );
        assert_eq!(
            progress
                .iter()
                .filter(|event| matches!(event, ProviderProgress::ToolCompleted { call_id, .. } if call_id == "call-1"))
                .count(),
            1
        );
    }

    #[tokio::test]
    async fn cancellation_interrupts_retry_backoff() {
        let (base_url, captured_requests) = provider_server(vec![TestResponse::failure(
            429,
            r#"{"error":{"message":"slow down"}}"#,
        )])
        .await;
        let (cancel_sender, cancel_receiver) = watch::channel(false);
        let result = complete(
            request(base_url),
            "test-key".to_string(),
            cancel_receiver,
            move |event| {
                if matches!(event, ProviderProgress::RetryScheduled { .. }) {
                    cancel_sender.send(true).expect("cancellation should send");
                }
                Ok(())
            },
        )
        .await;
        assert_eq!(
            result.expect_err("run should cancel").diagnostic.code,
            AgentErrorCode::Cancelled
        );
        assert_eq!(
            captured_requests
                .lock()
                .expect("requests should lock")
                .len(),
            1
        );
    }

    #[tokio::test]
    async fn delayed_dense_delivery_is_reported_as_burst_without_fake_deltas() {
        let batch = format!(
            "data: {}\n\ndata: {}\n\ndata: {}\n\n",
            responses_text("One"),
            responses_text(" two"),
            serde_json::json!({"type": "response.completed"})
        );
        let (base_url, _) = provider_server(vec![TestResponse {
            status: 200,
            content_type: "text/event-stream",
            chunks: vec![(180, batch)],
        }])
        .await;
        let (_cancel_sender, cancel_receiver) = watch::channel(false);
        let deltas = Arc::new(Mutex::new(Vec::<String>::new()));
        let captured_deltas = deltas.clone();
        let completion = complete(
            request(base_url),
            "test-key".to_string(),
            cancel_receiver,
            move |event| {
                if let ProviderProgress::TextDelta(text) = event {
                    captured_deltas
                        .lock()
                        .expect("deltas should lock")
                        .push(text);
                }
                Ok(())
            },
        )
        .await
        .expect("burst response should complete");
        assert_eq!(completion.telemetry.behavior, StreamingBehavior::Burst);
        assert_eq!(*deltas.lock().expect("deltas should lock"), ["One", " two"]);
    }
}
