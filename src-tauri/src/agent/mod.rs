mod provider;
mod runtime;
mod session;
mod skills;
mod types;

use crate::settings;
use session::AgentSessionState;
use tauri::ipc::Channel;
use types::{AgentRunEvent, AgentRunRequest, AgentRunResponse, AgentSkillMetadata};

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
    let result = runtime::complete(request, api_key, cancellation, move |text| {
        event_channel
            .send(AgentRunEvent::TextDelta {
                run_id: event_run_id.clone(),
                text: text.to_string(),
            })
            .map_err(|error| format!("Agent event could not be delivered: {error}"))
    })
    .await;
    state.finish_run(&run_id);
    match result {
        Ok(text) => {
            let response = AgentRunResponse {
                run_id: run_id.clone(),
                text: text.clone(),
                skill_id: skill_id.clone(),
            };
            let _ = on_event.send(AgentRunEvent::Completed {
                run_id,
                text,
                skill_id,
            });
            Ok(response)
        }
        Err(message) if message == "Agent run cancelled" => {
            let _ = on_event.send(AgentRunEvent::Cancelled { run_id });
            Err(message)
        }
        Err(message) => {
            let _ = on_event.send(AgentRunEvent::Error {
                run_id,
                message: message.clone(),
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
