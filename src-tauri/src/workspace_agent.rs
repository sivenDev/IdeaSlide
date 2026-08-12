use crate::agent::types::{AgentToolDescriptor, AgentToolEffect, AgentToolSource};
use crate::safe_write::{self, WriteMode};
use crate::workspace::{normalize_relative_path, relative_path_to_string, WorkspaceService};
use crate::workspace_watcher::WorkspaceWatcherState;
use chrono::Utc;
use globset::{Glob, GlobMatcher};
use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use similar::TextDiff;
use std::collections::{BTreeSet, VecDeque};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

const MAX_TEXT_BYTES: u64 = 48 * 1024;
const MAX_LIST_ENTRIES: usize = 200;
const MAX_LIST_DEPTH: usize = 12;
const MAX_WALK_ENTRIES: usize = 2_000;
const MAX_SEARCH_FILES: usize = 500;
const MAX_SEARCH_MATCHES: usize = 100;
const MAX_MATCHES_PER_FILE: usize = 50;
const MAX_PATCH_OPERATIONS: usize = 32;
const MAX_PATCH_BYTES: usize = 2 * 1024 * 1024;
const MAX_DIFF_BYTES: usize = 48 * 1024;
const MAX_LEDGER_ENTRIES: usize = 8;
const MAX_LEDGER_BYTES: usize = 4 * 1024 * 1024;

#[derive(Clone, Debug)]
struct ActiveWorkspaceContext {
    root: PathBuf,
    read_only: bool,
    protected_paths: BTreeSet<PathBuf>,
    generation: u64,
}

#[derive(Clone, Debug)]
struct FileSnapshot {
    path: String,
    before: Option<Vec<u8>>,
    after: Option<Vec<u8>>,
}

#[derive(Clone, Debug)]
struct WorkspaceChangeSet {
    id: String,
    root: PathBuf,
    generation: u64,
    created_at: String,
    summary: String,
    status: String,
    diff: String,
    truncated: bool,
    snapshots: Vec<FileSnapshot>,
    bytes: usize,
}

#[derive(Default)]
struct WorkspaceAgentLedger {
    entries: VecDeque<WorkspaceChangeSet>,
    bytes: usize,
}

#[derive(Default)]
pub(crate) struct WorkspaceAgentHost {
    context: Mutex<Option<ActiveWorkspaceContext>>,
    ledger: Mutex<WorkspaceAgentLedger>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceAgentContextInput {
    root: Option<String>,
    #[serde(default)]
    read_only: bool,
    #[serde(default)]
    protected_paths: Vec<String>,
    generation: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceAgentContextStatus {
    available: bool,
    capability_id: Option<String>,
    generation: u64,
}

#[tauri::command]
pub(crate) fn sync_workspace_agent_context(
    context: WorkspaceAgentContextInput,
    host: tauri::State<'_, WorkspaceAgentHost>,
) -> Result<WorkspaceAgentContextStatus, String> {
    host.sync_context(context)
}

impl WorkspaceAgentHost {
    fn sync_context(
        &self,
        input: WorkspaceAgentContextInput,
    ) -> Result<WorkspaceAgentContextStatus, String> {
        let next = if let Some(root) = input.root {
            let service = WorkspaceService::open(Path::new(&root))?;
            let protected_paths = input
                .protected_paths
                .iter()
                .map(|path| normalize_relative_path(path, false))
                .collect::<Result<BTreeSet<_>, _>>()?;
            Some(ActiveWorkspaceContext {
                root: service.root().to_path_buf(),
                read_only: input.read_only || service.is_read_only(),
                protected_paths,
                generation: input.generation,
            })
        } else {
            None
        };
        let root_changed = {
            let current = self
                .context
                .lock()
                .map_err(|_| "Workspace Agent context is unavailable")?;
            current.as_ref().map(|value| &value.root) != next.as_ref().map(|value| &value.root)
        };
        if root_changed {
            let mut ledger = self
                .ledger
                .lock()
                .map_err(|_| "Workspace Agent ledger is unavailable")?;
            ledger.entries.clear();
            ledger.bytes = 0;
        }
        let status = WorkspaceAgentContextStatus {
            available: next.is_some(),
            capability_id: next.as_ref().map(capability_id),
            generation: next
                .as_ref()
                .map(|value| value.generation)
                .unwrap_or(input.generation),
        };
        *self
            .context
            .lock()
            .map_err(|_| "Workspace Agent context is unavailable")? = next;
        Ok(status)
    }

    pub(crate) fn descriptors(&self) -> Result<(Vec<AgentToolDescriptor>, Option<String>), String> {
        let context = self.context_snapshot()?;
        let Some(context) = context else {
            return Ok((Vec::new(), None));
        };
        Ok((workspace_tool_descriptors(), Some(capability_id(&context))))
    }

    pub(crate) fn is_workspace_tool(&self, name: &str) -> bool {
        matches!(
            name,
            "list_workspace_files"
                | "search_workspace_text"
                | "read_workspace_text"
                | "create_workspace_folder"
                | "apply_workspace_patch"
                | "get_workspace_change_set"
                | "undo_workspace_change_set"
                | "move_workspace_entry"
                | "trash_workspace_entry"
        )
    }

    pub(crate) fn requires_approval(&self, name: &str, arguments: &Value) -> bool {
        matches!(name, "move_workspace_entry" | "trash_workspace_entry")
            || (name == "apply_workspace_patch"
                && arguments
                    .get("operations")
                    .and_then(Value::as_array)
                    .is_some_and(|operations| {
                        operations.iter().any(|operation| {
                            operation.get("kind").and_then(Value::as_str) == Some("delete")
                        })
                    }))
    }

    pub(crate) fn approval_copy(&self, name: &str, arguments: &Value) -> (String, String) {
        match name {
            "move_workspace_entry" => (
                "Move Workspace entry?".to_string(),
                format!(
                    "Allow the Agent to move {}?",
                    arguments
                        .get("path")
                        .and_then(Value::as_str)
                        .unwrap_or("this entry")
                ),
            ),
            "trash_workspace_entry" => (
                "Move Workspace entry to Trash?".to_string(),
                format!(
                    "Allow the Agent to move {} to Trash?",
                    arguments
                        .get("path")
                        .and_then(Value::as_str)
                        .unwrap_or("this entry")
                ),
            ),
            _ => (
                "Delete Workspace files?".to_string(),
                "This patch includes file deletion. Allow the Agent to apply it?".to_string(),
            ),
        }
    }

    pub(crate) fn execute(
        &self,
        call_id: &str,
        name: &str,
        arguments: &Value,
        expected_capability_id: Option<&str>,
        watcher: &WorkspaceWatcherState,
    ) -> Value {
        if self
            .context_snapshot()
            .ok()
            .flatten()
            .map(|context| capability_id(&context))
            .as_deref()
            != expected_capability_id
        {
            return workspace_failure(
                call_id,
                name,
                "Workspace context changed after this Turn started".to_string(),
            );
        }
        let result = match name {
            "list_workspace_files" => self.list_files(arguments).map(|content| ("read", content)),
            "search_workspace_text" => self.search_text(arguments).map(|content| ("read", content)),
            "read_workspace_text" => self.read_text(arguments).map(|content| ("read", content)),
            "create_workspace_folder" => self
                .create_folder(arguments)
                .map(|content| ("workspaceMutation", content)),
            "apply_workspace_patch" => self
                .apply_patch(arguments, watcher)
                .map(|content| ("workspaceMutation", content)),
            "get_workspace_change_set" => self
                .get_change_set(arguments)
                .map(|content| ("read", content)),
            "undo_workspace_change_set" => self
                .undo_change_set(arguments, watcher)
                .map(|content| ("workspaceMutation", content)),
            "move_workspace_entry" => self
                .move_entry(arguments)
                .map(|content| ("workspaceMutation", content)),
            "trash_workspace_entry" => self
                .trash_entry(arguments)
                .map(|content| ("workspaceMutation", content)),
            _ => Err(format!("Workspace Tool is not registered: {name}")),
        };
        match result {
            Ok((kind, content)) => json!({
                "kind": kind,
                "callId": call_id,
                "name": name,
                "success": true,
                "summary": content.get("summary").and_then(Value::as_str).unwrap_or("Workspace Tool completed"),
                "content": content,
                "truncated": false,
                "persistable": kind != "read",
            }),
            Err(message) => workspace_failure(call_id, name, message),
        }
    }

    fn context_snapshot(&self) -> Result<Option<ActiveWorkspaceContext>, String> {
        self.context
            .lock()
            .map(|context| context.clone())
            .map_err(|_| "Workspace Agent context is unavailable".to_string())
    }

    fn require_context(&self) -> Result<ActiveWorkspaceContext, String> {
        let context = self
            .context_snapshot()?
            .ok_or_else(|| "Workspace Tools are unavailable in Standalone mode".to_string())?;
        let service = WorkspaceService::open(&context.root)?;
        if service.root() != context.root {
            return Err("Workspace root changed; refresh the Agent context".to_string());
        }
        Ok(ActiveWorkspaceContext {
            read_only: context.read_only || service.is_read_only(),
            ..context
        })
    }

    fn list_files(&self, arguments: &Value) -> Result<Value, String> {
        let context = self.require_context()?;
        let directory = string_argument(arguments, "directory", "")?;
        let relative = normalize_relative_path(directory, true)?;
        ensure_disclosable_path(&relative, true)?;
        let start = if relative.as_os_str().is_empty() {
            context.root.clone()
        } else {
            WorkspaceService::open(&context.root)?.resolve_directory(directory)?
        };
        let matcher = optional_glob(arguments.get("glob").and_then(Value::as_str))?;
        let max_depth = usize_argument(arguments, "maxDepth", 4)?.clamp(1, MAX_LIST_DEPTH);
        let max_entries = usize_argument(arguments, "maxEntries", 100)?.clamp(1, MAX_LIST_ENTRIES);
        let mut entries = Vec::new();
        let outcome = walk_workspace(
            &context.root,
            &start,
            &relative,
            max_depth,
            &mut |path, relative, metadata| {
                if entries.len() >= max_entries {
                    return Ok(false);
                }
                let path_text = relative_path_to_string(relative);
                if metadata.is_dir()
                    || matcher
                        .as_ref()
                        .is_none_or(|glob| glob.is_match(&path_text))
                {
                    if metadata.is_file() && read_disclosable_text(path).is_err() {
                        return Ok(true);
                    }
                    entries.push(json!({
                    "path": path_text,
                    "kind": if metadata.is_dir() { "directory" } else { "file" },
                    "size": metadata.is_file().then_some(metadata.len()),
                    "modified": metadata.modified().ok().map(|value| chrono::DateTime::<Utc>::from(value).to_rfc3339()),
                }));
                }
                let _ = path;
                Ok(true)
            },
        )?;
        let truncated = !outcome.completed || outcome.depth_truncated;
        Ok(json!({
            "summary": format!("Listed {} Workspace entries", entries.len()),
            "directory": directory,
            "entries": entries,
            "truncated": truncated,
        }))
    }

    fn search_text(&self, arguments: &Value) -> Result<Value, String> {
        let context = self.require_context()?;
        let query = required_string(arguments, "query")?;
        if query.is_empty() || query.len() > 512 {
            return Err("Search query must contain 1 to 512 characters".to_string());
        }
        let directory = string_argument(arguments, "directory", "")?;
        let relative = normalize_relative_path(directory, true)?;
        ensure_disclosable_path(&relative, true)?;
        let start = if relative.as_os_str().is_empty() {
            context.root.clone()
        } else {
            WorkspaceService::open(&context.root)?.resolve_directory(directory)?
        };
        let matcher = optional_glob(arguments.get("glob").and_then(Value::as_str))?;
        let regex_mode = arguments
            .get("regex")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let case_sensitive = arguments
            .get("caseSensitive")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let pattern = if regex_mode {
            query.to_string()
        } else {
            regex::escape(query)
        };
        let regex = RegexBuilder::new(&pattern)
            .case_insensitive(!case_sensitive)
            .size_limit(1024 * 1024)
            .dfa_size_limit(1024 * 1024)
            .build()
            .map_err(|error| format!("Invalid bounded regular expression: {error}"))?;
        let mut matches = Vec::new();
        let mut searched_files = 0usize;
        let outcome = walk_workspace(
            &context.root,
            &start,
            &relative,
            MAX_LIST_DEPTH,
            &mut |_path, relative, metadata| {
                if matches.len() >= MAX_SEARCH_MATCHES || searched_files >= MAX_SEARCH_FILES {
                    return Ok(false);
                }
                if !metadata.is_file() {
                    return Ok(true);
                }
                let path_text = relative_path_to_string(relative);
                if matcher
                    .as_ref()
                    .is_some_and(|glob| !glob.is_match(&path_text))
                {
                    return Ok(true);
                }
                let absolute = context.root.join(relative);
                let Ok(text) = read_disclosable_text(&absolute) else {
                    return Ok(true);
                };
                searched_files += 1;
                let mut file_matches = 0usize;
                for (line_index, line) in text.lines().enumerate() {
                    if file_matches >= MAX_MATCHES_PER_FILE || matches.len() >= MAX_SEARCH_MATCHES {
                        break;
                    }
                    let ranges = regex
                        .find_iter(line)
                        .map(|value| (value.start(), value.end()))
                        .collect::<Vec<_>>();
                    for (start, _end) in ranges {
                        matches.push(json!({
                            "path": path_text,
                            "line": line_index + 1,
                            "column": line[..start].chars().count() + 1,
                        "snippet": truncate_chars(line, 200),
                        }));
                        file_matches += 1;
                        if file_matches >= MAX_MATCHES_PER_FILE
                            || matches.len() >= MAX_SEARCH_MATCHES
                        {
                            break;
                        }
                    }
                }
                Ok(true)
            },
        )?;
        let truncated = !outcome.completed
            || outcome.depth_truncated
            || matches.len() >= MAX_SEARCH_MATCHES
            || searched_files >= MAX_SEARCH_FILES;
        Ok(json!({
            "summary": format!("Found {} matches in {} files", matches.len(), searched_files),
            "matches": matches,
            "searchedFiles": searched_files,
            "truncated": truncated,
        }))
    }

    fn read_text(&self, arguments: &Value) -> Result<Value, String> {
        let context = self.require_context()?;
        let path = required_string(arguments, "path")?;
        let relative = normalize_relative_path(path, false)?;
        ensure_disclosable_path(&relative, false)?;
        let absolute = WorkspaceService::open(&context.root)?.resolve_existing(path)?;
        let text = read_disclosable_text(&absolute)?;
        let bytes = text.as_bytes();
        let digest = digest_bytes(bytes);
        let lines = text.split_inclusive('\n').collect::<Vec<_>>();
        let line_count = if text.is_empty() { 0 } else { lines.len() };
        let has_explicit_range =
            arguments.get("startLine").is_some() || arguments.get("endLine").is_some();
        let start_line = usize_argument(arguments, "startLine", 1)?;
        let end_line = arguments
            .get("endLine")
            .and_then(Value::as_u64)
            .map(|value| value as usize)
            .unwrap_or(line_count.max(1));
        if start_line == 0
            || end_line < start_line
            || (line_count == 0 && has_explicit_range)
            || (line_count > 0 && (start_line > line_count || end_line > line_count))
        {
            return Err("Requested line range is outside the text file".to_string());
        }
        let content = if line_count == 0 {
            String::new()
        } else {
            lines[start_line - 1..end_line.min(line_count)].concat()
        };
        Ok(json!({
            "summary": format!("Read {}", path),
            "path": path,
            "content": content,
            "digest": digest,
            "byteCount": bytes.len(),
            "lineCount": line_count,
            "startLine": start_line,
            "endLine": end_line.min(line_count),
            "truncated": end_line < line_count || start_line > 1,
        }))
    }

    fn create_folder(&self, arguments: &Value) -> Result<Value, String> {
        let context = self.require_writable_context()?;
        let parent_path = string_argument(arguments, "parentPath", "")?;
        let name = required_string(arguments, "name")?;
        let parent = normalize_relative_path(parent_path, true)?;
        ensure_disclosable_path(&parent, true)?;
        ensure_disclosable_path(&parent.join(name), false)?;
        let result =
            WorkspaceService::open(&context.root)?.create_folder(parent_path, Some(name))?;
        Ok(json!({
            "summary": format!("Created Folder {}", result.value.path),
            "path": result.value.path,
            "metadataError": result.metadata_error,
        }))
    }

    fn apply_patch(
        &self,
        arguments: &Value,
        watcher: &WorkspaceWatcherState,
    ) -> Result<Value, String> {
        let context = self.require_writable_context()?;
        let operations = serde_json::from_value::<Vec<PatchOperation>>(
            arguments
                .get("operations")
                .cloned()
                .ok_or_else(|| "Patch operations are required".to_string())?,
        )
        .map_err(|error| format!("Invalid Workspace patch: {error}"))?;
        if operations.is_empty() || operations.len() > MAX_PATCH_OPERATIONS {
            return Err(format!(
                "Workspace patch must contain 1 to {MAX_PATCH_OPERATIONS} operations"
            ));
        }
        let service = WorkspaceService::open(&context.root)?;
        let mut unique = BTreeSet::new();
        let mut snapshots = Vec::new();
        let mut total_bytes = 0usize;
        for operation in operations {
            let path = operation.path();
            let relative = normalize_relative_path(path, false)?;
            ensure_mutable_path(&relative, &context)?;
            if !unique.insert(relative.clone()) {
                return Err(format!("Workspace patch contains duplicate target: {path}"));
            }
            let absolute = context.root.join(&relative);
            let parent = absolute
                .parent()
                .ok_or_else(|| "Patch target has no parent".to_string())?;
            let parent_relative = parent
                .strip_prefix(&context.root)
                .map_err(|_| "Patch target escaped the Workspace".to_string())?;
            let _ = service.resolve_directory(&relative_path_to_string(parent_relative))?;
            let before = if absolute.exists() {
                let resolved = service.resolve_existing(path)?;
                Some(read_disclosable_text(&resolved)?.into_bytes())
            } else {
                None
            };
            let after = operation.build_after(before.as_deref())?;
            operation.validate_digest(before.as_deref())?;
            total_bytes = total_bytes
                .saturating_add(before.as_ref().map(Vec::len).unwrap_or(0))
                .saturating_add(after.as_ref().map(Vec::len).unwrap_or(0));
            if total_bytes > MAX_PATCH_BYTES {
                return Err("Workspace patch exceeds the bounded content limit".to_string());
            }
            snapshots.push(FileSnapshot {
                path: relative_path_to_string(&relative),
                before,
                after,
            });
        }
        self.recheck_context(&context)?;
        let paths = snapshots
            .iter()
            .map(|snapshot| snapshot.path.clone())
            .collect::<Vec<_>>();
        watcher.with_expected_writes(&context.root, &paths, || {
            apply_snapshots(&context.root, &snapshots, false)
        })?;
        let change_set = build_change_set(&context, snapshots, "Applied Workspace patch")?;
        let response = change_set_response(&change_set);
        self.record_change_set(change_set)?;
        Ok(response)
    }

    fn get_change_set(&self, arguments: &Value) -> Result<Value, String> {
        let context = self.require_context()?;
        let id = required_string(arguments, "changeSetId")?;
        let ledger = self
            .ledger
            .lock()
            .map_err(|_| "Workspace Agent ledger is unavailable")?;
        let change_set = ledger
            .entries
            .iter()
            .find(|entry| entry.id == id)
            .ok_or_else(|| "Workspace change set is unavailable or was evicted".to_string())?;
        if change_set.root != context.root {
            return Err("Workspace change set belongs to another Workspace".to_string());
        }
        Ok(change_set_response(change_set))
    }

    fn undo_change_set(
        &self,
        arguments: &Value,
        watcher: &WorkspaceWatcherState,
    ) -> Result<Value, String> {
        let context = self.require_writable_context()?;
        let id = required_string(arguments, "changeSetId")?;
        let change_set = {
            let ledger = self
                .ledger
                .lock()
                .map_err(|_| "Workspace Agent ledger is unavailable")?;
            ledger
                .entries
                .iter()
                .find(|entry| entry.id == id)
                .cloned()
                .ok_or_else(|| "Workspace change set is unavailable or was evicted".to_string())?
        };
        if change_set.root != context.root || change_set.generation != context.generation {
            return Err("Workspace change set is stale for the active Workspace".to_string());
        }
        for snapshot in &change_set.snapshots {
            let relative = normalize_relative_path(&snapshot.path, false)?;
            ensure_mutable_path(&relative, &context)?;
            let current = read_optional_file(&context.root.join(&relative))?;
            if current != snapshot.after {
                return Err(format!(
                    "Cannot undo because {} changed after the Agent patch",
                    snapshot.path
                ));
            }
        }
        self.recheck_context(&context)?;
        let paths = change_set
            .snapshots
            .iter()
            .map(|snapshot| snapshot.path.clone())
            .collect::<Vec<_>>();
        watcher.with_expected_writes(&context.root, &paths, || {
            apply_snapshots(&context.root, &change_set.snapshots, true)
        })?;
        if let Ok(mut ledger) = self.ledger.lock() {
            if let Some(entry) = ledger.entries.iter_mut().find(|entry| entry.id == id) {
                entry.status = "undone".to_string();
            }
        }
        Ok(json!({
            "summary": format!("Undid Workspace change set {}", change_set.id),
            "changeSetId": change_set.id,
            "status": "undone",
        }))
    }

    fn move_entry(&self, arguments: &Value) -> Result<Value, String> {
        let context = self.require_writable_context()?;
        let path = required_string(arguments, "path")?;
        let destination = string_argument(arguments, "destinationParentPath", "")?;
        ensure_mutable_path(&normalize_relative_path(path, false)?, &context)?;
        ensure_disclosable_path(&normalize_relative_path(destination, true)?, true)?;
        let entry = WorkspaceService::open(&context.root)?.move_entry(path, destination)?;
        Ok(json!({"summary": format!("Moved {}", path), "path": entry.path}))
    }

    fn trash_entry(&self, arguments: &Value) -> Result<Value, String> {
        let context = self.require_writable_context()?;
        let path = required_string(arguments, "path")?;
        ensure_mutable_path(&normalize_relative_path(path, false)?, &context)?;
        WorkspaceService::open(&context.root)?.trash_entry(path)?;
        Ok(json!({"summary": format!("Moved {} to Trash", path), "path": path}))
    }

    fn require_writable_context(&self) -> Result<ActiveWorkspaceContext, String> {
        let context = self.require_context()?;
        if context.read_only {
            return Err("Workspace is read-only".to_string());
        }
        Ok(context)
    }

    fn recheck_context(&self, captured: &ActiveWorkspaceContext) -> Result<(), String> {
        let current = self.require_context()?;
        if current.root != captured.root
            || current.generation != captured.generation
            || current.read_only
            || current.protected_paths != captured.protected_paths
        {
            return Err(
                "Workspace context changed before the file operation could commit".to_string(),
            );
        }
        Ok(())
    }

    fn record_change_set(&self, change_set: WorkspaceChangeSet) -> Result<(), String> {
        let mut ledger = self
            .ledger
            .lock()
            .map_err(|_| "Workspace Agent ledger is unavailable")?;
        ledger.bytes = ledger.bytes.saturating_add(change_set.bytes);
        ledger.entries.push_back(change_set);
        while ledger.entries.len() > MAX_LEDGER_ENTRIES || ledger.bytes > MAX_LEDGER_BYTES {
            if let Some(evicted) = ledger.entries.pop_front() {
                ledger.bytes = ledger.bytes.saturating_sub(evicted.bytes);
            } else {
                break;
            }
        }
        Ok(())
    }
}

fn workspace_failure(call_id: &str, name: &str, message: String) -> Value {
    json!({
        "kind": "failure",
        "callId": call_id,
        "name": name,
        "success": false,
        "summary": message,
        "error": {
            "code": "toolExecutionFailed",
            "message": message,
            "recovery": "Refresh the Workspace context, read the current file digest, and retry.",
            "diagnosticId": uuid::Uuid::new_v4().to_string(),
            "retryable": true,
        },
        "truncated": false,
        "persistable": true,
    })
}

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum PatchOperation {
    Create {
        path: String,
        content: String,
        #[serde(rename = "expectedDigest")]
        expected_digest: Option<String>,
    },
    Replace {
        path: String,
        #[serde(rename = "expectedDigest")]
        expected_digest: Option<String>,
        replacements: Vec<TextReplacement>,
    },
    Delete {
        path: String,
        #[serde(rename = "expectedDigest")]
        expected_digest: Option<String>,
    },
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TextReplacement {
    old_text: String,
    new_text: String,
}

impl PatchOperation {
    fn path(&self) -> &str {
        match self {
            Self::Create { path, .. } | Self::Replace { path, .. } | Self::Delete { path, .. } => {
                path
            }
        }
    }

    fn expected_digest(&self) -> Option<&str> {
        match self {
            Self::Create {
                expected_digest, ..
            }
            | Self::Replace {
                expected_digest, ..
            }
            | Self::Delete {
                expected_digest, ..
            } => expected_digest.as_deref(),
        }
    }

    fn validate_digest(&self, before: Option<&[u8]>) -> Result<(), String> {
        match (before, self.expected_digest(), self) {
            (None, None, Self::Create { .. }) => Ok(()),
            (None, _, _) => Err(format!("Patch target does not exist: {}", self.path())),
            (Some(_), None, Self::Create { .. }) => Err(format!(
                "Patch create target already exists: {}",
                self.path()
            )),
            (Some(bytes), Some(expected), _) if digest_bytes(bytes) == expected => Ok(()),
            (Some(_), Some(_), _) => Err(format!("Patch digest is stale for {}", self.path())),
            (Some(_), None, _) => Err(format!("Patch digest is required for {}", self.path())),
        }
    }

    fn build_after(&self, before: Option<&[u8]>) -> Result<Option<Vec<u8>>, String> {
        match self {
            Self::Create { content, .. } => {
                validate_text_bytes(content.as_bytes())?;
                Ok(Some(content.as_bytes().to_vec()))
            }
            Self::Delete { .. } => Ok(None),
            Self::Replace { replacements, .. } => {
                if replacements.is_empty() {
                    return Err(
                        "Patch replace requires at least one exact-text replacement".to_string()
                    );
                }
                let before = before
                    .ok_or_else(|| format!("Patch target does not exist: {}", self.path()))?;
                let mut text = std::str::from_utf8(before)
                    .map_err(|_| format!("Workspace file is not valid UTF-8: {}", self.path()))?
                    .to_string();
                for replacement in replacements {
                    if replacement.old_text.is_empty() {
                        return Err("Patch oldText cannot be empty".to_string());
                    }
                    let count = text.match_indices(&replacement.old_text).count();
                    if count != 1 {
                        return Err(format!(
                            "Patch oldText must match exactly once in {} (matched {count})",
                            self.path()
                        ));
                    }
                    text = text.replacen(&replacement.old_text, &replacement.new_text, 1);
                }
                validate_text_bytes(text.as_bytes())?;
                Ok(Some(text.into_bytes()))
            }
        }
    }
}

fn workspace_tool_descriptors() -> Vec<AgentToolDescriptor> {
    let descriptor = |name: &str,
                      description: &str,
                      effect: AgentToolEffect,
                      input_schema: Value| AgentToolDescriptor {
        name: name.to_string(),
        description: description.to_string(),
        input_schema,
        requires: Vec::new(),
        source: AgentToolSource::Workspace,
        effect,
    };
    vec![
        descriptor("list_workspace_files", "List bounded files and Folders inside the active Workspace, including ordinary text artifacts hidden from Explorer.", AgentToolEffect::Read, json!({"type":"object","properties":{"directory":{"type":"string"},"glob":{"type":"string","maxLength":256},"maxDepth":{"type":"integer","minimum":1,"maximum":12},"maxEntries":{"type":"integer","minimum":1,"maximum":200}},"additionalProperties":false})),
        descriptor("search_workspace_text", "Search bounded UTF-8 Workspace text with a literal or regular expression query.", AgentToolEffect::Read, json!({"type":"object","properties":{"query":{"type":"string","minLength":1,"maxLength":512},"directory":{"type":"string"},"glob":{"type":"string","maxLength":256},"regex":{"type":"boolean"},"caseSensitive":{"type":"boolean"}},"required":["query"],"additionalProperties":false})),
        descriptor("read_workspace_text", "Read a complete or inclusive line range from one UTF-8 Workspace file and return its SHA-256 digest.", AgentToolEffect::Read, json!({"type":"object","properties":{"path":{"type":"string"},"startLine":{"type":"integer","minimum":1},"endLine":{"type":"integer","minimum":1}},"required":["path"],"additionalProperties":false})),
        descriptor("create_workspace_folder", "Create one Folder inside the active Workspace.", AgentToolEffect::Write, json!({"type":"object","properties":{"parentPath":{"type":"string"},"name":{"type":"string","minLength":1}},"required":["name"],"additionalProperties":false})),
        descriptor("apply_workspace_patch", "Atomically create, exact-text replace, or delete multiple UTF-8 Workspace files using optimistic SHA-256 digests. A deletion-bearing call is approval-gated.", AgentToolEffect::Destructive, patch_schema()),
        descriptor("get_workspace_change_set", "Inspect the bounded unified Diff for a current-session Workspace change set.", AgentToolEffect::Read, change_set_schema()),
        descriptor("undo_workspace_change_set", "Undo a current-session Workspace patch only while every affected path still matches its recorded after-state.", AgentToolEffect::Write, change_set_schema()),
        descriptor("move_workspace_entry", "Move one Workspace file or Folder into another existing Folder after explicit approval.", AgentToolEffect::Destructive, json!({"type":"object","properties":{"path":{"type":"string"},"destinationParentPath":{"type":"string"}},"required":["path","destinationParentPath"],"additionalProperties":false})),
        descriptor("trash_workspace_entry", "Move one Workspace file or Folder to the operating system Trash after explicit approval.", AgentToolEffect::Destructive, json!({"type":"object","properties":{"path":{"type":"string"}},"required":["path"],"additionalProperties":false})),
    ]
}

fn patch_schema() -> Value {
    json!({"type":"object","properties":{"operations":{"type":"array","minItems":1,"maxItems":32,"items":{"oneOf":[
        {"type":"object","properties":{"kind":{"const":"create"},"path":{"type":"string"},"content":{"type":"string"},"expectedDigest":{"type":"null"}},"required":["kind","path","content","expectedDigest"],"additionalProperties":false},
        {"type":"object","properties":{"kind":{"const":"replace"},"path":{"type":"string"},"expectedDigest":{"type":"string","pattern":"^sha256-[0-9a-f]{64}$"},"replacements":{"type":"array","minItems":1,"items":{"type":"object","properties":{"oldText":{"type":"string","minLength":1},"newText":{"type":"string"}},"required":["oldText","newText"],"additionalProperties":false}}},"required":["kind","path","expectedDigest","replacements"],"additionalProperties":false},
        {"type":"object","properties":{"kind":{"const":"delete"},"path":{"type":"string"},"expectedDigest":{"type":"string","pattern":"^sha256-[0-9a-f]{64}$"}},"required":["kind","path","expectedDigest"],"additionalProperties":false}
    ]}}},"required":["operations"],"additionalProperties":false})
}

fn change_set_schema() -> Value {
    json!({"type":"object","properties":{"changeSetId":{"type":"string","minLength":1}},"required":["changeSetId"],"additionalProperties":false})
}

fn capability_id(context: &ActiveWorkspaceContext) -> String {
    let mut hasher = Sha256::new();
    hasher.update(context.root.to_string_lossy().as_bytes());
    hasher.update(context.generation.to_le_bytes());
    hasher.update([u8::from(context.read_only)]);
    for path in &context.protected_paths {
        hasher.update(relative_path_to_string(path).as_bytes());
        hasher.update([0]);
    }
    format!("workspace-sha256-{:x}", hasher.finalize())
}

fn ensure_disclosable_path(path: &Path, allow_empty: bool) -> Result<(), String> {
    if path.as_os_str().is_empty() && allow_empty {
        return Ok(());
    }
    for component in path.components() {
        let Component::Normal(name) = component else {
            return Err("Workspace path must be relative and normalized".to_string());
        };
        let name = name.to_string_lossy();
        if excluded_component(&name) {
            return Err(format!(
                "Workspace path is excluded from Agent access: {}",
                relative_path_to_string(path)
            ));
        }
    }
    if path
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("is"))
    {
        return Err(
            "IdeaSketch archives cannot be accessed through Workspace text Tools".to_string(),
        );
    }
    Ok(())
}

fn ensure_mutable_path(path: &Path, context: &ActiveWorkspaceContext) -> Result<(), String> {
    ensure_disclosable_path(path, false)?;
    if context
        .protected_paths
        .iter()
        .any(|protected| protected == path || protected.starts_with(path))
    {
        return Err(format!(
            "Open or protected document cannot be overwritten: {}",
            relative_path_to_string(path)
        ));
    }
    Ok(())
}

fn excluded_component(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    name.starts_with('.')
        || matches!(
            lower.as_str(),
            "node_modules" | "vendor" | "target" | "dist" | "build" | "coverage" | "__pycache__"
        )
        || matches!(
            lower.as_str(),
            "id_rsa" | "id_ed25519" | "credentials" | "credentials.json"
        )
        || lower.starts_with(".env")
        || lower.ends_with(".pem")
        || lower.ends_with(".key")
        || lower.ends_with(".p12")
}

#[derive(Clone, Copy, Debug, Default)]
struct WalkOutcome {
    completed: bool,
    depth_truncated: bool,
}

fn walk_workspace<F>(
    root: &Path,
    directory: &Path,
    relative_directory: &Path,
    max_depth: usize,
    visitor: &mut F,
) -> Result<WalkOutcome, String>
where
    F: FnMut(&Path, &Path, &fs::Metadata) -> Result<bool, String>,
{
    fn visit<F>(
        root: &Path,
        directory: &Path,
        relative: &Path,
        depth: usize,
        max_depth: usize,
        visitor: &mut F,
        depth_truncated: &mut bool,
        visited: &mut usize,
    ) -> Result<bool, String>
    where
        F: FnMut(&Path, &Path, &fs::Metadata) -> Result<bool, String>,
    {
        if depth >= max_depth {
            return Ok(true);
        }
        let mut children = fs::read_dir(directory)
            .map_err(|error| format!("Failed to scan Workspace directory: {error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Failed to read Workspace entry: {error}"))?;
        children.sort_by_key(|entry| entry.file_name().to_string_lossy().to_ascii_lowercase());
        for child in children {
            if *visited >= MAX_WALK_ENTRIES {
                return Ok(false);
            }
            *visited += 1;
            let name = child.file_name().to_string_lossy().to_string();
            if excluded_component(&name) {
                continue;
            }
            let child_relative = relative.join(&name);
            if ensure_disclosable_path(&child_relative, false).is_err() {
                continue;
            }
            let path = child.path();
            let metadata = fs::symlink_metadata(&path)
                .map_err(|error| format!("Failed to inspect Workspace entry: {error}"))?;
            if metadata.file_type().is_symlink() {
                continue;
            }
            if !path.starts_with(root) {
                continue;
            }
            if !visitor(&path, &child_relative, &metadata)? {
                return Ok(false);
            }
            if metadata.is_dir() {
                if depth + 1 >= max_depth {
                    if directory_has_disclosable_child(&path)? {
                        *depth_truncated = true;
                    }
                } else if !visit(
                    root,
                    &path,
                    &child_relative,
                    depth + 1,
                    max_depth,
                    visitor,
                    depth_truncated,
                    visited,
                )? {
                    return Ok(false);
                }
            }
        }
        Ok(true)
    }
    let mut depth_truncated = false;
    let mut visited = 0;
    let completed = visit(
        root,
        directory,
        relative_directory,
        0,
        max_depth,
        visitor,
        &mut depth_truncated,
        &mut visited,
    )?;
    Ok(WalkOutcome {
        completed,
        depth_truncated,
    })
}

fn directory_has_disclosable_child(directory: &Path) -> Result<bool, String> {
    for entry in fs::read_dir(directory)
        .map_err(|error| format!("Failed to scan Workspace directory: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Failed to read Workspace entry: {error}"))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if excluded_component(&name) {
            continue;
        }
        let metadata = fs::symlink_metadata(entry.path())
            .map_err(|error| format!("Failed to inspect Workspace entry: {error}"))?;
        if !metadata.file_type().is_symlink() {
            return Ok(true);
        }
    }
    Ok(false)
}

fn read_disclosable_text(path: &Path) -> Result<String, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Failed to inspect Workspace file: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Workspace text path must be a regular file".to_string());
    }
    if metadata.len() > MAX_TEXT_BYTES {
        return Err(format!(
            "Workspace text file exceeds the {} byte limit",
            MAX_TEXT_BYTES
        ));
    }
    let bytes =
        fs::read(path).map_err(|error| format!("Failed to read Workspace file: {error}"))?;
    validate_text_bytes(&bytes)?;
    String::from_utf8(bytes).map_err(|_| "Workspace file is not valid UTF-8".to_string())
}

fn validate_text_bytes(bytes: &[u8]) -> Result<(), String> {
    if bytes.len() as u64 > MAX_TEXT_BYTES {
        return Err(format!(
            "Workspace text exceeds the {} byte limit",
            MAX_TEXT_BYTES
        ));
    }
    if bytes.iter().take(8192).any(|byte| *byte == 0) {
        return Err("Workspace file appears to be binary".to_string());
    }
    std::str::from_utf8(bytes).map_err(|_| "Workspace file is not valid UTF-8".to_string())?;
    Ok(())
}

fn optional_glob(pattern: Option<&str>) -> Result<Option<GlobMatcher>, String> {
    pattern
        .filter(|value| !value.is_empty())
        .map(|value| {
            Glob::new(value)
                .map(|glob| glob.compile_matcher())
                .map_err(|error| format!("Invalid Workspace glob: {error}"))
        })
        .transpose()
}

fn truncate_chars(value: &str, limit: usize) -> String {
    let mut result = value.chars().take(limit).collect::<String>();
    if value.chars().count() > limit {
        result.push('…');
    }
    result
}

fn digest_bytes(bytes: &[u8]) -> String {
    format!("sha256-{:x}", Sha256::digest(bytes))
}

fn required_string<'a>(arguments: &'a Value, name: &str) -> Result<&'a str, String> {
    arguments
        .get(name)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("{name} is required"))
}

fn string_argument<'a>(
    arguments: &'a Value,
    name: &str,
    default: &'a str,
) -> Result<&'a str, String> {
    match arguments.get(name) {
        None | Some(Value::Null) => Ok(default),
        Some(Value::String(value)) => Ok(value),
        _ => Err(format!("{name} must be a string")),
    }
}

fn usize_argument(arguments: &Value, name: &str, default: usize) -> Result<usize, String> {
    arguments.get(name).map_or(Ok(default), |value| {
        value
            .as_u64()
            .map(|value| value as usize)
            .ok_or_else(|| format!("{name} must be a positive integer"))
    })
}

fn apply_snapshots(root: &Path, snapshots: &[FileSnapshot], reverse: bool) -> Result<(), String> {
    let service = WorkspaceService::open(root)?;
    let staging = service.ensure_temp_directory()?;
    let mut committed = Vec::<(&FileSnapshot, Option<Vec<u8>>, Option<Vec<u8>>)>::new();
    for snapshot in snapshots {
        let target = root.join(&snapshot.path);
        let desired = if reverse {
            &snapshot.before
        } else {
            &snapshot.after
        };
        let previous = if reverse {
            &snapshot.after
        } else {
            &snapshot.before
        };
        if read_optional_file(&target)? != *previous {
            let rollback_errors = rollback_committed(root, &staging, committed);
            let primary = format!(
                "Workspace file changed during the transaction: {}",
                snapshot.path
            );
            return Err(if rollback_errors.is_empty() {
                primary
            } else {
                format!(
                    "{primary}; rollback also failed: {}",
                    rollback_errors.join("; ")
                )
            });
        }
        let result = match desired {
            Some(bytes) => safe_write::write_bytes(
                &target,
                &staging,
                bytes,
                if target.exists() {
                    WriteMode::Replace
                } else {
                    WriteMode::CreateNew
                },
            ),
            None => fs::remove_file(&target)
                .map_err(|error| format!("Failed to delete Workspace file: {error}")),
        };
        if let Err(primary) = result {
            let rollback_errors = rollback_committed(root, &staging, committed);
            return Err(if rollback_errors.is_empty() {
                primary
            } else {
                format!(
                    "{primary}; rollback also failed: {}",
                    rollback_errors.join("; ")
                )
            });
        }
        committed.push((snapshot, previous.clone(), desired.clone()));
    }
    Ok(())
}

fn rollback_committed<'a>(
    root: &Path,
    staging: &Path,
    committed: Vec<(&'a FileSnapshot, Option<Vec<u8>>, Option<Vec<u8>>)>,
) -> Vec<String> {
    let mut rollback_errors = Vec::new();
    for (snapshot, rollback_bytes, committed_bytes) in committed.into_iter().rev() {
        let target = root.join(&snapshot.path);
        let current = match read_optional_file(&target) {
            Ok(current) => current,
            Err(error) => {
                rollback_errors.push(error);
                continue;
            }
        };
        if current != committed_bytes {
            rollback_errors.push(format!(
                "Rollback refused because {} changed after the Agent write",
                snapshot.path
            ));
            continue;
        }
        let rollback = match rollback_bytes {
            Some(bytes) => safe_write::write_bytes(
                &target,
                staging,
                &bytes,
                if target.exists() {
                    WriteMode::Replace
                } else {
                    WriteMode::CreateNew
                },
            ),
            None => {
                if target.exists() {
                    fs::remove_file(&target).map_err(|error| error.to_string())
                } else {
                    Ok(())
                }
            }
        };
        if let Err(error) = rollback {
            rollback_errors.push(error);
        }
    }
    rollback_errors
}

fn build_change_set(
    context: &ActiveWorkspaceContext,
    snapshots: Vec<FileSnapshot>,
    summary: &str,
) -> Result<WorkspaceChangeSet, String> {
    let mut diff = String::new();
    let mut truncated = false;
    for snapshot in &snapshots {
        let before = snapshot
            .before
            .as_deref()
            .map(std::str::from_utf8)
            .transpose()
            .map_err(|_| "Workspace patch before-state is not UTF-8")?
            .unwrap_or("");
        let after = snapshot
            .after
            .as_deref()
            .map(std::str::from_utf8)
            .transpose()
            .map_err(|_| "Workspace patch after-state is not UTF-8")?
            .unwrap_or("");
        let header_before = if snapshot.before.is_some() {
            format!("a/{}", snapshot.path)
        } else {
            "/dev/null".to_string()
        };
        let header_after = if snapshot.after.is_some() {
            format!("b/{}", snapshot.path)
        } else {
            "/dev/null".to_string()
        };
        let rendered = TextDiff::from_lines(before, after)
            .unified_diff()
            .context_radius(3)
            .header(&header_before, &header_after)
            .to_string();
        if diff.len().saturating_add(rendered.len()) > MAX_DIFF_BYTES {
            let remaining = MAX_DIFF_BYTES.saturating_sub(diff.len());
            diff.push_str(&rendered[..rendered.floor_char_boundary(remaining)]);
            truncated = true;
            break;
        }
        diff.push_str(&rendered);
    }
    let bytes = snapshots
        .iter()
        .map(|snapshot| {
            snapshot.before.as_ref().map(Vec::len).unwrap_or(0)
                + snapshot.after.as_ref().map(Vec::len).unwrap_or(0)
        })
        .sum();
    Ok(WorkspaceChangeSet {
        id: format!("workspace-change-{}", uuid::Uuid::new_v4()),
        root: context.root.clone(),
        generation: context.generation,
        created_at: Utc::now().to_rfc3339(),
        summary: summary.to_string(),
        status: "applied".to_string(),
        diff,
        truncated,
        snapshots,
        bytes,
    })
}

fn change_set_response(change_set: &WorkspaceChangeSet) -> Value {
    json!({
        "summary": change_set.summary,
        "changeSetId": change_set.id,
        "status": change_set.status,
        "createdAt": change_set.created_at,
        "paths": change_set.snapshots.iter().map(|snapshot| &snapshot.path).collect::<Vec<_>>(),
        "diff": change_set.diff,
        "truncated": change_set.truncated,
    })
}

fn read_optional_file(path: &Path) -> Result<Option<Vec<u8>>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Failed to inspect Workspace file: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Workspace change-set path is no longer a regular file".to_string());
    }
    fs::read(path)
        .map(Some)
        .map_err(|error| format!("Failed to read Workspace file: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn host_with_workspace() -> (TempDir, WorkspaceAgentHost) {
        let root = TempDir::new().unwrap();
        fs::write(root.path().join("index.html"), "<h1>Hello</h1>\n").unwrap();
        fs::write(root.path().join("notes.txt"), "Alpha\nBeta\n").unwrap();
        fs::create_dir(root.path().join("node_modules")).unwrap();
        fs::write(root.path().join("node_modules/secret.js"), "hidden").unwrap();
        let host = WorkspaceAgentHost::default();
        host.sync_context(WorkspaceAgentContextInput {
            root: Some(root.path().to_string_lossy().to_string()),
            read_only: false,
            protected_paths: Vec::new(),
            generation: 1,
        })
        .unwrap();
        (root, host)
    }

    #[test]
    fn discovers_searches_and_range_reads_unsupported_text_artifacts() {
        let (_root, host) = host_with_workspace();
        let listed = host.list_files(&json!({"glob":"*.html"})).unwrap();
        assert_eq!(listed["entries"].as_array().unwrap().len(), 1);
        assert_eq!(listed["entries"][0]["path"], "index.html");
        let searched = host.search_text(&json!({"query":"beta"})).unwrap();
        assert_eq!(searched["matches"][0]["path"], "notes.txt");
        let read = host
            .read_text(&json!({"path":"notes.txt","startLine":2,"endLine":2}))
            .unwrap();
        assert_eq!(read["content"], "Beta\n");
        assert!(read["digest"].as_str().unwrap().starts_with("sha256-"));
        assert!(host
            .read_text(&json!({"path":"node_modules/secret.js"}))
            .is_err());
        assert!(host
            .read_text(&json!({"path":"notes.txt","startLine":2,"endLine":3}))
            .is_err());
    }

    #[test]
    fn discovery_excludes_hidden_binary_invalid_oversized_and_symlink_files() {
        let (root, host) = host_with_workspace();
        fs::write(root.path().join(".env"), "TOKEN=secret\n").unwrap();
        fs::write(root.path().join("binary.dat"), b"abc\0def").unwrap();
        fs::write(root.path().join("invalid.txt"), [0xff, 0xfe]).unwrap();
        fs::write(
            root.path().join("oversized.txt"),
            vec![b'a'; MAX_TEXT_BYTES as usize + 1],
        )
        .unwrap();
        fs::create_dir(root.path().join("nested")).unwrap();
        fs::write(root.path().join("nested/visible.js"), "export {};\n").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink("notes.txt", root.path().join("linked.txt")).unwrap();

        let listed = host.list_files(&json!({"maxDepth":1})).unwrap();
        let paths = listed["entries"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|entry| entry["path"].as_str())
            .collect::<Vec<_>>();
        assert!(!paths.contains(&".env"));
        assert!(!paths.contains(&"binary.dat"));
        assert!(!paths.contains(&"invalid.txt"));
        assert!(!paths.contains(&"oversized.txt"));
        #[cfg(unix)]
        assert!(!paths.contains(&"linked.txt"));
        assert_eq!(listed["truncated"], true);

        for path in [".env", "binary.dat", "invalid.txt", "oversized.txt"] {
            assert!(host.read_text(&json!({"path":path})).is_err());
        }
    }

    #[test]
    fn traversal_budget_is_bounded_and_reports_truncation() {
        let (root, host) = host_with_workspace();
        let many = root.path().join("many");
        fs::create_dir(&many).unwrap();
        for index in 0..=MAX_WALK_ENTRIES {
            fs::write(many.join(format!("file-{index:04}.txt")), "text\n").unwrap();
        }
        let listed = host
            .list_files(&json!({"directory":"many","maxEntries":200}))
            .unwrap();
        assert_eq!(listed["truncated"], true);
        assert!(listed["entries"].as_array().unwrap().len() <= 200);
    }

    #[test]
    fn patch_is_atomic_digest_checked_diffable_and_undoable() {
        let (root, host) = host_with_workspace();
        fs::create_dir(root.path().join("site")).unwrap();
        let digest = digest_bytes(b"<h1>Hello</h1>\n");
        let watcher = WorkspaceWatcherState::default();
        let applied = host.apply_patch(&json!({"operations":[
            {"kind":"replace","path":"index.html","expectedDigest":digest,"replacements":[{"oldText":"Hello","newText":"World"}]},
            {"kind":"create","path":"site/styles.css","content":"body {}\n","expectedDigest":null}
        ]}), &watcher).unwrap();
        assert_eq!(
            fs::read_to_string(root.path().join("index.html")).unwrap(),
            "<h1>World</h1>\n"
        );
        assert!(root.path().join("site/styles.css").is_file());
        assert!(applied["diff"]
            .as_str()
            .unwrap()
            .contains("-<h1>Hello</h1>"));
        let id = applied["changeSetId"].as_str().unwrap();
        host.undo_change_set(&json!({"changeSetId":id}), &watcher)
            .unwrap();
        assert_eq!(
            fs::read_to_string(root.path().join("index.html")).unwrap(),
            "<h1>Hello</h1>\n"
        );
        assert!(!root.path().join("site/styles.css").exists());
        assert_eq!(
            host.get_change_set(&json!({"changeSetId":id})).unwrap()["status"],
            "undone"
        );
    }

    #[test]
    fn stale_ambiguous_protected_and_root_switched_changes_do_not_write() {
        let (root, host) = host_with_workspace();
        let watcher = WorkspaceWatcherState::default();
        assert!(host.apply_patch(&json!({"operations":[{"kind":"replace","path":"notes.txt","expectedDigest":"sha256-00","replacements":[{"oldText":"Alpha","newText":"Gamma"}]}]}), &watcher).is_err());
        assert_eq!(
            fs::read_to_string(root.path().join("notes.txt")).unwrap(),
            "Alpha\nBeta\n"
        );
        let digest = digest_bytes(b"Alpha\nBeta\n");
        assert!(host.apply_patch(&json!({"operations":[
            {"kind":"replace","path":"notes.txt","expectedDigest":digest,"replacements":[{"oldText":"a","newText":"x"}]},
            {"kind":"delete","path":"notes.txt","expectedDigest":digest}
        ]}), &watcher).is_err());
        assert!(host.apply_patch(&json!({"operations":[{"kind":"replace","path":"notes.txt","expectedDigest":digest,"replacements":[{"oldText":"Alpha","newText":"Alpha Alpha"},{"oldText":"Alpha","newText":"Gamma"}]}]}), &watcher).is_err());
        assert_eq!(
            fs::read_to_string(root.path().join("notes.txt")).unwrap(),
            "Alpha\nBeta\n"
        );
        host.sync_context(WorkspaceAgentContextInput {
            root: Some(root.path().to_string_lossy().to_string()),
            read_only: false,
            protected_paths: vec!["notes.txt".to_string()],
            generation: 2,
        })
        .unwrap();
        assert!(host.apply_patch(&json!({"operations":[{"kind":"replace","path":"notes.txt","expectedDigest":digest,"replacements":[{"oldText":"Alpha","newText":"Gamma"}]}]}), &watcher).is_err());
        assert_eq!(
            fs::read_to_string(root.path().join("notes.txt")).unwrap(),
            "Alpha\nBeta\n"
        );
    }

    #[test]
    fn rollback_restores_agent_writes_but_never_overwrites_a_later_external_edit() {
        let (root, _host) = host_with_workspace();
        let snapshots = vec![
            FileSnapshot {
                path: "index.html".to_string(),
                before: Some(b"<h1>Hello</h1>\n".to_vec()),
                after: Some(b"<h1>World</h1>\n".to_vec()),
            },
            FileSnapshot {
                path: "notes.txt".to_string(),
                before: Some(b"stale expected state\n".to_vec()),
                after: Some(b"new notes\n".to_vec()),
            },
        ];
        assert!(apply_snapshots(root.path(), &snapshots, false).is_err());
        assert_eq!(
            fs::read_to_string(root.path().join("index.html")).unwrap(),
            "<h1>Hello</h1>\n"
        );

        let staging = WorkspaceService::open(root.path())
            .unwrap()
            .ensure_temp_directory()
            .unwrap();
        fs::write(root.path().join("index.html"), "external edit\n").unwrap();
        let errors = rollback_committed(
            root.path(),
            &staging,
            vec![(
                &snapshots[0],
                snapshots[0].before.clone(),
                snapshots[0].after.clone(),
            )],
        );
        assert_eq!(errors.len(), 1);
        assert_eq!(
            fs::read_to_string(root.path().join("index.html")).unwrap(),
            "external edit\n"
        );
    }

    #[test]
    fn ledger_evicts_old_changes_and_clears_when_the_workspace_root_changes() {
        let (root, host) = host_with_workspace();
        let watcher = WorkspaceWatcherState::default();
        let mut ids = Vec::new();
        for index in 0..=MAX_LEDGER_ENTRIES {
            let applied = host
                .apply_patch(
                    &json!({"operations":[{
                        "kind":"create",
                        "path":format!("created-{index}.txt"),
                        "content":"text\n",
                        "expectedDigest":null
                    }]}),
                    &watcher,
                )
                .unwrap();
            ids.push(applied["changeSetId"].as_str().unwrap().to_string());
        }
        assert!(host.get_change_set(&json!({"changeSetId":ids[0]})).is_err());
        assert!(host
            .get_change_set(&json!({"changeSetId":ids[MAX_LEDGER_ENTRIES]}))
            .is_ok());

        let other = TempDir::new().unwrap();
        host.sync_context(WorkspaceAgentContextInput {
            root: Some(other.path().to_string_lossy().to_string()),
            read_only: false,
            protected_paths: Vec::new(),
            generation: 2,
        })
        .unwrap();
        assert!(host
            .get_change_set(&json!({"changeSetId":ids[MAX_LEDGER_ENTRIES]}))
            .is_err());
        assert!(root.path().join("created-8.txt").is_file());
    }
}
