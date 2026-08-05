use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[cfg(test)]
use std::sync::{Mutex, OnceLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub modified: String,
    pub opened_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentWorkspace {
    pub path: String,
    pub name: String,
    pub opened_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UserConfig {
    #[serde(default)]
    pub recent_files: Vec<RecentFile>,
    #[serde(default)]
    pub recent_workspaces: Vec<RecentWorkspace>,
}

#[cfg(test)]
pub(crate) fn config_env_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
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
        return Ok(UserConfig::default());
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
pub fn get_recent_workspaces() -> Result<Vec<RecentWorkspace>, String> {
    let config = load_user_config()?;
    let mut workspaces = config.recent_workspaces;
    workspaces.retain(|workspace| {
        fs::symlink_metadata(&workspace.path)
            .map(|metadata| metadata.is_dir() && !metadata.file_type().is_symlink())
            .unwrap_or(false)
    });
    Ok(workspaces)
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

    let mut config = load_user_config().unwrap_or_default();

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

pub fn add_recent_workspace(path: String) -> Result<(), String> {
    let workspace_path = PathBuf::from(&path);
    let metadata = fs::symlink_metadata(&workspace_path)
        .map_err(|error| format!("Failed to read Workspace metadata: {error}"))?;
    if metadata.file_type().is_symlink() {
        return Err("Workspace root cannot be a Symlink".to_string());
    }
    if !metadata.is_dir() {
        return Err("Workspace root must be a directory".to_string());
    }

    let canonical_path = workspace_path
        .canonicalize()
        .map_err(|error| format!("Failed to resolve Workspace root: {error}"))?;
    let path = canonical_path.to_string_lossy().to_string();
    let name = canonical_path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    let opened_at = chrono::Utc::now().to_rfc3339();

    let mut config = load_user_config().unwrap_or_default();
    config
        .recent_workspaces
        .retain(|workspace| workspace.path != path);
    config.recent_workspaces.insert(
        0,
        RecentWorkspace {
            path,
            name,
            opened_at,
        },
    );
    config.recent_workspaces.truncate(20);

    save_user_config(&config)
}

#[command]
pub fn remove_recent_file(path: String) -> Result<(), String> {
    let mut config = load_user_config()?;
    config.recent_files.retain(|f| f.path != path);
    save_user_config(&config)
}

#[command]
pub fn remove_recent_workspace(path: String) -> Result<(), String> {
    let mut config = load_user_config()?;
    config
        .recent_workspaces
        .retain(|workspace| workspace.path != path);
    save_user_config(&config)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands;
    use crate::document_formats;
    use chrono::Utc;
    use std::time::Duration;
    use tempfile::TempDir;

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

        document_formats::create_file(&scene_path).unwrap();

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

    #[test]
    fn legacy_config_defaults_recent_workspaces_without_losing_recent_files() {
        let _guard = config_env_lock().lock().unwrap();
        let config_dir = TempDir::new().unwrap();
        let app_dir = config_dir.path().join("ideaslide");
        fs::create_dir_all(&app_dir).unwrap();
        fs::write(
            app_dir.join("user.json"),
            r#"{"recent_files":[{"path":"/tmp/legacy.is","name":"legacy.is","modified":"","opened_at":""}]}"#,
        )
        .unwrap();
        std::env::set_var("IDEASLIDE_CONFIG_DIR", config_dir.path());

        let config = load_user_config().unwrap();
        assert_eq!(config.recent_files.len(), 1);
        assert!(config.recent_workspaces.is_empty());

        std::env::remove_var("IDEASLIDE_CONFIG_DIR");
    }

    #[test]
    fn recent_workspace_entries_dedupe_refresh_filter_and_remove() {
        let _guard = config_env_lock().lock().unwrap();
        let config_dir = TempDir::new().unwrap();
        let workspace_dir = TempDir::new().unwrap();
        let non_directory = workspace_dir.path().join("not-a-workspace");
        fs::write(&non_directory, b"file").unwrap();
        std::env::set_var("IDEASLIDE_CONFIG_DIR", config_dir.path());

        let non_canonical = workspace_dir.path().join(".").to_string_lossy().to_string();
        add_recent_workspace(non_canonical).unwrap();
        let initial_opened_at = get_recent_workspaces().unwrap()[0].opened_at.clone();
        std::thread::sleep(Duration::from_millis(10));
        add_recent_workspace(workspace_dir.path().to_string_lossy().to_string()).unwrap();

        let workspaces = get_recent_workspaces().unwrap();
        assert_eq!(workspaces.len(), 1);
        assert_eq!(
            workspaces[0].path,
            workspace_dir
                .path()
                .canonicalize()
                .unwrap()
                .to_string_lossy()
        );
        assert_ne!(workspaces[0].opened_at, initial_opened_at);

        let mut config = load_user_config().unwrap();
        config.recent_workspaces.push(RecentWorkspace {
            path: non_directory.to_string_lossy().to_string(),
            name: "not-a-workspace".to_string(),
            opened_at: Utc::now().to_rfc3339(),
        });
        save_user_config(&config).unwrap();
        assert_eq!(get_recent_workspaces().unwrap().len(), 1);

        remove_recent_workspace(workspaces[0].path.clone()).unwrap();
        assert!(get_recent_workspaces().unwrap().is_empty());

        std::env::remove_var("IDEASLIDE_CONFIG_DIR");
    }

    #[test]
    fn recent_workspaces_keep_only_the_twenty_newest_directories() {
        let _guard = config_env_lock().lock().unwrap();
        let config_dir = TempDir::new().unwrap();
        let workspace_parent = TempDir::new().unwrap();
        std::env::set_var("IDEASLIDE_CONFIG_DIR", config_dir.path());

        for index in 0..21 {
            let workspace = workspace_parent
                .path()
                .join(format!("workspace-{index:02}"));
            fs::create_dir(&workspace).unwrap();
            add_recent_workspace(workspace.to_string_lossy().to_string()).unwrap();
        }

        let workspaces = get_recent_workspaces().unwrap();
        assert_eq!(workspaces.len(), 20);
        assert_eq!(workspaces[0].name, "workspace-20");
        assert_eq!(workspaces[19].name, "workspace-01");

        std::env::remove_var("IDEASLIDE_CONFIG_DIR");
    }

    #[test]
    fn open_workspace_refreshes_history_only_after_success() {
        let _guard = config_env_lock().lock().unwrap();
        let config_dir = TempDir::new().unwrap();
        let workspace_dir = TempDir::new().unwrap();
        std::env::set_var("IDEASLIDE_CONFIG_DIR", config_dir.path());

        let root = workspace_dir.path().to_string_lossy().to_string();
        let opened = commands::open_workspace(root.clone()).unwrap();
        assert_eq!(get_recent_workspaces().unwrap()[0].path, opened.root);
        let initial_opened_at = get_recent_workspaces().unwrap()[0].opened_at.clone();
        std::thread::sleep(Duration::from_millis(10));
        commands::open_workspace(root).unwrap();
        assert_ne!(
            get_recent_workspaces().unwrap()[0].opened_at,
            initial_opened_at
        );

        assert!(commands::open_workspace(
            workspace_dir
                .path()
                .join("missing")
                .to_string_lossy()
                .to_string()
        )
        .is_err());
        assert_eq!(get_recent_workspaces().unwrap().len(), 1);

        std::env::remove_var("IDEASLIDE_CONFIG_DIR");
    }

    #[test]
    fn recent_workspace_write_failure_does_not_block_workspace_open() {
        let _guard = config_env_lock().lock().unwrap();
        let config_parent = TempDir::new().unwrap();
        let invalid_config_dir = config_parent.path().join("not-a-directory");
        fs::write(&invalid_config_dir, b"file").unwrap();
        let workspace_dir = TempDir::new().unwrap();
        std::env::set_var("IDEASLIDE_CONFIG_DIR", &invalid_config_dir);

        let result = commands::open_workspace(workspace_dir.path().to_string_lossy().to_string());
        assert!(result.is_ok());

        std::env::remove_var("IDEASLIDE_CONFIG_DIR");
    }
}
