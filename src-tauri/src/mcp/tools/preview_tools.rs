use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use crate::mcp::error::ToolError;

/// Preview a single slide (stub).
pub fn handle_preview_slide(
    renderer_ready: &Arc<AtomicBool>,
    _path: &str,
    _slide_id: &str,
) -> Result<String, String> {
    if !renderer_ready.load(std::sync::atomic::Ordering::Relaxed) {
        return Err(ToolError::RenderNotReady.to_string());
    }
    Err("Preview slide is not yet implemented".to_string())
}

/// Preview all slides in a presentation (stub).
pub fn handle_preview_presentation(
    renderer_ready: &Arc<AtomicBool>,
    _path: &str,
) -> Result<String, String> {
    if !renderer_ready.load(std::sync::atomic::Ordering::Relaxed) {
        return Err(ToolError::RenderNotReady.to_string());
    }
    Err("Preview presentation is not yet implemented".to_string())
}
