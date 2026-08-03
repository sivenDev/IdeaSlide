use crate::document_formats::{self, DocumentFileData};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::ffi::OsStr;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Component, Path, PathBuf};

pub const WORKSPACE_SCHEMA_VERSION: u32 = 1;
pub const METADATA_DIRECTORY_NAME: &str = ".ideanote";
const WORKSPACE_CONFIG_NAME: &str = "workspace.json";
const WORKSPACE_STATE_NAME: &str = "state.json";
const METADATA_GITIGNORE_NAME: &str = ".gitignore";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WorkspaceEntryKind {
    File,
    Directory,
    Symlink,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntry {
    pub path: String,
    pub name: String,
    pub kind: WorkspaceEntryKind,
    pub size: Option<u64>,
    pub modified: Option<String>,
    pub read_only: bool,
    pub file_type: Option<String>,
    pub children: Vec<WorkspaceEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceConfig {
    pub schema_version: u32,
    pub workspace_id: String,
    pub created: String,
    pub modified: String,
    #[serde(default)]
    pub settings: BTreeMap<String, serde_json::Value>,
}

impl WorkspaceConfig {
    fn new() -> Self {
        let now = Utc::now().to_rfc3339();
        Self {
            schema_version: WORKSPACE_SCHEMA_VERSION,
            workspace_id: uuid::Uuid::new_v4().to_string(),
            created: now.clone(),
            modified: now,
            settings: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceState {
    pub schema_version: u32,
    #[serde(default)]
    pub open_tabs: Vec<String>,
    pub active_path: Option<String>,
    #[serde(default)]
    pub expanded_paths: Vec<String>,
}

impl Default for WorkspaceState {
    fn default() -> Self {
        Self {
            schema_version: WORKSPACE_SCHEMA_VERSION,
            open_tabs: Vec::new(),
            active_path: None,
            expanded_paths: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceMetadataSnapshot {
    pub exists: bool,
    pub workspace: Option<WorkspaceConfig>,
    pub state: Option<WorkspaceState>,
    pub diagnostics: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceOpenResult {
    pub root: String,
    pub name: String,
    pub read_only: bool,
    pub entries: Vec<WorkspaceEntry>,
    pub metadata: WorkspaceMetadataSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceMutationResult<T> {
    pub value: T,
    pub metadata_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSaveResult {
    pub saved: bool,
    pub metadata_error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct WorkspaceService {
    root: PathBuf,
    read_only: bool,
}

impl WorkspaceService {
    pub fn open(root: &Path) -> Result<Self, String> {
        let root_metadata = fs::symlink_metadata(root)
            .map_err(|error| format!("Failed to inspect Workspace root: {error}"))?;
        if root_metadata.file_type().is_symlink() {
            return Err("Workspace root cannot be a Symlink".to_string());
        }
        if !root_metadata.is_dir() {
            return Err("Workspace root must be a directory".to_string());
        }
        fs::read_dir(root).map_err(|error| format!("Workspace root is not readable: {error}"))?;
        let root = root
            .canonicalize()
            .map_err(|error| format!("Failed to resolve Workspace root: {error}"))?;
        let read_only = path_is_read_only(&root_metadata);
        Ok(Self { root, read_only })
    }

    pub fn open_result(&self) -> Result<WorkspaceOpenResult, String> {
        let name = self
            .root
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| self.root.to_string_lossy().to_string());
        Ok(WorkspaceOpenResult {
            root: self.root.to_string_lossy().to_string(),
            name,
            read_only: self.read_only,
            entries: self.scan()?,
            metadata: self.load_metadata(),
        })
    }

    pub fn scan(&self) -> Result<Vec<WorkspaceEntry>, String> {
        self.scan_directory(&self.root, Path::new(""))
    }

    pub fn read_file(&self, relative_path: &str) -> Result<Vec<u8>, String> {
        let path = self.resolve_existing(relative_path)?;
        let metadata = fs::metadata(&path)
            .map_err(|error| format!("Failed to inspect Workspace file: {error}"))?;
        if !metadata.is_file() {
            return Err("Workspace path is not a file".to_string());
        }
        fs::read(path).map_err(|error| format!("Failed to read Workspace file: {error}"))
    }

    pub fn create_folder(
        &self,
        parent_path: &str,
        preferred_name: Option<&str>,
    ) -> Result<WorkspaceMutationResult<WorkspaceEntry>, String> {
        let parent = self.resolve_directory(parent_path)?;
        self.require_writable(&parent)?;
        let name = match preferred_name {
            Some(name) => validate_entry_name(name)?.to_string(),
            None => self.unique_child_name(&parent, "New Folder", "")?,
        };
        let path = parent.join(&name);
        if path.exists() {
            return Err(format!("Workspace entry already exists: {name}"));
        }
        fs::create_dir(&path).map_err(|error| format!("Failed to create Folder: {error}"))?;
        Ok(WorkspaceMutationResult {
            value: self.entry_for_path(&path)?,
            metadata_error: None,
        })
    }

    pub fn create_document(
        &self,
        parent_path: &str,
        file_type: &str,
        preferred_name: Option<&str>,
    ) -> Result<WorkspaceMutationResult<WorkspaceEntry>, String> {
        let definition = document_formats::definition_for_type(file_type)
            .ok_or_else(|| format!("Unsupported file type: {file_type}"))?;
        let extension = definition
            .extensions
            .first()
            .ok_or_else(|| format!("File type {} has no extension", definition.type_id))?;
        let parent = self.resolve_directory(parent_path)?;
        self.require_writable(&parent)?;

        let name = match preferred_name {
            Some(name) => normalize_document_name(name, extension)?,
            None => self.unique_child_name(&parent, "Untitled", &format!(".{extension}"))?,
        };
        let path = parent.join(&name);
        if path.exists() {
            return Err(format!("Workspace entry already exists: {name}"));
        }

        document_formats::create_file(&path)?;
        let entry = self.entry_for_path(&path)?;
        let metadata_error = self.ensure_metadata().err();
        Ok(WorkspaceMutationResult {
            value: entry,
            metadata_error,
        })
    }

    pub fn rename_entry(
        &self,
        relative_path: &str,
        new_name: &str,
    ) -> Result<WorkspaceEntry, String> {
        let normalized = normalize_relative_path(relative_path, false)?;
        let source = self.resolve_existing_path(&normalized)?;
        self.require_writable(&source)?;
        let name = validate_entry_name(new_name)?;
        let parent = source
            .parent()
            .ok_or_else(|| "Workspace root cannot be renamed".to_string())?;
        let destination = parent.join(name);
        if destination.exists() {
            return Err(format!("Workspace entry already exists: {new_name}"));
        }
        fs::rename(&source, &destination)
            .map_err(|error| format!("Failed to rename Workspace entry: {error}"))?;
        self.entry_for_path(&destination)
    }

    pub fn move_entry(
        &self,
        relative_path: &str,
        destination_parent_path: &str,
    ) -> Result<WorkspaceEntry, String> {
        let source_relative = normalize_relative_path(relative_path, false)?;
        let destination_parent_relative = normalize_relative_path(destination_parent_path, true)?;
        if destination_parent_relative == source_relative
            || destination_parent_relative.starts_with(&source_relative)
        {
            return Err("A Folder cannot be moved into itself or its descendant".to_string());
        }

        let source = self.resolve_existing_path(&source_relative)?;
        let destination_parent = self.resolve_directory_path(&destination_parent_relative)?;
        self.require_writable(&source)?;
        self.require_writable(&destination_parent)?;
        let name = source
            .file_name()
            .ok_or_else(|| "Workspace root cannot be moved".to_string())?;
        let destination = destination_parent.join(name);
        if destination.exists() {
            return Err(format!(
                "Workspace entry already exists at destination: {}",
                name.to_string_lossy()
            ));
        }
        fs::rename(&source, &destination)
            .map_err(|error| format!("Failed to move Workspace entry: {error}"))?;
        self.entry_for_path(&destination)
    }

    pub fn trash_entry(&self, relative_path: &str) -> Result<(), String> {
        self.trash_entry_with(relative_path, |path| {
            trash::delete(path).map_err(|error| error.to_string())
        })
    }

    fn trash_entry_with<F>(&self, relative_path: &str, delete: F) -> Result<(), String>
    where
        F: FnOnce(&Path) -> Result<(), String>,
    {
        let normalized = normalize_relative_path(relative_path, false)?;
        let source = self.resolve_existing_path(&normalized)?;
        self.require_writable(&source)?;
        delete(&source).map_err(|error| format!("Failed to move entry to Trash: {error}"))
    }

    pub fn save_document(
        &self,
        relative_path: &str,
        data: &DocumentFileData,
    ) -> Result<WorkspaceSaveResult, String> {
        let path = self.resolve_existing(relative_path)?;
        self.require_writable(&path)?;
        if !path.is_file() {
            return Err("Workspace path is not a file".to_string());
        }
        document_formats::write_file(&path, data)?;
        Ok(WorkspaceSaveResult {
            saved: true,
            metadata_error: self.ensure_metadata().err(),
        })
    }

    pub fn save_state(&self, mut state: WorkspaceState) -> Result<(), String> {
        self.validate_state_paths(&state)?;
        state.schema_version = WORKSPACE_SCHEMA_VERSION;
        self.ensure_metadata()?;
        let metadata_directory = self.root.join(METADATA_DIRECTORY_NAME);
        atomic_write_json(&metadata_directory.join(WORKSPACE_STATE_NAME), &state)?;
        self.touch_workspace_config(&metadata_directory)
    }

    pub fn load_metadata(&self) -> WorkspaceMetadataSnapshot {
        let directory = self.root.join(METADATA_DIRECTORY_NAME);
        if !directory.exists() {
            return WorkspaceMetadataSnapshot::default();
        }

        let mut snapshot = WorkspaceMetadataSnapshot {
            exists: true,
            ..WorkspaceMetadataSnapshot::default()
        };
        let Ok(metadata) = fs::symlink_metadata(&directory) else {
            snapshot
                .diagnostics
                .push("Workspace metadata could not be inspected".to_string());
            return snapshot;
        };
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            snapshot
                .diagnostics
                .push(".ideanote must be a real directory".to_string());
            return snapshot;
        }

        match read_versioned_json::<WorkspaceConfig>(&directory.join(WORKSPACE_CONFIG_NAME)) {
            Ok(Some(config)) => snapshot.workspace = Some(config),
            Ok(None) => {}
            Err(error) => snapshot.diagnostics.push(error),
        }
        match read_versioned_json::<WorkspaceState>(&directory.join(WORKSPACE_STATE_NAME)) {
            Ok(Some(state)) => snapshot.state = Some(state),
            Ok(None) => {}
            Err(error) => snapshot.diagnostics.push(error),
        }
        snapshot
    }

    fn scan_directory(
        &self,
        directory: &Path,
        relative_directory: &Path,
    ) -> Result<Vec<WorkspaceEntry>, String> {
        let mut entries = Vec::new();
        let children = fs::read_dir(directory)
            .map_err(|error| format!("Failed to scan Workspace directory: {error}"))?;
        for child in children {
            let child =
                child.map_err(|error| format!("Failed to read Workspace entry: {error}"))?;
            let name = child.file_name().to_string_lossy().to_string();
            if is_internal_name(&name) {
                continue;
            }
            let relative_path = relative_directory.join(&name);
            if path_targets_internal_metadata(&relative_path) {
                continue;
            }
            let path = child.path();
            entries.push(self.entry_from_metadata(&path, &relative_path)?);
        }
        entries.sort_by(|left, right| {
            entry_kind_rank(left.kind)
                .cmp(&entry_kind_rank(right.kind))
                .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
                .then_with(|| left.name.cmp(&right.name))
        });
        Ok(entries)
    }

    fn entry_for_path(&self, path: &Path) -> Result<WorkspaceEntry, String> {
        let relative = path
            .strip_prefix(&self.root)
            .map_err(|_| "Workspace entry escaped the root".to_string())?;
        self.entry_from_metadata(path, relative)
    }

    fn entry_from_metadata(
        &self,
        path: &Path,
        relative_path: &Path,
    ) -> Result<WorkspaceEntry, String> {
        let metadata = fs::symlink_metadata(path)
            .map_err(|error| format!("Failed to inspect Workspace entry: {error}"))?;
        let kind = if metadata.file_type().is_symlink() {
            WorkspaceEntryKind::Symlink
        } else if metadata.is_dir() {
            WorkspaceEntryKind::Directory
        } else {
            WorkspaceEntryKind::File
        };
        let children = if kind == WorkspaceEntryKind::Directory {
            self.scan_directory(path, relative_path)?
        } else {
            Vec::new()
        };
        let file_type = if kind == WorkspaceEntryKind::File {
            document_formats::definition_for_path(path)
                .map(|definition| definition.type_id.to_string())
        } else {
            None
        };
        Ok(WorkspaceEntry {
            path: relative_path_to_string(relative_path),
            name: path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_default(),
            kind,
            size: (kind == WorkspaceEntryKind::File).then_some(metadata.len()),
            modified: metadata
                .modified()
                .ok()
                .map(|modified| chrono::DateTime::<Utc>::from(modified).to_rfc3339()),
            read_only: self.read_only || path_is_read_only(&metadata),
            file_type,
            children,
        })
    }

    fn resolve_existing(&self, relative_path: &str) -> Result<PathBuf, String> {
        let relative = normalize_relative_path(relative_path, false)?;
        self.resolve_existing_path(&relative)
    }

    fn resolve_directory(&self, relative_path: &str) -> Result<PathBuf, String> {
        let relative = normalize_relative_path(relative_path, true)?;
        self.resolve_directory_path(&relative)
    }

    fn resolve_directory_path(&self, relative_path: &Path) -> Result<PathBuf, String> {
        let path = self.resolve_existing_path(relative_path)?;
        if !path.is_dir() {
            return Err("Workspace parent path must be a directory".to_string());
        }
        Ok(path)
    }

    fn resolve_existing_path(&self, relative_path: &Path) -> Result<PathBuf, String> {
        let mut current = self.root.clone();
        for component in relative_path.components() {
            let Component::Normal(name) = component else {
                return Err("Workspace path must be relative and normalized".to_string());
            };
            current.push(name);
            let metadata = fs::symlink_metadata(&current)
                .map_err(|error| format!("Workspace path does not exist: {error}"))?;
            if metadata.file_type().is_symlink() {
                return Err(format!(
                    "Workspace path cannot traverse a Symlink: {}",
                    relative_path_to_string(relative_path)
                ));
            }
        }
        let resolved = current
            .canonicalize()
            .map_err(|error| format!("Failed to resolve Workspace path: {error}"))?;
        if !resolved.starts_with(&self.root) {
            return Err("Workspace path escaped the root".to_string());
        }
        Ok(resolved)
    }

    fn require_writable(&self, path: &Path) -> Result<(), String> {
        if self.read_only {
            return Err("Workspace is read-only".to_string());
        }
        let metadata = fs::metadata(path)
            .map_err(|error| format!("Failed to inspect Workspace permissions: {error}"))?;
        let permission_target = if metadata.is_dir() {
            path.to_path_buf()
        } else {
            path.parent().unwrap_or(&self.root).to_path_buf()
        };
        let permissions = fs::metadata(&permission_target)
            .map_err(|error| format!("Failed to inspect Workspace permissions: {error}"))?;
        if path_is_read_only(&permissions) {
            return Err("Workspace path is read-only".to_string());
        }
        Ok(())
    }

    fn unique_child_name(&self, parent: &Path, stem: &str, suffix: &str) -> Result<String, String> {
        for index in 1..=10_000usize {
            let name = if index == 1 {
                format!("{stem}{suffix}")
            } else {
                format!("{stem} {index}{suffix}")
            };
            if !parent.join(&name).exists() {
                return Ok(name);
            }
        }
        Err(format!("Could not find an available name for {stem}"))
    }

    fn ensure_metadata(&self) -> Result<(), String> {
        if self.read_only {
            return Err("Workspace is read-only; metadata was not created".to_string());
        }
        let directory = self.root.join(METADATA_DIRECTORY_NAME);
        if directory.exists() {
            let metadata = fs::symlink_metadata(&directory)
                .map_err(|error| format!("Failed to inspect .ideanote: {error}"))?;
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                return Err(".ideanote must be a real directory".to_string());
            }
        } else {
            fs::create_dir(&directory)
                .map_err(|error| format!("Failed to create .ideanote: {error}"))?;
        }

        let config_path = directory.join(WORKSPACE_CONFIG_NAME);
        let mut config = match read_versioned_json::<WorkspaceConfig>(&config_path)? {
            Some(config) => config,
            None => WorkspaceConfig::new(),
        };
        config.modified = Utc::now().to_rfc3339();
        atomic_write_json(&config_path, &config)?;

        let state_path = directory.join(WORKSPACE_STATE_NAME);
        if state_path.exists() {
            let _ = read_versioned_json::<WorkspaceState>(&state_path)?;
        } else {
            atomic_write_json(&state_path, &WorkspaceState::default())?;
        }

        let gitignore_path = directory.join(METADATA_GITIGNORE_NAME);
        if !gitignore_path.exists() {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&gitignore_path)
                .map_err(|error| format!("Failed to create .ideanote/.gitignore: {error}"))?;
            file.write_all(b"state.json\nrecovery/\ncache/\n")
                .map_err(|error| format!("Failed to write .ideanote/.gitignore: {error}"))?;
            file.sync_all()
                .map_err(|error| format!("Failed to sync .ideanote/.gitignore: {error}"))?;
        }
        Ok(())
    }

    fn touch_workspace_config(&self, directory: &Path) -> Result<(), String> {
        let path = directory.join(WORKSPACE_CONFIG_NAME);
        let mut config = read_versioned_json::<WorkspaceConfig>(&path)?
            .ok_or_else(|| "Workspace metadata is missing workspace.json".to_string())?;
        config.modified = Utc::now().to_rfc3339();
        atomic_write_json(&path, &config)
    }

    fn validate_state_paths(&self, state: &WorkspaceState) -> Result<(), String> {
        for path in &state.open_tabs {
            let _ = normalize_relative_path(path, false)?;
        }
        if let Some(path) = &state.active_path {
            let _ = normalize_relative_path(path, false)?;
        }
        for path in &state.expanded_paths {
            let _ = normalize_relative_path(path, false)?;
        }
        Ok(())
    }
}

fn entry_kind_rank(kind: WorkspaceEntryKind) -> u8 {
    match kind {
        WorkspaceEntryKind::Directory => 0,
        WorkspaceEntryKind::File => 1,
        WorkspaceEntryKind::Symlink => 2,
    }
}

fn relative_path_to_string(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(value) => Some(value.to_string_lossy()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn normalize_relative_path(input: &str, allow_empty: bool) -> Result<PathBuf, String> {
    if input.is_empty() {
        return allow_empty
            .then(PathBuf::new)
            .ok_or_else(|| "Workspace path cannot be empty".to_string());
    }
    let path = Path::new(input);
    if path.is_absolute() {
        return Err("Workspace path must be relative".to_string());
    }
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => normalized.push(value),
            Component::Prefix(_)
            | Component::RootDir
            | Component::ParentDir
            | Component::CurDir => {
                return Err("Workspace path must be relative and normalized".to_string());
            }
        }
    }
    if normalized.as_os_str().is_empty() && !allow_empty {
        return Err("Workspace path cannot be empty".to_string());
    }
    if path_targets_internal_metadata(&normalized) {
        return Err("Workspace internal metadata cannot be accessed".to_string());
    }
    Ok(normalized)
}

fn validate_entry_name(name: &str) -> Result<&str, String> {
    if name.is_empty() || name == "." || name == ".." {
        return Err("Workspace entry name cannot be empty".to_string());
    }
    let path = Path::new(name);
    let mut components = path.components();
    if !matches!(components.next(), Some(Component::Normal(_))) || components.next().is_some() {
        return Err("Workspace entry name must not contain path separators".to_string());
    }
    if is_internal_name(name) {
        return Err("Workspace internal names are reserved".to_string());
    }
    Ok(name)
}

fn normalize_document_name(name: &str, extension: &str) -> Result<String, String> {
    let name = validate_entry_name(name)?;
    let path = Path::new(name);
    match path.extension().and_then(OsStr::to_str) {
        Some(current) if current.eq_ignore_ascii_case(extension) => Ok(name.to_string()),
        Some(_) => Err(format!("Expected a .{extension} file name")),
        None => Ok(format!("{name}.{extension}")),
    }
}

fn is_internal_name(name: &str) -> bool {
    name.eq_ignore_ascii_case(METADATA_DIRECTORY_NAME)
        || name.to_ascii_lowercase().ends_with(".is.tmp")
}

fn path_targets_internal_metadata(path: &Path) -> bool {
    path.components().any(|component| {
        matches!(component, Component::Normal(name) if name.to_string_lossy().eq_ignore_ascii_case(METADATA_DIRECTORY_NAME))
    }) || path
        .file_name()
        .and_then(OsStr::to_str)
        .is_some_and(is_internal_name)
}

fn read_versioned_json<T>(path: &Path) -> Result<Option<T>, String>
where
    T: for<'de> Deserialize<'de> + HasSchemaVersion,
{
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read {}: {error}", path.display()))?;
    let parsed: T = serde_json::from_str(&content)
        .map_err(|error| format!("Invalid {}: {error}", path.display()))?;
    if parsed.schema_version() != WORKSPACE_SCHEMA_VERSION {
        return Err(format!(
            "Unsupported {} schemaVersion {}; expected {}",
            path.display(),
            parsed.schema_version(),
            WORKSPACE_SCHEMA_VERSION
        ));
    }
    Ok(Some(parsed))
}

trait HasSchemaVersion {
    fn schema_version(&self) -> u32;
}

impl HasSchemaVersion for WorkspaceConfig {
    fn schema_version(&self) -> u32 {
        self.schema_version
    }
}

impl HasSchemaVersion for WorkspaceState {
    fn schema_version(&self) -> u32 {
        self.schema_version
    }
}

fn atomic_write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("Failed to serialize {}: {error}", path.display()))?;
    let file_name = path
        .file_name()
        .and_then(OsStr::to_str)
        .ok_or_else(|| "Metadata file name is invalid".to_string())?;
    let temp_path = path.with_file_name(format!("{file_name}.tmp"));
    let write_result = (|| -> Result<(), String> {
        let mut file = File::create(&temp_path)
            .map_err(|error| format!("Failed to create metadata temp file: {error}"))?;
        file.write_all(&bytes)
            .map_err(|error| format!("Failed to write metadata temp file: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("Failed to sync metadata temp file: {error}"))?;
        fs::rename(&temp_path, path)
            .map_err(|error| format!("Failed to atomically replace metadata file: {error}"))?;
        if let Some(parent) = path.parent() {
            if let Ok(directory) = File::open(parent) {
                let _ = directory.sync_all();
            }
        }
        Ok(())
    })();
    if write_result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    write_result
}

#[cfg(unix)]
fn path_is_read_only(metadata: &fs::Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    metadata.permissions().mode() & 0o222 == 0
}

#[cfg(not(unix))]
fn path_is_read_only(metadata: &fs::Metadata) -> bool {
    metadata.permissions().readonly()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn open_temp_workspace() -> (TempDir, WorkspaceService) {
        let directory = TempDir::new().unwrap();
        let service = WorkspaceService::open(directory.path()).unwrap();
        (directory, service)
    }

    #[test]
    fn opening_and_scanning_are_side_effect_free_and_metadata_only() {
        let (directory, service) = open_temp_workspace();
        fs::write(directory.path().join("notes.txt"), "hello").unwrap();
        fs::write(directory.path().join("ignored.is.tmp"), "temp").unwrap();
        fs::create_dir(directory.path().join("folder")).unwrap();
        fs::write(directory.path().join("folder/drawing.is"), "not parsed").unwrap();

        let result = service.open_result().unwrap();
        assert!(!directory.path().join(METADATA_DIRECTORY_NAME).exists());
        assert_eq!(result.entries.len(), 2);
        assert_eq!(result.entries[0].kind, WorkspaceEntryKind::Directory);
        assert_eq!(
            result.entries[0].children[0].file_type.as_deref(),
            Some("ideasketch")
        );
        assert_eq!(result.entries[1].name, "notes.txt");
        assert!(!result.metadata.exists);
    }

    #[test]
    fn traversal_absolute_paths_and_internal_metadata_are_rejected() {
        let (_directory, service) = open_temp_workspace();
        for path in [
            "../outside",
            "/tmp/outside",
            ".ideanote/state.json",
            "file.is.tmp",
        ] {
            assert!(service.read_file(path).is_err(), "path should fail: {path}");
        }
    }

    #[cfg(unix)]
    #[test]
    fn symlinks_are_visible_but_never_followed() {
        use std::os::unix::fs::symlink;

        let (directory, service) = open_temp_workspace();
        let outside = TempDir::new().unwrap();
        fs::write(outside.path().join("secret.txt"), "secret").unwrap();
        symlink(outside.path(), directory.path().join("linked")).unwrap();

        let entries = service.scan().unwrap();
        assert_eq!(entries[0].kind, WorkspaceEntryKind::Symlink);
        assert!(entries[0].children.is_empty());
        assert!(service
            .read_file("linked/secret.txt")
            .unwrap_err()
            .contains("Symlink"));
    }

    #[test]
    fn corrupt_or_unknown_metadata_is_preserved_and_reported() {
        let (directory, service) = open_temp_workspace();
        let metadata = directory.path().join(METADATA_DIRECTORY_NAME);
        fs::create_dir(&metadata).unwrap();
        fs::write(metadata.join(WORKSPACE_CONFIG_NAME), "{broken").unwrap();
        fs::write(
            metadata.join(WORKSPACE_STATE_NAME),
            r#"{"schemaVersion":99,"openTabs":[],"activePath":null,"expandedPaths":[]}"#,
        )
        .unwrap();

        let before = fs::read(metadata.join(WORKSPACE_CONFIG_NAME)).unwrap();
        let snapshot = service.load_metadata();
        assert!(snapshot.exists);
        assert_eq!(snapshot.diagnostics.len(), 2);
        assert_eq!(
            fs::read(metadata.join(WORKSPACE_CONFIG_NAME)).unwrap(),
            before
        );
    }

    #[test]
    fn creating_ideasketch_is_unique_valid_v1_and_lazily_creates_metadata() {
        let (directory, service) = open_temp_workspace();
        let first = service.create_document("", "ideasketch", None).unwrap();
        let second = service.create_document("", "ideasketch", None).unwrap();

        assert_eq!(first.value.path, "Untitled.is");
        assert_eq!(second.value.path, "Untitled 2.is");
        assert!(first.metadata_error.is_none());
        assert!(directory.path().join(METADATA_DIRECTORY_NAME).is_dir());
        assert!(!directory.path().join(".gitignore").exists());
        assert!(!directory.path().join(".ideanote/recovery").exists());
        assert!(!directory.path().join(".ideanote/cache").exists());

        let opened = document_formats::read_file(&directory.path().join("Untitled.is")).unwrap();
        assert_eq!(opened.as_idea_sketch().unwrap().manifest.version, "1.0");
    }

    #[test]
    fn folder_creation_does_not_trigger_metadata_and_failed_file_creation_is_clean() {
        let (directory, service) = open_temp_workspace();
        service.create_folder("", None).unwrap();
        assert!(!directory.path().join(METADATA_DIRECTORY_NAME).exists());

        fs::write(directory.path().join("taken.is"), "existing").unwrap();
        assert!(service
            .create_document("", "ideasketch", Some("taken.is"))
            .is_err());
        assert!(!directory.path().join(METADATA_DIRECTORY_NAME).exists());
    }

    #[test]
    fn content_success_reports_metadata_failure_without_rolling_back_file() {
        let (directory, service) = open_temp_workspace();
        fs::write(directory.path().join(METADATA_DIRECTORY_NAME), "blocked").unwrap();
        let result = service
            .create_document("", "ideasketch", Some("drawing.is"))
            .unwrap();
        assert!(directory.path().join("drawing.is").is_file());
        assert!(result.metadata_error.unwrap().contains("real directory"));
    }

    #[test]
    fn first_workspace_save_triggers_metadata_after_document_success() {
        let (directory, service) = open_temp_workspace();
        let path = directory.path().join("existing.is");
        let document = document_formats::create_file(&path).unwrap();
        assert!(!directory.path().join(METADATA_DIRECTORY_NAME).exists());

        let result = service.save_document("existing.is", &document).unwrap();
        assert!(result.saved);
        assert!(result.metadata_error.is_none());
        assert!(directory.path().join(".ideanote/workspace.json").is_file());
        assert_eq!(
            document_formats::read_file(&path)
                .unwrap()
                .as_idea_sketch()
                .unwrap()
                .manifest
                .version,
            "1.0"
        );
    }

    #[test]
    fn rename_move_and_collision_rules_stay_inside_root() {
        let (directory, service) = open_temp_workspace();
        fs::create_dir(directory.path().join("a")).unwrap();
        fs::create_dir(directory.path().join("b")).unwrap();
        fs::write(directory.path().join("a/note.txt"), "note").unwrap();
        fs::write(directory.path().join("b/note.txt"), "collision").unwrap();

        assert!(service.move_entry("a/note.txt", "b").is_err());
        let renamed = service.rename_entry("a/note.txt", "renamed.txt").unwrap();
        assert_eq!(renamed.path, "a/renamed.txt");
        let moved = service.move_entry("a/renamed.txt", "b").unwrap();
        assert_eq!(moved.path, "b/renamed.txt");
        assert!(service.move_entry("b", "b/child").is_err());
    }

    #[test]
    fn trash_failure_is_non_destructive() {
        let (directory, service) = open_temp_workspace();
        fs::write(directory.path().join("keep.txt"), "keep").unwrap();
        let result = service.trash_entry_with("keep.txt", |_path| Err("denied".to_string()));
        assert!(result.unwrap_err().contains("denied"));
        assert!(directory.path().join("keep.txt").exists());
    }

    #[test]
    fn state_write_is_versioned_atomic_and_does_not_touch_root_gitignore() {
        let (directory, service) = open_temp_workspace();
        fs::write(directory.path().join(".gitignore"), "user-rule\n").unwrap();
        service
            .save_state(WorkspaceState {
                schema_version: 42,
                open_tabs: vec!["drawing.is".to_string()],
                active_path: Some("drawing.is".to_string()),
                expanded_paths: vec!["folder".to_string()],
            })
            .unwrap();

        let state: WorkspaceState = serde_json::from_slice(
            &fs::read(directory.path().join(".ideanote/state.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(state.schema_version, WORKSPACE_SCHEMA_VERSION);
        assert_eq!(
            fs::read_to_string(directory.path().join(".gitignore")).unwrap(),
            "user-rule\n"
        );
        assert!(!directory.path().join(".ideanote/state.json.tmp").exists());
    }

    #[test]
    fn failed_atomic_metadata_replacement_keeps_target_and_cleans_temp() {
        let directory = TempDir::new().unwrap();
        let target = directory.path().join("state.json");
        fs::create_dir(&target).unwrap();
        let error = atomic_write_json(&target, &WorkspaceState::default()).unwrap_err();
        assert!(error.contains("atomically replace"));
        assert!(target.is_dir());
        assert!(!directory.path().join("state.json.tmp").exists());
    }

    #[cfg(unix)]
    #[test]
    fn permission_read_only_workspace_opens_but_rejects_mutation() {
        use std::os::unix::fs::PermissionsExt;

        let directory = TempDir::new().unwrap();
        let mut permissions = fs::metadata(directory.path()).unwrap().permissions();
        permissions.set_mode(0o555);
        fs::set_permissions(directory.path(), permissions).unwrap();

        let service = WorkspaceService::open(directory.path()).unwrap();
        assert!(service.open_result().unwrap().read_only);
        assert!(service
            .create_folder("", None)
            .unwrap_err()
            .contains("read-only"));

        let mut permissions = fs::metadata(directory.path()).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(directory.path(), permissions).unwrap();
    }

    #[test]
    fn recursive_scan_keeps_unsupported_files_without_parsing_them() {
        let (directory, service) = open_temp_workspace();
        for index in 0..40 {
            let folder = directory.path().join(format!("folder-{index:02}"));
            fs::create_dir(&folder).unwrap();
            fs::write(folder.join("data.bin"), [0xff, 0x00, 0x7f]).unwrap();
        }
        let entries = service.scan().unwrap();
        assert_eq!(entries.len(), 40);
        assert!(entries
            .iter()
            .all(|entry| entry.children[0].file_type.is_none()));
    }
}
