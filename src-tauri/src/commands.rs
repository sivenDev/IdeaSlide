use crate::document_formats::{self, DocumentFileData, OpenDocumentResult};
use std::path::PathBuf;
use tauri::command;

#[command]
pub fn create_file(path: String) -> Result<DocumentFileData, String> {
    let path = PathBuf::from(&path);
    document_formats::create_file(&path)
}

#[command]
pub fn open_file(path: String) -> Result<OpenDocumentResult, String> {
    let path = PathBuf::from(&path);
    let result = document_formats::open_file(&path)?;

    // Opening a file should always refresh its recent-file timestamp, but a
    // failure to write user config must not block the actual file open.
    if let Err(err) = crate::recent_files::add_recent_file(path.to_string_lossy().to_string()) {
        eprintln!("[IdeaSlide] Failed to refresh recent file entry after open: {err}");
    }

    Ok(result)
}

#[command]
pub fn save_file(path: String, data: DocumentFileData) -> Result<(), String> {
    let path = PathBuf::from(&path);

    document_formats::write_file(&path, &data)
}

#[command]
pub fn write_file_bytes(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, &data).map_err(|e| format!("Failed to write file: {e}"))
}
