use crate::document_formats::{self, DocumentFileData, OpenDocumentResult};
use crate::workspace::{
    WorkspaceEntry, WorkspaceMutationResult, WorkspaceOpenResult, WorkspaceSaveResult,
    WorkspaceService, WorkspaceState,
};
use crate::workspace_watcher::WorkspaceWatcherState;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInspection {
    exists: bool,
    modified: Option<String>,
    read_only: bool,
    size: Option<u64>,
}

fn inspect_path(path: &std::path::Path) -> Result<FileInspection, String> {
    let metadata = match std::fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(FileInspection {
                exists: false,
                modified: None,
                read_only: false,
                size: None,
            });
        }
        Err(error) => return Err(format!("Failed to inspect file: {error}")),
    };
    let modified = metadata
        .modified()
        .ok()
        .map(|value| DateTime::<Utc>::from(value).to_rfc3339());
    Ok(FileInspection {
        exists: true,
        modified,
        read_only: metadata.permissions().readonly(),
        size: Some(metadata.len()),
    })
}

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

#[command]
pub fn inspect_file(path: String) -> Result<FileInspection, String> {
    inspect_path(PathBuf::from(path).as_path())
}

#[command]
pub fn open_workspace(root: String) -> Result<WorkspaceOpenResult, String> {
    WorkspaceService::open(PathBuf::from(root).as_path())?.open_result()
}

#[command]
pub fn scan_workspace(root: String) -> Result<Vec<WorkspaceEntry>, String> {
    WorkspaceService::open(PathBuf::from(root).as_path())?.scan()
}

#[command]
pub fn refresh_workspace(root: String) -> Result<Vec<WorkspaceEntry>, String> {
    scan_workspace(root)
}

#[command]
pub fn read_workspace_file(root: String, path: String) -> Result<Vec<u8>, String> {
    WorkspaceService::open(PathBuf::from(root).as_path())?.read_file(&path)
}

#[command]
pub fn open_workspace_document(root: String, path: String) -> Result<OpenDocumentResult, String> {
    WorkspaceService::open(PathBuf::from(root).as_path())?.open_document(&path)
}

#[command]
pub fn create_workspace_folder(
    root: String,
    parent_path: String,
    name: Option<String>,
) -> Result<WorkspaceMutationResult<WorkspaceEntry>, String> {
    WorkspaceService::open(PathBuf::from(root).as_path())?
        .create_folder(&parent_path, name.as_deref())
}

#[command]
pub fn create_workspace_document(
    root: String,
    parent_path: String,
    file_type: String,
    name: Option<String>,
) -> Result<WorkspaceMutationResult<WorkspaceEntry>, String> {
    WorkspaceService::open(PathBuf::from(root).as_path())?.create_document(
        &parent_path,
        &file_type,
        name.as_deref(),
    )
}

#[command]
pub fn rename_workspace_entry(
    root: String,
    path: String,
    new_name: String,
) -> Result<WorkspaceEntry, String> {
    WorkspaceService::open(PathBuf::from(root).as_path())?.rename_entry(&path, &new_name)
}

#[command]
pub fn move_workspace_entry(
    root: String,
    path: String,
    destination_parent_path: String,
) -> Result<WorkspaceEntry, String> {
    WorkspaceService::open(PathBuf::from(root).as_path())?
        .move_entry(&path, &destination_parent_path)
}

#[command]
pub fn trash_workspace_entry(root: String, path: String) -> Result<(), String> {
    WorkspaceService::open(PathBuf::from(root).as_path())?.trash_entry(&path)
}

#[command]
pub fn save_workspace_document(
    root: String,
    path: String,
    data: DocumentFileData,
    watcher: tauri::State<'_, WorkspaceWatcherState>,
) -> Result<WorkspaceSaveResult, String> {
    let root = PathBuf::from(root);
    watcher.with_expected_write(&root, &path, || {
        WorkspaceService::open(&root)?.save_document(&path, &data)
    })
}

#[command]
pub fn save_workspace_state(root: String, state: WorkspaceState) -> Result<(), String> {
    WorkspaceService::open(PathBuf::from(root).as_path())?.save_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn workspace_commands_open_create_and_refresh_without_hidden_metadata_entries() {
        let directory = TempDir::new().unwrap();
        let root = directory.path().to_string_lossy().to_string();
        let opened = open_workspace(root.clone()).unwrap();
        assert!(opened.entries.is_empty());
        assert!(!directory.path().join(".ideanote").exists());

        let created =
            create_workspace_document(root.clone(), String::new(), "ideasketch".to_string(), None)
                .unwrap();
        assert_eq!(created.value.path, "Untitled.is");
        let entries = refresh_workspace(root).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "Untitled.is");
    }

    #[test]
    fn workspace_commands_reject_absolute_child_paths() {
        let directory = TempDir::new().unwrap();
        let root = directory.path().to_string_lossy().to_string();
        assert!(read_workspace_file(root, "/tmp/outside".to_string()).is_err());
    }

    #[test]
    fn workspace_commands_open_supported_documents_through_the_registry() {
        let directory = TempDir::new().unwrap();
        let root = directory.path().to_string_lossy().to_string();
        create_workspace_document(
            root.clone(),
            String::new(),
            "ideasketch".to_string(),
            Some("drawing.is".to_string()),
        )
        .unwrap();
        let opened = open_workspace_document(root, "drawing.is".to_string()).unwrap();
        assert!(matches!(opened, OpenDocumentResult::Editable { .. }));
    }
}
