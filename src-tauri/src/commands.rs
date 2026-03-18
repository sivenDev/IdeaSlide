use crate::file_format::{self, IsFileData};
use std::path::PathBuf;
use tauri::command;

#[command]
pub fn create_file(path: String) -> Result<IsFileData, String> {
    let path = PathBuf::from(&path);
    file_format::create_is_file(&path)
}

#[command]
pub fn open_file(path: String) -> Result<IsFileData, String> {
    let path = PathBuf::from(&path);
    let data = file_format::read_is_file(&path)?;

    // Opening a file should always refresh its recent-file timestamp, but a
    // failure to write user config must not block the actual file open.
    if let Err(err) = crate::recent_files::add_recent_file(path.to_string_lossy().to_string()) {
        eprintln!("[IdeaSlide] Failed to refresh recent file entry after open: {err}");
    }

    Ok(data)
}

#[command]
pub fn save_file(path: String, data: IsFileData) -> Result<(), String> {
    let path = PathBuf::from(&path);

    // Update modified timestamp
    let mut data = data;
    data.manifest.modified = chrono::Utc::now().to_rfc3339();

    file_format::write_is_file(&path, &data)
}

#[command]
pub fn write_file_bytes(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, &data).map_err(|e| format!("Failed to write file: {e}"))
}
