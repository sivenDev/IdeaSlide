use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub modified: String,
}

fn recent_files_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir().ok_or("Could not find config directory")?;
    let app_dir = config_dir.join("ideaslide");
    fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
    Ok(app_dir.join("recent_files.json"))
}

fn load_recent_files() -> Result<Vec<RecentFile>, String> {
    let path = recent_files_path()?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let content =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read recent files: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse recent files: {e}"))
}

fn save_recent_files(files: &[RecentFile]) -> Result<(), String> {
    let path = recent_files_path()?;
    let json = serde_json::to_string_pretty(files)
        .map_err(|e| format!("Failed to serialize recent files: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write recent files: {e}"))
}

#[command]
pub fn get_recent_files() -> Result<Vec<RecentFile>, String> {
    let mut files = load_recent_files()?;
    // Filter out files that no longer exist
    files.retain(|f| PathBuf::from(&f.path).exists());
    Ok(files)
}

#[command]
pub fn add_recent_file(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    let name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let metadata =
        fs::metadata(&file_path).map_err(|e| format!("Failed to read file metadata: {e}"))?;
    let modified = metadata
        .modified()
        .map(|t| {
            let dt: chrono::DateTime<chrono::Utc> = t.into();
            dt.to_rfc3339()
        })
        .unwrap_or_default();

    let mut files = load_recent_files().unwrap_or_default();

    // Remove existing entry for same path
    files.retain(|f| f.path != path);

    // Add to front
    files.insert(0, RecentFile {
        path,
        name,
        modified,
    });

    // Keep max 20 entries
    files.truncate(20);

    save_recent_files(&files)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recent_files_roundtrip() {
        let files = vec![RecentFile {
            path: "/tmp/test.is".to_string(),
            name: "test.is".to_string(),
            modified: "2026-03-11T00:00:00Z".to_string(),
        }];
        let json = serde_json::to_string(&files).unwrap();
        let parsed: Vec<RecentFile> = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].name, "test.is");
    }
}
