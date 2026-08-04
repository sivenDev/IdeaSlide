use crate::workspace::{WorkspaceEntry, WorkspaceService, METADATA_DIRECTORY_NAME};
use notify::event::{ModifyKind, RenameMode};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};
use tauri::{AppHandle, Emitter};

const ACTIVE_WRITE_TTL: Duration = Duration::from_secs(30);
const COMPLETED_WRITE_TTL: Duration = Duration::from_secs(3);
const COALESCE_WINDOW: Duration = Duration::from_millis(120);
const AMBIGUOUS_RENAME_WINDOW: Duration = Duration::from_millis(400);

#[derive(Debug, Clone)]
struct PendingRename {
    absolute_path: PathBuf,
    relative_path: String,
    seen_at: Instant,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct FileStamp {
    length: u64,
    modified: Option<SystemTime>,
}

#[derive(Debug, Clone)]
enum ExpectedWrite {
    Active {
        started_at: Instant,
    },
    Completed {
        completed_at: Instant,
        stamp: FileStamp,
    },
}

type ExpectedWrites = Arc<Mutex<HashMap<PathBuf, ExpectedWrite>>>;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceChangeEvent {
    pub kind: String,
    pub path: Option<String>,
    pub old_path: Option<String>,
    pub new_path: Option<String>,
    pub entry: Option<WorkspaceEntry>,
    pub read_only: Option<bool>,
}

#[derive(Default)]
pub struct WorkspaceWatcherState {
    watcher: Mutex<Option<RecommendedWatcher>>,
    root: Mutex<Option<PathBuf>>,
    expected: ExpectedWrites,
    recent: Arc<Mutex<HashMap<String, Instant>>>,
    pending_rename: Arc<Mutex<Option<PendingRename>>>,
}

impl WorkspaceWatcherState {
    fn begin_expected_write(&self, root: &Path, relative_path: &str) -> Option<PathBuf> {
        if let Ok(service) = WorkspaceService::open(root) {
            let absolute = service.root().join(relative_path);
            let path = absolute.canonicalize().unwrap_or(absolute);
            self.expected.lock().unwrap().insert(
                path.clone(),
                ExpectedWrite::Active {
                    started_at: Instant::now(),
                },
            );
            return Some(path);
        }
        None
    }

    fn finish_expected_write(&self, path: Option<&Path>, succeeded: bool) {
        let Some(path) = path else { return };
        let mut expected = self.expected.lock().unwrap();
        if succeeded {
            if let Some(stamp) = file_stamp(path) {
                expected.insert(
                    path.to_path_buf(),
                    ExpectedWrite::Completed {
                        completed_at: Instant::now(),
                        stamp,
                    },
                );
                return;
            }
        }
        expected.remove(path);
    }

    pub fn with_expected_write<T, F>(
        &self,
        root: &Path,
        relative_path: &str,
        write: F,
    ) -> Result<T, String>
    where
        F: FnOnce() -> Result<T, String>,
    {
        let path = self.begin_expected_write(root, relative_path);
        let result = write();
        self.finish_expected_write(path.as_deref(), result.is_ok());
        result
    }

    fn start(&self, app: AppHandle, root: PathBuf) -> Result<(), String> {
        let service = WorkspaceService::open(&root)?;
        let canonical_root = service.root().to_path_buf();
        let last_read_only = Arc::new(Mutex::new(service.is_read_only()));
        let expected = Arc::clone(&self.expected);
        let recent = Arc::clone(&self.recent);
        let pending_rename = Arc::clone(&self.pending_rename);
        let callback_read_only = Arc::clone(&last_read_only);
        let callback_root = canonical_root.clone();
        let callback_app = app.clone();
        let mut watcher = notify::recommended_watcher(move |result: notify::Result<Event>| {
            let Ok(event) = result else { return };
            let (mut changes, pending_removal) =
                normalize_ambiguous_rename(&callback_root, &event, &expected, &pending_rename);
            if !matches!(
                event.kind,
                EventKind::Modify(ModifyKind::Name(RenameMode::Any))
            ) {
                changes.extend(normalize_event(&callback_root, &event, &expected));
            }
            match WorkspaceService::open(&callback_root) {
                Ok(service) => {
                    let current = service.is_read_only();
                    let mut previous = callback_read_only.lock().unwrap();
                    if current != *previous {
                        *previous = current;
                        changes.push(WorkspaceChangeEvent {
                            kind: "rootStatus".to_string(),
                            path: None,
                            old_path: None,
                            new_path: None,
                            entry: None,
                            read_only: Some(current),
                        });
                    }
                }
                Err(_)
                    if !callback_root.exists()
                        && !changes.iter().any(|change| change.kind == "rootMissing") =>
                {
                    changes.push(change("rootMissing", None, None, None, None));
                }
                Err(_) => {}
            }
            for change in changes {
                emit_change(&callback_app, &recent, change);
            }
            if let Some(ticket) = pending_removal {
                let delayed_pending = Arc::clone(&pending_rename);
                let delayed_recent = Arc::clone(&recent);
                let delayed_app = callback_app.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(AMBIGUOUS_RENAME_WINDOW);
                    let removal = {
                        let mut pending = delayed_pending.lock().unwrap();
                        if pending.as_ref().is_some_and(|candidate| {
                            candidate.absolute_path == ticket.absolute_path
                                && candidate.seen_at == ticket.seen_at
                        }) {
                            pending.take().map(|candidate| {
                                change("remove", Some(candidate.relative_path), None, None, None)
                            })
                        } else {
                            None
                        }
                    };
                    if let Some(removal) = removal {
                        emit_change(&delayed_app, &delayed_recent, removal);
                    }
                });
            }
        })
        .map_err(|error| format!("Failed to create Workspace watcher: {error}"))?;
        watcher
            .watch(&canonical_root, RecursiveMode::Recursive)
            .map_err(|error| format!("Failed to watch Workspace: {error}"))?;
        *self.watcher.lock().unwrap() = Some(watcher);
        *self.root.lock().unwrap() = Some(canonical_root);
        Ok(())
    }

    fn stop(&self) {
        self.watcher.lock().unwrap().take();
        self.root.lock().unwrap().take();
        self.expected.lock().unwrap().clear();
        self.recent.lock().unwrap().clear();
        self.pending_rename.lock().unwrap().take();
    }
}

fn emit_change(
    app: &AppHandle,
    recent: &Arc<Mutex<HashMap<String, Instant>>>,
    change: WorkspaceChangeEvent,
) {
    let key = format!(
        "{}:{:?}:{:?}:{:?}",
        change.kind, change.path, change.old_path, change.new_path
    );
    let now = Instant::now();
    let mut recent_events = recent.lock().unwrap();
    recent_events.retain(|_, seen| now.duration_since(*seen) <= COALESCE_WINDOW);
    if recent_events
        .get(&key)
        .is_some_and(|seen| now.duration_since(*seen) <= COALESCE_WINDOW)
    {
        return;
    }
    recent_events.insert(key, now);
    drop(recent_events);
    let _ = app.emit_to("main", "workspace-change", change);
}

fn relative_path(root: &Path, path: &Path) -> Option<String> {
    path.strip_prefix(root)
        .ok()
        .map(|relative| relative.to_string_lossy().replace('\\', "/"))
}

fn ignored_relative(path: &str) -> bool {
    let first = path.split('/').next().unwrap_or_default();
    first.eq_ignore_ascii_case(METADATA_DIRECTORY_NAME) || path.is_empty()
}

fn crosses_symlink(root: &Path, path: &Path) -> bool {
    let Ok(relative) = path.strip_prefix(root) else {
        return false;
    };
    let mut current = root.to_path_buf();
    for component in relative.components() {
        current.push(component);
        if fs_symlink_metadata(&current).is_some_and(|metadata| metadata.file_type().is_symlink()) {
            return true;
        }
    }
    false
}

fn fs_symlink_metadata(path: &Path) -> Option<std::fs::Metadata> {
    std::fs::symlink_metadata(path).ok()
}

fn file_stamp(path: &Path) -> Option<FileStamp> {
    let metadata = std::fs::metadata(path).ok()?;
    if !metadata.is_file() {
        return None;
    }
    Some(FileStamp {
        length: metadata.len(),
        modified: metadata.modified().ok(),
    })
}

fn should_suppress_expected(expected: &ExpectedWrites, path: &Path) -> bool {
    let now = Instant::now();
    let mut entries = expected.lock().unwrap();
    entries.retain(|_, write| match write {
        ExpectedWrite::Active { started_at } => now.duration_since(*started_at) <= ACTIVE_WRITE_TTL,
        ExpectedWrite::Completed { completed_at, .. } => {
            now.duration_since(*completed_at) <= COMPLETED_WRITE_TTL
        }
    });
    let Some(write) = entries.get(path).cloned() else {
        return false;
    };
    match write {
        ExpectedWrite::Active { .. } => true,
        ExpectedWrite::Completed { stamp, .. } => {
            if file_stamp(path).as_ref() == Some(&stamp) {
                true
            } else {
                entries.remove(path);
                false
            }
        }
    }
}

fn entry_for(root: &Path, relative: &str) -> Option<WorkspaceEntry> {
    WorkspaceService::open(root).ok()?.entry(relative).ok()
}

fn change(
    kind: &str,
    path: Option<String>,
    old_path: Option<String>,
    new_path: Option<String>,
    entry: Option<WorkspaceEntry>,
) -> WorkspaceChangeEvent {
    WorkspaceChangeEvent {
        kind: kind.to_string(),
        path,
        old_path,
        new_path,
        entry,
        read_only: None,
    }
}

fn normalize_ambiguous_rename(
    root: &Path,
    event: &Event,
    expected: &ExpectedWrites,
    pending: &Arc<Mutex<Option<PendingRename>>>,
) -> (Vec<WorkspaceChangeEvent>, Option<PendingRename>) {
    if !matches!(
        event.kind,
        EventKind::Modify(ModifyKind::Name(RenameMode::Any))
    ) {
        return (Vec::new(), None);
    }

    let mut changes = Vec::new();
    let mut pending_removal = None;
    for path in &event.paths {
        let Some(relative) = relative_path(root, path) else {
            continue;
        };
        if ignored_relative(&relative) || crosses_symlink(root, path) {
            continue;
        }

        if should_suppress_expected(expected, path) {
            continue;
        }

        if path.exists() {
            let previous = pending.lock().unwrap().take();
            if let Some(previous) = previous {
                if previous.seen_at.elapsed() <= AMBIGUOUS_RENAME_WINDOW {
                    changes.push(change(
                        "rename",
                        None,
                        Some(previous.relative_path),
                        Some(relative.clone()),
                        entry_for(root, &relative),
                    ));
                } else {
                    changes.push(change(
                        "remove",
                        Some(previous.relative_path),
                        None,
                        None,
                        None,
                    ));
                    changes.push(change(
                        "create",
                        Some(relative.clone()),
                        None,
                        None,
                        entry_for(root, &relative),
                    ));
                }
            } else {
                changes.push(change(
                    "create",
                    Some(relative.clone()),
                    None,
                    None,
                    entry_for(root, &relative),
                ));
            }
        } else {
            let candidate = PendingRename {
                absolute_path: path.clone(),
                relative_path: relative,
                seen_at: Instant::now(),
            };
            if let Some(previous) = pending.lock().unwrap().replace(candidate.clone()) {
                changes.push(change(
                    "remove",
                    Some(previous.relative_path),
                    None,
                    None,
                    None,
                ));
            }
            pending_removal = Some(candidate);
        }
    }

    (changes, pending_removal)
}

fn normalize_event(
    root: &Path,
    event: &Event,
    expected: &ExpectedWrites,
) -> Vec<WorkspaceChangeEvent> {
    if event.paths.iter().any(|path| path == root) && matches!(event.kind, EventKind::Remove(_)) {
        return vec![change("rootMissing", None, None, None, None)];
    }
    if matches!(
        event.kind,
        EventKind::Modify(ModifyKind::Name(RenameMode::Both))
    ) && event.paths.len() >= 2
    {
        if event
            .paths
            .iter()
            .any(|path| should_suppress_expected(expected, path))
        {
            return Vec::new();
        }
        let old = relative_path(root, &event.paths[0]);
        let new = relative_path(root, &event.paths[1]);
        if let (Some(old_path), Some(new_path)) = (old, new) {
            if ignored_relative(&old_path)
                || ignored_relative(&new_path)
                || crosses_symlink(root, &event.paths[0])
                || crosses_symlink(root, &event.paths[1])
            {
                return Vec::new();
            }
            return vec![change(
                "rename",
                None,
                Some(old_path),
                Some(new_path.clone()),
                entry_for(root, &new_path),
            )];
        }
    }
    event
        .paths
        .iter()
        .filter_map(|path| {
            let relative = relative_path(root, path)?;
            if ignored_relative(&relative)
                || crosses_symlink(root, path)
                || should_suppress_expected(expected, path)
            {
                return None;
            }
            match event.kind {
                EventKind::Create(_) => Some(change(
                    "create",
                    Some(relative.clone()),
                    None,
                    None,
                    entry_for(root, &relative),
                )),
                EventKind::Modify(ModifyKind::Name(_)) => None,
                EventKind::Modify(_) => Some(change(
                    "modify",
                    Some(relative.clone()),
                    None,
                    None,
                    entry_for(root, &relative),
                )),
                EventKind::Remove(_) => Some(change("remove", Some(relative), None, None, None)),
                _ => None,
            }
        })
        .collect()
}

#[tauri::command]
pub fn start_workspace_watcher(
    app: AppHandle,
    state: tauri::State<'_, WorkspaceWatcherState>,
    root: String,
) -> Result<(), String> {
    state.stop();
    state.start(app, PathBuf::from(root))
}

#[tauri::command]
pub fn stop_workspace_watcher(state: tauri::State<'_, WorkspaceWatcherState>) {
    state.stop();
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::{CreateKind, RemoveKind};
    use tempfile::TempDir;

    fn active_expected(path: PathBuf) -> ExpectedWrites {
        Arc::new(Mutex::new(HashMap::from([(
            path,
            ExpectedWrite::Active {
                started_at: Instant::now(),
            },
        )])))
    }

    #[test]
    fn normalizes_create_remove_and_rename_without_internal_paths() {
        let dir = TempDir::new().unwrap();
        std::fs::write(dir.path().join("a.is"), b"x").unwrap();
        std::fs::write(dir.path().join("notes.txt"), b"x").unwrap();
        let expected = Arc::new(Mutex::new(HashMap::new()));
        let create =
            Event::new(EventKind::Create(CreateKind::File)).add_path(dir.path().join("a.is"));
        assert_eq!(
            normalize_event(dir.path(), &create, &expected)[0].kind,
            "create"
        );
        let hidden = Event::new(EventKind::Create(CreateKind::File))
            .add_path(dir.path().join(".ideanote/state.json"));
        assert!(normalize_event(dir.path(), &hidden, &expected).is_empty());
        let hidden_case_variant = Event::new(EventKind::Create(CreateKind::File))
            .add_path(dir.path().join(".IdeaNote/tmp/staged"));
        assert!(normalize_event(dir.path(), &hidden_case_variant, &expected).is_empty());
        let unsupported =
            Event::new(EventKind::Create(CreateKind::File)).add_path(dir.path().join("notes.txt"));
        let unsupported_changes = normalize_event(dir.path(), &unsupported, &expected);
        assert_eq!(unsupported_changes.len(), 1);
        assert!(unsupported_changes[0].entry.is_none());
        let remove =
            Event::new(EventKind::Remove(RemoveKind::File)).add_path(dir.path().join("a.is"));
        assert_eq!(
            normalize_event(dir.path(), &remove, &expected)[0].kind,
            "remove"
        );
        let rename = Event::new(EventKind::Modify(ModifyKind::Name(RenameMode::Both)))
            .add_path(dir.path().join("a.is"))
            .add_path(dir.path().join("b.is"));
        assert_eq!(
            normalize_event(dir.path(), &rename, &expected)[0]
                .old_path
                .as_deref(),
            Some("a.is")
        );

        std::fs::rename(dir.path().join("a.is"), dir.path().join("a.txt")).unwrap();
        let supported_to_unsupported =
            Event::new(EventKind::Modify(ModifyKind::Name(RenameMode::Both)))
                .add_path(dir.path().join("a.is"))
                .add_path(dir.path().join("a.txt"));
        let changes = normalize_event(dir.path(), &supported_to_unsupported, &expected);
        assert_eq!(changes.len(), 1);
        assert!(changes[0].entry.is_none());

        std::fs::rename(dir.path().join("notes.txt"), dir.path().join("notes.is")).unwrap();
        let unsupported_to_supported =
            Event::new(EventKind::Modify(ModifyKind::Name(RenameMode::Both)))
                .add_path(dir.path().join("notes.txt"))
                .add_path(dir.path().join("notes.is"));
        let changes = normalize_event(dir.path(), &unsupported_to_supported, &expected);
        assert_eq!(changes.len(), 1);
        assert_eq!(
            changes[0]
                .entry
                .as_ref()
                .and_then(|entry| entry.file_type.as_deref()),
            Some("ideasketch")
        );
    }

    #[test]
    fn expected_write_suppresses_the_full_event_burst() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("saved.is");
        std::fs::write(&path, b"x").unwrap();
        let expected = active_expected(path.clone());
        let modify = Event::new(EventKind::Modify(ModifyKind::Data(
            notify::event::DataChange::Any,
        )))
        .add_path(path);
        assert!(normalize_event(dir.path(), &modify, &expected).is_empty());
        assert!(normalize_event(dir.path(), &modify, &expected).is_empty());
    }

    #[test]
    fn expected_write_suppresses_ambiguous_remove_before_replacement_create() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("saved.is");
        std::fs::write(&path, b"before").unwrap();
        let expected = active_expected(path.clone());
        let pending = Arc::new(Mutex::new(None));

        std::fs::remove_file(&path).unwrap();
        let remove =
            Event::new(EventKind::Modify(ModifyKind::Name(RenameMode::Any))).add_path(path);
        let (changes, ticket) =
            normalize_ambiguous_rename(dir.path(), &remove, &expected, &pending);

        assert!(changes.is_empty());
        assert!(ticket.is_none());
        assert!(pending.lock().unwrap().is_none());
    }

    #[test]
    fn completed_write_suppresses_matching_events_until_the_file_changes() {
        let dir = TempDir::new().unwrap();
        let root = dir.path().canonicalize().unwrap();
        let path = root.join("saved.is");
        std::fs::write(&path, b"before").unwrap();
        let state = WorkspaceWatcherState::default();

        state
            .with_expected_write(&root, "saved.is", || {
                std::fs::write(&path, b"saved").map_err(|error| error.to_string())
            })
            .unwrap();

        let modify = Event::new(EventKind::Modify(ModifyKind::Data(
            notify::event::DataChange::Any,
        )))
        .add_path(path.clone());
        assert!(normalize_event(&root, &modify, &state.expected).is_empty());

        std::fs::write(&path, b"external-change").unwrap();
        let changes = normalize_event(&root, &modify, &state.expected);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].kind, "modify");
        assert!(state.expected.lock().unwrap().is_empty());
    }

    #[test]
    fn failed_write_and_other_paths_remain_observable() {
        let dir = TempDir::new().unwrap();
        let saved_path = dir.path().join("saved.is");
        let other_path = dir.path().join("other.is");
        std::fs::write(&saved_path, b"saved").unwrap();
        std::fs::write(&other_path, b"other").unwrap();
        let state = WorkspaceWatcherState::default();

        let result = state.with_expected_write(dir.path(), "saved.is", || {
            Err::<(), String>("save failed".to_string())
        });
        assert!(result.is_err());
        assert!(state.expected.lock().unwrap().is_empty());

        let other_modify = Event::new(EventKind::Modify(ModifyKind::Any)).add_path(other_path);
        assert_eq!(
            normalize_event(dir.path(), &other_modify, &active_expected(saved_path)).len(),
            1
        );
    }

    #[test]
    fn completed_write_expiry_and_external_delete_clear_suppression() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("saved.is");
        std::fs::write(&path, b"saved").unwrap();
        let expired = Arc::new(Mutex::new(HashMap::from([(
            path.clone(),
            ExpectedWrite::Completed {
                completed_at: Instant::now()
                    .checked_sub(COMPLETED_WRITE_TTL + Duration::from_millis(1))
                    .unwrap(),
                stamp: file_stamp(&path).unwrap(),
            },
        )])));
        let modify = Event::new(EventKind::Modify(ModifyKind::Any)).add_path(path.clone());
        assert_eq!(normalize_event(dir.path(), &modify, &expired).len(), 1);
        assert!(expired.lock().unwrap().is_empty());

        let completed = Arc::new(Mutex::new(HashMap::from([(
            path.clone(),
            ExpectedWrite::Completed {
                completed_at: Instant::now(),
                stamp: file_stamp(&path).unwrap(),
            },
        )])));
        std::fs::remove_file(&path).unwrap();
        let remove = Event::new(EventKind::Remove(RemoveKind::File)).add_path(path);
        let changes = normalize_event(dir.path(), &remove, &completed);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].kind, "remove");
        assert!(completed.lock().unwrap().is_empty());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn native_atomic_replace_burst_is_suppressed_without_hiding_another_file() {
        use crate::document_formats::OpenDocumentResult;
        use std::sync::mpsc;

        let dir = TempDir::new().unwrap();
        let root = dir.path().canonicalize().unwrap();
        let saved_path = root.join("saved.is");
        let other_path = root.join("other.is");
        let service = WorkspaceService::open(&root).unwrap();
        service
            .create_document("", "ideasketch", Some("saved.is"))
            .unwrap();
        service
            .create_document("", "ideasketch", Some("other.is"))
            .unwrap();
        let document = match service.open_document("saved.is").unwrap() {
            OpenDocumentResult::Editable { document } => document,
            OpenDocumentResult::LegacyProtected { .. } => panic!("new document was protected"),
        };

        let (sender, receiver) = mpsc::channel();
        let mut watcher = notify::recommended_watcher(move |result| {
            let _ = sender.send(result);
        })
        .unwrap();
        watcher.watch(&root, RecursiveMode::Recursive).unwrap();

        let state = WorkspaceWatcherState::default();
        state
            .with_expected_write(&root, "saved.is", || {
                service.save_document("saved.is", &document).map(|_| ())
            })
            .unwrap();

        let pending = Arc::new(Mutex::new(None));
        let deadline = Instant::now() + Duration::from_secs(2);
        let mut saw_saved_path_event = false;
        let mut projected = Vec::new();
        while let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
            match receiver.recv_timeout(remaining.min(Duration::from_millis(100))) {
                Ok(Ok(event)) => {
                    saw_saved_path_event |= event.paths.iter().any(|path| path == &saved_path);
                    let (mut changes, ticket) =
                        normalize_ambiguous_rename(&root, &event, &state.expected, &pending);
                    assert!(ticket.is_none());
                    if !matches!(
                        event.kind,
                        EventKind::Modify(ModifyKind::Name(RenameMode::Any))
                    ) {
                        changes.extend(normalize_event(&root, &event, &state.expected));
                    }
                    projected.extend(changes);
                }
                Ok(Err(error)) => panic!("native watcher failed: {error}"),
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
        assert!(saw_saved_path_event);
        assert!(projected.is_empty());

        std::fs::write(&other_path, b"external-change").unwrap();
        let deadline = Instant::now() + Duration::from_secs(2);
        let mut projected_other = false;
        while let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
            match receiver.recv_timeout(remaining.min(Duration::from_millis(100))) {
                Ok(Ok(event)) => {
                    let (mut changes, _) =
                        normalize_ambiguous_rename(&root, &event, &state.expected, &pending);
                    if !matches!(
                        event.kind,
                        EventKind::Modify(ModifyKind::Name(RenameMode::Any))
                    ) {
                        changes.extend(normalize_event(&root, &event, &state.expected));
                    }
                    if changes
                        .iter()
                        .any(|change| change.path.as_deref() == Some("other.is"))
                    {
                        projected_other = true;
                        break;
                    }
                }
                Ok(Err(error)) => panic!("native watcher failed: {error}"),
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
        assert!(projected_other);
    }

    #[test]
    fn pairs_ambiguous_macos_rename_events() {
        let dir = TempDir::new().unwrap();
        let old_path = dir.path().join("before.is");
        let new_path = dir.path().join("after.is");
        std::fs::write(&old_path, b"x").unwrap();
        std::fs::rename(&old_path, &new_path).unwrap();
        let expected = Arc::new(Mutex::new(HashMap::new()));
        let pending = Arc::new(Mutex::new(None));

        let from =
            Event::new(EventKind::Modify(ModifyKind::Name(RenameMode::Any))).add_path(old_path);
        let (from_changes, ticket) =
            normalize_ambiguous_rename(dir.path(), &from, &expected, &pending);
        assert!(from_changes.is_empty());
        assert!(ticket.is_some());

        let to =
            Event::new(EventKind::Modify(ModifyKind::Name(RenameMode::Any))).add_path(new_path);
        let (to_changes, _) = normalize_ambiguous_rename(dir.path(), &to, &expected, &pending);
        assert_eq!(to_changes.len(), 1);
        assert_eq!(to_changes[0].kind, "rename");
        assert_eq!(to_changes[0].old_path.as_deref(), Some("before.is"));
        assert_eq!(to_changes[0].new_path.as_deref(), Some("after.is"));
        assert!(pending.lock().unwrap().is_none());
    }

    #[test]
    fn keeps_unpaired_ambiguous_rename_as_pending_removal() {
        let dir = TempDir::new().unwrap();
        let missing_path = dir.path().join("deleted.is");
        let expected = Arc::new(Mutex::new(HashMap::new()));
        let pending = Arc::new(Mutex::new(None));
        let event =
            Event::new(EventKind::Modify(ModifyKind::Name(RenameMode::Any))).add_path(missing_path);

        let (changes, ticket) = normalize_ambiguous_rename(dir.path(), &event, &expected, &pending);

        assert!(changes.is_empty());
        assert_eq!(ticket.unwrap().relative_path, "deleted.is");
        assert_eq!(
            pending.lock().unwrap().as_ref().unwrap().relative_path,
            "deleted.is"
        );
    }

    #[cfg(unix)]
    #[test]
    fn ignores_events_reached_through_workspace_symlinks() {
        use std::os::unix::fs::symlink;

        let dir = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        std::fs::write(outside.path().join("outside.is"), b"x").unwrap();
        symlink(outside.path(), dir.path().join("linked")).unwrap();
        let event = Event::new(EventKind::Modify(ModifyKind::Any))
            .add_path(dir.path().join("linked/outside.is"));
        let expected = Arc::new(Mutex::new(HashMap::new()));
        assert!(normalize_event(dir.path(), &event, &expected).is_empty());
    }
}
