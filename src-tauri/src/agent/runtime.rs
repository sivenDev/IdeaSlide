use futures_util::StreamExt;
use rig_core::{
    completion::{CompletionModel, Message},
    streaming::StreamedAssistantContent,
};
use tokio::sync::watch;

use super::{
    provider, skills,
    types::{AgentMessageRole, AgentRunRequest},
};

pub(crate) async fn complete(
    request: AgentRunRequest,
    api_key: String,
    mut cancelled: watch::Receiver<bool>,
    mut on_text: impl FnMut(&str) -> Result<(), String>,
) -> Result<String, String> {
    let skill = request
        .skill_id
        .as_deref()
        .map(skills::load_skill)
        .transpose()?
        .unwrap_or("");
    let tools = serde_json::to_string_pretty(&request.tools)
        .map_err(|error| format!("Agent tools could not be encoded: {error}"))?;
    let context = serde_json::to_string_pretty(&request.context)
        .map_err(|error| format!("Agent context could not be encoded: {error}"))?;
    let preamble = format!(
        "{}\n\nACTIVE EDITOR SKILL:\n{}\n\nAVAILABLE EDITOR TOOLS:\n{}\n\nACTIVE DOCUMENT CONTEXT:\n{}\n\nNever write files directly. Mutation requests must be returned as reviewable proposals in the active Skill format.",
        request.system_prompt, skill, tools, context
    );
    let model = provider::completion_model(api_key, &request.base_url, &request.model)?;
    let history = request
        .messages
        .iter()
        .filter(|message| !message.content.trim().is_empty())
        .map(|message| match message.role {
            AgentMessageRole::User => Message::user(message.content.clone()),
            AgentMessageRole::Assistant => Message::assistant(message.content.clone()),
        })
        .collect::<Vec<_>>();
    let completion_request = model
        .completion_request(request.prompt)
        .preamble(preamble)
        .messages(history)
        .build();
    let mut stream = model
        .stream(completion_request)
        .await
        .map_err(|error| format!("AI provider request failed: {error}"))?;
    let mut text = String::new();
    loop {
        tokio::select! {
            changed = cancelled.changed() => {
                if changed.is_ok() && *cancelled.borrow() {
                    return Err("Agent run cancelled".to_string());
                }
            }
            item = stream.next() => {
                let Some(item) = item else { break };
                let item = item.map_err(|error| format!("AI provider stream failed: {error}"))?;
                if let StreamedAssistantContent::Text(chunk) = item {
                    if !chunk.text.is_empty() {
                        on_text(&chunk.text)?;
                        text.push_str(&chunk.text);
                    }
                }
            }
        }
    }
    if text.trim().is_empty() {
        return Err("The AI provider returned no text response".to_string());
    }
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent::types::{AgentMessageInput, AgentRunRequest};
    use std::sync::{Arc, Mutex};
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
        sync::watch,
    };

    fn request(base_url: String) -> AgentRunRequest {
        AgentRunRequest {
            run_id: "test-run".to_string(),
            prompt: "Current question".to_string(),
            base_url,
            model: "test-model".to_string(),
            system_prompt: "Follow the editor contract".to_string(),
            skill_id: None,
            context: serde_json::json!({"documentType": "test"}),
            tools: Vec::new(),
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

    async fn openai_stream_server(
        chunks: Vec<&'static str>,
        linger_after_first: bool,
    ) -> (String, tokio::sync::oneshot::Receiver<String>) {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test listener should bind");
        let address = listener
            .local_addr()
            .expect("listener should have an address");
        let (request_sender, request_receiver) = tokio::sync::oneshot::channel();
        tokio::spawn(async move {
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
            let request_text = String::from_utf8_lossy(&request_bytes).to_string();
            let _ = request_sender.send(request_text);
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\n")
                .await
                .expect("response headers should write");
            for (index, text) in chunks.into_iter().enumerate() {
                let payload = serde_json::json!({
                    "id": "chatcmpl-test",
                    "object": "chat.completion.chunk",
                    "created": 1,
                    "model": "test-model",
                    "choices": [{
                        "index": 0,
                        "delta": {"content": text},
                        "finish_reason": serde_json::Value::Null
                    }]
                });
                stream
                    .write_all(format!("data: {payload}\n\n").as_bytes())
                    .await
                    .expect("stream chunk should write");
                stream.flush().await.expect("stream chunk should flush");
                if linger_after_first && index == 0 {
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                }
            }
            let _ = stream.write_all(b"data: [DONE]\n\n").await;
        });
        (format!("http://{address}/v1"), request_receiver)
    }

    #[test]
    fn message_roles_map_to_provider_history() {
        assert!(matches!(Message::user("question"), Message::User { .. }));
        assert!(matches!(
            Message::assistant("answer"),
            Message::Assistant { .. }
        ));
    }

    #[tokio::test]
    async fn openai_compatible_streams_text_and_history_offline() {
        let (base_url, captured_request) =
            openai_stream_server(vec!["Hello", " world"], false).await;
        let (_cancel_sender, cancel_receiver) = watch::channel(false);
        let deltas = Arc::new(Mutex::new(Vec::<String>::new()));
        let captured_deltas = deltas.clone();
        let text = complete(
            request(base_url),
            "test-key".to_string(),
            cancel_receiver,
            move |delta| {
                captured_deltas
                    .lock()
                    .expect("deltas should lock")
                    .push(delta.to_string());
                Ok(())
            },
        )
        .await
        .expect("stream should complete");
        assert_eq!(text, "Hello world");
        assert_eq!(
            *deltas.lock().expect("deltas should lock"),
            ["Hello", " world"]
        );
        let request_text = captured_request.await.expect("request should be captured");
        assert!(request_text.contains("Earlier question"));
        assert!(request_text.contains("Earlier answer"));
        assert!(request_text
            .to_ascii_lowercase()
            .contains("authorization: bearer test-key"));
    }

    #[tokio::test]
    async fn cancellation_stops_an_active_provider_stream() {
        let (base_url, _) = openai_stream_server(vec!["First", " second"], true).await;
        let (cancel_sender, cancel_receiver) = watch::channel(false);
        let result = complete(
            request(base_url),
            "test-key".to_string(),
            cancel_receiver,
            move |_| {
                cancel_sender.send(true).expect("cancellation should send");
                Ok(())
            },
        )
        .await;
        assert_eq!(
            result.expect_err("run should cancel"),
            "Agent run cancelled"
        );
    }
}
