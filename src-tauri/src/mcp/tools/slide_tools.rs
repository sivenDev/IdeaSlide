use std::path::Path;
use std::sync::Arc;

use crate::mcp::services::file_service::FileService;
use crate::mcp::services::slide_service::SlideService;

/// List all slides in a presentation.
pub fn handle_list_slides(
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: &str,
) -> Result<String, String> {
    let p = Path::new(path);
    let data = file_service.read(p).map_err(|e| e.to_string())?;
    let slides = slide_service.list(&data);
    serde_json::to_string_pretty(&slides).map_err(|e| e.to_string())
}

/// Add a new slide to the presentation.
pub fn handle_add_slide(
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: &str,
    index: Option<usize>,
    content: Option<String>,
) -> Result<String, String> {
    let p = Path::new(path);
    let parsed_content = match content {
        Some(c) => Some(
            serde_json::from_str::<serde_json::Value>(&c)
                .map_err(|e| format!("Invalid JSON content: {}", e))?,
        ),
        None => None,
    };

    let mut new_id = String::new();
    file_service
        .read_and_modify(p, |data| {
            new_id = slide_service.add(data, index, parsed_content.clone())?;
            Ok(())
        })
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "slide_id": new_id }).to_string())
}

/// Delete a slide from the presentation by its ID.
pub fn handle_delete_slide(
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: &str,
    slide_id: &str,
) -> Result<String, String> {
    let p = Path::new(path);
    let sid = slide_id.to_string();
    file_service
        .read_and_modify(p, |data| {
            slide_service.delete(data, &sid)
        })
        .map_err(|e| e.to_string())?;

    Ok(format!("Slide {} deleted", slide_id))
}

/// Get the full Excalidraw JSON content of a slide.
pub fn handle_get_slide_content(
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: &str,
    slide_id: &str,
) -> Result<String, String> {
    let p = Path::new(path);
    let data = file_service.read(p).map_err(|e| e.to_string())?;
    let content = slide_service
        .get_content(&data, slide_id)
        .map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&content).map_err(|e| e.to_string())
}

/// Replace the full Excalidraw JSON content of a slide.
pub fn handle_set_slide_content(
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: &str,
    slide_id: &str,
    content: &str,
) -> Result<String, String> {
    let p = Path::new(path);
    let parsed: serde_json::Value =
        serde_json::from_str(content).map_err(|e| format!("Invalid JSON content: {}", e))?;
    let sid = slide_id.to_string();
    file_service
        .read_and_modify(p, |data| {
            slide_service.set_content(data, &sid, parsed.clone())
        })
        .map_err(|e| e.to_string())?;

    Ok(format!("Slide {} content updated", slide_id))
}

/// Reorder slides in the presentation.
pub fn handle_reorder_slides(
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: &str,
    slide_ids: &[String],
) -> Result<String, String> {
    let p = Path::new(path);
    let ids = slide_ids.to_vec();
    file_service
        .read_and_modify(p, |data| {
            slide_service.reorder(data, &ids)
        })
        .map_err(|e| e.to_string())?;

    Ok("Slides reordered".to_string())
}
