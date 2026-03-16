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
/// If output_path is provided, saves to that file. Otherwise returns base64-encoded data.
async fn render_slide(
    app_handle: &tauri::AppHandle,
    slide_content: &serde_json::Value,
    output_path: Option<&str>,
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

            // If output_path is provided, write to file
            if let Some(path) = output_path {
                std::fs::write(path, &response.png_bytes)
                    .map_err(|e| ToolError::IoError(format!("Failed to write PNG: {}", e)))?;
                Ok(path.to_string())
            } else {
                // Return base64-encoded PNG data
                use base64::Engine;
                let base64_data = base64::engine::general_purpose::STANDARD.encode(&response.png_bytes);
                Ok(base64_data)
            }
        }
        Ok(Err(_)) => Err(ToolError::RenderTimeout),
        Err(_) => Err(ToolError::RenderTimeout),
    }
}

/// Preview a single slide — renders to PNG.
/// If output_path is provided, saves to file and returns {"path": "..."}.
/// Otherwise returns base64-encoded data: {"base64": "..."}.
pub async fn handle_preview_slide(
    renderer_ready: &Arc<AtomicBool>,
    app_handle: &tauri::AppHandle,
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: &str,
    slide_id: &str,
    output_path: Option<&str>,
) -> Result<String, String> {
    if !renderer_ready.load(Ordering::Relaxed) {
        return Err(ToolError::RenderNotReady.to_string());
    }

    let file_path = Path::new(path);
    let data = file_service.read(file_path).map_err(|e| e.to_string())?;
    let content = slide_service
        .get_content(&data, slide_id)
        .map_err(|e| e.to_string())?;

    let result = render_slide(app_handle, &content, output_path)
        .await
        .map_err(|e| e.to_string())?;

    if output_path.is_some() {
        Ok(serde_json::json!({ "path": result }).to_string())
    } else {
        Ok(serde_json::json!({ "base64": result }).to_string())
    }
}

/// Preview all slides — renders each to PNG.
/// If output_dir is provided, saves files there and returns paths.
/// Otherwise returns base64-encoded data: {"previews": [{"slide_id": "...", "base64": "..."}]}.
pub async fn handle_preview_presentation(
    renderer_ready: &Arc<AtomicBool>,
    app_handle: &tauri::AppHandle,
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: &str,
    output_dir: Option<&str>,
) -> Result<String, String> {
    if !renderer_ready.load(Ordering::Relaxed) {
        return Err(ToolError::RenderNotReady.to_string());
    }

    let file_path = Path::new(path);
    let data = file_service.read(file_path).map_err(|e| e.to_string())?;

    // If output_dir is provided, create it
    if let Some(dir) = output_dir {
        std::fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    let mut previews = Vec::new();
    for slide in &data.slides {
        let content = slide_service
            .get_content(&data, &slide.id)
            .map_err(|e| e.to_string())?;

        let output_path = output_dir.map(|dir| {
            Path::new(dir).join(format!("slide-{}.png", slide.id)).to_string_lossy().to_string()
        });

        let result = render_slide(app_handle, &content, output_path.as_deref())
            .await
            .map_err(|e| e.to_string())?;

        if output_dir.is_some() {
            previews.push(serde_json::json!({
                "slide_id": slide.id,
                "path": result,
            }));
        } else {
            previews.push(serde_json::json!({
                "slide_id": slide.id,
                "base64": result,
            }));
        }
    }

    Ok(serde_json::json!({ "previews": previews }).to_string())
}
