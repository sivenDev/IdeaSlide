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
    let config_dir = std::env::var_os("IDEASLIDE_CONFIG_DIR")
        .map(PathBuf::from)
        .or_else(dirs::config_dir)
        .ok_or("Could not find config directory")?;
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
    use crate::commands;
    use crate::file_format;
    use std::sync::{Mutex, OnceLock};
    use std::time::Duration;
    use tempfile::TempDir;

    fn config_env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

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

    #[test]
    fn test_open_file_refreshes_recent_file_timestamp() {
        let _guard = config_env_lock().lock().unwrap();
        let config_dir = TempDir::new().unwrap();
        let scene_dir = TempDir::new().unwrap();
        let scene_path = scene_dir.path().join("recent-refresh.is");

        std::env::set_var("IDEASLIDE_CONFIG_DIR", config_dir.path());

        file_format::create_is_file(&scene_path).unwrap();

        let scene_path_string = scene_path.to_string_lossy().to_string();
        add_recent_file(scene_path_string.clone()).unwrap();
        let initial_opened_at = get_recent_files().unwrap()[0].opened_at.clone();

        std::thread::sleep(Duration::from_millis(10));

        commands::open_file(scene_path_string.clone()).unwrap();

        let recent_files = get_recent_files().unwrap();
        assert_eq!(recent_files.len(), 1);
        assert_eq!(recent_files[0].path, scene_path_string);
        assert_ne!(recent_files[0].opened_at, initial_opened_at);

        std::env::remove_var("IDEASLIDE_CONFIG_DIR");
    }
}
