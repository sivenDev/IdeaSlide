# IdeaSlide MCP Server Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an MCP Server to IdeaSlide so AI clients can create, edit, and preview presentations via the Model Context Protocol.

**Architecture:** Rust MCP server embedded in the Tauri app using `rmcp` crate. 11 tools (3 file, 6 slide, 2 preview) with stateless read-modify-write model. Preview renders via hidden webview + Excalidraw `exportToBlob()`. All tools defined with `#[tool]` macro, business logic in separate handler modules.

**Tech Stack:** Rust + rmcp 0.17+ (MCP SDK), Tauri v2 (runtime), TypeScript + Excalidraw 0.18 (preview renderer)

**Spec:** `docs/superpowers/specs/2026-03-15-mcp-server-design.md`

---

## File Map

### New Files (Rust)
| File | Responsibility |
|------|---------------|
| `src-tauri/src/mcp/mod.rs` | `IdeaSlideServer` struct, `#[tool]` definitions, `ServerHandler` impl, `start_server()` |
| `src-tauri/src/mcp/error.rs` | `ToolError` enum + Display/conversion impls |
| `src-tauri/src/mcp/services/mod.rs` | Re-exports |
| `src-tauri/src/mcp/services/file_service.rs` | `FileService` — wraps `file_format.rs` + per-file locking |
| `src-tauri/src/mcp/services/slide_service.rs` | `SlideService` — slide CRUD on `IsFileData` |
| `src-tauri/src/mcp/tools/mod.rs` | Re-exports |
| `src-tauri/src/mcp/tools/file_tools.rs` | Handler fns: `handle_create_presentation`, `handle_open_presentation`, `handle_get_presentation_info` |
| `src-tauri/src/mcp/tools/slide_tools.rs` | Handler fns: `handle_list_slides`, `handle_add_slide`, `handle_delete_slide`, `handle_get_slide_content`, `handle_set_slide_content`, `handle_reorder_slides` |
| `src-tauri/src/mcp/tools/preview_tools.rs` | Handler fns: `handle_preview_slide`, `handle_preview_presentation` |

### New Files (Frontend)
| File | Responsibility |
|------|---------------|
| `src/lib/mcpRenderer.ts` | Listen for render requests, call Excalidraw `exportToBlob()`, return PNG bytes via invoke |

### Modified Files
| File | Changes |
|------|---------|
| `src-tauri/Cargo.toml` | Add `rmcp` dependency |
| `src-tauri/src/lib.rs` | Add `mod mcp`, `--mcp` flag detection, hidden webview creation, MCP server spawn |
| `src-tauri/src/main.rs` | Pass CLI args through to `run()` |
| `src/App.tsx` | Initialize `mcpRenderer` on mount |
| `src-tauri/capabilities/default.json` | Add event permissions for mcp-render events |

---

## Chunk 1: Foundation — Error Types, FileService, SlideService

### Task 1: Add rmcp dependency

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add rmcp to Cargo.toml**

Add after the `base64` dependency (line 22 of `src-tauri/Cargo.toml`):

```toml
rmcp = { version = "0.17", features = ["server", "transport-io"] }
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully (rmcp downloads and resolves)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "chore: add rmcp dependency for MCP server"
```

---

### Task 2: Create ToolError enum

**Files:**
- Create: `src-tauri/src/mcp/mod.rs`
- Create: `src-tauri/src/mcp/error.rs`

- [ ] **Step 1: Create mcp module directory and mod.rs**

```bash
mkdir -p src-tauri/src/mcp/services src-tauri/src/mcp/tools
```

Create `src-tauri/src/mcp/mod.rs`:

```rust
pub mod error;
pub mod services;
pub mod tools;

pub use error::ToolError;
```

- [ ] **Step 2: Write ToolError with Display and conversion impls**

Create `src-tauri/src/mcp/error.rs`:

```rust
use std::fmt;

#[derive(Debug)]
pub enum ToolError {
    FileNotFound(String),
    FileAlreadyExists(String),
    SlideNotFound(String),
    InvalidContent(String),
    InvalidFile(String),
    IoError(String),
    PermissionDenied(String),
    RenderTimeout,
    RenderNotReady,
}

impl fmt::Display for ToolError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::FileNotFound(p) => write!(f, "File not found: {}", p),
            Self::FileAlreadyExists(p) => write!(f, "File already exists: {}", p),
            Self::SlideNotFound(id) => write!(f, "Slide not found: {}", id),
            Self::InvalidContent(msg) => write!(f, "Invalid content: {}", msg),
            Self::InvalidFile(msg) => write!(f, "Invalid .is file: {}", msg),
            Self::IoError(msg) => write!(f, "I/O error: {}", msg),
            Self::PermissionDenied(p) => write!(f, "Permission denied: {}", p),
            Self::RenderTimeout => write!(f, "Render timeout"),
            Self::RenderNotReady => write!(f, "Renderer not ready yet"),
        }
    }
}

impl std::error::Error for ToolError {}

impl From<std::io::Error> for ToolError {
    fn from(e: std::io::Error) -> Self {
        match e.kind() {
            std::io::ErrorKind::NotFound => Self::FileNotFound(e.to_string()),
            std::io::ErrorKind::PermissionDenied => Self::PermissionDenied(e.to_string()),
            _ => Self::IoError(e.to_string()),
        }
    }
}
```

- [ ] **Step 3: Create stub modules for services and tools**

Create `src-tauri/src/mcp/services/mod.rs`:

```rust
pub mod file_service;
pub mod slide_service;
```

Create `src-tauri/src/mcp/services/file_service.rs`:

```rust
// FileService — wraps file_format.rs with per-file locking
```

Create `src-tauri/src/mcp/services/slide_service.rs`:

```rust
// SlideService — slide CRUD operations on IsFileData
```

Create `src-tauri/src/mcp/tools/mod.rs`:

```rust
pub mod file_tools;
pub mod slide_tools;
pub mod preview_tools;
```

Create `src-tauri/src/mcp/tools/file_tools.rs`:

```rust
// File tool handlers
```

Create `src-tauri/src/mcp/tools/slide_tools.rs`:

```rust
// Slide tool handlers
```

Create `src-tauri/src/mcp/tools/preview_tools.rs`:

```rust
// Preview tool handlers
```

- [ ] **Step 4: Register mcp module in lib.rs**

In `src-tauri/src/lib.rs`, add after line 4 (`mod recent_files;`):

```rust
mod mcp;
```

- [ ] **Step 5: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors (stub modules are empty but valid)

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/mcp/
git commit -m "feat(mcp): add ToolError enum and module structure"
```

---

### Task 3: Implement FileService

**Files:**
- Modify: `src-tauri/src/mcp/services/file_service.rs`
- Reference: `src-tauri/src/file_format.rs` (public API: `create_is_file`, `read_is_file`, `write_is_file`, `IsFileData`)

- [ ] **Step 1: Write FileService tests**

Add to `src-tauri/src/mcp/services/file_service.rs`:

```rust
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::file_format::{self, IsFileData};
use crate::mcp::error::ToolError;

pub struct FileService {
    locks: Mutex<HashMap<PathBuf, Arc<Mutex<()>>>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_create_new_file() {
        let svc = FileService::new();
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.is");
        let result = svc.create(&path);
        assert!(result.is_ok());
        assert!(path.exists());
    }

    #[test]
    fn test_create_file_already_exists() {
        let svc = FileService::new();
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.is");
        svc.create(&path).unwrap();
        let result = svc.create(&path);
        assert!(matches!(result, Err(ToolError::FileAlreadyExists(_))));
    }

    #[test]
    fn test_read_nonexistent_file() {
        let svc = FileService::new();
        let result = svc.read(Path::new("/tmp/nonexistent_abc123.is"));
        assert!(matches!(result, Err(ToolError::FileNotFound(_))));
    }

    #[test]
    fn test_read_and_modify() {
        let svc = FileService::new();
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.is");
        svc.create(&path).unwrap();

        svc.read_and_modify(&path, |data| {
            assert_eq!(data.slides.len(), 1);
            Ok(())
        }).unwrap();
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test mcp::services::file_service::tests -- --nocapture`
Expected: FAIL — `FileService::new()` not defined

- [ ] **Step 3: Implement FileService**

Replace the struct definition and add impl block in `src-tauri/src/mcp/services/file_service.rs` (keep tests at bottom):

```rust
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::Utc;

use crate::file_format::{self, IsFileData};
use crate::mcp::error::ToolError;

pub struct FileService {
    locks: Mutex<HashMap<PathBuf, Arc<Mutex<()>>>>,
}

impl FileService {
    pub fn new() -> Self {
        Self {
            locks: Mutex::new(HashMap::new()),
        }
    }

    fn get_lock(&self, path: &Path) -> Arc<Mutex<()>> {
        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        let mut locks = self.locks.lock().unwrap();
        locks.entry(canonical).or_insert_with(|| Arc::new(Mutex::new(()))).clone()
    }

    pub fn create(&self, path: &Path) -> Result<IsFileData, ToolError> {
        // Use per-file lock to prevent TOCTOU race on exists() check
        let lock = self.get_lock(path);
        let _guard = lock.lock().unwrap();
        if path.exists() {
            return Err(ToolError::FileAlreadyExists(path.display().to_string()));
        }
        file_format::create_is_file(path).map_err(|e| ToolError::InvalidFile(e))
    }

    pub fn read(&self, path: &Path) -> Result<IsFileData, ToolError> {
        if !path.exists() {
            return Err(ToolError::FileNotFound(path.display().to_string()));
        }
        file_format::read_is_file(path).map_err(|e| ToolError::InvalidFile(e))
    }

    pub fn write(&self, path: &Path, data: &IsFileData) -> Result<(), ToolError> {
        file_format::write_is_file(path, data).map_err(|e| ToolError::IoError(e))
    }

    pub fn read_and_modify<F>(&self, path: &Path, f: F) -> Result<(), ToolError>
    where
        F: FnOnce(&mut IsFileData) -> Result<(), ToolError>,
    {
        let lock = self.get_lock(path);
        let _guard = lock.lock().unwrap();
        let mut data = self.read(path)?;
        f(&mut data)?;
        // Update modified timestamp on every write (matches commands.rs save_file behavior)
        data.manifest.modified = Utc::now().to_rfc3339();
        self.write(path, &data)
    }
}
```

- [ ] **Step 4: Add tempfile dev-dependency to Cargo.toml**

Add under `[dev-dependencies]` in `src-tauri/Cargo.toml` (create section if not exists):

```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-tauri && cargo test mcp::services::file_service::tests -- --nocapture`
Expected: All 4 tests pass

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/mcp/services/file_service.rs src-tauri/Cargo.toml
git commit -m "feat(mcp): implement FileService with per-file locking"
```

---

### Task 4: Implement SlideService

**Files:**
- Modify: `src-tauri/src/mcp/services/slide_service.rs`
- Reference: `src-tauri/src/file_format.rs` — `IsFileData`, `SlideData`, `Manifest`, `SlideEntry`

- [ ] **Step 1: Write SlideService tests**

Create `src-tauri/src/mcp/services/slide_service.rs`:

```rust
use serde::{Deserialize, Serialize};
use crate::file_format::{IsFileData, SlideData, SlideEntry, Manifest};
use crate::mcp::error::ToolError;

#[derive(Debug, Serialize, Deserialize)]
pub struct SlideInfo {
    pub id: String,
    pub title: String,
}

pub struct SlideService;

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn make_test_data() -> IsFileData {
        IsFileData {
            manifest: Manifest {
                version: "1.0".to_string(),
                created: "2026-01-01T00:00:00Z".to_string(),
                modified: "2026-01-01T00:00:00Z".to_string(),
                slides: vec![
                    SlideEntry { id: "slide-1".into(), title: "Slide 1".into() },
                    SlideEntry { id: "slide-2".into(), title: "Slide 2".into() },
                ],
            },
            slides: vec![
                SlideData {
                    id: "slide-1".into(),
                    content: json!({"elements": [], "appState": {}}),
                },
                SlideData {
                    id: "slide-2".into(),
                    content: json!({"elements": [{"type": "text"}], "appState": {}}),
                },
            ],
            media: vec![],
        }
    }

    #[test]
    fn test_list_slides() {
        let svc = SlideService;
        let data = make_test_data();
        let list = svc.list(&data);
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].id, "slide-1");
        assert_eq!(list[1].title, "Slide 2");
    }

    #[test]
    fn test_get_content_found() {
        let svc = SlideService;
        let data = make_test_data();
        let content = svc.get_content(&data, "slide-2").unwrap();
        assert!(content["elements"].as_array().unwrap().len() > 0);
    }

    #[test]
    fn test_get_content_not_found() {
        let svc = SlideService;
        let data = make_test_data();
        let result = svc.get_content(&data, "nonexistent");
        assert!(matches!(result, Err(ToolError::SlideNotFound(_))));
    }

    #[test]
    fn test_add_slide_at_end() {
        let svc = SlideService;
        let mut data = make_test_data();
        let id = svc.add(&mut data, None, None).unwrap();
        assert_eq!(data.slides.len(), 3);
        assert_eq!(data.manifest.slides.len(), 3);
        assert_eq!(data.slides[2].id, id);
    }

    #[test]
    fn test_add_slide_at_index() {
        let svc = SlideService;
        let mut data = make_test_data();
        let id = svc.add(&mut data, Some(0), None).unwrap();
        assert_eq!(data.slides.len(), 3);
        assert_eq!(data.slides[0].id, id);
    }

    #[test]
    fn test_add_slide_with_content() {
        let svc = SlideService;
        let mut data = make_test_data();
        let content = json!({"elements": [{"type": "rectangle"}], "appState": {}});
        let id = svc.add(&mut data, None, Some(content.clone())).unwrap();
        let stored = svc.get_content(&data, &id).unwrap();
        assert_eq!(stored["elements"][0]["type"], "rectangle");
    }

    #[test]
    fn test_delete_slide() {
        let svc = SlideService;
        let mut data = make_test_data();
        svc.delete(&mut data, "slide-1").unwrap();
        assert_eq!(data.slides.len(), 1);
        assert_eq!(data.manifest.slides.len(), 1);
        assert_eq!(data.slides[0].id, "slide-2");
    }

    #[test]
    fn test_delete_nonexistent_slide() {
        let svc = SlideService;
        let mut data = make_test_data();
        let result = svc.delete(&mut data, "nonexistent");
        assert!(matches!(result, Err(ToolError::SlideNotFound(_))));
    }

    #[test]
    fn test_set_content() {
        let svc = SlideService;
        let mut data = make_test_data();
        let new_content = json!({"elements": [{"type": "ellipse"}], "appState": {"zoom": 2}});
        svc.set_content(&mut data, "slide-1", new_content).unwrap();
        let stored = svc.get_content(&data, "slide-1").unwrap();
        assert_eq!(stored["elements"][0]["type"], "ellipse");
    }

    #[test]
    fn test_reorder_slides() {
        let svc = SlideService;
        let mut data = make_test_data();
        svc.reorder(&mut data, &["slide-2".into(), "slide-1".into()]).unwrap();
        assert_eq!(data.slides[0].id, "slide-2");
        assert_eq!(data.slides[1].id, "slide-1");
        assert_eq!(data.manifest.slides[0].id, "slide-2");
    }

    #[test]
    fn test_reorder_with_invalid_ids() {
        let svc = SlideService;
        let mut data = make_test_data();
        let result = svc.reorder(&mut data, &["slide-1".into(), "nonexistent".into()]);
        assert!(matches!(result, Err(ToolError::SlideNotFound(_))));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test mcp::services::slide_service::tests -- --nocapture`
Expected: FAIL — methods not implemented

- [ ] **Step 3: Implement SlideService**

Add impl block above the tests in `src-tauri/src/mcp/services/slide_service.rs`:

```rust
impl SlideService {
    pub fn list(&self, data: &IsFileData) -> Vec<SlideInfo> {
        data.manifest.slides.iter().map(|entry| SlideInfo {
            id: entry.id.clone(),
            title: entry.title.clone(),
        }).collect()
    }

    pub fn get_content(&self, data: &IsFileData, slide_id: &str) -> Result<serde_json::Value, ToolError> {
        data.slides.iter()
            .find(|s| s.id == slide_id)
            .map(|s| s.content.clone())
            .ok_or_else(|| ToolError::SlideNotFound(slide_id.to_string()))
    }

    pub fn set_content(
        &self,
        data: &mut IsFileData,
        slide_id: &str,
        content: serde_json::Value,
    ) -> Result<(), ToolError> {
        let slide = data.slides.iter_mut()
            .find(|s| s.id == slide_id)
            .ok_or_else(|| ToolError::SlideNotFound(slide_id.to_string()))?;
        slide.content = content;
        Ok(())
    }

    pub fn add(
        &self,
        data: &mut IsFileData,
        index: Option<usize>,
        content: Option<serde_json::Value>,
    ) -> Result<String, ToolError> {
        let id = uuid::Uuid::new_v4().to_string();
        let slide_content = content.unwrap_or_else(|| {
            serde_json::json!({"elements": [], "appState": {}})
        });

        let slide_data = SlideData {
            id: id.clone(),
            content: slide_content,
        };
        let slide_entry = SlideEntry {
            id: id.clone(),
            title: String::new(),
        };

        let idx = index.unwrap_or(data.slides.len());
        let idx = idx.min(data.slides.len()); // clamp
        data.slides.insert(idx, slide_data);
        data.manifest.slides.insert(idx, slide_entry);

        Ok(id)
    }

    pub fn delete(&self, data: &mut IsFileData, slide_id: &str) -> Result<(), ToolError> {
        let slide_idx = data.slides.iter().position(|s| s.id == slide_id)
            .ok_or_else(|| ToolError::SlideNotFound(slide_id.to_string()))?;
        data.slides.remove(slide_idx);

        if let Some(manifest_idx) = data.manifest.slides.iter().position(|s| s.id == slide_id) {
            data.manifest.slides.remove(manifest_idx);
        }

        Ok(())
    }

    pub fn reorder(&self, data: &mut IsFileData, slide_ids: &[String]) -> Result<(), ToolError> {
        // Verify all provided IDs exist
        for id in slide_ids {
            if !data.slides.iter().any(|s| s.id == *id) {
                return Err(ToolError::SlideNotFound(id.clone()));
            }
        }
        // Verify all existing slides are included (no drops)
        if slide_ids.len() != data.slides.len() {
            return Err(ToolError::InvalidContent(format!(
                "Expected {} slide IDs but got {}. All slides must be included.",
                data.slides.len(), slide_ids.len()
            )));
        }

        // Reorder slides
        let mut new_slides = Vec::with_capacity(slide_ids.len());
        let mut new_manifest_slides = Vec::with_capacity(slide_ids.len());

        for id in slide_ids {
            let slide = data.slides.iter().find(|s| s.id == *id).unwrap().clone();
            let entry = data.manifest.slides.iter().find(|s| s.id == *id).unwrap().clone();
            new_slides.push(slide);
            new_manifest_slides.push(entry);
        }

        data.slides = new_slides;
        data.manifest.slides = new_manifest_slides;

        Ok(())
    }
}
```

- [ ] **Step 4: Add uuid dependency to Cargo.toml**

Add to `[dependencies]` in `src-tauri/Cargo.toml`:

```toml
uuid = { version = "1", features = ["v4"] }
```

- [ ] **Step 5: Verify SlideData and SlideEntry derive Clone**

Check `src-tauri/src/file_format.rs`. If `SlideData` and `SlideEntry` don't derive `Clone`, add it:

```rust
#[derive(Serialize, Deserialize, Clone)]  // add Clone
pub struct SlideData { ... }

#[derive(Serialize, Deserialize, Clone)]  // add Clone
pub struct SlideEntry { ... }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd src-tauri && cargo test mcp::services::slide_service::tests -- --nocapture`
Expected: All 10 tests pass

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/mcp/services/slide_service.rs src-tauri/Cargo.toml src-tauri/src/file_format.rs
git commit -m "feat(mcp): implement SlideService with full CRUD and reorder"
```

---

## Chunk 2: MCP Server Core — IdeaSlideServer + Startup

> **Important: rmcp API adaptation.** The code below is based on rmcp 0.17 docs. The exact API (function names, type paths, macro syntax) may differ at implementation time. Before writing code, run `cargo doc -p rmcp --open` to check actual types. Key things to verify: `CallToolResult` construction, `Content::text()` vs `Content::Text { text }`, `rmcp::Error` vs `rmcp::McpError`, `rmcp::serve()` signature, `rmcp::transport::io::stdio()` signature. Adapt code as needed — the business logic and architecture are the spec, not the exact API calls.

### Task 5: Implement IdeaSlideServer with rmcp #[tool] definitions

**Files:**
- Modify: `src-tauri/src/mcp/mod.rs`
- Modify: `src-tauri/src/mcp/tools/file_tools.rs`
- Modify: `src-tauri/src/mcp/tools/slide_tools.rs`
- Modify: `src-tauri/src/mcp/tools/preview_tools.rs`
- Reference: `docs/superpowers/specs/2026-03-15-mcp-server-design.md` — rmcp integration section

- [ ] **Step 1: Write file_tools handlers**

Replace `src-tauri/src/mcp/tools/file_tools.rs`:

```rust
use std::path::Path;
use std::sync::Arc;

use rmcp::model::{CallToolResult, Content};
use serde_json::json;

use crate::mcp::error::ToolError;
use crate::mcp::services::file_service::FileService;
use crate::mcp::services::slide_service::SlideService;

fn tool_err(e: ToolError) -> rmcp::Error {
    rmcp::Error::internal(e.to_string())
}

pub async fn handle_create_presentation(
    file_service: &Arc<FileService>,
    path: String,
) -> Result<CallToolResult, rmcp::Error> {
    let fs = file_service.clone();
    let result = tokio::task::spawn_blocking(move || {
        fs.create(Path::new(&path))
    })
    .await
    .map_err(|e| rmcp::Error::internal(e.to_string()))?
    .map_err(tool_err)?;

    let info = json!({
        "manifest": result.manifest,
        "slide_count": result.slides.len(),
    });
    Ok(CallToolResult {
        content: vec![Content::text(info.to_string())],
        is_error: None,
    })
}

pub async fn handle_open_presentation(
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: String,
) -> Result<CallToolResult, rmcp::Error> {
    let fs = file_service.clone();
    let ss = slide_service.clone();
    let result = tokio::task::spawn_blocking(move || {
        let data = fs.read(Path::new(&path))?;
        let slides = ss.list(&data);
        Ok::<_, ToolError>((data.manifest, slides))
    })
    .await
    .map_err(|e| rmcp::Error::internal(e.to_string()))?
    .map_err(tool_err)?;

    let info = json!({
        "manifest": result.0,
        "slides": result.1,
    });
    Ok(CallToolResult {
        content: vec![Content::text(info.to_string())],
        is_error: None,
    })
}

pub async fn handle_get_presentation_info(
    file_service: &Arc<FileService>,
    path: String,
) -> Result<CallToolResult, rmcp::Error> {
    let fs = file_service.clone();
    let result = tokio::task::spawn_blocking(move || {
        let data = fs.read(Path::new(&path))?;
        Ok::<_, ToolError>(data.manifest)
    })
    .await
    .map_err(|e| rmcp::Error::internal(e.to_string()))?
    .map_err(tool_err)?;

    Ok(CallToolResult {
        content: vec![Content::text(serde_json::to_string(&result).unwrap())],
        is_error: None,
    })
}
```

- [ ] **Step 2: Write slide_tools handlers**

Replace `src-tauri/src/mcp/tools/slide_tools.rs`:

```rust
use std::path::Path;
use std::sync::Arc;

use rmcp::model::{CallToolResult, Content};
use serde_json::json;

use crate::mcp::error::ToolError;
use crate::mcp::services::file_service::FileService;
use crate::mcp::services::slide_service::SlideService;

fn tool_err(e: ToolError) -> rmcp::Error {
    rmcp::Error::internal(e.to_string())
}

pub async fn handle_list_slides(
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: String,
) -> Result<CallToolResult, rmcp::Error> {
    let fs = file_service.clone();
    let ss = slide_service.clone();
    let result = tokio::task::spawn_blocking(move || {
        let data = fs.read(Path::new(&path))?;
        Ok::<_, ToolError>(ss.list(&data))
    })
    .await
    .map_err(|e| rmcp::Error::internal(e.to_string()))?
    .map_err(tool_err)?;

    Ok(CallToolResult {
        content: vec![Content::text(serde_json::to_string(&result).unwrap())],
        is_error: None,
    })
}

pub async fn handle_add_slide(
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: String,
    index: Option<u64>,
    content: Option<serde_json::Value>,
) -> Result<CallToolResult, rmcp::Error> {
    let fs = file_service.clone();
    let ss = slide_service.clone();
    let result = tokio::task::spawn_blocking(move || {
        let mut new_id = String::new();
        fs.read_and_modify(Path::new(&path), |data| {
            new_id = ss.add(data, index.map(|i| i as usize), content)?;
            Ok(())
        })?;
        Ok::<_, ToolError>(new_id)
    })
    .await
    .map_err(|e| rmcp::Error::internal(e.to_string()))?
    .map_err(tool_err)?;

    Ok(CallToolResult {
        content: vec![Content::text(json!({"slide_id": result}).to_string())],
        is_error: None,
    })
}

pub async fn handle_delete_slide(
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: String,
    slide_id: String,
) -> Result<CallToolResult, rmcp::Error> {
    let fs = file_service.clone();
    let ss = slide_service.clone();
    tokio::task::spawn_blocking(move || {
        fs.read_and_modify(Path::new(&path), |data| {
            ss.delete(data, &slide_id)
        })
    })
    .await
    .map_err(|e| rmcp::Error::internal(e.to_string()))?
    .map_err(tool_err)?;

    Ok(CallToolResult {
        content: vec![Content::text(r#"{"success": true}"#.into())],
        is_error: None,
    })
}

pub async fn handle_get_slide_content(
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: String,
    slide_id: String,
) -> Result<CallToolResult, rmcp::Error> {
    let fs = file_service.clone();
    let ss = slide_service.clone();
    let result = tokio::task::spawn_blocking(move || {
        let data = fs.read(Path::new(&path))?;
        ss.get_content(&data, &slide_id)
    })
    .await
    .map_err(|e| rmcp::Error::internal(e.to_string()))?
    .map_err(tool_err)?;

    Ok(CallToolResult {
        content: vec![Content::text(serde_json::to_string(&result).unwrap())],
        is_error: None,
    })
}

pub async fn handle_set_slide_content(
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: String,
    slide_id: String,
    content: serde_json::Value,
) -> Result<CallToolResult, rmcp::Error> {
    let fs = file_service.clone();
    let ss = slide_service.clone();
    tokio::task::spawn_blocking(move || {
        fs.read_and_modify(Path::new(&path), |data| {
            ss.set_content(data, &slide_id, content)
        })
    })
    .await
    .map_err(|e| rmcp::Error::internal(e.to_string()))?
    .map_err(tool_err)?;

    Ok(CallToolResult {
        content: vec![Content::text(r#"{"success": true}"#.into())],
        is_error: None,
    })
}

pub async fn handle_reorder_slides(
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    path: String,
    slide_ids: Vec<String>,
) -> Result<CallToolResult, rmcp::Error> {
    let fs = file_service.clone();
    let ss = slide_service.clone();
    tokio::task::spawn_blocking(move || {
        fs.read_and_modify(Path::new(&path), |data| {
            ss.reorder(data, &slide_ids)
        })
    })
    .await
    .map_err(|e| rmcp::Error::internal(e.to_string()))?
    .map_err(tool_err)?;

    Ok(CallToolResult {
        content: vec![Content::text(r#"{"success": true}"#.into())],
        is_error: None,
    })
}
```

- [ ] **Step 3: Write preview_tools stubs**

Replace `src-tauri/src/mcp/tools/preview_tools.rs`:

```rust
use std::sync::Arc;
use std::sync::atomic::AtomicBool;

use rmcp::model::{CallToolResult, Content};

use crate::mcp::error::ToolError;
use crate::mcp::services::file_service::FileService;

fn tool_err(e: ToolError) -> rmcp::Error {
    rmcp::Error::internal(e.to_string())
}

pub async fn handle_preview_slide(
    _file_service: &Arc<FileService>,
    renderer_ready: &Arc<AtomicBool>,
    _app_handle: &tauri::AppHandle,
    _path: String,
    _slide_id: String,
) -> Result<CallToolResult, rmcp::Error> {
    if !renderer_ready.load(std::sync::atomic::Ordering::Relaxed) {
        return Err(rmcp::Error::internal(ToolError::RenderNotReady.to_string()));
    }
    // TODO: implement in Task 8 (preview chunk)
    Ok(CallToolResult {
        content: vec![Content::text(r#"{"error": "preview not yet implemented"}"#.into())],
        is_error: Some(true),
    })
}

pub async fn handle_preview_presentation(
    _file_service: &Arc<FileService>,
    renderer_ready: &Arc<AtomicBool>,
    _app_handle: &tauri::AppHandle,
    _path: String,
) -> Result<CallToolResult, rmcp::Error> {
    if !renderer_ready.load(std::sync::atomic::Ordering::Relaxed) {
        return Err(rmcp::Error::internal(ToolError::RenderNotReady.to_string()));
    }
    // TODO: implement in Task 8 (preview chunk)
    Ok(CallToolResult {
        content: vec![Content::text(r#"{"error": "preview not yet implemented"}"#.into())],
        is_error: Some(true),
    })
}
```

- [ ] **Step 4: Write IdeaSlideServer with all #[tool] methods**

Replace `src-tauri/src/mcp/mod.rs`:

```rust
pub mod error;
pub mod services;
pub mod tools;

pub use error::ToolError;

use std::sync::Arc;
use std::sync::atomic::AtomicBool;

use rmcp::model::{CallToolResult, Content, ServerInfo, ServerCapabilities, ToolsCapability};
use rmcp::{ServerHandler, Error as McpError};

use services::file_service::FileService;
use services::slide_service::SlideService;

#[derive(Clone)]
pub struct IdeaSlideServer {
    pub file_service: Arc<FileService>,
    pub slide_service: Arc<SlideService>,
    pub renderer_ready: Arc<AtomicBool>,
    pub app_handle: tauri::AppHandle,
}

impl IdeaSlideServer {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            file_service: Arc::new(FileService::new()),
            slide_service: Arc::new(SlideService),
            renderer_ready: Arc::new(AtomicBool::new(false)),
            app_handle,
        }
    }
}

#[rmcp::tool(tool_box)]
impl IdeaSlideServer {
    #[tool(description = "Create a new .is presentation file. Errors if file already exists at the given path.")]
    async fn create_presentation(
        &self,
        #[tool(param, description = "Absolute path for the new .is file")] path: String,
    ) -> Result<CallToolResult, McpError> {
        tools::file_tools::handle_create_presentation(&self.file_service, path).await
    }

    #[tool(description = "Open an existing .is presentation file. Returns manifest metadata and slide list.")]
    async fn open_presentation(
        &self,
        #[tool(param, description = "Absolute path to the .is file")] path: String,
    ) -> Result<CallToolResult, McpError> {
        tools::file_tools::handle_open_presentation(&self.file_service, &self.slide_service, path).await
    }

    #[tool(description = "Get metadata (manifest) of a presentation without loading slide contents.")]
    async fn get_presentation_info(
        &self,
        #[tool(param, description = "Absolute path to the .is file")] path: String,
    ) -> Result<CallToolResult, McpError> {
        tools::file_tools::handle_get_presentation_info(&self.file_service, path).await
    }

    #[tool(description = "List all slides in a presentation. Returns slide IDs and titles.")]
    async fn list_slides(
        &self,
        #[tool(param, description = "Absolute path to the .is file")] path: String,
    ) -> Result<CallToolResult, McpError> {
        tools::slide_tools::handle_list_slides(&self.file_service, &self.slide_service, path).await
    }

    #[tool(description = "Add a new slide to the presentation. Optionally specify position index and initial Excalidraw JSON content.")]
    async fn add_slide(
        &self,
        #[tool(param, description = "Absolute path to the .is file")] path: String,
        #[tool(param, description = "Insert position (0-based). Omit to append at end.")] index: Option<u64>,
        #[tool(param, description = "Initial Excalidraw JSON content. Omit for blank slide.")] content: Option<serde_json::Value>,
    ) -> Result<CallToolResult, McpError> {
        tools::slide_tools::handle_add_slide(&self.file_service, &self.slide_service, path, index, content).await
    }

    #[tool(description = "Delete a slide from the presentation by its ID.")]
    async fn delete_slide(
        &self,
        #[tool(param, description = "Absolute path to the .is file")] path: String,
        #[tool(param, description = "ID of the slide to delete")] slide_id: String,
    ) -> Result<CallToolResult, McpError> {
        tools::slide_tools::handle_delete_slide(&self.file_service, &self.slide_service, path, slide_id).await
    }

    #[tool(description = "Get the full Excalidraw JSON content of a slide (elements, appState, files).")]
    async fn get_slide_content(
        &self,
        #[tool(param, description = "Absolute path to the .is file")] path: String,
        #[tool(param, description = "ID of the slide")] slide_id: String,
    ) -> Result<CallToolResult, McpError> {
        tools::slide_tools::handle_get_slide_content(&self.file_service, &self.slide_service, path, slide_id).await
    }

    #[tool(description = "Replace the full Excalidraw JSON content of a slide. The content should include elements and appState.")]
    async fn set_slide_content(
        &self,
        #[tool(param, description = "Absolute path to the .is file")] path: String,
        #[tool(param, description = "ID of the slide")] slide_id: String,
        #[tool(param, description = "Complete Excalidraw JSON content to write")] content: serde_json::Value,
    ) -> Result<CallToolResult, McpError> {
        tools::slide_tools::handle_set_slide_content(&self.file_service, &self.slide_service, path, slide_id, content).await
    }

    #[tool(description = "Reorder slides in the presentation. Provide all slide IDs in the desired order.")]
    async fn reorder_slides(
        &self,
        #[tool(param, description = "Absolute path to the .is file")] path: String,
        #[tool(param, description = "All slide IDs in desired order")] slide_ids: Vec<String>,
    ) -> Result<CallToolResult, McpError> {
        tools::slide_tools::handle_reorder_slides(&self.file_service, &self.slide_service, path, slide_ids).await
    }

    #[tool(description = "Render a slide to a PNG image file. Returns the local file path to the rendered image.")]
    async fn preview_slide(
        &self,
        #[tool(param, description = "Absolute path to the .is file")] path: String,
        #[tool(param, description = "ID of the slide to preview")] slide_id: String,
    ) -> Result<CallToolResult, McpError> {
        tools::preview_tools::handle_preview_slide(
            &self.file_service, &self.slide_service, &self.renderer_ready, &self.app_handle, path, slide_id
        ).await
    }

    #[tool(description = "Render all slides in the presentation to PNG thumbnail images. Returns array of local file paths.")]
    async fn preview_presentation(
        &self,
        #[tool(param, description = "Absolute path to the .is file")] path: String,
    ) -> Result<CallToolResult, McpError> {
        tools::preview_tools::handle_preview_presentation(
            &self.file_service, &self.renderer_ready, &self.app_handle, path
        ).await
    }
}

#[rmcp::tool(tool_box)]
impl ServerHandler for IdeaSlideServer {
    fn name(&self) -> String {
        "idea-slide".into()
    }

    fn version(&self) -> String {
        env!("CARGO_PKG_VERSION").into()
    }
}

pub async fn start_server(app_handle: tauri::AppHandle) {
    let server = IdeaSlideServer::new(app_handle);
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();
    let transport = rmcp::transport::io::stdio(stdin, stdout);

    if let Err(e) = rmcp::serve(server, transport).await {
        eprintln!("MCP server error: {}", e);
    }

    // Cleanup temp dir on shutdown
    let tmp_dir = std::env::temp_dir().join("idea-slide-mcp");
    let _ = std::fs::remove_dir_all(&tmp_dir);
}
```

- [ ] **Step 5: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles. Note: The exact `rmcp` API may differ slightly from what's shown — adjust imports and types as needed based on compiler errors. Key types to verify: `CallToolResult`, `Content::text()`, `rmcp::Error`, `rmcp::serve()`, `rmcp::transport::io::stdio()`.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/mcp/
git commit -m "feat(mcp): implement IdeaSlideServer with all 11 tool definitions"
```

---

### Task 6: Wire --mcp flag into Tauri startup

**Files:**
- Modify: `src-tauri/src/lib.rs` (current: 52 lines)
- Modify: `src-tauri/src/main.rs` (current: 6 lines)

- [ ] **Step 1: Add --mcp detection and MCP server startup to lib.rs**

In `src-tauri/src/lib.rs`, modify the `run()` function. The current `setup` closure (lines 20-31) needs the `--mcp` check added:

After the existing `PendingFile` managed state line (line 21), add:

```rust
let is_mcp_mode = std::env::args().any(|a| a == "--mcp");

if is_mcp_mode {
    // Create hidden webview for Excalidraw rendering
    let _window = tauri::WebviewWindowBuilder::new(
        app,
        "mcp-renderer",
        tauri::WebviewUrl::App("index.html".into()),
    )
    .visible(false)
    .build()
    .expect("Failed to create MCP renderer window");

    // Start MCP server on Tauri's tokio runtime
    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        mcp::start_server(handle).await;
    });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(mcp): wire --mcp flag to start MCP server with hidden webview"
```

---

## Chunk 3: Preview System — Frontend Renderer + Backend Integration

### Task 7: Create frontend mcpRenderer module

**Files:**
- Create: `src/lib/mcpRenderer.ts`
- Modify: `src/App.tsx` (lines 10-78, AppContent component)

- [ ] **Step 1: Write mcpRenderer.ts**

Create `src/lib/mcpRenderer.ts`:

```typescript
import { listen, emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

interface RenderRequest {
  request_id: string;
  slide_content: string; // JSON string of Excalidraw scene
}

interface RenderResponse {
  request_id: string;
  png_bytes: number[]; // byte array
  error?: string;
}

/**
 * Initialize the MCP renderer. Call once on app mount.
 * Listens for render requests from the Rust backend,
 * renders Excalidraw content to PNG, and sends bytes back.
 */
export async function initMcpRenderer(): Promise<void> {
  const { exportToBlob } = await import('@excalidraw/excalidraw');

  await listen<RenderRequest>('mcp-render-request', async (event) => {
    const { request_id, slide_content } = event.payload;

    try {
      const scene = JSON.parse(slide_content);
      const elements = scene.elements || [];
      const appState = scene.appState || {};
      const files = scene.files || {};

      const blob = await exportToBlob({
        elements,
        appState: {
          ...appState,
          exportBackground: true,
          viewBackgroundColor: appState.viewBackgroundColor || '#ffffff',
        },
        files,
        getDimensions: () => ({ width: 1920, height: 1080, scale: 1 }),
      });

      const arrayBuffer = await blob.arrayBuffer();
      const pngBytes = Array.from(new Uint8Array(arrayBuffer));

      const response: RenderResponse = {
        request_id,
        png_bytes: pngBytes,
      };
      await emit('mcp-render-response', response);
    } catch (err) {
      const response: RenderResponse = {
        request_id,
        png_bytes: [],
        error: err instanceof Error ? err.message : String(err),
      };
      await emit('mcp-render-response', response);
    }
  });

  // Signal to backend that renderer is ready
  await invoke('mcp_renderer_ready');
}
```

- [ ] **Step 2: Add mcp_renderer_ready Tauri command to lib.rs**

In `src-tauri/src/lib.rs`, add a new command and register it. Add this function before `run()`:

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Wrapper so we can manage a single type in Tauri state for both modes.
pub struct McpRendererReady(Option<Arc<AtomicBool>>);

#[tauri::command]
fn mcp_renderer_ready(state: tauri::State<'_, McpRendererReady>) {
    if let Some(ref ready) = state.0 {
        ready.store(true, Ordering::Relaxed);
    }
}
```

In the `setup` closure, when in MCP mode, manage the renderer_ready flag:

```rust
if is_mcp_mode {
    let server = mcp::IdeaSlideServer::new(app.handle().clone());
    let renderer_ready = server.renderer_ready.clone();
    app.manage(McpRendererReady(Some(renderer_ready)));

    // ... existing hidden window code ...

    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        mcp::start_server_with(server).await;
    });
} else {
    app.manage(McpRendererReady(None));
}
```

Add `mcp_renderer_ready` to the `invoke_handler` registration.

- [ ] **Step 3: Update mcp/mod.rs to accept pre-built server**

Add a `start_server_with` function to `src-tauri/src/mcp/mod.rs`:

```rust
pub async fn start_server_with(server: IdeaSlideServer) {
    let app_handle = server.app_handle.clone();
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();
    let transport = rmcp::transport::io::stdio(stdin, stdout);

    if let Err(e) = rmcp::serve(server, transport).await {
        eprintln!("MCP server error: {}", e);
    }

    // Graceful shutdown: cleanup temp dir, close webview, exit process
    let tmp_dir = std::env::temp_dir().join("idea-slide-mcp");
    let _ = std::fs::remove_dir_all(&tmp_dir);

    // Close the hidden renderer window
    if let Some(window) = app_handle.get_webview_window("mcp-renderer") {
        let _ = window.close();
    }

    // Exit the Tauri app process
    app_handle.exit(0);
}
```

- [ ] **Step 4: Initialize mcpRenderer in App.tsx**

In `src/App.tsx`, add to the `AppContent` component. The MCP renderer should only init in the hidden webview (window label "mcp-renderer"):

```typescript
import { initMcpRenderer } from './lib/mcpRenderer';
import { getCurrentWindow } from '@tauri-apps/api/window';

// Inside AppContent, add a new useEffect:
useEffect(() => {
  // Only initialize MCP renderer in the hidden mcp-renderer window
  if (getCurrentWindow().label === 'mcp-renderer') {
    initMcpRenderer().catch(console.error);
  }
}, []);
```

- [ ] **Step 5: Verify frontend builds**

Run: `npm run build`
Expected: TypeScript check passes, Vite build succeeds

- [ ] **Step 6: Verify backend compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully

- [ ] **Step 7: Commit**

```bash
git add src/lib/mcpRenderer.ts src/App.tsx src-tauri/src/lib.rs src-tauri/src/mcp/mod.rs
git commit -m "feat(mcp): add frontend preview renderer and renderer-ready handshake"
```

---

### Task 8: Implement preview tool handlers

**Files:**
- Modify: `src-tauri/src/mcp/tools/preview_tools.rs`

- [ ] **Step 1: Implement preview_slide with Tauri event round-trip**

Replace `src-tauri/src/mcp/tools/preview_tools.rs`:

```rust
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use rmcp::model::{CallToolResult, Content};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::oneshot;

use crate::mcp::error::ToolError;
use crate::mcp::services::file_service::FileService;
use crate::mcp::services::slide_service::SlideService;

fn tool_err(e: ToolError) -> rmcp::Error {
    rmcp::Error::internal(e.to_string())
}

#[derive(Serialize)]
struct RenderRequest {
    request_id: String,
    slide_content: String,
}

#[derive(Deserialize)]
struct RenderResponse {
    request_id: String,
    png_bytes: Vec<u8>,
    error: Option<String>,
}

async fn render_slide_to_file(
    app_handle: &tauri::AppHandle,
    slide_content: serde_json::Value,
    output_path: &Path,
) -> Result<(), ToolError> {
    let request_id = uuid::Uuid::new_v4().to_string();
    let content_str = serde_json::to_string(&slide_content)
        .map_err(|e| ToolError::InvalidContent(e.to_string()))?;

    let req = RenderRequest {
        request_id: request_id.clone(),
        slide_content: content_str,
    };

    // Set up a one-shot listener for the response
    let (tx, rx) = oneshot::channel::<RenderResponse>();
    let expected_id = request_id.clone();

    let handle = app_handle.clone();
    let listener = handle.listen("mcp-render-response", move |event| {
        if let Ok(response) = serde_json::from_str::<RenderResponse>(event.payload()) {
            if response.request_id == expected_id {
                let _ = tx.send(response);
            }
        }
    });

    // Emit render request to frontend
    app_handle.emit("mcp-render-request", &req)
        .map_err(|e| ToolError::IoError(e.to_string()))?;

    // Wait for response with timeout
    let response = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        rx,
    )
    .await
    .map_err(|_| ToolError::RenderTimeout)?
    .map_err(|_| ToolError::RenderTimeout)?;

    // Unlisten
    app_handle.unlisten(listener);

    if let Some(err) = response.error {
        return Err(ToolError::InvalidContent(err));
    }

    // Write PNG bytes to file
    let output = output_path.to_path_buf();
    let bytes = response.png_bytes;
    tokio::task::spawn_blocking(move || {
        if let Some(parent) = output.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&output, &bytes)
    })
    .await
    .map_err(|e| ToolError::IoError(e.to_string()))?
    .map_err(|e| ToolError::IoError(e.to_string()))?;

    Ok(())
}

pub async fn handle_preview_slide(
    file_service: &Arc<FileService>,
    slide_service: &Arc<SlideService>,
    renderer_ready: &Arc<AtomicBool>,
    app_handle: &tauri::AppHandle,
    path: String,
    slide_id: String,
) -> Result<CallToolResult, rmcp::Error> {
    if !renderer_ready.load(Ordering::Relaxed) {
        return Err(rmcp::Error::internal(ToolError::RenderNotReady.to_string()));
    }

    let fs = file_service.clone();
    let ss = slide_service.clone();
    let sid = slide_id.clone();
    let content = tokio::task::spawn_blocking(move || {
        let data = fs.read(Path::new(&path))?;
        ss.get_content(&data, &sid)
    })
    .await
    .map_err(|e| rmcp::Error::internal(e.to_string()))?
    .map_err(tool_err)?;

    let tmp_dir = std::env::temp_dir().join("idea-slide-mcp");
    let output_path = tmp_dir.join(format!("preview-{}.png", slide_id));

    render_slide_to_file(app_handle, content, &output_path)
        .await
        .map_err(tool_err)?;

    Ok(CallToolResult {
        content: vec![Content::text(json!({
            "image_path": output_path.display().to_string()
        }).to_string())],
        is_error: None,
    })
}

pub async fn handle_preview_presentation(
    file_service: &Arc<FileService>,
    renderer_ready: &Arc<AtomicBool>,
    app_handle: &tauri::AppHandle,
    path: String,
) -> Result<CallToolResult, rmcp::Error> {
    if !renderer_ready.load(Ordering::Relaxed) {
        return Err(rmcp::Error::internal(ToolError::RenderNotReady.to_string()));
    }

    let fs = file_service.clone();
    let path_clone = path.clone();
    let data = tokio::task::spawn_blocking(move || {
        fs.read(Path::new(&path_clone))
    })
    .await
    .map_err(|e| rmcp::Error::internal(e.to_string()))?
    .map_err(tool_err)?;

    let tmp_dir = std::env::temp_dir().join("idea-slide-mcp");
    let mut image_paths = Vec::new();

    for slide in &data.slides {
        let output_path = tmp_dir.join(format!("preview-{}.png", slide.id));
        render_slide_to_file(app_handle, slide.content.clone(), &output_path)
            .await
            .map_err(tool_err)?;
        image_paths.push(output_path.display().to_string());
    }

    Ok(CallToolResult {
        content: vec![Content::text(json!({
            "image_paths": image_paths
        }).to_string())],
        is_error: None,
    })
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/mcp/tools/preview_tools.rs
git commit -m "feat(mcp): implement preview tools with Tauri event-based rendering"
```

---

## Chunk 4: Integration & Smoke Test

### Task 9: Add Tauri capability permissions for MCP events

**Files:**
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Add event permissions**

The current `default.json` has permissions on line 7. Add event-related permissions:

```json
{
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main", "mcp-renderer"],
  "permissions": [
    "core:default",
    "core:window:allow-set-fullscreen",
    "core:event:default",
    "opener:default",
    "dialog:default"
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/capabilities/default.json
git commit -m "feat(mcp): add event permissions for MCP renderer window"
```

---

### Task 10: Full build verification

**Files:** None (verification only)

- [ ] **Step 1: Build frontend**

Run: `npm run build`
Expected: TypeScript check passes, Vite build succeeds with no errors

- [ ] **Step 2: Build Rust backend**

Run: `cd src-tauri && cargo build`
Expected: Compiles successfully with no errors

- [ ] **Step 3: Run all Rust tests**

Run: `cd src-tauri && cargo test -- --nocapture`
Expected: All tests pass (existing file_format tests + new FileService + SlideService tests)

- [ ] **Step 4: Smoke test --mcp flag**

Run: `cd src-tauri && cargo run -- --mcp`
Expected: App starts without crashing. MCP server should be listening on stdio. Press Ctrl+C to stop.

- [ ] **Step 5: Commit all remaining changes**

```bash
git add -A
git commit -m "feat(mcp): complete MCP server integration with 11 tools"
```

---

## Chunk 5: Manual End-to-End Test

### Task 11: Test MCP server with a real MCP client

**Files:** None (manual testing)

- [ ] **Step 1: Configure Claude Code to use IdeaSlide MCP server**

Add to Claude Code's MCP server config:

```json
{
  "idea-slide": {
    "command": "<path-to-built-binary>/idea-slide",
    "args": ["--mcp"],
    "transport": "stdio"
  }
}
```

- [ ] **Step 2: Test create_presentation**

In Claude Code, ask: "Use the idea-slide MCP server to create a new presentation at /tmp/test-mcp.is"

Expected: Tool returns manifest metadata with 1 slide

- [ ] **Step 3: Test get_slide_content + set_slide_content**

Ask: "Get the content of the first slide, then add a title text element saying 'Hello MCP'"

Expected: get_slide_content returns JSON, set_slide_content succeeds

- [ ] **Step 4: Test preview_slide**

Ask: "Preview the first slide"

Expected: Returns a local PNG file path, Claude Code reads and displays the image

- [ ] **Step 5: Test add_slide + delete_slide + reorder_slides**

Test each remaining tool to verify full functionality.

- [ ] **Step 6: Fix any issues found and commit**

```bash
git add -A
git commit -m "fix(mcp): address issues found during end-to-end testing"
```
