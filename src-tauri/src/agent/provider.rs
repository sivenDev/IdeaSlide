use std::{collections::HashMap, time::Duration};

use futures_util::StreamExt;
use reqwest::{Client, StatusCode, Url};
use serde_json::{json, Value};
use tokio::sync::watch;
use uuid::Uuid;

use super::types::{
    AgentErrorCode, AgentErrorDiagnostic, AgentMessageInput, AgentMessageRole,
    AgentProviderCapabilities, AgentProviderStrategy, AgentRetryPolicy, AgentStreamingTelemetry,
    AgentToolCall, AgentToolDescriptor, StreamingBehavior,
};

const MAX_ERROR_BODY_BYTES: usize = 8 * 1024;

pub(crate) struct ProviderRequest {
    pub base_url: String,
    pub model: String,
    pub preamble: String,
    pub prompt: String,
    pub messages: Vec<AgentMessageInput>,
    pub tools: Vec<AgentToolDescriptor>,
    pub strategy: AgentProviderStrategy,
    pub retry: AgentRetryPolicy,
}

#[derive(Debug)]
pub(crate) struct ProviderCompletion {
    pub text: String,
    pub capabilities: AgentProviderCapabilities,
    pub telemetry: AgentStreamingTelemetry,
    pub tool_calls: Vec<AgentToolCall>,
}

#[derive(Debug)]
pub(crate) struct ProviderFailure {
    pub diagnostic: AgentErrorDiagnostic,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum ProviderProgress {
    Capabilities(AgentProviderCapabilities),
    StrategyFallback {
        from: AgentProviderStrategy,
        to: AgentProviderStrategy,
        reason: String,
    },
    RetryScheduled {
        attempt: u8,
        delay_ms: u64,
        diagnostic: AgentErrorDiagnostic,
    },
    PublicActivityDelta(String),
    TextDelta(String),
    ToolStarted {
        call_id: String,
        name: String,
    },
    ToolCompleted {
        call_id: String,
        name: String,
        arguments: Value,
    },
    Telemetry(AgentStreamingTelemetry),
}

#[derive(Clone, Debug, Eq, PartialEq)]
enum ProviderStreamEvent {
    TextDelta(String),
    PublicActivityDelta(String),
    ToolStarted {
        call_id: String,
        name: String,
    },
    ToolArgumentsDelta {
        call_id: Option<String>,
        index: u64,
        name: String,
        arguments: String,
    },
    ToolCompleted {
        call_id: String,
        name: String,
        arguments: Value,
    },
    Completed,
    Error(String),
}

struct AttemptFailure {
    diagnostic: AgentErrorDiagnostic,
    unsupported: bool,
    visible_progress: bool,
}

struct AttemptSuccess {
    text: String,
    capabilities: AgentProviderCapabilities,
    request_ms: u64,
    first_event_ms: Option<u64>,
    first_text_ms: Option<u64>,
    event_span_ms: u64,
    event_count: u32,
    tool_calls: Vec<AgentToolCall>,
}

#[derive(Clone, Copy)]
enum TransportFailureKind {
    Timeout,
    Tls,
    Network,
    Provider,
}

pub(crate) async fn complete(
    request: ProviderRequest,
    api_key: String,
    mut cancelled: watch::Receiver<bool>,
    mut emit: impl FnMut(ProviderProgress) -> Result<(), String>,
) -> Result<ProviderCompletion, ProviderFailure> {
    let base_url = validate_base_url(&request.base_url)
        .map_err(|diagnostic| ProviderFailure { diagnostic })?;
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|error| ProviderFailure {
            diagnostic: classify_reqwest_failure(&error),
        })?;
    let total_started = std::time::Instant::now();
    let mut strategy = request.strategy;
    let mut attempt = 1_u8;
    let max_attempts = effective_max_attempts(request.retry);

    loop {
        if *cancelled.borrow() {
            return Err(cancelled_failure());
        }
        match execute_attempt(
            &client,
            &request,
            &api_key,
            &base_url,
            strategy,
            &mut cancelled,
            &mut emit,
        )
        .await
        {
            Ok(success) => {
                let total_ms = elapsed_ms(total_started);
                let behavior = classify_streaming_behavior(
                    success.first_event_ms.unwrap_or_default(),
                    success.event_span_ms,
                    success.event_count,
                );
                let telemetry = AgentStreamingTelemetry {
                    strategy,
                    attempts: attempt,
                    request_ms: success.request_ms,
                    first_event_ms: success.first_event_ms,
                    first_text_ms: success.first_text_ms,
                    event_span_ms: success.event_span_ms,
                    total_ms,
                    event_count: success.event_count,
                    behavior,
                };
                emit(ProviderProgress::Telemetry(telemetry.clone())).map_err(|message| {
                    ProviderFailure {
                        diagnostic: runtime_diagnostic(message),
                    }
                })?;
                return Ok(ProviderCompletion {
                    text: success.text,
                    capabilities: success.capabilities,
                    telemetry,
                    tool_calls: success.tool_calls,
                });
            }
            Err(failure)
                if failure.unsupported
                    && !failure.visible_progress
                    && strategy == AgentProviderStrategy::Responses =>
            {
                let next = AgentProviderStrategy::ChatCompletions;
                emit(ProviderProgress::StrategyFallback {
                    from: strategy,
                    to: next,
                    reason: "Responses is unavailable on this endpoint; using Chat Completions."
                        .to_string(),
                })
                .map_err(|message| ProviderFailure {
                    diagnostic: runtime_diagnostic(message),
                })?;
                strategy = next;
            }
            Err(failure)
                if failure.diagnostic.retryable
                    && !failure.visible_progress
                    && attempt < max_attempts =>
            {
                let delay_ms = retry_delay_ms(attempt);
                emit(ProviderProgress::RetryScheduled {
                    attempt: attempt + 1,
                    delay_ms,
                    diagnostic: failure.diagnostic,
                })
                .map_err(|message| ProviderFailure {
                    diagnostic: runtime_diagnostic(message),
                })?;
                wait_for_retry(delay_ms, &mut cancelled).await?;
                attempt += 1;
            }
            Err(failure) => {
                return Err(ProviderFailure {
                    diagnostic: failure.diagnostic,
                });
            }
        }
    }
}

async fn execute_attempt(
    client: &Client,
    request: &ProviderRequest,
    api_key: &str,
    base_url: &Url,
    strategy: AgentProviderStrategy,
    cancelled: &mut watch::Receiver<bool>,
    emit: &mut impl FnMut(ProviderProgress) -> Result<(), String>,
) -> Result<AttemptSuccess, AttemptFailure> {
    let started = std::time::Instant::now();
    let endpoint = endpoint_url(base_url, strategy);
    let body = request_body(request, strategy);
    let send = client
        .post(endpoint.clone())
        .bearer_auth(api_key)
        .json(&body)
        .send();
    let response = tokio::select! {
        changed = cancelled.changed() => {
            if changed.is_ok() && *cancelled.borrow() {
                return Err(cancelled_attempt_failure());
            }
            return Err(runtime_attempt_failure("Agent cancellation state closed unexpectedly"));
        }
        response = send => response.map_err(|error| AttemptFailure {
            diagnostic: classify_reqwest_failure(&error),
            unsupported: false,
            visible_progress: false,
        })?,
    };
    let request_ms = elapsed_ms(started);
    let status = response.status();
    if !status.is_success() {
        let body = read_bounded_body(response).await;
        return Err(AttemptFailure {
            diagnostic: classify_http_failure(status.as_u16(), endpoint.as_str(), &body),
            unsupported: strategy == AgentProviderStrategy::Responses
                && is_unsupported_responses_status(status, &body),
            visible_progress: false,
        });
    }
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !content_type.contains("text/event-stream") {
        return Err(AttemptFailure {
            diagnostic: diagnostic(
                AgentErrorCode::ProviderProtocolError,
                "The AI provider did not return an event stream.",
                Some("Verify the configured base URL or use a compatible gateway."),
                false,
            ),
            unsupported: strategy == AgentProviderStrategy::Responses,
            visible_progress: false,
        });
    }

    let capabilities = capabilities_for(strategy);
    emit(ProviderProgress::Capabilities(capabilities.clone()))
        .map_err(|message| runtime_attempt_failure(&message))?;

    let mut byte_stream = response.bytes_stream();
    let mut buffer = Vec::<u8>::new();
    let mut text = String::new();
    let mut first_event_ms = None;
    let mut first_text_ms = None;
    let mut last_event_ms = None;
    let mut event_count = 0_u32;
    let mut visible_progress = false;
    let mut active_tools = HashMap::<String, (String, String)>::new();
    let mut chat_tool_ids = HashMap::<u64, String>::new();
    let mut tool_calls = Vec::<AgentToolCall>::new();

    loop {
        let chunk = tokio::select! {
            changed = cancelled.changed() => {
                if changed.is_ok() && *cancelled.borrow() {
                    return Err(cancelled_attempt_failure());
                }
                return Err(runtime_attempt_failure("Agent cancellation state closed unexpectedly"));
            }
            chunk = byte_stream.next() => chunk,
        };
        let Some(chunk) = chunk else { break };
        let chunk = chunk.map_err(|error| AttemptFailure {
            diagnostic: classify_reqwest_failure(&error),
            unsupported: false,
            visible_progress,
        })?;
        buffer.extend_from_slice(&chunk);
        while let Some((frame_end, separator_len)) = next_sse_frame(&buffer) {
            let frame = String::from_utf8_lossy(&buffer[..frame_end]).to_string();
            buffer.drain(..frame_end + separator_len);
            let Some(data) = sse_data(&frame) else {
                continue;
            };
            if data == "[DONE]" {
                continue;
            }
            let parsed = match strategy {
                AgentProviderStrategy::Responses => parse_responses_event(&data),
                AgentProviderStrategy::ChatCompletions => parse_chat_event(&data),
            }
            .map_err(|message| AttemptFailure {
                diagnostic: diagnostic(
                    AgentErrorCode::ProviderProtocolError,
                    &format!("The AI provider returned an invalid stream event: {message}"),
                    Some("Retry the Turn or verify gateway compatibility."),
                    false,
                ),
                unsupported: strategy == AgentProviderStrategy::Responses && !visible_progress,
                visible_progress,
            })?;
            let Some(event) = parsed else { continue };
            let event_ms = elapsed_ms(started);
            first_event_ms.get_or_insert(event_ms);
            last_event_ms = Some(event_ms);
            event_count = event_count.saturating_add(1);
            match event {
                ProviderStreamEvent::TextDelta(delta) if !delta.is_empty() => {
                    first_text_ms.get_or_insert(event_ms);
                    visible_progress = true;
                    text.push_str(&delta);
                    emit(ProviderProgress::TextDelta(delta))
                        .map_err(|message| runtime_attempt_failure(&message))?;
                }
                ProviderStreamEvent::PublicActivityDelta(delta) if !delta.is_empty() => {
                    visible_progress = true;
                    emit(ProviderProgress::PublicActivityDelta(delta))
                        .map_err(|message| runtime_attempt_failure(&message))?;
                }
                ProviderStreamEvent::ToolStarted { call_id, name } => {
                    visible_progress = true;
                    if !active_tools.contains_key(&call_id) {
                        active_tools.insert(call_id.clone(), (name.clone(), String::new()));
                        emit(ProviderProgress::ToolStarted { call_id, name })
                            .map_err(|message| runtime_attempt_failure(&message))?;
                    }
                }
                ProviderStreamEvent::ToolArgumentsDelta {
                    call_id,
                    index,
                    name,
                    arguments,
                } => {
                    visible_progress = true;
                    let call_id = if let Some(call_id) = call_id {
                        chat_tool_ids.insert(index, call_id.clone());
                        call_id
                    } else {
                        chat_tool_ids
                            .get(&index)
                            .cloned()
                            .unwrap_or_else(|| format!("chat-tool-{index}"))
                    };
                    let is_new = !active_tools.contains_key(&call_id);
                    let entry = active_tools
                        .entry(call_id.clone())
                        .or_insert_with(|| (name.clone(), String::new()));
                    if entry.0 == "Editor Tool" && name != "Editor Tool" {
                        entry.0 = name.clone();
                    }
                    entry.1.push_str(&arguments);
                    if is_new {
                        emit(ProviderProgress::ToolStarted { call_id, name })
                            .map_err(|message| runtime_attempt_failure(&message))?;
                    }
                }
                ProviderStreamEvent::ToolCompleted {
                    call_id,
                    name,
                    arguments,
                } => {
                    visible_progress = true;
                    active_tools.remove(&call_id);
                    emit(ProviderProgress::ToolCompleted {
                        call_id: call_id.clone(),
                        name: name.clone(),
                        arguments: arguments.clone(),
                    })
                    .map_err(|message| runtime_attempt_failure(&message))?;
                    tool_calls.push(AgentToolCall {
                        call_id,
                        name,
                        arguments,
                    });
                }
                ProviderStreamEvent::Error(message) => {
                    return Err(AttemptFailure {
                        diagnostic: diagnostic(
                            AgentErrorCode::ProviderUnavailable,
                            &redact_sensitive(&message),
                            Some("Retry the Turn. If the failure persists, verify the provider settings."),
                            !visible_progress,
                        ),
                        unsupported: false,
                        visible_progress,
                    });
                }
                ProviderStreamEvent::Completed
                | ProviderStreamEvent::TextDelta(_)
                | ProviderStreamEvent::PublicActivityDelta(_) => {}
            }
        }
    }

    for (call_id, (name, arguments)) in active_tools {
        let arguments = serde_json::from_str(&arguments).unwrap_or_else(|_| json!({}));
        emit(ProviderProgress::ToolCompleted {
            call_id: call_id.clone(),
            name: name.clone(),
            arguments: arguments.clone(),
        })
        .map_err(|message| runtime_attempt_failure(&message))?;
        tool_calls.push(AgentToolCall {
            call_id,
            name,
            arguments,
        });
    }
    if text.trim().is_empty() && tool_calls.is_empty() {
        return Err(AttemptFailure {
            diagnostic: diagnostic(
                AgentErrorCode::ProviderProtocolError,
                "The AI provider returned no text response.",
                Some("Retry the Turn or choose a model that supports text output."),
                false,
            ),
            unsupported: strategy == AgentProviderStrategy::Responses && !visible_progress,
            visible_progress,
        });
    }
    let first = first_event_ms.unwrap_or_default();
    let event_span_ms = last_event_ms.unwrap_or(first).saturating_sub(first);
    Ok(AttemptSuccess {
        text,
        capabilities,
        request_ms,
        first_event_ms,
        first_text_ms,
        event_span_ms,
        event_count,
        tool_calls,
    })
}

fn validate_base_url(value: &str) -> Result<Url, AgentErrorDiagnostic> {
    let parsed = Url::parse(value.trim()).map_err(|_| {
        diagnostic(
            AgentErrorCode::ConfigurationRequired,
            "The AI provider base URL is invalid.",
            Some("Open Settings and enter an HTTP or HTTPS provider base URL."),
            false,
        )
    })?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(diagnostic(
            AgentErrorCode::ConfigurationRequired,
            "The AI provider base URL must use HTTP or HTTPS.",
            Some("Open Settings and verify the provider base URL."),
            false,
        ));
    }
    Ok(parsed)
}

fn endpoint_url(base_url: &Url, strategy: AgentProviderStrategy) -> Url {
    let suffix = match strategy {
        AgentProviderStrategy::Responses => "responses",
        AgentProviderStrategy::ChatCompletions => "chat/completions",
    };
    let mut endpoint = base_url.clone();
    let path = format!("{}/{}", base_url.path().trim_end_matches('/'), suffix);
    endpoint.set_path(&path);
    endpoint.set_fragment(None);
    endpoint
}

fn request_body(request: &ProviderRequest, strategy: AgentProviderStrategy) -> Value {
    let history = request.messages.iter().filter_map(|message| {
        let content = message.content.trim();
        if content.is_empty() {
            return None;
        }
        let role = match message.role {
            AgentMessageRole::User => "user",
            AgentMessageRole::Assistant => "assistant",
        };
        Some(json!({"role": role, "content": content}))
    });
    match strategy {
        AgentProviderStrategy::Responses => {
            let mut input = history.collect::<Vec<_>>();
            input.push(json!({"role": "user", "content": request.prompt}));
            let tools = request
                .tools
                .iter()
                .map(|tool| {
                    json!({
                        "type": "function",
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": tool.input_schema,
                        "strict": false,
                    })
                })
                .collect::<Vec<_>>();
            json!({
                "model": request.model,
                "stream": true,
                "instructions": request.preamble,
                "input": input,
                "reasoning": {"summary": "auto"},
                "tools": tools,
            })
        }
        AgentProviderStrategy::ChatCompletions => {
            let mut messages = vec![json!({"role": "system", "content": request.preamble})];
            messages.extend(history);
            messages.push(json!({"role": "user", "content": request.prompt}));
            let tools = request
                .tools
                .iter()
                .map(|tool| {
                    json!({
                        "type": "function",
                        "function": {
                            "name": tool.name,
                            "description": tool.description,
                            "parameters": tool.input_schema,
                        }
                    })
                })
                .collect::<Vec<_>>();
            json!({"model": request.model, "stream": true, "messages": messages, "tools": tools})
        }
    }
}

fn capabilities_for(strategy: AgentProviderStrategy) -> AgentProviderCapabilities {
    AgentProviderCapabilities {
        strategy,
        text_streaming: true,
        reasoning_summary: strategy == AgentProviderStrategy::Responses,
        tool_events: true,
        cancellation: true,
        retry: true,
        timing: true,
    }
}

fn parse_responses_event(data: &str) -> Result<Option<ProviderStreamEvent>, String> {
    let value: Value = serde_json::from_str(data).map_err(|error| error.to_string())?;
    let event_type = value
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    Ok(match event_type {
        "response.output_text.delta" => value
            .get("delta")
            .and_then(Value::as_str)
            .map(|text| ProviderStreamEvent::TextDelta(text.to_string())),
        "response.reasoning_summary_text.delta" => value
            .get("delta")
            .and_then(Value::as_str)
            .map(|text| ProviderStreamEvent::PublicActivityDelta(text.to_string())),
        "response.output_item.added" => function_call_event(&value, false),
        "response.output_item.done" => function_call_event(&value, true),
        "response.completed" => Some(ProviderStreamEvent::Completed),
        "response.failed" | "error" => {
            Some(ProviderStreamEvent::Error(provider_error_message(&value)))
        }
        _ => None,
    })
}

fn function_call_event(value: &Value, completed: bool) -> Option<ProviderStreamEvent> {
    let item = value.get("item")?;
    if item.get("type").and_then(Value::as_str) != Some("function_call") {
        return None;
    }
    let call_id = item
        .get("call_id")
        .and_then(Value::as_str)
        .filter(|value| valid_tool_call_id(value))
        .or_else(|| {
            item.get("id")
                .and_then(Value::as_str)
                .filter(|value| valid_tool_call_id(value))
        })
        .map(str::to_string)
        .or_else(|| {
            value
                .get("output_index")
                .and_then(Value::as_u64)
                .map(|index| format!("responses-tool-{index}"))
        })?;
    let name = item
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("Editor Tool")
        .to_string();
    Some(if completed {
        let arguments = item
            .get("arguments")
            .and_then(Value::as_str)
            .and_then(|value| serde_json::from_str(value).ok())
            .unwrap_or_else(|| json!({}));
        ProviderStreamEvent::ToolCompleted {
            call_id,
            name,
            arguments,
        }
    } else {
        ProviderStreamEvent::ToolStarted { call_id, name }
    })
}

fn parse_chat_event(data: &str) -> Result<Option<ProviderStreamEvent>, String> {
    let value: Value = serde_json::from_str(data).map_err(|error| error.to_string())?;
    if value.get("error").is_some() {
        return Ok(Some(ProviderStreamEvent::Error(provider_error_message(
            &value,
        ))));
    }
    let choice = value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|v| v.first());
    let Some(choice) = choice else {
        return Ok(None);
    };
    if let Some(text) = choice
        .get("delta")
        .and_then(|delta| delta.get("content"))
        .and_then(Value::as_str)
    {
        return Ok(Some(ProviderStreamEvent::TextDelta(text.to_string())));
    }
    let tool = choice
        .get("delta")
        .and_then(|delta| delta.get("tool_calls"))
        .and_then(Value::as_array)
        .and_then(|calls| calls.first());
    if let Some(tool) = tool {
        let call_id = tool
            .get("id")
            .and_then(Value::as_str)
            .filter(|value| valid_tool_call_id(value))
            .map(str::to_string);
        let index = tool.get("index").and_then(Value::as_u64).unwrap_or(0);
        let name = tool
            .get("function")
            .and_then(|function| function.get("name"))
            .and_then(Value::as_str)
            .unwrap_or("Editor Tool")
            .to_string();
        let arguments = tool
            .get("function")
            .and_then(|function| function.get("arguments"))
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        return Ok(Some(ProviderStreamEvent::ToolArgumentsDelta {
            call_id,
            index,
            name,
            arguments,
        }));
    }
    Ok(None)
}

fn valid_tool_call_id(value: &str) -> bool {
    let value = value.trim();
    !value.is_empty()
        && !matches!(value.to_ascii_lowercase().as_str(), "undefined" | "null")
        && !value.contains(['\n', '\r', '\0'])
}

fn next_sse_frame(buffer: &[u8]) -> Option<(usize, usize)> {
    let lf = buffer
        .windows(2)
        .position(|window| window == b"\n\n")
        .map(|i| (i, 2));
    let crlf = buffer
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|i| (i, 4));
    match (lf, crlf) {
        (Some(left), Some(right)) => Some(if left.0 <= right.0 { left } else { right }),
        (Some(value), None) | (None, Some(value)) => Some(value),
        (None, None) => None,
    }
}

fn sse_data(frame: &str) -> Option<String> {
    let data = frame
        .lines()
        .filter_map(|line| line.strip_prefix("data:"))
        .map(str::trim_start)
        .collect::<Vec<_>>()
        .join("\n");
    (!data.is_empty()).then_some(data)
}

fn provider_error_message(value: &Value) -> String {
    value
        .pointer("/error/message")
        .or_else(|| value.pointer("/response/error/message"))
        .or_else(|| value.get("message"))
        .and_then(Value::as_str)
        .unwrap_or("The AI provider reported an error.")
        .to_string()
}

async fn read_bounded_body(response: reqwest::Response) -> String {
    let mut stream = response.bytes_stream();
    let mut body = Vec::new();
    while let Some(Ok(chunk)) = stream.next().await {
        let remaining = MAX_ERROR_BODY_BYTES.saturating_sub(body.len());
        if remaining == 0 {
            break;
        }
        body.extend_from_slice(&chunk[..chunk.len().min(remaining)]);
    }
    String::from_utf8_lossy(&body).to_string()
}

fn is_unsupported_responses_status(status: StatusCode, body: &str) -> bool {
    matches!(status.as_u16(), 404 | 405 | 501)
        || (status == StatusCode::BAD_REQUEST
            && contains_any(
                &body.to_ascii_lowercase(),
                &[
                    "responses endpoint",
                    "responses api",
                    "unsupported endpoint",
                ],
            ))
}

fn classify_http_failure(status: u16, endpoint: &str, body: &str) -> AgentErrorDiagnostic {
    let lower = body.to_ascii_lowercase();
    let (code, recovery, retryable) = match status {
        0 => (
            AgentErrorCode::Unknown,
            "Retry the Turn and verify the provider settings.",
            false,
        ),
        401 => (
            AgentErrorCode::AuthenticationFailed,
            "Open Settings and verify the provider credential.",
            false,
        ),
        403 => (
            AgentErrorCode::PermissionDenied,
            "Verify the credential permissions and model access.",
            false,
        ),
        408 => (
            AgentErrorCode::RequestTimeout,
            "Retry the Turn and verify the provider connection.",
            true,
        ),
        413 => (
            AgentErrorCode::ContextLimit,
            "Reduce the active document context or start a new Thread.",
            false,
        ),
        422 if lower.contains("tool") => (
            AgentErrorCode::ToolValidationFailed,
            "Verify the editor Tool schema and retry the Turn.",
            false,
        ),
        424 if lower.contains("tool") => (
            AgentErrorCode::ToolExecutionFailed,
            "Review the Tool activity and retry the Turn.",
            false,
        ),
        429 => (
            AgentErrorCode::RateLimited,
            "Wait briefly and retry the Turn.",
            true,
        ),
        500..=599 => (
            AgentErrorCode::ProviderUnavailable,
            "Retry the Turn. If the failure persists, check the provider status.",
            true,
        ),
        404 if lower.contains("model") => (
            AgentErrorCode::ModelUnavailable,
            "Open Settings and verify the configured model.",
            false,
        ),
        400 if contains_any(
            &lower,
            &["context length", "too many tokens", "maximum context"],
        ) =>
        {
            (
                AgentErrorCode::ContextLimit,
                "Reduce the active document context or start a new Thread.",
                false,
            )
        }
        400 if lower.contains("model") => (
            AgentErrorCode::ModelUnavailable,
            "Open Settings and verify the configured model.",
            false,
        ),
        _ => (
            AgentErrorCode::ProviderProtocolError,
            "Verify the provider base URL, model, and API compatibility.",
            false,
        ),
    };
    let provider_message = provider_message_from_body(body);
    let safe_endpoint = sanitize_url(endpoint);
    diagnostic(
        code,
        &format!("Provider request to {safe_endpoint} failed ({status}): {provider_message}"),
        Some(recovery),
        retryable,
    )
}

fn classify_reqwest_failure(error: &reqwest::Error) -> AgentErrorDiagnostic {
    let lower = error.to_string().to_ascii_lowercase();
    if error.is_timeout() {
        return transport_diagnostic(TransportFailureKind::Timeout);
    }
    if contains_any(&lower, &["tls", "ssl", "certificate", "handshake"]) {
        return transport_diagnostic(TransportFailureKind::Tls);
    }
    if error.is_connect() {
        return transport_diagnostic(TransportFailureKind::Network);
    }
    transport_diagnostic(TransportFailureKind::Provider)
}

fn transport_diagnostic(kind: TransportFailureKind) -> AgentErrorDiagnostic {
    match kind {
        TransportFailureKind::Timeout => diagnostic(
            AgentErrorCode::RequestTimeout,
            "The AI provider request timed out.",
            Some("Retry the Turn and verify the provider connection."),
            true,
        ),
        TransportFailureKind::Tls => diagnostic(
            AgentErrorCode::TlsFailure,
            "The secure connection to the AI provider failed.",
            Some("Verify the provider URL, certificate chain, proxy, and system clock."),
            true,
        ),
        TransportFailureKind::Network => diagnostic(
            AgentErrorCode::NetworkUnavailable,
            "IdeaNote could not connect to the AI provider.",
            Some("Check the network, proxy, and provider base URL, then retry."),
            true,
        ),
        TransportFailureKind::Provider => diagnostic(
            AgentErrorCode::ProviderUnavailable,
            "The AI provider request failed.",
            Some("Retry the Turn. If the failure persists, verify the provider settings."),
            true,
        ),
    }
}

fn provider_message_from_body(body: &str) -> String {
    let message = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|value| {
            value
                .pointer("/error/message")
                .or_else(|| value.get("message"))
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .unwrap_or_else(|| {
            let trimmed = body.trim();
            if trimmed.is_empty() {
                "The provider returned no error details.".to_string()
            } else {
                trimmed.chars().take(512).collect()
            }
        });
    redact_sensitive(&message)
}

fn sanitize_url(value: &str) -> String {
    Url::parse(value)
        .map(|mut url| {
            url.set_query(None);
            url.set_fragment(None);
            url.to_string()
        })
        .unwrap_or_else(|_| "the configured endpoint".to_string())
}

fn redact_sensitive(value: &str) -> String {
    let mut words = value
        .split_whitespace()
        .map(str::to_string)
        .collect::<Vec<_>>();
    let mut redact_next = false;
    for word in &mut words {
        let lower = word.to_ascii_lowercase();
        if redact_next
            || lower.starts_with("sk-")
            || lower.contains("api_key=")
            || lower.contains("apikey=")
        {
            *word = "[REDACTED]".to_string();
            redact_next = false;
            continue;
        }
        if lower.trim_matches(|ch: char| !ch.is_ascii_alphabetic()) == "bearer"
            || lower.starts_with("authorization:")
        {
            if lower.starts_with("authorization:") && lower.len() > "authorization:".len() {
                *word = "Authorization: [REDACTED]".to_string();
            } else {
                redact_next = true;
            }
        }
    }
    words.join(" ")
}

fn diagnostic(
    code: AgentErrorCode,
    message: &str,
    recovery: Option<&str>,
    retryable: bool,
) -> AgentErrorDiagnostic {
    AgentErrorDiagnostic {
        code,
        message: redact_sensitive(message),
        recovery: recovery.map(str::to_string),
        diagnostic_id: Uuid::new_v4().to_string(),
        retryable,
    }
}

fn runtime_diagnostic(message: String) -> AgentErrorDiagnostic {
    diagnostic(
        AgentErrorCode::RuntimeUnavailable,
        &message,
        Some("Restart the Agent and retry the Turn."),
        false,
    )
}

fn runtime_attempt_failure(message: &str) -> AttemptFailure {
    AttemptFailure {
        diagnostic: runtime_diagnostic(message.to_string()),
        unsupported: false,
        visible_progress: true,
    }
}

fn cancelled_attempt_failure() -> AttemptFailure {
    AttemptFailure {
        diagnostic: cancelled_diagnostic(),
        unsupported: false,
        visible_progress: true,
    }
}

fn cancelled_failure() -> ProviderFailure {
    ProviderFailure {
        diagnostic: cancelled_diagnostic(),
    }
}

fn cancelled_diagnostic() -> AgentErrorDiagnostic {
    diagnostic(
        AgentErrorCode::Cancelled,
        "Agent run cancelled.",
        None,
        false,
    )
}

async fn wait_for_retry(
    delay_ms: u64,
    cancelled: &mut watch::Receiver<bool>,
) -> Result<(), ProviderFailure> {
    tokio::select! {
        _ = tokio::time::sleep(Duration::from_millis(delay_ms)) => Ok(()),
        changed = cancelled.changed() => {
            if changed.is_ok() && *cancelled.borrow() {
                Err(cancelled_failure())
            } else {
                Err(ProviderFailure { diagnostic: runtime_diagnostic("Agent cancellation state closed unexpectedly".to_string()) })
            }
        }
    }
}

fn retry_delay_ms(attempt: u8) -> u64 {
    250_u64.saturating_mul(1_u64 << attempt.saturating_sub(1))
}

fn effective_max_attempts(policy: AgentRetryPolicy) -> u8 {
    if policy.enabled {
        policy.max_attempts.clamp(1, 5)
    } else {
        1
    }
}

fn elapsed_ms(started: std::time::Instant) -> u64 {
    started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64
}

fn classify_streaming_behavior(
    first_event_ms: u64,
    event_span_ms: u64,
    event_count: u32,
) -> StreamingBehavior {
    if event_count < 2 {
        StreamingBehavior::Indeterminate
    } else if event_span_ms >= 75 {
        StreamingBehavior::Incremental
    } else if first_event_ms >= 150 && event_span_ms <= 50 {
        StreamingBehavior::Buffered
    } else {
        StreamingBehavior::Indeterminate
    }
}

fn contains_any(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| value.contains(needle))
}

#[cfg(test)]
mod contract_tests {
    use super::*;

    #[test]
    fn responses_events_are_typed_and_raw_reasoning_is_ignored() {
        assert_eq!(
            parse_responses_event(r#"{"type":"response.output_text.delta","delta":"Hello"}"#,)
                .expect("text event should parse"),
            Some(ProviderStreamEvent::TextDelta("Hello".to_string()))
        );
        assert_eq!(
            parse_responses_event(
                r#"{"type":"response.reasoning_summary_text.delta","delta":"Checked the document"}"#,
            )
            .expect("summary event should parse"),
            Some(ProviderStreamEvent::PublicActivityDelta(
                "Checked the document".to_string(),
            ))
        );
        assert_eq!(
            parse_responses_event(
                r#"{"type":"response.reasoning_text.delta","delta":"private chain of thought"}"#,
            )
            .expect("raw reasoning event should be safely ignored"),
            None
        );
    }

    #[test]
    fn response_tool_events_normalize_missing_or_invalid_call_ids() {
        let started = parse_responses_event(
            r#"{"type":"response.output_item.added","output_index":2,"item":{"type":"function_call","call_id":"undefined","id":"item-2","name":"read_active_page"}}"#,
        )
        .unwrap()
        .unwrap();
        let completed = parse_responses_event(
            r#"{"type":"response.output_item.done","output_index":2,"item":{"type":"function_call","call_id":"undefined","id":"item-2","name":"read_active_page","arguments":"{}"}}"#,
        )
        .unwrap()
        .unwrap();
        assert!(
            matches!(started, ProviderStreamEvent::ToolStarted { call_id, .. } if call_id == "item-2")
        );
        assert!(
            matches!(completed, ProviderStreamEvent::ToolCompleted { call_id, .. } if call_id == "item-2")
        );
    }

    #[test]
    fn endpoint_suffix_preserves_gateway_query_parameters() {
        let base = Url::parse("https://gateway.example/v1?api-version=2026-08-08")
            .expect("base URL should parse");
        let endpoint = endpoint_url(&base, AgentProviderStrategy::Responses);
        assert_eq!(endpoint.path(), "/v1/responses");
        assert_eq!(endpoint.query(), Some("api-version=2026-08-08"));
    }

    #[test]
    fn responses_request_uses_only_portable_openai_compatible_fields() {
        let body = request_body(
            &ProviderRequest {
                base_url: "https://gateway.example/v1".to_string(),
                model: "gpt-test".to_string(),
                preamble: "Use the editor tools.".to_string(),
                prompt: "Add a Page.".to_string(),
                messages: Vec::new(),
                tools: Vec::new(),
                strategy: AgentProviderStrategy::Responses,
                retry: AgentRetryPolicy::default(),
            },
            AgentProviderStrategy::Responses,
        );

        assert_eq!(body["model"], "gpt-test");
        assert!(body.get("metadata").is_none());
        assert!(body["tools"].is_array());
    }

    #[test]
    fn diagnostics_classify_and_redact_sensitive_provider_failures() {
        let diagnostic = classify_http_failure(
            429,
            "https://gateway.example/v1/responses?api_key=secret-value",
            r#"{"error":{"message":"Authorization: Bearer sk-sensitive is rate limited"}}"#,
        );
        assert_eq!(diagnostic.code, AgentErrorCode::RateLimited);
        assert!(diagnostic.retryable);
        let serialized = serde_json::to_string(&diagnostic).expect("diagnostic should encode");
        assert!(!serialized.contains("secret-value"));
        assert!(!serialized.contains("sk-sensitive"));
        assert!(serialized.contains("[REDACTED]"));
    }

    #[test]
    fn http_failures_map_to_actionable_error_categories() {
        let cases = [
            (
                401,
                "invalid key",
                AgentErrorCode::AuthenticationFailed,
                false,
            ),
            (403, "forbidden", AgentErrorCode::PermissionDenied, false),
            (408, "timeout", AgentErrorCode::RequestTimeout, true),
            (413, "too large", AgentErrorCode::ContextLimit, false),
            (429, "slow down", AgentErrorCode::RateLimited, true),
            (
                500,
                "upstream unavailable",
                AgentErrorCode::ProviderUnavailable,
                true,
            ),
            (
                404,
                "model not found",
                AgentErrorCode::ModelUnavailable,
                false,
            ),
            (
                400,
                "maximum context length",
                AgentErrorCode::ContextLimit,
                false,
            ),
            (
                422,
                "tool schema invalid",
                AgentErrorCode::ToolValidationFailed,
                false,
            ),
            (
                424,
                "tool execution failed",
                AgentErrorCode::ToolExecutionFailed,
                false,
            ),
        ];
        for (status, body, code, retryable) in cases {
            let diagnostic = classify_http_failure(status, "https://example.test/v1", body);
            assert_eq!(diagnostic.code, code, "status {status}");
            assert_eq!(diagnostic.retryable, retryable, "status {status}");
            assert!(diagnostic.recovery.is_some(), "status {status}");
            assert!(!diagnostic.diagnostic_id.is_empty(), "status {status}");
        }
    }

    #[test]
    fn transport_failures_distinguish_timeout_tls_network_and_provider_errors() {
        let cases = [
            (
                TransportFailureKind::Timeout,
                AgentErrorCode::RequestTimeout,
            ),
            (TransportFailureKind::Tls, AgentErrorCode::TlsFailure),
            (
                TransportFailureKind::Network,
                AgentErrorCode::NetworkUnavailable,
            ),
            (
                TransportFailureKind::Provider,
                AgentErrorCode::ProviderUnavailable,
            ),
        ];
        for (kind, code) in cases {
            let diagnostic = transport_diagnostic(kind);
            assert_eq!(diagnostic.code, code);
            assert!(diagnostic.retryable);
            assert!(diagnostic.recovery.is_some());
        }
        assert_eq!(effective_max_attempts(AgentRetryPolicy::default()), 3);
        assert_eq!(
            effective_max_attempts(AgentRetryPolicy {
                enabled: false,
                max_attempts: 5,
            }),
            1
        );
        assert_eq!(
            effective_max_attempts(AgentRetryPolicy {
                enabled: true,
                max_attempts: 0,
            }),
            1
        );
        assert_eq!(
            effective_max_attempts(AgentRetryPolicy {
                enabled: true,
                max_attempts: 9,
            }),
            5
        );
    }

    #[test]
    fn streaming_timing_distinguishes_incremental_and_buffered_delivery() {
        assert_eq!(
            classify_streaming_behavior(180, 620, 3),
            StreamingBehavior::Incremental
        );
        assert_eq!(
            classify_streaming_behavior(520, 12, 8),
            StreamingBehavior::Buffered
        );
        assert_eq!(
            classify_streaming_behavior(20, 0, 1),
            StreamingBehavior::Indeterminate
        );
    }
}
