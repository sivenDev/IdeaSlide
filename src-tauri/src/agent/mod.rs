mod adapters;
mod provider;
mod repository;
mod runtime;
mod session;
mod skill_registry;
mod skills;
mod telemetry;
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
use skill_registry::{SkillRegistry, SkillTurnState};
use tauri::{ipc::Channel, Manager};
use telemetry::TextDeliveryTelemetryCollector;
use tool_broker::{AgentToolBroker, BrokerDecision};
use types::{
    AgentErrorCode, AgentErrorDiagnostic, AgentProviderCapabilities, AgentRunEvent,
    AgentRunRequest, AgentRunResponse, AgentSkillMetadata, AgentToolCall,
};
use uuid::Uuid;

#[tauri::command]
pub(crate) async fn list_agent_runtimes() -> Vec<adapters::RuntimeDescriptor> {
    adapters::discover_runtime_catalog().await
}

#[tauri::command]
pub(crate) fn discover_agent_skills(
    app_handle: tauri::AppHandle,
) -> Result<Vec<AgentSkillMetadata>, String> {
    skill_repository(&app_handle)?.list()
}

fn skill_repository(app_handle: &tauri::AppHandle) -> Result<SkillRegistry, String> {
    let root = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("Application data directory is unavailable: {error}"))?
        .join("agent");
    Ok(SkillRegistry::new(root))
}

#[tauri::command]
pub(crate) fn import_agent_skill(
    source_path: String,
    replace_id: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<AgentSkillMetadata, String> {
    skill_repository(&app_handle)?.import(std::path::Path::new(&source_path), replace_id.as_deref())
}

#[tauri::command]
pub(crate) fn update_agent_skill(
    id: String,
    enabled: bool,
    implicit_invocation: bool,
    editor_scopes: Vec<String>,
    app_handle: tauri::AppHandle,
) -> Result<AgentSkillMetadata, String> {
    skill_repository(&app_handle)?.update(&id, enabled, implicit_invocation, editor_scopes)
}

#[tauri::command]
pub(crate) fn remove_agent_skill(id: String, app_handle: tauri::AppHandle) -> Result<bool, String> {
    skill_repository(&app_handle)?.remove(&id)
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
    assistant_segment: u32,
    assistant_added: bool,
    assistant_content: String,
    activity_added: bool,
    activity_content: String,
    tool_items: HashMap<String, String>,
    tool_activity_started: bool,
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
            assistant_segment: 0,
            assistant_added: false,
            assistant_content: String::new(),
            activity_added: false,
            activity_content: String::new(),
            tool_items: HashMap::new(),
            tool_activity_started: false,
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

    fn append_assistant_delta(&mut self, delta: &str) -> Result<(), String> {
        self.ensure_assistant()?;
        self.assistant_content.push_str(delta);
        let item_id = self.assistant_item_id.clone();
        self.send("itemDelta", json!({"itemId": item_id, "text": delta}))
    }

    fn close_assistant_segment(&mut self) -> Result<(), String> {
        if !self.assistant_added {
            return Ok(());
        }
        let item_id = self.assistant_item_id.clone();
        let content = self.assistant_content.clone();
        self.send(
            "itemUpdated",
            json!({"item": {
                "id": item_id,
                "kind": "message",
                "role": "assistant",
                "content": content,
                "status": "completed",
                "createdAt": now_millis(),
            }}),
        )?;
        self.assistant_segment = self.assistant_segment.saturating_add(1);
        self.assistant_item_id = format!("{}:assistant:{}", self.turn_id, self.assistant_segment);
        self.assistant_added = false;
        self.assistant_content.clear();
        Ok(())
    }

    fn finalize_assistant(&mut self, response_text: &str) -> Result<(String, String), String> {
        let final_text = if self.assistant_added && !self.assistant_content.is_empty() {
            self.assistant_content.clone()
        } else if self.tool_activity_started {
            "I completed the requested editor Tool activity.".to_string()
        } else {
            response_text.to_string()
        };
        if !self.assistant_added {
            self.ensure_assistant()?;
        }
        if self.assistant_content.is_empty() && !final_text.is_empty() {
            self.assistant_content.push_str(&final_text);
            let item_id = self.assistant_item_id.clone();
            self.send(
                "itemDelta",
                json!({"itemId": item_id, "text": final_text.clone()}),
            )?;
        }
        let item_id = self.assistant_item_id.clone();
        let content = self.assistant_content.clone();
        self.send(
            "itemUpdated",
            json!({"item": {
                "id": item_id,
                "kind": "message",
                "role": "assistant",
                "content": content,
                "status": "completed",
                "createdAt": now_millis(),
            }}),
        )?;
        Ok((
            self.assistant_item_id.clone(),
            self.assistant_content.clone(),
        ))
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

fn record_runtime_diagnostic(
    turn: &mut NativeTurnEmitter,
    category: &str,
    severity: &str,
    code: &str,
    message: impl Into<String>,
    recovery: Option<String>,
    retryable: bool,
) -> Result<(), String> {
    turn.send(
        "runtimeDiagnosticRecorded",
        json!({"diagnostic": {
            "id": Uuid::new_v4().to_string(),
            "at": now_millis(),
            "category": category,
            "severity": severity,
            "code": code,
            "message": message.into(),
            "recovery": recovery,
            "retryable": retryable,
        }}),
    )
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

fn emit_provider_progress(
    emitter: &Arc<Mutex<NativeTurnEmitter>>,
    progress: provider::ProviderProgress,
) -> Result<(), String> {
    let mut turn = emitter
        .lock()
        .map_err(|_| "Agent Turn event state is unavailable".to_string())?;
    match progress {
        provider::ProviderProgress::Capabilities(capabilities) => turn.send(
            "capabilitiesUpdated",
            json!({"capabilities": normalized_capabilities(&capabilities)}),
        ),
        provider::ProviderProgress::StrategyFallback { from, to, reason } => {
            let item_id = format!("{}:fallback", turn.turn_id);
            turn.send(
                "itemAdded",
                json!({"item": {
                    "id": item_id,
                    "kind": "lifecycle",
                    "label": format!("{reason} ({from:?} → {to:?})"),
                    "status": "completed",
                    "createdAt": now_millis(),
                }}),
            )?;
            record_runtime_diagnostic(
                &mut turn,
                "fallback",
                "warning",
                "provider.strategyFallback",
                format!("{reason} ({from:?} → {to:?})"),
                Some("No action is required unless the fallback repeats.".to_string()),
                true,
            )
        }
        provider::ProviderProgress::RetryScheduled {
            attempt,
            delay_ms,
            diagnostic,
        } => {
            let item_id = format!("{}:retry:{attempt}", turn.turn_id);
            turn.send("itemAdded", json!({"item": {
                "id": item_id,
                "kind": "lifecycle",
                "label": format!("Retrying provider request (attempt {attempt}) in {delay_ms} ms"),
                "status": "completed",
                "createdAt": now_millis(),
            }}))?;
            record_runtime_diagnostic(
                &mut turn,
                "retry",
                "warning",
                &format!("provider.{:?}", diagnostic.code),
                diagnostic.message,
                diagnostic.recovery,
                diagnostic.retryable,
            )
        }
        provider::ProviderProgress::PublicActivityDelta(text) => {
            emit_public_activity_delta(&mut turn, text)
        }
        provider::ProviderProgress::ContextUsage {
            total,
            last,
            model_context_window,
        } => {
            let used_percent = model_context_window
                .filter(|window| *window > 0)
                .map(|window| {
                    total
                        .total_tokens
                        .saturating_mul(100)
                        .checked_div(window)
                        .unwrap_or(0)
                        .min(100)
                });
            turn.send(
                "contextUpdated",
                json!({"context": {
                    "status": "available",
                    "source": "provider",
                    "total": total,
                    "last": last,
                    "modelContextWindow": model_context_window,
                    "usedPercent": used_percent,
                    "message": if used_percent.is_some() {
                        "Exact context usage was supplied by the provider."
                    } else {
                        "Exact token usage was supplied by the provider, but no context window was supplied."
                    },
                }}),
            )
        }
        provider::ProviderProgress::TextDelta(text) => turn.append_assistant_delta(&text),
        provider::ProviderProgress::ToolStarted { call_id, name } => {
            emit_tool_started(&mut turn, &call_id, &name, None)
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
            turn.send(
                "itemUpdated",
                json!({"item": {
                    "id": item_id,
                    "kind": "tool",
                    "name": name,
                    "callId": call_id,
                    "summary": "Arguments received",
                    "input": arguments,
                    "status": "running",
                    "createdAt": now_millis(),
                }}),
            )
        }
        provider::ProviderProgress::Telemetry(telemetry) => {
            turn.send("telemetryUpdated", json!({"telemetry": telemetry}))
        }
    }
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

fn compatibility_skill_loop_failure() -> provider::ProviderFailure {
    provider::ProviderFailure {
        diagnostic: AgentErrorDiagnostic {
            code: AgentErrorCode::ToolExecutionFailed,
            message: "Managed Skill activation did not settle within the bounded Compatibility Tool loop."
                .to_string(),
            recovery: Some(
                "Start a new Turn and explicitly select the required Skill.".to_string(),
            ),
            diagnostic_id: Uuid::new_v4().to_string(),
            retryable: true,
        },
    }
}

fn tool_output(result: &Value) -> Value {
    if result.get("persistable").and_then(Value::as_bool) == Some(false) {
        return json!({ "detail": "Ephemeral Tool content is not retained." });
    }
    match result.get("kind").and_then(Value::as_str) {
        Some("read") => result.get("content").cloned().unwrap_or(Value::Null),
        Some("mutation") => json!({
            "changeSetId": result.pointer("/changeSet/id").cloned().unwrap_or(Value::Null),
            "summary": result.pointer("/changeSet/summary").cloned().unwrap_or(Value::Null),
            "status": result.pointer("/changeSet/status").cloned().unwrap_or(Value::Null),
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
    skill_turn: &Arc<Mutex<SkillTurnState>>,
    editor_tools: &[types::AgentToolDescriptor],
    cancellation: tokio::sync::watch::Receiver<bool>,
) -> Result<Value, String> {
    match broker.begin(call) {
        Ok(BrokerDecision::Cached(result)) => Ok(result),
        Ok(BrokerDecision::Execute) => {
            let (host_result, activated) = {
                let mut skills = skill_turn
                    .lock()
                    .map_err(|_| "Skill activation state is unavailable".to_string())?;
                let before = skills
                    .provenance()
                    .into_iter()
                    .map(|item| item.id)
                    .collect::<std::collections::HashSet<_>>();
                let result = skills.execute_host_tool(call, editor_tools);
                let activated = skills
                    .provenance()
                    .into_iter()
                    .filter(|item| !before.contains(&item.id))
                    .collect::<Vec<_>>();
                (result, activated)
            };
            if let Some(result) = host_result {
                let result = broker
                    .complete(call, result)
                    .unwrap_or_else(|message| tool_failure(call, message));
                if result.get("success").and_then(Value::as_bool) == Some(true) {
                    let mut turn = emitter
                        .lock()
                        .map_err(|_| "Agent Turn event state is unavailable".to_string())?;
                    for provenance in activated {
                        turn.send("skillActivated", json!({ "provenance": provenance }))?;
                    }
                }
                return Ok(result);
            }
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

fn emit_tool_started(
    turn: &mut NativeTurnEmitter,
    call_id: &str,
    name: &str,
    input: Option<&Value>,
) -> Result<(), String> {
    if turn.tool_items.contains_key(call_id) {
        return Ok(());
    }
    turn.close_assistant_segment()?;
    turn.tool_activity_started = true;
    let item_id = format!("{}:tool:{call_id}", turn.turn_id);
    turn.tool_items.insert(call_id.to_string(), item_id.clone());
    let mut item = json!({
        "id": item_id,
        "kind": "tool",
        "name": name,
        "callId": call_id,
        "summary": "Running Agent Tool",
        "status": "running",
        "createdAt": now_millis(),
    });
    if let Some(input) = input {
        item["input"] = input.clone();
    }
    turn.send("itemAdded", json!({"item": item}))
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
    if kind == "failure" {
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
) -> Result<(u64, String, String), String> {
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
    let (assistant_item_id, final_text) = turn.finalize_assistant(response_text)?;
    turn.send_terminal(
        "turnCompleted",
        json!({"assistantItemId": assistant_item_id.clone(), "finalText": final_text.clone()}),
    )?;
    Ok((turn.sequence, assistant_item_id, final_text))
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

struct CodexRunOptions {
    started: std::time::Instant,
    request_ms: u64,
    max_steps: u8,
}

async fn run_codex_driver(
    mut driver: adapters::CodexTurnDriver,
    state: &AgentSessionState,
    emitter: &Arc<Mutex<NativeTurnEmitter>>,
    tools: &[types::AgentToolDescriptor],
    editor_tools: &[types::AgentToolDescriptor],
    skill_turn: &Arc<Mutex<SkillTurnState>>,
    model: &str,
    options: CodexRunOptions,
    mut cancellation: tokio::sync::watch::Receiver<bool>,
) -> Result<
    (
        String,
        AgentProviderCapabilities,
        types::AgentStreamingTelemetry,
    ),
    String,
> {
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
                "health": "healthy",
            }}),
        )?;
        record_runtime_diagnostic(
            &mut turn,
            "selection",
            "info",
            "runtime.codexSelected",
            format!(
                "Pinned Codex {} passed compatibility checks and was selected automatically.",
                adapters::PINNED_CODEX_VERSION
            ),
            None,
            false,
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
    let mut broker = AgentToolBroker::with_max_steps(tools, options.max_steps)?;
    let mut text = String::new();
    let mut delivery = TextDeliveryTelemetryCollector::default();
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
        let event_ms = elapsed_millis(options.started);
        delivery.observe_event(event_ms);
        match event {
            adapters::RuntimeDriverEvent::ToolRequest { request_id, call } => {
                {
                    let mut turn = emitter
                        .lock()
                        .map_err(|_| "Agent Turn event state is unavailable")?;
                    turn.runtime_progressed = true;
                    emit_tool_started(&mut turn, &call.call_id, &call.name, Some(&call.arguments))?;
                }
                let result = execute_editor_tool(
                    state,
                    emitter,
                    &mut broker,
                    &call,
                    skill_turn,
                    editor_tools,
                    cancellation.clone(),
                )
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
                    delivery.observe_text(event_ms, &delta);
                    text.push_str(&delta);
                    let mut turn = emitter
                        .lock()
                        .map_err(|_| "Agent Turn event state is unavailable")?;
                    turn.runtime_progressed = true;
                    turn.append_assistant_delta(&delta)?;
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
                adapters::RuntimeEvent::ContextUsage {
                    total,
                    last,
                    model_context_window,
                } => {
                    let used_percent =
                        model_context_window
                            .filter(|window| *window > 0)
                            .map(|window| {
                                total
                                    .total_tokens
                                    .saturating_mul(100)
                                    .checked_div(window)
                                    .unwrap_or(0)
                                    .min(100)
                            });
                    let mut turn = emitter
                        .lock()
                        .map_err(|_| "Agent Turn event state is unavailable")?;
                    turn.send(
                        "contextUpdated",
                        json!({"context": {
                            "status": "available",
                            "source": "runtime",
                            "total": total,
                            "last": last,
                            "modelContextWindow": model_context_window,
                            "usedPercent": used_percent,
                            "message": if used_percent.is_some() {
                                "Exact context usage supplied by the active runtime."
                            } else {
                                "Exact token usage is available, but the runtime did not supply a context window."
                            },
                        }}),
                    )?;
                }
                adapters::RuntimeEvent::ContextCompacted => {
                    let mut turn = emitter
                        .lock()
                        .map_err(|_| "Agent Turn event state is unavailable")?;
                    let turn_id = turn.turn_id.clone();
                    let compacted_at = now_millis();
                    turn.send(
                        "contextUpdated",
                        json!({"context": {
                            "runtimeCompactedAt": compacted_at,
                            "runtimeCompactedTurnId": turn_id,
                            "message": "The active runtime compacted upstream context. Visible Thread history is unchanged.",
                        }}),
                    )?;
                    record_runtime_diagnostic(
                        &mut turn,
                        "compaction",
                        "info",
                        "runtime.contextCompacted",
                        "The active runtime compacted upstream context. Visible Thread history is unchanged.",
                        Some("Start a new Thread if the current task no longer has enough working context.".to_string()),
                        false,
                    )?;
                }
                adapters::RuntimeEvent::Diagnostic { code, message } => {
                    let mut turn = emitter
                        .lock()
                        .map_err(|_| "Agent Turn event state is unavailable")?;
                    record_runtime_diagnostic(
                        &mut turn,
                        "provider",
                        "warning",
                        &code,
                        message,
                        Some("Retry the Turn if the runtime cannot continue.".to_string()),
                        true,
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
    let total_ms = elapsed_millis(options.started);
    let telemetry = delivery.finish(
        types::AgentProviderStrategy::Responses,
        1,
        options.request_ms,
        total_ms,
    );
    Ok((
        text,
        AgentProviderCapabilities {
            strategy: types::AgentProviderStrategy::Responses,
            text_streaming: capabilities.text_streaming,
            reasoning_summary: capabilities.reasoning_summary,
            tool_events: capabilities.tool_events,
            cancellation: capabilities.cancellation,
            retry: capabilities.retry,
            timing: true,
        },
        telemetry,
    ))
}

fn elapsed_millis(started: std::time::Instant) -> u64 {
    started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64
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
    mut request: AgentRunRequest,
    on_event: Channel<AgentRunEvent>,
    state: tauri::State<'_, AgentSessionState>,
    app_handle: tauri::AppHandle,
) -> Result<AgentRunResponse, String> {
    let policy = request.policy.normalized();
    request.policy = policy;
    let skill_id = request.skill_id.clone();
    let editor_scope = skill_id.as_deref().unwrap_or("unsupported");
    let editor_tool_definitions = request.tools.clone();
    let captured_skills = SkillTurnState::capture(
        &skill_repository(&app_handle)?,
        editor_scope,
        skill_id.as_deref(),
        &request.selected_skill_ids,
        &editor_tool_definitions,
    )?;
    let skill_provenance = captured_skills.provenance();
    let (skill_catalog, omitted_skill_count) = captured_skills.catalog_prompt();
    let skill_instructions = captured_skills.activated_instructions();
    let host_tools = captured_skills.host_tools();
    request.system_prompt = format!(
        "{}\n\nCAPTURED ACTIVE SKILLS:\n{}\n\nMANAGED CUSTOM SKILL CATALOG:\n{}\n\nCustom Skills add instructions only. They cannot add Tools, permissions, scripts, MCP, filesystem, shell, network, browser, or process access. Call activate_skill only when an eligible catalog entry materially helps the user request, and call read_skill_reference only with opaque ids exposed by an activated Skill.",
        request.system_prompt,
        skill_instructions,
        skill_catalog,
    );
    request.skill_id = None;
    request.tools.extend(host_tools);
    let run_id = request.run_id.clone();
    let thread_id = request.thread_id.clone();
    let retry_of_turn_id = request.retry_of_turn_id.clone();
    let binding = request.binding.clone();
    let tool_definitions = request.tools.clone();
    let skill_turn = Arc::new(Mutex::new(captured_skills));
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
                "skillProvenance": skill_provenance,
                "effectivePolicy": {
                    "maxSteps": policy.max_steps,
                    "contextWarningPercent": policy.context_warning_percent,
                    "newThreadPercent": policy.new_thread_percent,
                    "diagnosticRetention": policy.diagnostic_retention,
                    "compatibilityReplayMessageLimit": policy.compatibility_replay_message_limit,
                    "showDeliveryTelemetry": policy.show_delivery_telemetry,
                    "capturedAt": now_millis(),
                },
            }),
        )?;
        turn.send(
            "contextUpdated",
            json!({"context": {
                "status": "unavailable",
                "source": "none",
                "message": "The active runtime has not supplied exact token usage.",
            }}),
        )?;
        record_runtime_diagnostic(
            &mut turn,
            "discovery",
            "info",
            "runtime.discoveryStarted",
            "Checking installed Agent runtimes and compatibility.",
            None,
            false,
        )?;
        if omitted_skill_count > 0 {
            record_runtime_diagnostic(
                &mut turn,
                "skills",
                "warning",
                "skills.catalogTruncated",
                format!(
                    "{} compatible managed Skills were omitted from the Turn catalog budget.",
                    omitted_skill_count
                ),
                Some(
                    "Narrow compatible editor scopes or explicitly select the required Skill."
                        .to_string(),
                ),
                false,
            )?;
        }
        turn.send(
            "itemAdded",
            json!({
                "item": {
                    "id": format!("{run_id}:skill"),
                    "kind": "tool",
                    "name": format!("{} Skill", skill_id.clone().unwrap_or_else(|| "Editor".to_string())),
                    "summary": format!("{} editor Tools and {} host Tools available", editor_tool_definitions.len(), tool_definitions.len().saturating_sub(editor_tool_definitions.len())),
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
    if !codex_available {
        let mut turn = emitter
            .lock()
            .map_err(|_| "Agent Turn event state is unavailable")?;
        record_runtime_diagnostic(
            &mut turn,
            "discovery",
            "warning",
            "runtime.richRuntimeUnavailable",
            compatibility_reason.clone(),
            Some("Compatibility will be selected automatically for this Turn.".to_string()),
            false,
        )?;
    }
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
        let codex_started = std::time::Instant::now();
        match adapters::CodexTurnDriver::start(&rich_input).await {
            Ok(driver) => {
                let request_ms = elapsed_millis(codex_started);
                match run_codex_driver(
                    driver,
                    &state,
                    &emitter,
                    &tool_definitions,
                    &editor_tool_definitions,
                    &skill_turn,
                    &request.model,
                    CodexRunOptions {
                        started: codex_started,
                        request_ms,
                        max_steps: policy.max_steps,
                    },
                    tool_cancellation.clone(),
                )
                .await
                {
                    Ok((text, capabilities, telemetry)) => {
                        emitter
                            .lock()
                            .map_err(|_| "Agent Turn event state is unavailable")?
                            .send("telemetryUpdated", json!({"telemetry": telemetry.clone()}))?;
                        let response_text = if text.trim().is_empty() {
                            "I completed the requested editor Tool activity.".to_string()
                        } else {
                            text
                        };
                        let (next_sequence, assistant_item_id, response_text) =
                            finalize_turn(&emitter, &response_text)?;
                        let response = AgentRunResponse {
                            run_id: run_id.clone(),
                            text: response_text,
                            next_sequence,
                            assistant_item_id,
                            skill_id,
                            capabilities,
                            telemetry,
                            tool_calls: Vec::new(),
                        };
                        return Ok(response);
                    }
                    Err(message) => {
                        if message.to_ascii_lowercase().contains("cancel") {
                            if let Ok(mut turn) = emitter.lock() {
                                let _ = record_runtime_diagnostic(
                                    &mut turn,
                                    "cancellation",
                                    "info",
                                    "runtime.cancelled",
                                    "The running Turn was cancelled.",
                                    None,
                                    false,
                                );
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
                            record_runtime_diagnostic(
                                &mut turn,
                                "fallback",
                                "warning",
                                "runtime.codexStoppedBeforeOutput",
                                compatibility_reason.clone(),
                                Some(
                                    "Compatibility was selected automatically for this Turn."
                                        .to_string(),
                                ),
                                true,
                            )?;
                        } else {
                            if let Ok(mut turn) = emitter.lock() {
                                let _ = record_runtime_diagnostic(
                                    &mut turn,
                                    "terminal",
                                    "error",
                                    "runtime.codexFailedAfterProgress",
                                    message.clone(),
                                    Some("Retry the Turn. Automatic fallback is disabled after visible Codex progress or Tool activity.".to_string()),
                                    true,
                                );
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
                record_runtime_diagnostic(
                    &mut turn,
                    "startup",
                    "warning",
                    "runtime.codexInitializationFailed",
                    compatibility_reason.clone(),
                    Some("Compatibility was selected automatically for this Turn.".to_string()),
                    true,
                )?;
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
                "health": "degraded",
            }}),
        )?;
        record_runtime_diagnostic(
            &mut turn,
            "selection",
            "warning",
            "runtime.compatibilitySelected",
            "Using the OpenAI-compatible runtime for this Turn.",
            Some("Open Agent Settings to inspect installed runtime compatibility.".to_string()),
            false,
        )?;
    }
    let api_key = settings::read_provider_api_key(&app_handle)?
        .ok_or_else(|| "AI provider configuration is required".to_string())?;
    let mut compatibility_request = request;
    let mut broker = AgentToolBroker::with_max_steps(&tool_definitions, policy.max_steps)?;
    let mut compatibility_host_rounds = 0_u8;
    let result = loop {
        let progress_emitter = emitter.clone();
        let round_result = runtime::complete(
            compatibility_request.clone(),
            api_key.clone(),
            cancellation.clone(),
            move |progress| emit_provider_progress(&progress_emitter, progress),
        )
        .await;
        let Ok(completion) = round_result else {
            break round_result;
        };
        let host_calls = completion
            .tool_calls
            .iter()
            .filter(|tool_call| {
                matches!(
                    tool_call.name.as_str(),
                    "activate_skill" | "read_skill_reference"
                )
            })
            .collect::<Vec<_>>();
        let has_host_calls = !host_calls.is_empty();
        if has_host_calls {
            compatibility_host_rounds = compatibility_host_rounds.saturating_add(1);
            if compatibility_host_rounds > 3 {
                break Err(compatibility_skill_loop_failure());
            }
        }
        let mut ephemeral_host_results = Vec::new();
        let calls_to_execute = if has_host_calls {
            host_calls
        } else {
            completion.tool_calls.iter().collect::<Vec<_>>()
        };
        for tool_call in calls_to_execute {
            let raw_result = match execute_editor_tool(
                &state,
                &emitter,
                &mut broker,
                tool_call,
                &skill_turn,
                &editor_tool_definitions,
                tool_cancellation.clone(),
            )
            .await
            {
                Ok(result) => result,
                Err(message) => {
                    if let Ok(mut turn) = emitter.lock() {
                        let _ = record_runtime_diagnostic(
                            &mut turn,
                            "cancellation",
                            "info",
                            "runtime.cancelledDuringTool",
                            "The running Turn was cancelled during Agent Tool activity.",
                            None,
                            false,
                        );
                        let _ = turn.send_terminal(
                            "turnCancelled",
                            json!({"label": "Agent run cancelled"}),
                        );
                    }
                    return Err(message);
                }
            };
            if has_host_calls {
                ephemeral_host_results.push(raw_result.clone());
            }
            let mut turn = emitter
                .lock()
                .map_err(|_| "Agent Turn event state is unavailable")?;
            emit_tool_result(&mut turn, tool_call, &raw_result)?;
        }
        if has_host_calls {
            let activated = skill_turn
                .lock()
                .map_err(|_| "Skill activation state is unavailable")?
                .activated_instructions();
            let host_tools = skill_turn
                .lock()
                .map_err(|_| "Skill activation state is unavailable")?
                .host_tools();
            compatibility_request.tools = editor_tool_definitions.clone();
            compatibility_request.tools.extend(host_tools);
            compatibility_request.system_prompt = format!(
                "{}\n\nCURRENT CAPTURED SKILL INSTRUCTIONS:\n{}\n\nEPHEMERAL HOST TOOL RESULTS FOR THIS TURN ONLY:\n{}",
                compatibility_request.system_prompt,
                activated,
                serde_json::to_string(&ephemeral_host_results)
                    .unwrap_or_else(|_| "[]".to_string()),
            );
            continue;
        }
        break Ok(completion);
    };
    match result {
        Ok(completion) => {
            let response_text = if completion.text.trim().is_empty() {
                "I completed the requested editor Tool activity.".to_string()
            } else {
                completion.text.clone()
            };
            let (next_sequence, assistant_item_id, response_text) =
                finalize_turn(&emitter, &response_text)?;
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
                let _ = record_runtime_diagnostic(
                    &mut turn,
                    "cancellation",
                    "info",
                    "provider.cancelled",
                    "The running Turn was cancelled.",
                    None,
                    false,
                );
                let _ =
                    turn.send_terminal("turnCancelled", json!({"label": "Agent run cancelled"}));
            }
            Err(failure.diagnostic.message)
        }
        Err(failure) => {
            let message = failure.diagnostic.message.clone();
            if let Ok(mut turn) = emitter.lock() {
                let _ = record_runtime_diagnostic(
                    &mut turn,
                    "provider",
                    "error",
                    &format!("provider.{:?}", failure.diagnostic.code),
                    failure.diagnostic.message.clone(),
                    failure.diagnostic.recovery.clone(),
                    failure.diagnostic.retryable,
                );
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
    use super::{
        can_fallback_after_codex_failure, emit_tool_result, emit_tool_started, finalize_turn,
        NativeTurnEmitter,
    };
    use crate::agent::types::{AgentRunEvent, AgentToolCall};
    use serde_json::{json, Value};
    use std::sync::{Arc, Mutex};
    use tauri::ipc::{Channel, InvokeResponseBody};

    #[test]
    fn codex_failure_falls_back_only_before_visible_or_tool_progress() {
        assert!(can_fallback_after_codex_failure(false));
        assert!(!can_fallback_after_codex_failure(true));
    }

    #[test]
    fn assistant_segments_follow_tool_execution_order() {
        let captured = Arc::new(Mutex::new(Vec::<Value>::new()));
        let event_capture = captured.clone();
        let channel = Channel::<AgentRunEvent>::new(move |body| {
            let InvokeResponseBody::Json(text) = body else {
                panic!("Agent events must be JSON");
            };
            event_capture
                .lock()
                .unwrap()
                .push(serde_json::from_str(&text).unwrap());
            Ok(())
        });
        let emitter = Arc::new(Mutex::new(NativeTurnEmitter::new(
            channel,
            "thread-1".to_string(),
            "turn-1".to_string(),
        )));
        let call = AgentToolCall {
            call_id: "read-1".to_string(),
            name: "read_active_page".to_string(),
            arguments: json!({}),
        };
        let mutation = AgentToolCall {
            call_id: "replace-1".to_string(),
            name: "replace_page_elements".to_string(),
            arguments: json!({"pageId": "page-1", "elements": []}),
        };
        {
            let mut turn = emitter.lock().unwrap();
            turn.append_assistant_delta("Inspecting the Page.").unwrap();
            emit_tool_started(&mut turn, &call.call_id, &call.name, Some(&call.arguments)).unwrap();
            emit_tool_result(
                &mut turn,
                &call,
                &json!({
                    "kind": "read", "callId": "read-1", "name": "read_active_page",
                    "success": true, "summary": "Read active Page", "content": {"id": "page-1"},
                    "truncated": false, "persistable": false
                }),
            )
            .unwrap();
            turn.append_assistant_delta("Preparing the update.")
                .unwrap();
            emit_tool_started(
                &mut turn,
                &mutation.call_id,
                &mutation.name,
                Some(&mutation.arguments),
            )
            .unwrap();
            emit_tool_result(
                &mut turn,
                &mutation,
                &json!({
                    "kind": "mutation", "callId": "replace-1", "name": "replace_page_elements",
                    "success": true, "summary": "Replaced active Page elements",
                    "changeSet": {"id": "change-1", "summary": "Replace Page", "status": "applied"},
                    "truncated": false, "persistable": true
                }),
            )
            .unwrap();
            turn.append_assistant_delta("Updated the Page.").unwrap();
        }
        let (_, assistant_item_id, final_text) = finalize_turn(
            &emitter,
            "Inspecting the Page.Preparing the update.Updated the Page.",
        )
        .unwrap();
        assert_eq!(assistant_item_id, "turn-1:assistant:2");
        assert_eq!(final_text, "Updated the Page.");

        let events = captured.lock().unwrap();
        let ordered = events
            .iter()
            .filter_map(|envelope| {
                let event = envelope.get("event")?;
                match event.get("type")?.as_str()? {
                    "itemAdded" | "itemUpdated" => {
                        let item = event.get("item")?;
                        Some(format!(
                            "{}:{}:{}",
                            event.get("type")?.as_str()?,
                            item.get("kind")?.as_str()?,
                            item.get("status")?.as_str()?
                        ))
                    }
                    "turnCompleted" => Some("turnCompleted".to_string()),
                    _ => None,
                }
            })
            .collect::<Vec<_>>();
        assert_eq!(
            ordered,
            [
                "itemAdded:message:running",
                "itemUpdated:message:completed",
                "itemAdded:tool:running",
                "itemUpdated:tool:completed",
                "itemAdded:message:running",
                "itemUpdated:message:completed",
                "itemAdded:tool:running",
                "itemUpdated:tool:completed",
                "itemAdded:message:running",
                "itemUpdated:message:completed",
                "turnCompleted",
            ]
        );
    }

    #[test]
    fn tool_only_completion_does_not_repeat_pre_tool_text_as_the_final_message() {
        let channel = Channel::<AgentRunEvent>::new(|_| Ok(()));
        let emitter = Arc::new(Mutex::new(NativeTurnEmitter::new(
            channel,
            "thread-2".to_string(),
            "turn-2".to_string(),
        )));
        {
            let mut turn = emitter.lock().unwrap();
            turn.append_assistant_delta("I will inspect the Page.")
                .unwrap();
            emit_tool_started(&mut turn, "read-2", "read_active_page", Some(&json!({}))).unwrap();
        }
        let (_, assistant_item_id, final_text) =
            finalize_turn(&emitter, "I will inspect the Page.").unwrap();
        assert_eq!(assistant_item_id, "turn-2:assistant:1");
        assert_eq!(
            final_text,
            "I completed the requested editor Tool activity."
        );
    }
}
