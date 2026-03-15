use std::path::Path;
use std::sync::Arc;

use crate::mcp::services::file_service::FileService;
use crate::mcp::services::slide_service::{SlideService, SlideInfo};

/// Create a new .is presentation file. Returns manifest JSON.
pub fn handle_create_presentation(
    file_service: &Arc<FileService>,
    path: &str,
) -> Result<String, String> {
    let fs = Arc::clone(file_service);
    let p = Path::new(path);
    let data = fs.create(p).map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&data.manifest).map_err(|e| e.to_string())
}

/// Open an existing .is presentation file. Returns manifest + slide list.
pub fn handle_open_presentation(
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: &str,
) -> Result<String, String> {
    let fs = Arc::clone(file_service);
    let ss = Arc::clone(slide_service);
    let p = Path::new(path);
    let data = fs.read(p).map_err(|e| e.to_string())?;
    let slides: Vec<SlideInfo> = ss.list(&data);
    let result = serde_json::json!({
        "manifest": data.manifest,
        "slides": slides,
    });
    serde_json::to_string_pretty(&result).map_err(|e| e.to_string())
}

/// Get metadata (manifest) of a presentation without loading slide contents.
pub fn handle_get_presentation_info(
    file_service: &Arc<FileService>,
    path: &str,
) -> Result<String, String> {
    let fs = Arc::clone(file_service);
    let p = Path::new(path);
    let data = fs.read(p).map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&data.manifest).map_err(|e| e.to_string())
}
