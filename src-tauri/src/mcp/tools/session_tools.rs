use std::sync::Arc;
use serde_json::Value;
use crate::mcp::services::session_manager::SessionManager;
use crate::mcp::services::file_service::FileService;
use crate::mcp::services::slide_service::SlideService;

pub fn handle_begin_slide_stream(
    session_manager: &Arc<SessionManager>,
    path: &str,
    index: Option<usize>,
) -> Result<String, String> {
    let session_id = session_manager.create_session(path.to_string(), index);
    Ok(serde_json::json!({ "session_id": session_id }).to_string())
}

pub fn handle_append_elements(
    session_manager: &Arc<SessionManager>,
    session_id: &str,
    elements: Vec<Value>,
) -> Result<String, String> {
    let count = session_manager.append_elements(session_id, elements)?;
    Ok(serde_json::json!({
        "session_id": session_id,
        "total_elements": count
    }).to_string())
}

pub fn handle_commit_slide(
    session_manager: &Arc<SessionManager>,
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    session_id: &str,
) -> Result<String, String> {
    let session = session_manager.get_session(session_id)?;

    let content = serde_json::json!({
        "elements": session.elements,
        "appState": session.app_state.unwrap_or_else(|| serde_json::json!({
            "viewBackgroundColor": "#ffffff"
        }))
    });

    let path = std::path::Path::new(&session.path);
    let mut new_id = String::new();
    file_service.read_and_modify(path, |data| {
        new_id = slide_service.add(data, session.index, Some(content))?;
        Ok(())
    }).map_err(|e| e.to_string())?;

    session_manager.remove_session(session_id)?;

    Ok(serde_json::json!({ "slide_id": new_id }).to_string())
}

pub fn handle_abort_slide_stream(
    session_manager: &Arc<SessionManager>,
    session_id: &str,
) -> Result<String, String> {
    session_manager.abort_session(session_id)?;
    Ok(serde_json::json!({ "aborted": true }).to_string())
}
