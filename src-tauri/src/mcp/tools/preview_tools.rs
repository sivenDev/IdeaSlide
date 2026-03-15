use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tauri::Listener;

use crate::mcp::error::ToolError;
use crate::mcp::services::file_service::FileService;
use crate::mcp::services::slide_service::SlideService;

#[derive(Clone, Serialize)]
struct RenderRequest {
    request_id: String,
    slide_content: String,
}

#[derive(Clone, Deserialize)]
struct RenderResponse {
    request_id: String,
    png_bytes: Vec<u8>,
    error: Option<String>,
}

const RENDER_TIMEOUT: Duration = Duration::from_secs(30);

/// Render a single slide by emitting to the frontend renderer and waiting for a response.
async fn render_slide(
    app_handle: &tauri::AppHandle,
    slide_content: &serde_json::Value,
    slide_id: &str,
) -> Result<String, ToolError> {
    let request_id = uuid::Uuid::new_v4().to_string();
    let content_str = serde_json::to_string(slide_content)
        .map_err(|e| ToolError::InvalidContent(e.to_string()))?;

    // Create oneshot channel for the response
    let (tx, rx) = tokio::sync::oneshot::channel::<RenderResponse>();
    let expected_id = request_id.clone();
    let tx = std::sync::Mutex::new(Some(tx));

    // Listen for response event
    let event_id = app_handle.listen("mcp-render-response", move |event| {
        if let Ok(response) = serde_json::from_str::<RenderResponse>(event.payload()) {
            if response.request_id == expected_id {
                if let Some(tx) = tx.lock().unwrap().take() {
                    let _ = tx.send(response);
                }
            }
        }
    });

    // Emit render request
    let request = RenderRequest {
        request_id: request_id.clone(),
        slide_content: content_str,
    };
    app_handle
        .emit("mcp-render-request", &request)
        .map_err(|e| ToolError::IoError(format!("Failed to emit render request: {}", e)))?;

    // Wait for response with timeout
    let result = tokio::time::timeout(RENDER_TIMEOUT, rx).await;

    // Always unlisten
    app_handle.unlisten(event_id);

    match result {
        Ok(Ok(response)) => {
            if let Some(err) = response.error {
                return Err(ToolError::IoError(format!("Render error: {}", err)));
            }

            // Write PNG to temp file
            let tmp_dir = std::env::temp_dir().join("idea-slide-mcp");
            std::fs::create_dir_all(&tmp_dir)
                .map_err(|e| ToolError::IoError(format!("Failed to create temp dir: {}", e)))?;

            let png_path = tmp_dir.join(format!("preview-{}.png", slide_id));
            std::fs::write(&png_path, &response.png_bytes)
                .map_err(|e| ToolError::IoError(format!("Failed to write PNG: {}", e)))?;

            Ok(png_path.to_string_lossy().to_string())
        }
        Ok(Err(_)) => Err(ToolError::RenderTimeout),
        Err(_) => Err(ToolError::RenderTimeout),
    }
}

/// Preview a single slide — renders to PNG and returns the file path.
pub async fn handle_preview_slide(
    renderer_ready: &Arc<AtomicBool>,
    app_handle: &tauri::AppHandle,
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: &str,
    slide_id: &str,
) -> Result<String, String> {
    if !renderer_ready.load(Ordering::Relaxed) {
        return Err(ToolError::RenderNotReady.to_string());
    }

    let file_path = Path::new(path);
    let data = file_service.read(file_path).map_err(|e| e.to_string())?;
    let content = slide_service
        .get_content(&data, slide_id)
        .map_err(|e| e.to_string())?;

    let png_path = render_slide(app_handle, &content, slide_id)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "path": png_path }).to_string())
}

/// Preview all slides — renders each to PNG and returns array of file paths.
pub async fn handle_preview_presentation(
    renderer_ready: &Arc<AtomicBool>,
    app_handle: &tauri::AppHandle,
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: &str,
) -> Result<String, String> {
    if !renderer_ready.load(Ordering::Relaxed) {
        return Err(ToolError::RenderNotReady.to_string());
    }

    let file_path = Path::new(path);
    let data = file_service.read(file_path).map_err(|e| e.to_string())?;

    let mut paths = Vec::new();
    for slide in &data.slides {
        let content = slide_service
            .get_content(&data, &slide.id)
            .map_err(|e| e.to_string())?;
        let png_path = render_slide(app_handle, &content, &slide.id)
            .await
            .map_err(|e| e.to_string())?;
        paths.push(serde_json::json!({
            "slide_id": slide.id,
            "path": png_path,
        }));
    }

    Ok(serde_json::json!({ "previews": paths }).to_string())
}
