mod provider;
mod runtime;
mod session;
mod skills;
mod types;

use crate::settings;
use session::AgentSessionState;
use tauri::ipc::Channel;
use types::{AgentErrorCode, AgentRunEvent, AgentRunRequest, AgentRunResponse, AgentSkillMetadata};

#[tauri::command]
pub(crate) fn discover_agent_skills() -> Vec<AgentSkillMetadata> {
    skills::discover_skills()
}

#[tauri::command]
pub(crate) async fn run_agent(
    request: AgentRunRequest,
    on_event: Channel<AgentRunEvent>,
    state: tauri::State<'_, AgentSessionState>,
) -> Result<AgentRunResponse, String> {
    let run_id = request.run_id.clone();
    let api_key = settings::read_provider_api_key()?
        .ok_or_else(|| "AI provider configuration is required".to_string())?;
    let cancellation = state.start_run(&run_id)?;
    let _ = on_event.send(AgentRunEvent::Started {
        run_id: run_id.clone(),
    });
    let skill_id = request.skill_id.clone();
    let event_channel = on_event.clone();
    let event_run_id = run_id.clone();
    let result = runtime::complete(request, api_key, cancellation, move |progress| {
        let event = match progress {
            provider::ProviderProgress::Capabilities(capabilities) => AgentRunEvent::Capabilities {
                run_id: event_run_id.clone(),
                capabilities,
            },
            provider::ProviderProgress::StrategyFallback { from, to, reason } => {
                AgentRunEvent::StrategyFallback {
                    run_id: event_run_id.clone(),
                    from,
                    to,
                    reason,
                }
            }
            provider::ProviderProgress::RetryScheduled {
                attempt,
                delay_ms,
                diagnostic,
            } => AgentRunEvent::RetryScheduled {
                run_id: event_run_id.clone(),
                attempt,
                delay_ms,
                diagnostic,
            },
            provider::ProviderProgress::ReasoningSummaryDelta(text) => {
                AgentRunEvent::ReasoningSummaryDelta {
                    run_id: event_run_id.clone(),
                    text,
                }
            }
            provider::ProviderProgress::TextDelta(text) => AgentRunEvent::TextDelta {
                run_id: event_run_id.clone(),
                text,
            },
            provider::ProviderProgress::ToolStarted { call_id, name } => {
                AgentRunEvent::ToolStarted {
                    run_id: event_run_id.clone(),
                    call_id,
                    name,
                }
            }
            provider::ProviderProgress::ToolCompleted { call_id, name } => {
                AgentRunEvent::ToolCompleted {
                    run_id: event_run_id.clone(),
                    call_id,
                    name,
                }
            }
            provider::ProviderProgress::Telemetry(telemetry) => AgentRunEvent::Telemetry {
                run_id: event_run_id.clone(),
                telemetry,
            },
        };
        event_channel
            .send(event)
            .map_err(|error| format!("Agent event could not be delivered: {error}"))
    })
    .await;
    state.finish_run(&run_id);
    match result {
        Ok(completion) => {
            let response = AgentRunResponse {
                run_id: run_id.clone(),
                text: completion.text.clone(),
                skill_id: skill_id.clone(),
                capabilities: completion.capabilities,
                telemetry: completion.telemetry,
            };
            let _ = on_event.send(AgentRunEvent::Completed {
                run_id,
                text: completion.text,
                skill_id,
            });
            Ok(response)
        }
        Err(failure) if failure.diagnostic.code == AgentErrorCode::Cancelled => {
            let _ = on_event.send(AgentRunEvent::Cancelled { run_id });
            Err(failure.diagnostic.message)
        }
        Err(failure) => {
            let message = failure.diagnostic.message.clone();
            let _ = on_event.send(AgentRunEvent::Error {
                run_id,
                error: failure.diagnostic,
            });
            Err(message)
        }
    }
}

#[tauri::command]
pub(crate) fn cancel_agent(run_id: String, state: tauri::State<'_, AgentSessionState>) -> bool {
    state.cancel_run(&run_id)
}

pub(crate) fn state() -> AgentSessionState {
    AgentSessionState::default()
}
