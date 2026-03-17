use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub modified: String,
    pub opened_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserConfig {
    pub recent_files: Vec<RecentFile>,
}

fn user_config_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir().ok_or("Could not find config directory")?;
    let app_dir = config_dir.join("ideaslide");
    fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
    Ok(app_dir.join("user.json"))
}

fn load_user_config() -> Result<UserConfig, String> {
    let path = user_config_path()?;
    if !path.exists() {
        return Ok(UserConfig {
            recent_files: vec![],
        });
    }
    let content =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read user config: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse user config: {e}"))
}

fn save_user_config(config: &UserConfig) -> Result<(), String> {
    let path = user_config_path()?;
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize user config: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write user config: {e}"))
}

#[command]
pub fn get_recent_files() -> Result<Vec<RecentFile>, String> {
    let config = load_user_config()?;
    let mut files = config.recent_files;
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

    let opened_at = chrono::Utc::now().to_rfc3339();

    let mut config = load_user_config().unwrap_or_else(|_| UserConfig {
        recent_files: vec![],
    });

    // Remove existing entry for same path
    config.recent_files.retain(|f| f.path != path);

    // Add to front
    config.recent_files.insert(
        0,
        RecentFile {
            path,
            name,
            modified,
            opened_at,
        },
    );

    // Keep max 20 entries
    config.recent_files.truncate(20);

    save_user_config(&config)
}

#[command]
pub fn remove_recent_file(path: String) -> Result<(), String> {
    let mut config = load_user_config()?;
    config.recent_files.retain(|f| f.path != path);
    save_user_config(&config)
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
            opened_at: String::new(),
        }];
        let json = serde_json::to_string(&files).unwrap();
        let parsed: Vec<RecentFile> = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].name, "test.is");
    }
}
