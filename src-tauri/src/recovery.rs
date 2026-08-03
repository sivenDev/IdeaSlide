use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

pub const RECOVERY_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryDraft {
    pub schema_version: u32,
    pub source_path: String,
    pub source_modified: Option<String>,
    pub timestamp: String,
    pub model: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StandaloneRecoveryRecord {
    pub key: String,
    pub draft: RecoveryDraft,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "lowercase")]
pub enum RecoveryScope {
    Workspace {
        root: String,
        path: String,
    },
    Standalone {
        path: String,
        #[serde(rename = "sessionId")]
        session_id: String,
    },
}

fn key_for(value: &str) -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}.json")
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Recovery path has no parent".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Failed to create recovery directory: {error}"))?;
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, bytes).map_err(|error| format!("Failed to write recovery draft: {error}"))?;
    fs::rename(&temp, path).map_err(|error| {
        let _ = fs::remove_file(&temp);
        format!("Failed to replace recovery draft: {error}")
    })
}

fn recovery_path(app: &tauri::AppHandle, scope: &RecoveryScope) -> Result<PathBuf, String> {
    match scope {
        RecoveryScope::Workspace { root, path } => Ok(PathBuf::from(root)
            .join(".ideanote")
            .join("recovery")
            .join(key_for(path))),
        RecoveryScope::Standalone { path, session_id } => {
            let base = app
                .path()
                .app_data_dir()
                .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
            let identity = if path.is_empty() { session_id } else { path };
            Ok(base.join("recovery").join(key_for(identity)))
        }
    }
}

fn standalone_recovery_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    Ok(base.join("recovery"))
}

fn list_recovery_directory(directory: &Path) -> Result<Vec<StandaloneRecoveryRecord>, String> {
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let mut records = Vec::new();
    for entry in fs::read_dir(directory)
        .map_err(|error| format!("Failed to read recovery directory: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Failed to inspect recovery entry: {error}"))?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let Ok(bytes) = fs::read(&path) else {
            continue;
        };
        let Ok(draft) = serde_json::from_slice::<RecoveryDraft>(&bytes) else {
            continue;
        };
        if draft.schema_version != RECOVERY_SCHEMA_VERSION {
            continue;
        }
        let Some(key) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        records.push(StandaloneRecoveryRecord {
            key: key.to_string(),
            draft,
        });
    }
    records.sort_by(|left, right| right.draft.timestamp.cmp(&left.draft.timestamp));
    Ok(records)
}

fn valid_recovery_key(key: &str) -> bool {
    key.len() == 21
        && key.ends_with(".json")
        && key[..16].bytes().all(|byte| byte.is_ascii_hexdigit())
}

#[tauri::command]
pub fn write_recovery_draft(
    app: tauri::AppHandle,
    scope: RecoveryScope,
    mut draft: RecoveryDraft,
) -> Result<(), String> {
    draft.schema_version = RECOVERY_SCHEMA_VERSION;
    draft.timestamp = Utc::now().to_rfc3339();
    let bytes = serde_json::to_vec_pretty(&draft)
        .map_err(|error| format!("Failed to serialize recovery draft: {error}"))?;
    atomic_write(&recovery_path(&app, &scope)?, &bytes)
}

#[tauri::command]
pub fn load_recovery_draft(
    app: tauri::AppHandle,
    scope: RecoveryScope,
) -> Result<Option<RecoveryDraft>, String> {
    let path = recovery_path(&app, &scope)?;
    if !path.exists() {
        return Ok(None);
    }
    let bytes =
        fs::read(&path).map_err(|error| format!("Failed to read recovery draft: {error}"))?;
    let draft: RecoveryDraft = serde_json::from_slice(&bytes).map_err(|error| {
        format!(
            "Recovery draft is corrupt and was preserved at {}: {error}",
            path.display()
        )
    })?;
    if draft.schema_version != RECOVERY_SCHEMA_VERSION {
        return Err(format!(
            "Unsupported recovery schema {}",
            draft.schema_version
        ));
    }
    Ok(Some(draft))
}

#[tauri::command]
pub fn delete_recovery_draft(app: tauri::AppHandle, scope: RecoveryScope) -> Result<(), String> {
    let path = recovery_path(&app, &scope)?;
    if path.exists() {
        fs::remove_file(path)
            .map_err(|error| format!("Failed to delete recovery draft: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_standalone_recovery_drafts(
    app: tauri::AppHandle,
) -> Result<Vec<StandaloneRecoveryRecord>, String> {
    list_recovery_directory(&standalone_recovery_directory(&app)?)
}

#[tauri::command]
pub fn delete_standalone_recovery_draft(app: tauri::AppHandle, key: String) -> Result<(), String> {
    if !valid_recovery_key(&key) {
        return Err("Invalid recovery draft key".to_string());
    }
    let path = standalone_recovery_directory(&app)?.join(key);
    if path.exists() {
        fs::remove_file(path)
            .map_err(|error| format!("Failed to delete recovery draft: {error}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn atomic_recovery_roundtrip_is_versioned_and_corrupt_data_is_preserved() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("draft.json");
        let draft = RecoveryDraft {
            schema_version: RECOVERY_SCHEMA_VERSION,
            source_path: "drawing.is".to_string(),
            source_modified: None,
            timestamp: Utc::now().to_rfc3339(),
            model: serde_json::json!({"type":"ideasketch"}),
        };
        atomic_write(&path, &serde_json::to_vec(&draft).unwrap()).unwrap();
        let loaded: RecoveryDraft = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(loaded, draft);
        fs::write(&path, b"not-json").unwrap();
        assert!(serde_json::from_slice::<RecoveryDraft>(&fs::read(&path).unwrap()).is_err());
        assert!(path.exists());
    }

    #[test]
    fn workspace_keys_are_stable_and_do_not_expose_relative_paths() {
        assert_eq!(key_for("folder/drawing.is"), key_for("folder/drawing.is"));
        assert!(!key_for("folder/drawing.is").contains("drawing"));
    }

    #[test]
    fn standalone_recovery_listing_is_newest_first_and_preserves_corrupt_files() {
        let dir = TempDir::new().unwrap();
        let older = RecoveryDraft {
            schema_version: RECOVERY_SCHEMA_VERSION,
            source_path: String::new(),
            source_modified: None,
            timestamp: "2026-01-01T00:00:00Z".to_string(),
            model: serde_json::json!({"type":"ideasketch"}),
        };
        let newer = RecoveryDraft {
            timestamp: "2026-02-01T00:00:00Z".to_string(),
            ..older.clone()
        };
        fs::write(
            dir.path().join("0000000000000001.json"),
            serde_json::to_vec(&older).unwrap(),
        )
        .unwrap();
        fs::write(
            dir.path().join("0000000000000002.json"),
            serde_json::to_vec(&newer).unwrap(),
        )
        .unwrap();
        fs::write(dir.path().join("0000000000000003.json"), b"corrupt").unwrap();

        let records = list_recovery_directory(dir.path()).unwrap();
        assert_eq!(records.len(), 2);
        assert_eq!(records[0].draft.timestamp, newer.timestamp);
        assert!(dir.path().join("0000000000000003.json").exists());
        assert!(valid_recovery_key("0000000000000001.json"));
        assert!(!valid_recovery_key("../outside.json"));
    }

    #[test]
    fn standalone_scope_accepts_frontend_camel_case_session_id() {
        let scope: RecoveryScope = serde_json::from_value(serde_json::json!({
            "mode": "standalone",
            "path": "",
            "sessionId": "draft-session"
        }))
        .unwrap();

        assert!(matches!(
            scope,
            RecoveryScope::Standalone { path, session_id }
                if path.is_empty() && session_id == "draft-session"
        ));
    }
}
