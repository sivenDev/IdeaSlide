mod adapters;
mod provider;
mod repository;
mod runtime;
mod session;
mod skills;
mod tool_broker;
mod types;

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};

use crate::settings;
use repository::{AgentThreadPage, AgentThreadRecord, AgentThreadRepository};
use serde_json::{json, Value};
use session::AgentSessionState;
use tauri::{ipc::Channel, Manager};
use tool_broker::{AgentToolBroker, BrokerDecision};
use types::{
    AgentErrorCode, AgentProviderCapabilities, AgentRunEvent, AgentRunRequest, AgentRunResponse,
    AgentSkillMetadata, AgentToolCall,
};

#[tauri::command]
pub(crate) async fn list_agent_runtimes() -> Vec<adapters::RuntimeDescriptor> {
    adapters::discover_runtime_catalog().await
}

#[tauri::command]
pub(crate) fn discover_agent_skills() -> Vec<AgentSkillMetadata> {
    skills::discover_skills()
}

fn thread_repository(app_handle: &tauri::AppHandle) -> Result<AgentThreadRepository, String> {
    let root = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("Application data directory is unavailable: {error}"))?
        .join("agent");
    Ok(AgentThreadRepository::new(root))
}

#[tauri::command]
pub(crate) fn save_agent_thread(
    record: AgentThreadRecord,
    app_handle: tauri::AppHandle,
) -> Result<AgentThreadRecord, String> {
    thread_repository(&app_handle)?.save(record)
}

#[tauri::command]
pub(crate) fn get_agent_thread(
    thread_id: String,
    app_handle: tauri::AppHandle,
) -> Result<Option<AgentThreadRecord>, String> {
    thread_repository(&app_handle)?.load(&thread_id)
}

#[tauri::command]
pub(crate) fn list_agent_threads(
    cursor: Option<String>,
    limit: Option<usize>,
    include_archived: bool,
    app_handle: tauri::AppHandle,
) -> Result<AgentThreadPage, String> {
    thread_repository(&app_handle)?.list(cursor, limit, include_archived)
}

#[tauri::command]
pub(crate) fn rename_agent_thread(
    thread_id: String,
    title: String,
    app_handle: tauri::AppHandle,
) -> Result<AgentThreadRecord, String> {
    thread_repository(&app_handle)?.rename(&thread_id, &title)
}

#[tauri::command]
pub(crate) fn archive_agent_thread(
    thread_id: String,
    app_handle: tauri::AppHandle,
) -> Result<AgentThreadRecord, String> {
    thread_repository(&app_handle)?.archive(&thread_id)
}

#[tauri::command]
pub(crate) fn delete_agent_thread(
    thread_id: String,
    app_handle: tauri::AppHandle,
) -> Result<bool, String> {
    thread_repository(&app_handle)?.delete(&thread_id)
}

struct NativeTurnEmitter {
    channel: Channel<AgentRunEvent>,
    thread_id: String,
    turn_id: String,
    sequence: u64,
    assistant_item_id: String,
    assistant_added: bool,
    activity_added: bool,
    activity_content: String,
    tool_items: HashMap<String, String>,
    runtime_progressed: bool,
    terminal: bool,
}

impl NativeTurnEmitter {
    fn new(channel: Channel<AgentRunEvent>, thread_id: String, turn_id: String) -> Self {
        let assistant_item_id = format!("{turn_id}:assistant");
        Self {
            channel,
            thread_id,
            turn_id,
            sequence: 0,
            assistant_item_id,
            assistant_added: false,
            activity_added: false,
            activity_content: String::new(),
            tool_items: HashMap::new(),
            runtime_progressed: false,
            terminal: false,
        }
    }

    fn send(&mut self, event_type: &str, payload: Value) -> Result<(), String> {
        let mut event = payload
            .as_object()
            .cloned()
            .ok_or_else(|| "Agent event payload must be an object".to_string())?;
        let now = now_millis();
        event.insert("type".to_string(), Value::String(event_type.to_string()));
        event.insert(
            "eventId".to_string(),
            Value::String(format!("{}:{}:{event_type}", self.turn_id, self.sequence)),
        );
        event.insert(
            "threadId".to_string(),
            Value::String(self.thread_id.clone()),
        );
        event.insert("turnId".to_string(), Value::String(self.turn_id.clone()));
        event.insert("sequence".to_string(), Value::from(self.sequence));
        event.insert("at".to_string(), Value::from(now));
        self.sequence = self.sequence.saturating_add(1);
        self.channel
            .send(AgentRunEvent::Event {
                event: Value::Object(event),
            })
            .map_err(|error| format!("Agent event could not be delivered: {error}"))
    }

    fn ensure_assistant(&mut self) -> Result<(), String> {
        if self.assistant_added {
            return Ok(());
        }
        self.assistant_added = true;
        self.send(
            "itemAdded",
            json!({
                "item": {
                    "id": self.assistant_item_id,
                    "kind": "message",
                    "role": "assistant",
                    "content": "",
                    "status": "running",
                    "createdAt": now_millis(),
                }
            }),
        )
    }

    fn send_terminal(&mut self, event_type: &str, payload: Value) -> Result<bool, String> {
        if self.terminal {
            return Ok(false);
        }
        self.terminal = true;
        self.send(event_type, payload)?;
        Ok(true)
    }
}

fn can_fallback_after_codex_failure(runtime_progressed: bool) -> bool {
    !runtime_progressed
}

fn normalized_capabilities(capabilities: &AgentProviderCapabilities) -> Value {
    json!({
        "textStreaming": capabilities.text_streaming,
        "reasoningSummary": capabilities.reasoning_summary,
        "plans": false,
        "toolEvents": capabilities.tool_events,
        "approvals": false,
        "cancellation": capabilities.cancellation,
        "steering": false,
        "retry": capabilities.retry,
        "persistence": true,
    })
}

fn tool_failure(call: &AgentToolCall, message: impl Into<String>) -> Value {
    let message = message.into();
    json!({
        "kind": "failure",
        "callId": call.call_id,
        "name": call.name,
        "success": false,
        "summary": message,
        "error": {
            "code": "toolExecutionFailed",
            "message": message,
            "recovery": "Retry the Tool or refresh the editor context.",
            "diagnosticId": uuid::Uuid::new_v4().to_string(),
            "retryable": true,
        },
        "truncated": false,
        "persistable": true,
    })
}

fn tool_output(result: &Value) -> Value {
    match result.get("kind").and_then(Value::as_str) {
        Some("read") => result.get("content").cloned().unwrap_or(Value::Null),
        Some("proposal") => json!({
            "changeSetId": result.pointer("/changeSet/id").cloned().unwrap_or(Value::Null),
            "summary": result.pointer("/changeSet/summary").cloned().unwrap_or(Value::Null),
        }),
        _ => json!({
            "error": result.pointer("/error/message").cloned().unwrap_or(Value::Null),
        }),
    }
}

async fn execute_editor_tool(
    state: &AgentSessionState,
    emitter: &Arc<Mutex<NativeTurnEmitter>>,
    broker: &mut AgentToolBroker,
    call: &AgentToolCall,
    cancellation: tokio::sync::watch::Receiver<bool>,
) -> Result<Value, String> {
    match broker.begin(call) {
        Ok(BrokerDecision::Cached(result)) => Ok(result),
        Ok(BrokerDecision::Execute) => {
            let (run_id, channel) = match emitter.lock() {
                Ok(turn) => (turn.turn_id.clone(), turn.channel.clone()),
                Err(_) => return Ok(tool_failure(call, "Agent Turn event state is unavailable")),
            };
            match receive_tool_result(state, &run_id, channel, call, cancellation).await {
                Ok(result) => Ok(broker
                    .complete(call, result)
                    .unwrap_or_else(|message| tool_failure(call, message))),
                Err(message) if message.to_ascii_lowercase().contains("cancel") => Err(message),
                Err(message) => Ok(tool_failure(call, message)),
            }
        }
        Err(message) => Ok(tool_failure(call, message)),
    }
}

fn emit_public_activity_delta(turn: &mut NativeTurnEmitter, delta: String) -> Result<(), String> {
    let item_id = format!("{}:public-activity", turn.turn_id);
    turn.activity_content.push_str(&delta);
    if !turn.activity_added {
        turn.activity_added = true;
        turn.send(
            "itemAdded",
            json!({"item": {
                "id": item_id,
                "kind": "activity",
                "content": "",
                "status": "running",
                "createdAt": now_millis(),
            }}),
        )?;
    }
    turn.send("itemDelta", json!({"itemId": item_id, "text": delta}))
}

fn emit_tool_result(
    turn: &mut NativeTurnEmitter,
    call: &AgentToolCall,
    result: &Value,
) -> Result<(), String> {
    let kind = result
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or("failure");
    let summary = result
        .get("summary")
        .and_then(Value::as_str)
        .unwrap_or("Editor Tool completed");
    let success = result
        .get("success")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let item_id = turn
        .tool_items
        .get(&call.call_id)
        .cloned()
        .unwrap_or_else(|| format!("{}:tool:{}", turn.turn_id, call.call_id));
    turn.send(
        "itemUpdated",
        json!({"item": {
            "id": item_id,
            "kind": "tool",
            "name": call.name,
            "callId": call.call_id,
            "summary": summary,
            "input": call.arguments,
            "output": tool_output(result),
            "status": if success { "completed" } else { "failed" },
            "createdAt": now_millis(),
        }}),
    )?;
    if kind == "proposal" {
        if let Some(change_set) = result.get("changeSet") {
            let review_id = format!("{}:change-review:{}", turn.turn_id, call.call_id);
            turn.send(
                "itemAdded",
                json!({"item": {
                    "id": review_id,
                    "kind": "changeReview",
                    "changeSet": change_set,
                    "status": "pending",
                    "createdAt": now_millis(),
                }}),
            )?;
        }
    } else if kind == "failure" {
        let error_id = format!("{}:tool-error:{}", turn.turn_id, call.call_id);
        turn.send(
            "itemAdded",
            json!({"item": {
                "id": error_id,
                "kind": "error",
                "error": result.get("error").cloned().unwrap_or_else(|| json!({
                    "code": "toolExecutionFailed", "message": summary,
                    "retryable": true,
                })),
                "status": "failed",
                "createdAt": now_millis(),
            }}),
        )?;
    }
    Ok(())
}

fn finalize_turn(
    emitter: &Arc<Mutex<NativeTurnEmitter>>,
    response_text: &str,
) -> Result<(u64, String), String> {
    let mut turn = emitter
        .lock()
        .map_err(|_| "Agent Turn event state is unavailable")?;
    if turn.activity_added {
        let content = turn.activity_content.clone();
        let activity_id = format!("{}:public-activity", turn.turn_id);
        turn.send(
            "itemUpdated",
            json!({"item": {
                "id": activity_id,
                "kind": "activity",
                "content": content,
                "status": "completed",
                "createdAt": now_millis(),
            }}),
        )?;
    }
    let assistant_item_id = turn.assistant_item_id.clone();
    turn.send_terminal(
        "turnCompleted",
        json!({"assistantItemId": assistant_item_id, "finalText": response_text}),
    )?;
    Ok((turn.sequence, turn.assistant_item_id.clone()))
}

async fn receive_tool_result(
    state: &AgentSessionState,
    run_id: &str,
    channel: Channel<AgentRunEvent>,
    call: &AgentToolCall,
    mut cancelled: tokio::sync::watch::Receiver<bool>,
) -> Result<Value, String> {
    if *cancelled.borrow() {
        return Err("Editor Tool call was cancelled.".to_string());
    }
    let receiver = state.await_tool_result(run_id, &call.call_id)?;
    channel
        .send(AgentRunEvent::ToolExecutionRequested {
            run_id: run_id.to_string(),
            call: call.clone(),
        })
        .map_err(|error| format!("Agent Tool request could not be delivered: {error}"))?;
    tokio::select! {
        biased;
        changed = cancelled.changed() => {
            if changed.is_ok() && *cancelled.borrow() {
                Err("Editor Tool call was cancelled.".to_string())
            } else {
                Err("Agent cancellation state closed unexpectedly".to_string())
            }
        }
        result = tokio::time::timeout(Duration::from_secs(30), receiver) => {
            match result {
                Ok(Ok(value)) => Ok(value),
                Ok(Err(_)) => Err("Editor Tool result channel closed.".to_string()),
                Err(_) => Err("Editor Tool call timed out.".to_string()),
            }
        }
    }
}

async fn run_codex_driver(
    mut driver: adapters::CodexTurnDriver,
    state: &AgentSessionState,
    emitter: &Arc<Mutex<NativeTurnEmitter>>,
    tools: &[types::AgentToolDescriptor],
    model: &str,
    mut cancellation: tokio::sync::watch::Receiver<bool>,
) -> Result<(String, AgentProviderCapabilities), String> {
    let capabilities = driver.capabilities();
    let upstream_thread_id = driver.conversation_id().to_string();
    {
        let mut turn = emitter
            .lock()
            .map_err(|_| "Agent Turn event state is unavailable")?;
        let runtime_item_id = format!("{}:runtime", turn.turn_id);
        turn.send(
            "runtimeUpdated",
            json!({"runtime": {
                "kind": "codexAppServer",
                "label": "Codex",
                "model": model,
                "upstreamThreadId": upstream_thread_id,
                "diagnostic": format!("Pinned Codex {} selected automatically.", adapters::PINNED_CODEX_VERSION),
                "degraded": false,
            }}),
        )?;
        turn.send(
            "capabilitiesUpdated",
            json!({"capabilities": {
                "textStreaming": capabilities.text_streaming,
                "reasoningSummary": capabilities.reasoning_summary,
                "plans": capabilities.plans,
                "toolEvents": capabilities.tool_events,
                "approvals": capabilities.approvals,
                "cancellation": capabilities.cancellation,
                "steering": capabilities.steering,
                "retry": capabilities.retry,
                "persistence": capabilities.persistence,
            }}),
        )?;
        turn.send(
            "itemAdded",
            json!({"item": {
                "id": runtime_item_id,
                "kind": "lifecycle",
                "label": "Using Codex app-server",
                "status": "completed",
                "createdAt": now_millis(),
            }}),
        )?;
    }
    let mut broker = AgentToolBroker::new(tools)?;
    let mut text = String::new();
    loop {
        let event = tokio::select! {
            changed = cancellation.changed() => {
                if changed.is_ok() && *cancellation.borrow() {
                    let _ = driver.cancel().await;
                    return Err("Agent run cancelled".to_string());
                }
                return Err("Agent cancellation state closed unexpectedly".to_string());
            }
            event = driver.next_event() => event.map_err(|error| error.message)?,
        };
        match event {
            adapters::RuntimeDriverEvent::ToolRequest { request_id, call } => {
                {
                    let mut turn = emitter
                        .lock()
                        .map_err(|_| "Agent Turn event state is unavailable")?;
                    turn.runtime_progressed = true;
                    if !turn.tool_items.contains_key(&call.call_id) {
                        let item_id = format!("{}:tool:{}", turn.turn_id, call.call_id);
                        turn.tool_items
                            .insert(call.call_id.clone(), item_id.clone());
                        turn.send(
                            "itemAdded",
                            json!({"item": {
                                "id": item_id,
                                "kind": "tool",
                                "name": call.name,
                                "callId": call.call_id,
                                "summary": "Running editor Tool",
                                "input": call.arguments,
                                "status": "running",
                                "createdAt": now_millis(),
                            }}),
                        )?;
                    }
                }
                let result =
                    execute_editor_tool(state, emitter, &mut broker, &call, cancellation.clone())
                        .await?;
                let success = result
                    .get("success")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                driver
                    .tool_result(&request_id, result.clone(), success)
                    .await
                    .map_err(|error| error.message)?;
                let mut turn = emitter
                    .lock()
                    .map_err(|_| "Agent Turn event state is unavailable")?;
                emit_tool_result(&mut turn, &call, &result)?;
            }
            adapters::RuntimeDriverEvent::Event(event) => match event {
                adapters::RuntimeEvent::TextDelta(delta) => {
                    text.push_str(&delta);
                    let mut turn = emitter
                        .lock()
                        .map_err(|_| "Agent Turn event state is unavailable")?;
                    turn.runtime_progressed = true;
                    turn.ensure_assistant()?;
                    let item_id = turn.assistant_item_id.clone();
                    turn.send("itemDelta", json!({"itemId": item_id, "text": delta}))?;
                }
                adapters::RuntimeEvent::PublicActivityDelta(delta) => {
                    let mut turn = emitter
                        .lock()
                        .map_err(|_| "Agent Turn event state is unavailable")?;
                    turn.runtime_progressed = true;
                    emit_public_activity_delta(&mut turn, delta)?;
                }
                adapters::RuntimeEvent::PlanUpdated { title, steps } => {
                    let mut turn = emitter
                        .lock()
                        .map_err(|_| "Agent Turn event state is unavailable")?;
                    turn.runtime_progressed = true;
                    let turn_id = turn.turn_id.clone();
                    let steps = steps
                        .into_iter()
                        .enumerate()
                        .map(|(index, label)| {
                            json!({
                                "id": format!("{turn_id}:plan:{index}"),
                                "label": label,
                                "status": "pending",
                            })
                        })
                        .collect::<Vec<_>>();
                    turn.send(
                        "planUpdated",
                        json!({"item": {
                            "id": format!("{turn_id}:plan"),
                            "kind": "plan",
                            "title": title,
                            "steps": steps,
                            "status": "running",
                            "createdAt": now_millis(),
                        }}),
                    )?;
                }
                adapters::RuntimeEvent::ApprovalRequested {
                    title, description, ..
                } => {
                    let mut turn = emitter
                        .lock()
                        .map_err(|_| "Agent Turn event state is unavailable")?;
                    turn.runtime_progressed = true;
                    let item_id = format!("{}:approval-declined", turn.turn_id);
                    turn.send(
                        "itemAdded",
                        json!({"item": {
                            "id": item_id,
                            "kind": "lifecycle",
                            "label": format!("{title} was declined: {description}"),
                            "status": "completed",
                            "createdAt": now_millis(),
                        }}),
                    )?;
                }
                adapters::RuntimeEvent::TurnCompleted => break,
                adapters::RuntimeEvent::TurnCancelled => {
                    return Err("Agent run cancelled".to_string());
                }
                adapters::RuntimeEvent::RuntimeError(message) => return Err(message),
                adapters::RuntimeEvent::ToolStarted { .. }
                | adapters::RuntimeEvent::ToolCompleted { .. } => {}
            },
        }
    }
    let _ = driver.shutdown().await;
    Ok((
        text,
        AgentProviderCapabilities {
            strategy: types::AgentProviderStrategy::Responses,
            text_streaming: capabilities.text_streaming,
            reasoning_summary: capabilities.reasoning_summary,
            tool_events: capabilities.tool_events,
            cancellation: capabilities.cancellation,
            retry: capabilities.retry,
            timing: false,
        },
    ))
}

struct ActiveRunGuard<'a> {
    state: &'a AgentSessionState,
    run_id: &'a str,
}

struct TerminalTurnGuard {
    emitter: Arc<Mutex<NativeTurnEmitter>>,
}

impl Drop for TerminalTurnGuard {
    fn drop(&mut self) {
        if let Ok(mut turn) = self.emitter.lock() {
            let assistant_item_id = turn.assistant_item_id.clone();
            let _ = turn.send_terminal(
                "turnFailed",
                json!({
                    "assistantItemId": assistant_item_id,
                    "error": {
                        "code": "runtimeUnavailable",
                        "message": "Agent runtime ended before producing a terminal result.",
                        "recovery": "Retry the Turn. If the problem persists, restart the Agent.",
                        "retryable": true,
                    }
                }),
            );
        }
    }
}

impl Drop for ActiveRunGuard<'_> {
    fn drop(&mut self) {
        self.state.finish_run(self.run_id);
    }
}

#[tauri::command]
pub(crate) async fn run_agent(
    request: AgentRunRequest,
    on_event: Channel<AgentRunEvent>,
    state: tauri::State<'_, AgentSessionState>,
    app_handle: tauri::AppHandle,
) -> Result<AgentRunResponse, String> {
    let run_id = request.run_id.clone();
    let thread_id = request.thread_id.clone();
    let retry_of_turn_id = request.retry_of_turn_id.clone();
    let binding = request.binding.clone();
    let tool_definitions = request.tools.clone();
    let cancellation = state.start_run(&run_id)?;
    let _active_run = ActiveRunGuard {
        state: &state,
        run_id: &run_id,
    };
    let tool_cancellation = cancellation.clone();
    let emitter = Arc::new(Mutex::new(NativeTurnEmitter::new(
        on_event,
        thread_id.clone(),
        run_id.clone(),
    )));
    {
        let mut turn = emitter
            .lock()
            .map_err(|_| "Agent Turn event state is unavailable")?;
        let assistant_item_id = turn.assistant_item_id.clone();
        turn.send(
            "turnStarted",
            json!({
                "prompt": request.prompt.clone(),
                "retryOfTurnId": retry_of_turn_id,
                "binding": binding,
                "userItemId": format!("{run_id}:user"),
                "assistantItemId": assistant_item_id,
            }),
        )?;
        turn.send(
            "itemAdded",
            json!({
                "item": {
                    "id": format!("{run_id}:skill"),
                    "kind": "tool",
                    "name": format!("{} Skill", request.skill_id.clone().unwrap_or_else(|| "Editor".to_string())),
                    "summary": format!("{} editor Tools available", tool_definitions.len()),
                    "status": "completed",
                    "createdAt": now_millis(),
                }
            }),
        )?;
        turn.send(
            "itemUpdated",
            json!({
                "item": {
                    "id": format!("{run_id}:activity"),
                    "kind": "lifecycle",
                    "label": "Working",
                    "status": "running",
                    "createdAt": now_millis(),
                }
            }),
        )?;
    }
    let _terminal_turn = TerminalTurnGuard {
        emitter: emitter.clone(),
    };
    let skill_id = request.skill_id.clone();
    let runtime_catalog = adapters::discover_runtime_catalog().await;
    let codex_runtime = runtime_catalog
        .iter()
        .find(|runtime| runtime.kind == adapters::RuntimeKind::CodexAppServer);
    let codex_available = codex_runtime.is_some_and(|runtime| {
        runtime.kind == adapters::RuntimeKind::CodexAppServer
            && runtime.installed
            && runtime.compatible
            && runtime.capabilities.editor_tools
    });
    let mut compatibility_reason = codex_runtime
        .and_then(|runtime| runtime.diagnostic.clone())
        .unwrap_or_else(|| "Codex did not pass the runtime safety gate.".to_string());
    if codex_available {
        let runtime_root = app_handle
            .path()
            .app_data_dir()
            .map_err(|error| format!("Application data directory is unavailable: {error}"))?
            .join("agent")
            .join("runtime");
        std::fs::create_dir_all(&runtime_root)
            .map_err(|error| format!("Agent runtime directory could not be created: {error}"))?;
        let preamble =
            runtime::prompt_with_context(&request).map_err(|failure| failure.diagnostic.message)?;
        let rich_input = adapters::RuntimeTurnInput {
            conversation_id: request.upstream_thread_id.clone(),
            prompt: format!("{preamble}\n\nUSER REQUEST:\n{}", request.prompt),
            model: request.model.clone(),
            cwd: runtime_root,
            tools: tool_definitions.clone(),
        };
        match adapters::CodexTurnDriver::start(&rich_input).await {
            Ok(driver) => {
                match run_codex_driver(
                    driver,
                    &state,
                    &emitter,
                    &tool_definitions,
                    &request.model,
                    tool_cancellation.clone(),
                )
                .await
                {
                    Ok((text, capabilities)) => {
                        let response_text = if text.trim().is_empty() {
                            "I completed the requested editor Tool activity.".to_string()
                        } else {
                            text
                        };
                        let (next_sequence, assistant_item_id) =
                            finalize_turn(&emitter, &response_text)?;
                        let response = AgentRunResponse {
                            run_id: run_id.clone(),
                            text: response_text,
                            next_sequence,
                            assistant_item_id,
                            skill_id,
                            capabilities,
                            telemetry: types::AgentStreamingTelemetry {
                                strategy: types::AgentProviderStrategy::Responses,
                                attempts: 1,
                                request_ms: 0,
                                first_event_ms: None,
                                first_text_ms: None,
                                event_span_ms: 0,
                                total_ms: 0,
                                event_count: 0,
                                behavior: types::StreamingBehavior::Indeterminate,
                            },
                            tool_calls: Vec::new(),
                        };
                        return Ok(response);
                    }
                    Err(message) => {
                        if message.to_ascii_lowercase().contains("cancel") {
                            if let Ok(mut turn) = emitter.lock() {
                                let _ = turn.send_terminal(
                                    "turnCancelled",
                                    json!({"label": "Agent run cancelled"}),
                                );
                            }
                            return Err(message);
                        }
                        let safe_to_fallback = can_fallback_after_codex_failure(
                            emitter
                                .lock()
                                .map_err(|_| "Agent Turn event state is unavailable")?
                                .runtime_progressed,
                        );
                        if safe_to_fallback {
                            compatibility_reason =
                                format!("Codex stopped before producing output: {message}");
                            let mut turn = emitter
                                .lock()
                                .map_err(|_| "Agent Turn event state is unavailable")?;
                            let item_id = format!("{}:codex-runtime-fallback", turn.turn_id);
                            turn.send("itemAdded", json!({"item": {
                                "id": item_id,
                                "kind": "lifecycle",
                                "label": "Codex stopped before producing output; using Compatibility.",
                                "status": "completed",
                                "createdAt": now_millis(),
                            }}))?;
                        } else {
                            if let Ok(mut turn) = emitter.lock() {
                                let assistant_item_id = turn.assistant_item_id.clone();
                                let _ = turn.send_terminal("turnFailed", json!({
                                    "assistantItemId": assistant_item_id,
                                    "error": {
                                        "code": "runtimeUnavailable",
                                        "message": message,
                                        "recovery": "Retry the Turn. Automatic fallback is disabled after visible Codex progress or Tool activity.",
                                        "retryable": true,
                                    }
                                }));
                            }
                            return Err(message);
                        }
                    }
                }
            }
            Err(error) => {
                compatibility_reason = format!("Codex initialization failed: {}", error.message);
                let mut turn = emitter
                    .lock()
                    .map_err(|_| "Agent Turn event state is unavailable")?;
                let item_id = format!("{}:codex-fallback", turn.turn_id);
                turn.send("itemAdded", json!({"item": {
                    "id": item_id,
                    "kind": "lifecycle",
                    "label": format!("Codex could not initialize; using Compatibility. {}", error.message),
                    "status": "completed",
                    "createdAt": now_millis(),
                }}))?;
            }
        }
    }
    {
        let mut turn = emitter
            .lock()
            .map_err(|_| "Agent Turn event state is unavailable")?;
        turn.send(
            "runtimeUpdated",
            json!({"runtime": {
                "kind": "compatibility",
                "label": "Compatibility",
                "model": request.model.clone(),
                "diagnostic": compatibility_reason,
                "degraded": true,
            }}),
        )?;
    }
    let api_key = settings::read_provider_api_key(&app_handle)?
        .ok_or_else(|| "AI provider configuration is required".to_string())?;
    let progress_emitter = emitter.clone();
    let result = runtime::complete(request, api_key, cancellation, move |progress| {
        let mut turn = progress_emitter
            .lock()
            .map_err(|_| "Agent Turn event state is unavailable".to_string())?;
        match progress {
            provider::ProviderProgress::Capabilities(capabilities) => turn.send(
                "capabilitiesUpdated",
                json!({"capabilities": normalized_capabilities(&capabilities)}),
            ),
            provider::ProviderProgress::StrategyFallback { from, to, reason } => {
                let item_id = format!("{}:fallback", turn.turn_id);
                turn.send("itemAdded", json!({"item": {
                    "id": item_id,
                    "kind": "lifecycle",
                    "label": format!("{reason} ({from:?} → {to:?})"),
                    "status": "completed",
                    "createdAt": now_millis(),
                }}))
            }
            provider::ProviderProgress::RetryScheduled {
                attempt,
                delay_ms,
                diagnostic: _,
            } => {
                let item_id = format!("{}:retry:{attempt}", turn.turn_id);
                turn.send("itemAdded", json!({"item": {
                    "id": item_id,
                    "kind": "lifecycle",
                    "label": format!("Retrying provider request (attempt {attempt}) in {delay_ms} ms"),
                    "status": "completed",
                    "createdAt": now_millis(),
                }}))
            }
            provider::ProviderProgress::PublicActivityDelta(text) => {
                emit_public_activity_delta(&mut turn, text)
            }
            provider::ProviderProgress::TextDelta(text) => {
                turn.ensure_assistant()?;
                let item_id = turn.assistant_item_id.clone();
                turn.send("itemDelta", json!({"itemId": item_id, "text": text}))
            }
            provider::ProviderProgress::ToolStarted { call_id, name } => {
                if turn.tool_items.contains_key(&call_id) {
                    return Ok(());
                }
                let item_id = format!("{}:tool:{call_id}", turn.turn_id);
                turn.tool_items.insert(call_id.clone(), item_id.clone());
                turn.send("itemAdded", json!({"item": {
                    "id": item_id,
                    "kind": "tool",
                    "name": name,
                    "callId": call_id,
                    "summary": "Running editor Tool",
                    "status": "running",
                    "createdAt": now_millis(),
                }}))
            }
            provider::ProviderProgress::ToolCompleted {
                call_id,
                name,
                arguments,
            } => {
                let item_id = turn
                    .tool_items
                    .get(&call_id)
                    .cloned()
                    .unwrap_or_else(|| format!("{}:tool:{call_id}", turn.turn_id));
                turn.send("itemUpdated", json!({"item": {
                    "id": item_id,
                    "kind": "tool",
                    "name": name,
                    "callId": call_id,
                    "summary": "Arguments received",
                    "input": arguments,
                    "status": "running",
                    "createdAt": now_millis(),
                }}))
            }
            provider::ProviderProgress::Telemetry(telemetry) => turn.send(
                "telemetryUpdated",
                json!({"telemetry": telemetry}),
            ),
        }
    })
    .await;
    match result {
        Ok(completion) => {
            let mut broker = AgentToolBroker::new(&tool_definitions)?;
            for tool_call in &completion.tool_calls {
                let raw_result = match execute_editor_tool(
                    &state,
                    &emitter,
                    &mut broker,
                    tool_call,
                    tool_cancellation.clone(),
                )
                .await
                {
                    Ok(result) => result,
                    Err(message) => {
                        if let Ok(mut turn) = emitter.lock() {
                            let _ = turn.send_terminal(
                                "turnCancelled",
                                json!({"label": "Agent run cancelled"}),
                            );
                        }
                        return Err(message);
                    }
                };
                let mut turn = emitter
                    .lock()
                    .map_err(|_| "Agent Turn event state is unavailable")?;
                emit_tool_result(&mut turn, tool_call, &raw_result)?;
            }
            let response_text = if completion.text.trim().is_empty() {
                "I completed the requested editor Tool activity.".to_string()
            } else {
                completion.text.clone()
            };
            let (next_sequence, assistant_item_id) = finalize_turn(&emitter, &response_text)?;
            let response = AgentRunResponse {
                run_id: run_id.clone(),
                text: response_text,
                next_sequence,
                assistant_item_id,
                skill_id: skill_id.clone(),
                capabilities: completion.capabilities,
                telemetry: completion.telemetry,
                tool_calls: completion.tool_calls,
            };
            Ok(response)
        }
        Err(failure) if failure.diagnostic.code == AgentErrorCode::Cancelled => {
            if let Ok(mut turn) = emitter.lock() {
                let _ =
                    turn.send_terminal("turnCancelled", json!({"label": "Agent run cancelled"}));
            }
            Err(failure.diagnostic.message)
        }
        Err(failure) => {
            let message = failure.diagnostic.message.clone();
            if let Ok(mut turn) = emitter.lock() {
                let assistant_item_id = turn.assistant_item_id.clone();
                let error = serde_json::to_value(failure.diagnostic).unwrap_or_else(|_| {
                    json!({
                        "code": "unknown", "message": message, "retryable": false,
                    })
                });
                let _ = turn.send_terminal(
                    "turnFailed",
                    json!({
                        "assistantItemId": assistant_item_id,
                        "error": error,
                    }),
                );
            }
            Err(message)
        }
    }
}

#[tauri::command]
pub(crate) fn submit_agent_tool_result(
    run_id: String,
    result: Value,
    state: tauri::State<'_, AgentSessionState>,
) -> bool {
    state.resolve_tool_result(&run_id, result)
}

#[tauri::command]
pub(crate) fn cancel_agent(run_id: String, state: tauri::State<'_, AgentSessionState>) -> bool {
    state.cancel_run(&run_id)
}

pub(crate) fn state() -> AgentSessionState {
    AgentSessionState::default()
}

fn now_millis() -> u64 {
    chrono::Utc::now().timestamp_millis().max(0) as u64
}

#[cfg(test)]
mod tests {
    use super::can_fallback_after_codex_failure;

    #[test]
    fn codex_failure_falls_back_only_before_visible_or_tool_progress() {
        assert!(can_fallback_after_codex_failure(false));
        assert!(!can_fallback_after_codex_failure(true));
    }
}
