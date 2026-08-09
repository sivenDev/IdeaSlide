use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::safe_write::{self, WriteMode};

const THREAD_SCHEMA_VERSION: u32 = 1;
const DEFAULT_PAGE_SIZE: usize = 20;
const MAX_PAGE_SIZE: usize = 100;
const MAX_RECORD_BYTES: usize = 1024 * 1024;
const MAX_STRING_BYTES: usize = 64 * 1024;
const MAX_ARRAY_ITEMS: usize = 500;
const MAX_JSON_DEPTH: usize = 16;

fn default_schema_version() -> u32 {
    0
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentThreadRuntimeMetadata {
    pub kind: String,
    pub label: String,
    pub model: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upstream_thread_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub compacted_before_turn_id: Option<String>,
    #[serde(default)]
    pub degraded: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentThreadRecord {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    pub thread: Value,
    pub capabilities: Value,
    pub runtime: AgentThreadRuntimeMetadata,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub archived_at: Option<u64>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentThreadSummary {
    pub id: String,
    pub title: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub turn_count: usize,
    pub archived_at: Option<u64>,
    pub runtime: AgentThreadRuntimeMetadata,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentThreadPage {
    pub threads: Vec<AgentThreadSummary>,
    pub next_cursor: Option<String>,
    pub recovered_corrupt_entries: usize,
}

pub(crate) struct AgentThreadRepository {
    root: PathBuf,
}

impl AgentThreadRepository {
    pub(crate) fn new(root: PathBuf) -> Self {
        Self { root }
    }

    fn threads_dir(&self) -> PathBuf {
        self.root.join("threads")
    }

    fn staging_dir(&self) -> PathBuf {
        self.root.join("tmp")
    }

    fn corrupt_dir(&self) -> PathBuf {
        self.root.join("corrupt")
    }

    fn thread_path(&self, thread_id: &str) -> Result<PathBuf, String> {
        validate_thread_id(thread_id)?;
        Ok(self.threads_dir().join(format!("{thread_id}.json")))
    }

    pub(crate) fn save(&self, record: AgentThreadRecord) -> Result<AgentThreadRecord, String> {
        let record = normalize_record(record)?;
        let summary = summary_from_record(&record)?;
        let target = self.thread_path(&summary.id)?;
        let bytes = serde_json::to_vec_pretty(&record)
            .map_err(|error| format!("Agent Thread could not be encoded: {error}"))?;
        if bytes.len() > MAX_RECORD_BYTES {
            return Err("Agent Thread history exceeds the bounded persistence limit.".to_string());
        }
        safe_write::write_bytes(&target, &self.staging_dir(), &bytes, WriteMode::Replace)?;
        Ok(record)
    }

    pub(crate) fn load(&self, thread_id: &str) -> Result<Option<AgentThreadRecord>, String> {
        let path = self.thread_path(thread_id)?;
        if !path.exists() {
            return Ok(None);
        }
        match self.read_record(&path) {
            Ok(record) => Ok(Some(record)),
            Err(error) => {
                self.quarantine(&path)?;
                Err(error)
            }
        }
    }

    pub(crate) fn list(
        &self,
        cursor: Option<String>,
        limit: Option<usize>,
        include_archived: bool,
    ) -> Result<AgentThreadPage, String> {
        fs::create_dir_all(self.threads_dir())
            .map_err(|error| format!("Agent history directory could not be created: {error}"))?;
        let mut summaries = Vec::new();
        let mut recovered_corrupt_entries = 0;
        for entry in fs::read_dir(self.threads_dir())
            .map_err(|error| format!("Agent history could not be listed: {error}"))?
        {
            let entry =
                entry.map_err(|error| format!("Agent history entry could not be read: {error}"))?;
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("json") {
                continue;
            }
            match self
                .read_record(&path)
                .and_then(|record| summary_from_record(&record))
            {
                Ok(summary) if include_archived || summary.archived_at.is_none() => {
                    summaries.push(summary)
                }
                Ok(_) => {}
                Err(_) => {
                    self.quarantine(&path)?;
                    recovered_corrupt_entries += 1;
                }
            }
        }
        summaries.sort_by(|left, right| {
            right
                .updated_at
                .cmp(&left.updated_at)
                .then_with(|| right.id.cmp(&left.id))
        });
        let offset = cursor
            .as_deref()
            .unwrap_or("0")
            .parse::<usize>()
            .map_err(|_| "Agent history cursor is invalid".to_string())?;
        let page_size = limit.unwrap_or(DEFAULT_PAGE_SIZE).clamp(1, MAX_PAGE_SIZE);
        let threads = summaries
            .iter()
            .skip(offset)
            .take(page_size)
            .cloned()
            .collect::<Vec<_>>();
        let next_offset = offset.saturating_add(threads.len());
        Ok(AgentThreadPage {
            threads,
            next_cursor: (next_offset < summaries.len()).then(|| next_offset.to_string()),
            recovered_corrupt_entries,
        })
    }

    pub(crate) fn rename(&self, thread_id: &str, title: &str) -> Result<AgentThreadRecord, String> {
        let title = title.trim();
        if title.is_empty() || title.len() > 160 {
            return Err("Thread title must be between 1 and 160 characters.".to_string());
        }
        let mut record = self
            .load(thread_id)?
            .ok_or_else(|| "Agent Thread was not found".to_string())?;
        let thread = record
            .thread
            .as_object_mut()
            .ok_or_else(|| "Agent Thread payload is invalid".to_string())?;
        thread.insert("title".to_string(), Value::String(title.to_string()));
        thread.insert("updatedAt".to_string(), Value::from(now_millis()));
        self.save(record)
    }

    pub(crate) fn archive(&self, thread_id: &str) -> Result<AgentThreadRecord, String> {
        let mut record = self
            .load(thread_id)?
            .ok_or_else(|| "Agent Thread was not found".to_string())?;
        let now = now_millis();
        record.archived_at = Some(now);
        if let Some(thread) = record.thread.as_object_mut() {
            thread.insert("updatedAt".to_string(), Value::from(now));
        }
        self.save(record)
    }

    pub(crate) fn delete(&self, thread_id: &str) -> Result<bool, String> {
        let path = self.thread_path(thread_id)?;
        match fs::remove_file(path) {
            Ok(()) => Ok(true),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(error) => Err(format!("Agent Thread could not be deleted: {error}")),
        }
    }

    fn read_record(&self, path: &Path) -> Result<AgentThreadRecord, String> {
        let metadata = fs::metadata(path)
            .map_err(|error| format!("Agent Thread metadata could not be read: {error}"))?;
        if metadata.len() > MAX_RECORD_BYTES as u64 {
            return Err("Agent Thread history exceeds the bounded persistence limit.".to_string());
        }
        let bytes =
            fs::read(path).map_err(|error| format!("Agent Thread could not be read: {error}"))?;
        let record = serde_json::from_slice::<AgentThreadRecord>(&bytes)
            .map_err(|error| format!("Agent Thread is corrupt: {error}"))?;
        normalize_record(record)
    }

    fn quarantine(&self, path: &Path) -> Result<(), String> {
        fs::create_dir_all(self.corrupt_dir())
            .map_err(|error| format!("Agent recovery directory could not be created: {error}"))?;
        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("thread.json");
        let destination = self
            .corrupt_dir()
            .join(format!("{}-{file_name}", now_millis()));
        fs::rename(path, destination)
            .map_err(|error| format!("Corrupt Agent Thread could not be quarantined: {error}"))
    }
}

fn normalize_record(mut record: AgentThreadRecord) -> Result<AgentThreadRecord, String> {
    if record.schema_version > THREAD_SCHEMA_VERSION {
        return Err("Agent Thread history uses a newer unsupported schema.".to_string());
    }
    record.schema_version = THREAD_SCHEMA_VERSION;
    record.thread = sanitize_json(record.thread, 0, None)?;
    record.capabilities = sanitize_json(record.capabilities, 0, None)?;
    record.runtime.kind = bounded_string(record.runtime.kind, 80);
    record.runtime.label = bounded_string(record.runtime.label, 160);
    record.runtime.model = bounded_string(record.runtime.model, 160);
    record.runtime.upstream_thread_id = record
        .runtime
        .upstream_thread_id
        .map(|value| bounded_string(value, 256));
    record.runtime.compacted_before_turn_id = record
        .runtime
        .compacted_before_turn_id
        .map(|value| bounded_string(value, 160));
    retain_persistable_turns(&mut record.thread)?;
    summary_from_record(&record)?;
    Ok(record)
}

fn retain_persistable_turns(thread: &mut Value) -> Result<(), String> {
    let object = thread
        .as_object_mut()
        .ok_or_else(|| "Agent Thread payload must be an object".to_string())?;
    let turns = object
        .get_mut("turns")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| "Agent Thread turns are missing".to_string())?;
    turns.retain(|turn| {
        turn.get("status")
            .and_then(Value::as_str)
            .is_some_and(|status| matches!(status, "completed" | "cancelled" | "failed"))
    });
    if turns.len() > MAX_ARRAY_ITEMS {
        let keep_from = turns.len() - MAX_ARRAY_ITEMS;
        turns.drain(..keep_from);
    }
    for turn in turns {
        let Some(items) = turn.get_mut("items").and_then(Value::as_array_mut) else {
            continue;
        };
        items.retain(|item| {
            !matches!(
                item.get("kind").and_then(Value::as_str),
                Some("reasoningSummary" | "changeReview")
            )
        });
        if items.len() > MAX_ARRAY_ITEMS {
            let keep_from = items.len() - MAX_ARRAY_ITEMS;
            items.drain(..keep_from);
        }
    }
    Ok(())
}

fn sanitize_json(value: Value, depth: usize, key: Option<&str>) -> Result<Value, String> {
    if depth > MAX_JSON_DEPTH {
        return Ok(Value::String("[truncated]".to_string()));
    }
    if key.is_some_and(is_sensitive_key) {
        return Ok(Value::Null);
    }
    match value {
        Value::String(value) => Ok(Value::String(bounded_string(value, MAX_STRING_BYTES))),
        Value::Array(values) => Ok(Value::Array(
            values
                .into_iter()
                .take(MAX_ARRAY_ITEMS)
                .map(|value| sanitize_json(value, depth + 1, None))
                .collect::<Result<Vec<_>, _>>()?,
        )),
        Value::Object(values) => {
            let mut sanitized = Map::new();
            for (name, value) in values {
                if is_sensitive_key(&name) {
                    continue;
                }
                sanitized.insert(name.clone(), sanitize_json(value, depth + 1, Some(&name))?);
            }
            Ok(Value::Object(sanitized))
        }
        other => Ok(other),
    }
}

fn is_sensitive_key(key: &str) -> bool {
    let normalized = key.to_ascii_lowercase().replace(['-', '_'], "");
    normalized.contains("apikey")
        || normalized.contains("authorization")
        || normalized.contains("credential")
        || normalized == "token"
        || normalized.ends_with("token")
        || normalized.contains("rawpayload")
        || normalized.contains("chainofthought")
        || normalized == "context"
        || normalized == "headers"
}

fn bounded_string(mut value: String, max_bytes: usize) -> String {
    if value.len() <= max_bytes {
        return value;
    }
    let mut boundary = max_bytes;
    while !value.is_char_boundary(boundary) {
        boundary -= 1;
    }
    value.truncate(boundary);
    value.push_str("…[truncated]");
    value
}

fn summary_from_record(record: &AgentThreadRecord) -> Result<AgentThreadSummary, String> {
    let thread = record
        .thread
        .as_object()
        .ok_or_else(|| "Agent Thread payload must be an object".to_string())?;
    let id = thread
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "Agent Thread id is missing".to_string())?
        .to_string();
    validate_thread_id(&id)?;
    let title = thread
        .get("title")
        .and_then(Value::as_str)
        .ok_or_else(|| "Agent Thread title is missing".to_string())?
        .to_string();
    let created_at = thread
        .get("createdAt")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Agent Thread creation time is missing".to_string())?;
    let updated_at = thread
        .get("updatedAt")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Agent Thread update time is missing".to_string())?;
    let turn_count = thread
        .get("turns")
        .and_then(Value::as_array)
        .ok_or_else(|| "Agent Thread turns are missing".to_string())?
        .len();
    Ok(AgentThreadSummary {
        id,
        title,
        created_at,
        updated_at,
        turn_count,
        archived_at: record.archived_at,
        runtime: record.runtime.clone(),
    })
}

fn validate_thread_id(thread_id: &str) -> Result<(), String> {
    if thread_id.is_empty()
        || thread_id.len() > 128
        || !thread_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err("Agent Thread id is invalid".to_string());
    }
    Ok(())
}

fn now_millis() -> u64 {
    chrono::Utc::now().timestamp_millis().max(0) as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::TempDir;

    fn record(id: &str, updated_at: u64) -> AgentThreadRecord {
        AgentThreadRecord {
            schema_version: 0,
            thread: json!({
                "id": id,
                "title": "Architecture",
                "createdAt": 1,
                "updatedAt": updated_at,
                "turns": [
                    {"id": "welcome", "status": "completed", "items": [{"kind": "message", "content": "Ready"}]},
                    {"id": "running", "status": "running", "items": [{"kind": "message", "content": "partial"}]},
                    {"id": "done", "status": "completed", "items": [
                        {"kind": "reasoningSummary", "content": "private summary"},
                        {"kind": "changeReview", "status": "pending", "changeSet": {
                            "status": "proposed", "operations": [{"kind": "replace", "elements": [1, 2, 3]}]
                        }}
                    ]}
                ]
            }),
            capabilities: json!({"persistence": true, "apiKey": "secret"}),
            runtime: AgentThreadRuntimeMetadata {
                kind: "compatibility".to_string(),
                label: "Compatibility".to_string(),
                model: "test-model".to_string(),
                upstream_thread_id: None,
                compacted_before_turn_id: None,
                degraded: true,
            },
            archived_at: None,
        }
    }

    #[test]
    fn saves_lists_loads_renames_archives_deletes_and_migrates_atomically() {
        let root = TempDir::new().unwrap();
        let repository = AgentThreadRepository::new(root.path().join("agent"));
        let saved = repository.save(record("thread-1", 4)).unwrap();
        assert_eq!(saved.schema_version, THREAD_SCHEMA_VERSION);
        assert_eq!(saved.thread["turns"].as_array().unwrap().len(), 2);
        assert!(saved.thread["turns"][1]["items"]
            .as_array()
            .unwrap()
            .is_empty());
        assert!(saved.capabilities.get("apiKey").is_none());

        repository.save(record("thread-2", 9)).unwrap();
        let first_page = repository.list(None, Some(1), false).unwrap();
        assert_eq!(first_page.threads[0].id, "thread-2");
        assert_eq!(first_page.next_cursor.as_deref(), Some("1"));
        let second_page = repository
            .list(first_page.next_cursor, Some(1), false)
            .unwrap();
        assert_eq!(second_page.threads[0].id, "thread-1");

        let renamed = repository.rename("thread-1", "Renamed").unwrap();
        assert_eq!(renamed.thread["title"], "Renamed");
        repository.archive("thread-1").unwrap();
        assert_eq!(repository.list(None, None, false).unwrap().threads.len(), 1);
        assert_eq!(repository.list(None, None, true).unwrap().threads.len(), 2);
        assert!(repository.delete("thread-1").unwrap());
        assert!(!repository.delete("thread-1").unwrap());
        assert_eq!(repository.list(None, None, true).unwrap().threads.len(), 1);
        assert!(repository
            .staging_dir()
            .read_dir()
            .unwrap()
            .next()
            .is_none());
    }

    #[test]
    fn corrupt_entries_are_quarantined_without_hiding_healthy_history() {
        let root = TempDir::new().unwrap();
        let repository = AgentThreadRepository::new(root.path().join("agent"));
        repository.save(record("healthy", 1)).unwrap();
        fs::create_dir_all(repository.threads_dir()).unwrap();
        fs::write(repository.threads_dir().join("broken.json"), b"not-json").unwrap();

        let page = repository.list(None, None, false).unwrap();
        assert_eq!(page.threads.len(), 1);
        assert_eq!(page.recovered_corrupt_entries, 1);
        assert_eq!(repository.corrupt_dir().read_dir().unwrap().count(), 1);
    }

    #[test]
    fn rejects_path_traversal_and_newer_schemas_and_bounds_large_values() {
        let root = TempDir::new().unwrap();
        let repository = AgentThreadRepository::new(root.path().join("agent"));
        assert!(repository.load("../outside").is_err());
        assert!(repository.delete("../outside").is_err());
        let mut future = record("future", 1);
        future.schema_version = THREAD_SCHEMA_VERSION + 1;
        assert!(repository.save(future).is_err());
        let mut oversized = record("large", 1);
        oversized.thread["turns"] = json!([{
            "id": "done", "status": "completed", "items": [{"kind": "message", "content": "x".repeat(MAX_RECORD_BYTES)}]
        }]);
        let bounded = repository.save(oversized).unwrap();
        assert!(bounded.thread["turns"][0]["items"][0]["content"]
            .as_str()
            .unwrap()
            .ends_with("…[truncated]"));
    }
}
