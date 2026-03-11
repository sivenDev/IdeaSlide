# ideaSlide MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP of ideaSlide — a Tauri v2 desktop app with Excalidraw-based slide editing, .is file format support, and auto-save.

**Architecture:** Tauri v2 Rust backend handles file I/O (.is zip files), React frontend handles UI rendering and Excalidraw integration. Frontend and backend communicate via Tauri commands (file ops) and events (save status). State managed with React Context + useReducer.

**Tech Stack:** Tauri v2, Rust, React 18, TypeScript, @excalidraw/excalidraw 0.18.x, Tailwind CSS, jsPDF

**Spec:** `docs/superpowers/specs/2026-03-11-ideaslide-design.md`

---

## File Structure

```
idea-slide/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   ├── src/
│   │   ├── lib.rs                    # Tauri app setup, register commands
│   │   ├── main.rs                   # Entry point
│   │   ├── commands.rs               # Tauri command handlers (open, save, create)
│   │   ├── file_format.rs            # .is zip file read/write, manifest parsing
│   │   └── recent_files.rs           # Recent files list persistence
├── src/
│   ├── main.tsx                      # React entry point
│   ├── App.tsx                       # Router: launch screen vs editor
│   ├── types.ts                      # Shared TypeScript types
│   ├── components/
│   │   ├── LaunchScreen.tsx          # Recent files list + new/open buttons
│   │   ├── EditorLayout.tsx          # Main editor layout (toolbar + preview + canvas)
│   │   ├── Toolbar.tsx               # Top toolbar (file ops, drawing tools, undo/redo)
│   │   ├── SlidePreviewPanel.tsx     # Left panel with slide thumbnails
│   │   ├── SlideCanvas.tsx           # Excalidraw wrapper with custom UI
│   │   └── SaveIndicator.tsx         # "Saved" / "Saving..." status display
│   ├── hooks/
│   │   ├── useSlideStore.ts          # Slide state management (Context + useReducer)
│   │   └── useAutoSave.ts            # Auto-save logic with debounce
│   └── lib/
│       └── tauriCommands.ts          # Typed wrappers for Tauri invoke calls
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
├── index.html
└── .gitignore
```

---

## Chunk 1: Project Scaffolding + Rust Backend

### Task 1: Scaffold Tauri v2 + React project

**Files:**
- Create: all project root files via `create-tauri-app`

- [ ] **Step 1: Preserve existing files and scaffold project**

The project directory already exists with `.git/` and `docs/`. Move them aside, scaffold, then restore:

```bash
cd /Users/zhengxiwan/ide-workspace
# Move existing content aside
mv idea-slide idea-slide-backup
# Scaffold fresh project
npm create tauri-app@latest idea-slide -- --template react-ts
```

When prompted, choose:
- Package manager: `npm`
- UI template: `React`
- UI flavor: `TypeScript`

Then restore preserved files:

```bash
# Restore .git and docs
cp -r idea-slide-backup/.git idea-slide/.git
cp -r idea-slide-backup/docs idea-slide/docs
cp -r idea-slide-backup/.superpowers idea-slide/.superpowers 2>/dev/null || true
# Clean up backup
rm -rf idea-slide-backup
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/zhengxiwan/ide-workspace/idea-slide
npm install
```

- [ ] **Step 3: Install additional frontend dependencies**

```bash
npm install @excalidraw/excalidraw jspdf tailwindcss @tailwindcss/vite @tauri-apps/plugin-dialog
```

- [ ] **Step 4: Configure Tailwind CSS**

Create `src/index.css`:

```css
@import "tailwindcss";
```

Update `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
```

- [ ] **Step 5: Add Rust dependencies to Cargo.toml**

Add to `src-tauri/Cargo.toml` under `[dependencies]`:

```toml
zip = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde"] }
dirs = "6"
```

- [ ] **Step 6: Verify project builds**

```bash
npm run tauri dev
```

Expected: Tauri window opens with default React template. Close the window.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Tauri v2 + React + TypeScript project"
```

---

### Task 2: Implement .is file format module (Rust)

**Files:**
- Create: `src-tauri/src/file_format.rs`

This module handles reading and writing .is zip files. It parses manifest.json and manages slide JSON files inside the zip.

- [ ] **Step 1: Write test for manifest serialization**

Add to `src-tauri/src/file_format.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub version: String,
    pub created: String,
    pub modified: String,
    pub slides: Vec<SlideEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlideEntry {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsFileData {
    pub manifest: Manifest,
    pub slides: Vec<SlideData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlideData {
    pub id: String,
    pub content: serde_json::Value,
}

impl Manifest {
    pub fn new() -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            version: "1.0".to_string(),
            created: now.clone(),
            modified: now,
            slides: vec![SlideEntry {
                id: "slide-1".to_string(),
                title: "Untitled 1".to_string(),
            }],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manifest_new_has_one_slide() {
        let manifest = Manifest::new();
        assert_eq!(manifest.version, "1.0");
        assert_eq!(manifest.slides.len(), 1);
        assert_eq!(manifest.slides[0].id, "slide-1");
    }

    #[test]
    fn test_manifest_roundtrip_json() {
        let manifest = Manifest::new();
        let json = serde_json::to_string(&manifest).unwrap();
        let parsed: Manifest = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.slides.len(), 1);
        assert_eq!(parsed.version, "1.0");
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd src-tauri && cargo test
```

Expected: 2 tests pass.

- [ ] **Step 3: Implement create_is_file and read_is_file**

Add to `src-tauri/src/file_format.rs`:

```rust
use std::fs;
use std::io::{Read, Write, Cursor};
use std::path::Path;
use zip::write::SimpleFileOptions;

/// Create a new .is file at the given path with a single blank slide
pub fn create_is_file(path: &Path) -> Result<IsFileData, String> {
    let manifest = Manifest::new();
    let blank_slide = serde_json::json!({
        "type": "excalidraw",
        "version": 2,
        "elements": [],
        "appState": {},
        "files": {}
    });

    let data = IsFileData {
        manifest: manifest.clone(),
        slides: vec![SlideData {
            id: "slide-1".to_string(),
            content: blank_slide,
        }],
    };

    write_is_file(path, &data)?;
    Ok(data)
}

/// Read an .is file and return its contents
pub fn read_is_file(path: &Path) -> Result<IsFileData, String> {
    let file_bytes = fs::read(path).map_err(|e| format!("Failed to read file: {e}"))?;
    let cursor = Cursor::new(file_bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| format!("Failed to open zip: {e}"))?;

    // Read manifest
    let manifest: Manifest = {
        let mut entry = archive.by_name("manifest.json")
            .map_err(|e| format!("Missing manifest.json: {e}"))?;
        let mut buf = String::new();
        entry.read_to_string(&mut buf)
            .map_err(|e| format!("Failed to read manifest: {e}"))?;
        serde_json::from_str(&buf)
            .map_err(|e| format!("Invalid manifest JSON: {e}"))?
    };

    // Read slides
    let mut slides = Vec::new();
    for slide_entry in &manifest.slides {
        let zip_path = format!("slides/{}.json", slide_entry.id);
        let mut entry = archive.by_name(&zip_path)
            .map_err(|e| format!("Missing slide {}: {e}", slide_entry.id))?;
        let mut buf = String::new();
        entry.read_to_string(&mut buf)
            .map_err(|e| format!("Failed to read slide: {e}"))?;
        let content: serde_json::Value = serde_json::from_str(&buf)
            .map_err(|e| format!("Invalid slide JSON: {e}"))?;
        slides.push(SlideData {
            id: slide_entry.id.clone(),
            content,
        });
    }

    Ok(IsFileData { manifest, slides })
}

/// Write an IsFileData to a .is file (zip) with atomic replacement
pub fn write_is_file(path: &Path, data: &IsFileData) -> Result<(), String> {
    let mut buf = Vec::new();
    {
        let cursor = Cursor::new(&mut buf);
        let mut zip = zip::ZipWriter::new(cursor);
        let options = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        // Write manifest
        let manifest_json = serde_json::to_string_pretty(&data.manifest)
            .map_err(|e| format!("Failed to serialize manifest: {e}"))?;
        zip.start_file("manifest.json", options)
            .map_err(|e| format!("Failed to write manifest to zip: {e}"))?;
        zip.write_all(manifest_json.as_bytes())
            .map_err(|e| format!("Failed to write manifest bytes: {e}"))?;

        // Write slides
        for slide in &data.slides {
            let zip_path = format!("slides/{}.json", slide.id);
            let slide_json = serde_json::to_string_pretty(&slide.content)
                .map_err(|e| format!("Failed to serialize slide: {e}"))?;
            zip.start_file(&zip_path, options)
                .map_err(|e| format!("Failed to write slide to zip: {e}"))?;
            zip.write_all(slide_json.as_bytes())
                .map_err(|e| format!("Failed to write slide bytes: {e}"))?;
        }

        // Create empty dirs for media/ and thumbnails/
        zip.add_directory("media/", options)
            .map_err(|e| format!("Failed to create media dir: {e}"))?;
        zip.add_directory("thumbnails/", options)
            .map_err(|e| format!("Failed to create thumbnails dir: {e}"))?;

        zip.finish().map_err(|e| format!("Failed to finalize zip: {e}"))?;
    }

    // Atomic write: write to temp file then rename
    let tmp_path = path.with_extension("is.tmp");
    fs::write(&tmp_path, &buf)
        .map_err(|e| format!("Failed to write temp file: {e}"))?;
    fs::rename(&tmp_path, path)
        .map_err(|e| format!("Failed to rename temp file: {e}"))?;

    Ok(())
}
```

- [ ] **Step 4: Write integration test for create + read roundtrip**

Add to the `#[cfg(test)]` block:

```rust
#[test]
fn test_create_and_read_is_file() {
    let dir = std::env::temp_dir().join(format!("ideaslide_test_{}", std::process::id()));
    let _ = fs::create_dir_all(&dir);
    let path = dir.join("test.is");

    let created = create_is_file(&path).unwrap();
    assert_eq!(created.slides.len(), 1);
    assert_eq!(created.manifest.slides[0].id, "slide-1");

    let read = read_is_file(&path).unwrap();
    assert_eq!(read.slides.len(), 1);
    assert_eq!(read.manifest.version, "1.0");
    assert_eq!(read.slides[0].content["type"], "excalidraw");

    let _ = fs::remove_dir_all(&dir);
}
```

- [ ] **Step 5: Run tests**

```bash
cd src-tauri && cargo test
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/file_format.rs
git commit -m "feat: implement .is file format read/write with zip support"
```

---

### Task 3: Implement Tauri commands for file operations

**Files:**
- Create: `src-tauri/src/commands.rs`
- Create: `src-tauri/src/recent_files.rs` (stub)
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create commands module**

Create `src-tauri/src/commands.rs`:

```rust
use crate::file_format::{self, IsFileData, Manifest, SlideData};
use std::path::PathBuf;
use tauri::command;

#[command]
pub fn create_file(path: String) -> Result<IsFileData, String> {
    let path = PathBuf::from(&path);
    file_format::create_is_file(&path)
}

#[command]
pub fn open_file(path: String) -> Result<IsFileData, String> {
    let path = PathBuf::from(&path);
    file_format::read_is_file(&path)
}

#[command]
pub fn save_file(path: String, data: IsFileData) -> Result<(), String> {
    let path = PathBuf::from(&path);

    // Create backup before saving
    if path.exists() {
        let backup_path = path.with_extension("is.bak");
        let _ = std::fs::copy(&path, &backup_path);
    }

    // Update modified timestamp
    let mut data = data;
    data.manifest.modified = chrono::Utc::now().to_rfc3339();

    file_format::write_is_file(&path, &data)
}

#[command]
pub fn write_file_bytes(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, &data).map_err(|e| format!("Failed to write file: {e}"))
}
```

- [ ] **Step 2: Create stub recent_files module**

Create `src-tauri/src/recent_files.rs` first (must exist before lib.rs can reference it):

```rust
use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub modified: String,
}

#[command]
pub fn get_recent_files() -> Result<Vec<RecentFile>, String> {
    Ok(vec![])
}

#[command]
pub fn add_recent_file(_path: String) -> Result<(), String> {
    Ok(())
}
```

- [ ] **Step 3: Register commands in lib.rs**

Replace the contents of `src-tauri/src/lib.rs`:

Note: `tauri_plugin_opener` is included by the `create-tauri-app` scaffold template.

```rust
mod commands;
mod file_format;
mod recent_files;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::create_file,
            commands::open_file,
            commands::save_file,
            commands::write_file_bytes,
            recent_files::get_recent_files,
            recent_files::add_recent_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Add tauri-plugin-dialog to Cargo.toml**

Add to `src-tauri/Cargo.toml` under `[dependencies]`:

```toml
tauri-plugin-dialog = "2"
```

Add to `src-tauri/capabilities/default.json` permissions array:

```json
"dialog:default"
```

- [ ] **Step 5: Verify it compiles**

```bash
cd src-tauri && cargo build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/recent_files.rs src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/capabilities/default.json
git commit -m "feat: add Tauri commands for file operations"
```

---

### Task 4: Implement recent files persistence

**Files:**
- Modify: `src-tauri/src/recent_files.rs`

- [ ] **Step 1: Write test for recent files storage**

Replace `src-tauri/src/recent_files.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub modified: String,
}

fn recent_files_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or("Could not find config directory")?;
    let app_dir = config_dir.join("ideaslide");
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create config dir: {e}"))?;
    Ok(app_dir.join("recent_files.json"))
}

fn load_recent_files() -> Result<Vec<RecentFile>, String> {
    let path = recent_files_path()?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read recent files: {e}"))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse recent files: {e}"))
}

fn save_recent_files(files: &[RecentFile]) -> Result<(), String> {
    let path = recent_files_path()?;
    let json = serde_json::to_string_pretty(files)
        .map_err(|e| format!("Failed to serialize recent files: {e}"))?;
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write recent files: {e}"))
}

#[command]
pub fn get_recent_files() -> Result<Vec<RecentFile>, String> {
    let mut files = load_recent_files()?;
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

    let metadata = fs::metadata(&file_path)
        .map_err(|e| format!("Failed to read file metadata: {e}"))?;
    let modified = metadata.modified()
        .map(|t| {
            let dt: chrono::DateTime<chrono::Utc> = t.into();
            dt.to_rfc3339()
        })
        .unwrap_or_default();

    let mut files = load_recent_files().unwrap_or_default();

    // Remove existing entry for same path
    files.retain(|f| f.path != path);

    // Add to front
    files.insert(0, RecentFile { path, name, modified });

    // Keep max 20 entries
    files.truncate(20);

    save_recent_files(&files)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recent_files_roundtrip() {
        let files = vec![
            RecentFile {
                path: "/tmp/test.is".to_string(),
                name: "test.is".to_string(),
                modified: "2026-03-11T00:00:00Z".to_string(),
            },
        ];
        let json = serde_json::to_string(&files).unwrap();
        let parsed: Vec<RecentFile> = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].name, "test.is");
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd src-tauri && cargo test
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/recent_files.rs
git commit -m "feat: implement recent files persistence"
```

---

## Chunk 2: Frontend Foundation

### Task 5: Set up TypeScript types and Tauri command wrappers

**Files:**
- Create: `src/types.ts`
- Create: `src/lib/tauriCommands.ts`

- [ ] **Step 1: Create shared types**

Create `src/types.ts`:

```typescript
export interface SlideEntry {
  id: string;
  title: string;
}

export interface Manifest {
  version: string;
  created: string;
  modified: string;
  slides: SlideEntry[];
}

export interface SlideData {
  id: string;
  content: ExcalidrawData;
}

export interface ExcalidrawData {
  type: string;
  version: number;
  elements: ExcalidrawElement[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

// Simplified Excalidraw element type — the full type comes from @excalidraw/excalidraw
export type ExcalidrawElement = Record<string, unknown>;

export interface IsFileData {
  manifest: Manifest;
  slides: SlideData[];
}

export interface RecentFile {
  path: string;
  name: string;
  modified: string;
}
```

- [ ] **Step 2: Create Tauri command wrappers**

Create `src/lib/tauriCommands.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";
import type { IsFileData, RecentFile } from "../types";

export async function createFile(path: string): Promise<IsFileData> {
  return invoke<IsFileData>("create_file", { path });
}

export async function openFile(path: string): Promise<IsFileData> {
  return invoke<IsFileData>("open_file", { path });
}

export async function saveFile(path: string, data: IsFileData): Promise<void> {
  return invoke("save_file", { path, data });
}

export async function writeFileBytes(
  path: string,
  data: number[]
): Promise<void> {
  return invoke("write_file_bytes", { path, data });
}

export async function getRecentFiles(): Promise<RecentFile[]> {
  return invoke<RecentFile[]>("get_recent_files");
}

export async function addRecentFile(path: string): Promise<void> {
  return invoke("add_recent_file", { path });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/lib/tauriCommands.ts
git commit -m "feat: add TypeScript types and Tauri command wrappers"
```

---

### Task 6: Implement slide state management

**Files:**
- Create: `src/hooks/useSlideStore.ts`

- [ ] **Step 1: Create slide store with Context + useReducer**

Create `src/hooks/useSlideStore.ts`:

```typescript
import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { IsFileData, Manifest, SlideData } from "../types";

// State
export interface SlideState {
  filePath: string | null;
  manifest: Manifest | null;
  slides: SlideData[];
  currentSlideIndex: number;
  isDirty: boolean;
  isSaving: boolean;
}

const initialState: SlideState = {
  filePath: null,
  manifest: null,
  slides: [],
  currentSlideIndex: 0,
  isDirty: false,
  isSaving: false,
};

// Actions
type SlideAction =
  | { type: "LOAD_FILE"; payload: { path: string; data: IsFileData } }
  | { type: "SET_CURRENT_SLIDE"; payload: number }
  | {
      type: "UPDATE_SLIDE_CONTENT";
      payload: { index: number; content: SlideData["content"] };
    }
  | { type: "ADD_SLIDE" }
  | { type: "DELETE_SLIDE"; payload: number }
  | { type: "PREV_SLIDE" }
  | { type: "NEXT_SLIDE" }
  | { type: "SAVE_STARTED" }
  | { type: "SAVE_COMPLETED" }
  | { type: "SAVE_FAILED" }
  | { type: "CLOSE_FILE" };

function slideReducer(state: SlideState, action: SlideAction): SlideState {
  switch (action.type) {
    case "LOAD_FILE":
      return {
        ...state,
        filePath: action.payload.path,
        manifest: action.payload.data.manifest,
        slides: action.payload.data.slides,
        currentSlideIndex: 0,
        isDirty: false,
        isSaving: false,
      };

    case "SET_CURRENT_SLIDE":
      return {
        ...state,
        currentSlideIndex: Math.max(
          0,
          Math.min(action.payload, state.slides.length - 1)
        ),
      };

    case "UPDATE_SLIDE_CONTENT": {
      const slides = [...state.slides];
      slides[action.payload.index] = {
        ...slides[action.payload.index],
        content: action.payload.content,
      };
      return { ...state, slides, isDirty: true };
    }

    case "ADD_SLIDE": {
      const newId = `slide-${Date.now()}`;
      const newSlide: SlideData = {
        id: newId,
        content: {
          type: "excalidraw",
          version: 2,
          elements: [],
          appState: {},
          files: {},
        },
      };
      const newManifest = state.manifest
        ? {
            ...state.manifest,
            slides: [
              ...state.manifest.slides,
              { id: newId, title: `Untitled ${state.slides.length + 1}` },
            ],
          }
        : null;
      return {
        ...state,
        manifest: newManifest,
        slides: [...state.slides, newSlide],
        currentSlideIndex: state.slides.length,
        isDirty: true,
      };
    }

    case "DELETE_SLIDE": {
      if (state.slides.length <= 1) return state;
      const idx = action.payload;
      const slides = state.slides.filter((_, i) => i !== idx);
      const newManifest = state.manifest
        ? {
            ...state.manifest,
            slides: state.manifest.slides.filter((_, i) => i !== idx),
          }
        : null;
      const newIndex = Math.min(state.currentSlideIndex, slides.length - 1);
      return {
        ...state,
        manifest: newManifest,
        slides,
        currentSlideIndex: newIndex,
        isDirty: true,
      };
    }

    case "PREV_SLIDE":
      return {
        ...state,
        currentSlideIndex: Math.max(0, state.currentSlideIndex - 1),
      };

    case "NEXT_SLIDE":
      return {
        ...state,
        currentSlideIndex: Math.min(
          state.slides.length - 1,
          state.currentSlideIndex + 1
        ),
      };

    case "SAVE_STARTED":
      return { ...state, isSaving: true };

    case "SAVE_COMPLETED":
      return { ...state, isSaving: false, isDirty: false };

    case "SAVE_FAILED":
      return { ...state, isSaving: false };

    case "CLOSE_FILE":
      return initialState;

    default:
      return state;
  }
}

// Context
const SlideStateContext = createContext<SlideState>(initialState);
const SlideDispatchContext = createContext<Dispatch<SlideAction>>(() => {});

export function SlideProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(slideReducer, initialState);
  return (
    <SlideStateContext.Provider value={state}>
      <SlideDispatchContext.Provider value={dispatch}>
        {children}
      </SlideDispatchContext.Provider>
    </SlideStateContext.Provider>
  );
}

export function useSlideState() {
  return useContext(SlideStateContext);
}

export function useSlideDispatch() {
  return useContext(SlideDispatchContext);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSlideStore.ts
git commit -m "feat: implement slide state management with Context + useReducer"
```

---

### Task 7: Build the Launch Screen

**Files:**
- Create: `src/components/LaunchScreen.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create LaunchScreen component**

Create `src/components/LaunchScreen.tsx`:

```tsx
import { useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { RecentFile } from "../types";
import {
  getRecentFiles,
  openFile,
  createFile,
  addRecentFile,
} from "../lib/tauriCommands";
import { useSlideDispatch } from "../hooks/useSlideStore";

export function LaunchScreen() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useSlideDispatch();

  useEffect(() => {
    getRecentFiles().then(setRecentFiles).catch(console.error);
  }, []);

  async function handleOpen(path: string) {
    try {
      const data = await openFile(path);
      await addRecentFile(path);
      dispatch({ type: "LOAD_FILE", payload: { path, data } });
    } catch (err) {
      setError(`Failed to open file: ${err}`);
    }
  }

  async function handleBrowse() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "ideaSlide", extensions: ["is"] }],
    });
    if (selected) {
      await handleOpen(selected as string);
    }
  }

  async function handleNew() {
    try {
      const filePath = await save({
        defaultPath: "Untitled.is",
        filters: [{ name: "ideaSlide", extensions: ["is"] }],
      });
      if (filePath) {
        const data = await createFile(filePath);
        await addRecentFile(filePath);
        dispatch({ type: "LOAD_FILE", payload: { path: filePath, data } });
      }
    } catch (err) {
      setError(`Failed to create file: ${err}`);
    }
  }

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">ideaSlide</h1>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-4 mb-8">
        <button
          onClick={handleNew}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          New
        </button>
        <button
          onClick={handleBrowse}
          className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Open
        </button>
      </div>

      {recentFiles.length > 0 && (
        <div className="w-96">
          <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase">
            Recent Files
          </h2>
          <ul className="bg-white rounded-lg shadow divide-y divide-gray-100">
            {recentFiles.map((file) => (
              <li key={file.path}>
                <button
                  onClick={() => handleOpen(file.path)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-gray-800">{file.name}</div>
                  <div className="text-sm text-gray-500">
                    {formatDate(file.modified)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create stub EditorLayout**

Create `src/components/EditorLayout.tsx` (stub — replaced by real components in Tasks 8-12):

```tsx
export function EditorLayout() {
  return (
    <div className="h-screen flex flex-col">
      {/* Replaced by Toolbar in Task 10 */}
      <div className="h-12 bg-gray-800 text-white flex items-center px-4">
        Toolbar placeholder
      </div>
      <div className="flex flex-1">
        <div className="w-[200px] bg-gray-100 border-r">
          Preview placeholder
        </div>
        <div className="flex-1">Canvas placeholder</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update App.tsx as router**

Replace `src/App.tsx`:

```tsx
import { useSlideState } from "./hooks/useSlideStore";
import { LaunchScreen } from "./components/LaunchScreen";
import { EditorLayout } from "./components/EditorLayout";

function App() {
  const { filePath } = useSlideState();

  if (!filePath) {
    return <LaunchScreen />;
  }

  return <EditorLayout />;
}

export default App;
```

- [ ] **Step 4: Update main.tsx to wrap with provider**

Replace `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { SlideProvider } from "./hooks/useSlideStore";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SlideProvider>
      <App />
    </SlideProvider>
  </React.StrictMode>
);
```

- [ ] **Step 5: Verify the launch screen renders**

```bash
npm run tauri dev
```

Expected: Tauri window opens, showing "ideaSlide" title with New and Open buttons. No recent files shown (first launch).

- [ ] **Step 6: Commit**

```bash
git add src/components/LaunchScreen.tsx src/components/EditorLayout.tsx src/App.tsx src/main.tsx
git commit -m "feat: implement launch screen with recent files and file open/create"
```

---

## Chunk 3: Editor Interface + Excalidraw Integration

### Task 8: Implement the Excalidraw canvas wrapper

**Files:**
- Create: `src/components/SlideCanvas.tsx`

- [ ] **Step 1: Create SlideCanvas with Excalidraw integration**

Create `src/components/SlideCanvas.tsx`:

```tsx
import { useCallback, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useSlideState, useSlideDispatch } from "../hooks/useSlideStore";

export function SlideCanvas() {
  const { slides, currentSlideIndex } = useSlideState();
  const dispatch = useSlideDispatch();
  const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);

  const currentSlide = slides[currentSlideIndex];

  const handleChange = useCallback(
    (elements: readonly Record<string, unknown>[]) => {
      dispatch({
        type: "UPDATE_SLIDE_CONTENT",
        payload: {
          index: currentSlideIndex,
          content: {
            ...currentSlide.content,
            elements: elements as Record<string, unknown>[],
          },
        },
      });
    },
    [currentSlideIndex, currentSlide, dispatch]
  );

  if (!currentSlide) return null;

  return (
    <div className="w-full h-full">
      <Excalidraw
        key={currentSlide.id}
        ref={(api: ExcalidrawImperativeAPI) => {
          excalidrawRef.current = api;
        }}
        initialData={{
          elements: currentSlide.content.elements,
          appState: {
            viewBackgroundColor: "#ffffff",
          },
        }}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            export: false,
            saveAsImage: false,
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
          },
        }}
      />
    </div>
  );
}
```

Note: The `onChange` handler currently only captures `elements`, not `appState` (zoom, scroll, selected tool). Per-slide viewport state will not persist across slide switches. This is acceptable for MVP; capturing appState can be added in a follow-up if needed.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SlideCanvas.tsx
git commit -m "feat: implement Excalidraw canvas wrapper with custom UIOptions"
```

---

### Task 9: Implement the slide preview panel

**Files:**
- Create: `src/components/SlidePreviewPanel.tsx`

Note: Thumbnails show placeholder text in this MVP. Actual thumbnail rendering with `exportToCanvas` is deferred to Phase 2.

- [ ] **Step 1: Create slide preview panel**

Create `src/components/SlidePreviewPanel.tsx`:

```tsx
import { useState, useCallback } from "react";
import { useSlideState, useSlideDispatch } from "../hooks/useSlideStore";

const MIN_WIDTH = 150;
const MAX_WIDTH = 320;
const DEFAULT_WIDTH = 200;

export function SlidePreviewPanel() {
  const { slides, currentSlideIndex } = useSlideState();
  const dispatch = useSlideDispatch();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = width;

      function onMouseMove(e: MouseEvent) {
        const newWidth = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, startWidth + e.clientX - startX)
        );
        setWidth(newWidth);
      }

      function onMouseUp() {
        setIsResizing(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [width]
  );

  return (
    <div className="flex h-full" style={{ width }}>
      {/* Slide list */}
      <div className="flex-1 overflow-y-auto p-2 bg-gray-100">
        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase px-1">
          Slides
        </div>
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() =>
              dispatch({ type: "SET_CURRENT_SLIDE", payload: index })
            }
            className={`w-full mb-2 p-2 rounded border-2 text-left transition-colors ${
              index === currentSlideIndex
                ? "border-blue-500 bg-white"
                : "border-transparent bg-white hover:border-gray-300"
            }`}
          >
            <div className="bg-gray-50 h-20 flex items-center justify-center text-xs text-gray-400 rounded">
              Slide {index + 1}
            </div>
          </button>
        ))}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`w-1 cursor-col-resize transition-colors ${
          isResizing ? "bg-blue-400" : "bg-gray-300 hover:bg-blue-300"
        }`}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SlidePreviewPanel.tsx
git commit -m "feat: implement resizable slide preview panel"
```

---

### Task 10: Implement the toolbar

**Files:**
- Create: `src/components/Toolbar.tsx`
- Create: `src/components/SaveIndicator.tsx`

- [ ] **Step 1: Create SaveIndicator component**

Create `src/components/SaveIndicator.tsx`:

```tsx
import { useSlideState } from "../hooks/useSlideStore";

export function SaveIndicator() {
  const { isSaving, isDirty } = useSlideState();

  let text: string;
  let color: string;

  if (isSaving) {
    text = "Saving...";
    color = "text-yellow-400";
  } else if (isDirty) {
    text = "Unsaved";
    color = "text-orange-400";
  } else {
    text = "Saved";
    color = "text-green-400";
  }

  return <span className={`text-sm ${color}`}>{text}</span>;
}
```

- [ ] **Step 2: Create Toolbar component**

Create `src/components/Toolbar.tsx`:

```tsx
import { useSlideState, useSlideDispatch } from "../hooks/useSlideStore";
import { SaveIndicator } from "./SaveIndicator";

interface ToolbarProps {
  onSave: () => void;
  onBack: () => void;
}

export function Toolbar({ onSave, onBack }: ToolbarProps) {
  const { slides, currentSlideIndex } = useSlideState();
  const dispatch = useSlideDispatch();

  function handleAddSlide() {
    dispatch({ type: "ADD_SLIDE" });
  }

  function handleDeleteSlide() {
    if (slides.length <= 1) return;
    dispatch({ type: "DELETE_SLIDE", payload: currentSlideIndex });
  }

  function handlePrevSlide() {
    if (currentSlideIndex > 0) {
      dispatch({
        type: "SET_CURRENT_SLIDE",
        payload: currentSlideIndex - 1,
      });
    }
  }

  function handleNextSlide() {
    if (currentSlideIndex < slides.length - 1) {
      dispatch({
        type: "SET_CURRENT_SLIDE",
        payload: currentSlideIndex + 1,
      });
    }
  }

  return (
    <div className="h-12 bg-gray-800 text-white flex items-center px-4 gap-2 select-none">
      {/* Left: back + file ops */}
      <button
        onClick={onBack}
        className="px-2 py-1 rounded hover:bg-gray-700 text-sm"
        title="Back to home"
      >
        ←
      </button>

      <div className="w-px h-6 bg-gray-600 mx-1" />

      <button
        onClick={handleAddSlide}
        className="px-3 py-1 rounded hover:bg-gray-700 text-sm"
        title="New slide (Cmd+N)"
      >
        + Slide
      </button>
      <button
        onClick={handleDeleteSlide}
        disabled={slides.length <= 1}
        className="px-3 py-1 rounded hover:bg-gray-700 text-sm disabled:opacity-40"
        title="Delete slide"
      >
        Delete
      </button>

      <div className="w-px h-6 bg-gray-600 mx-1" />

      {/* Center: slide navigation */}
      <button
        onClick={handlePrevSlide}
        disabled={currentSlideIndex === 0}
        className="px-2 py-1 rounded hover:bg-gray-700 text-sm disabled:opacity-40"
      >
        ↑
      </button>
      <span className="text-sm min-w-[60px] text-center">
        {currentSlideIndex + 1} / {slides.length}
      </span>
      <button
        onClick={handleNextSlide}
        disabled={currentSlideIndex === slides.length - 1}
        className="px-2 py-1 rounded hover:bg-gray-700 text-sm disabled:opacity-40"
      >
        ↓
      </button>

      {/* Right: save indicator */}
      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={onSave}
          className="px-3 py-1 rounded hover:bg-gray-700 text-sm"
          title="Save (Cmd+S)"
        >
          Save
        </button>
        <SaveIndicator />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Toolbar.tsx src/components/SaveIndicator.tsx
git commit -m "feat: implement toolbar with slide management and save indicator"
```

---

### Task 11: Implement auto-save hook

**Files:**
- Create: `src/hooks/useAutoSave.ts`

- [ ] **Step 1: Create auto-save hook with debounce**

Create `src/hooks/useAutoSave.ts`:

```typescript
import { useEffect, useRef, useCallback } from "react";
import { useSlideState, useSlideDispatch } from "./useSlideStore";
import { saveFile } from "../lib/tauriCommands";
import type { IsFileData } from "../types";

const AUTO_SAVE_DELAY = 2500; // 2.5 seconds
const MAX_RETRIES = 3;

export function useAutoSave() {
  const state = useSlideState();
  const dispatch = useSlideDispatch();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const doSave = useCallback(async () => {
    if (!state.filePath || !state.manifest || state.isSaving) return;

    const data: IsFileData = {
      manifest: state.manifest,
      slides: state.slides,
    };

    dispatch({ type: "SAVE_STARTED" });

    try {
      await saveFile(state.filePath, data);
      dispatch({ type: "SAVE_COMPLETED" });
      retryCountRef.current = 0;
    } catch (err) {
      console.error("Save failed:", err);
      retryCountRef.current += 1;
      if (retryCountRef.current < MAX_RETRIES) {
        // Retry after a short delay
        timerRef.current = setTimeout(doSave, 1000);
      } else {
        dispatch({ type: "SAVE_FAILED" });
        retryCountRef.current = 0;
      }
    }
  }, [state.filePath, state.manifest, state.slides, state.isSaving, dispatch]);

  // Trigger auto-save when content changes
  useEffect(() => {
    if (!state.isDirty || !state.filePath) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(doSave, AUTO_SAVE_DELAY);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [state.isDirty, state.filePath, doSave]);

  // Manual save function
  const manualSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    doSave();
  }, [doSave]);

  return { manualSave };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAutoSave.ts
git commit -m "feat: implement auto-save hook with debounce and retry"
```

---

### Task 12: Wire up the full EditorLayout

**Files:**
- Modify: `src/components/EditorLayout.tsx`

Note: `PREV_SLIDE` and `NEXT_SLIDE` actions were already added to `useSlideStore.ts` in Task 6.

- [ ] **Step 1: Complete EditorLayout with all components**

Replace `src/components/EditorLayout.tsx`:

```tsx
import { useEffect } from "react";
import { Toolbar } from "./Toolbar";
import { SlidePreviewPanel } from "./SlidePreviewPanel";
import { SlideCanvas } from "./SlideCanvas";
import { useSlideDispatch } from "../hooks/useSlideStore";
import { useAutoSave } from "../hooks/useAutoSave";

export function EditorLayout() {
  const dispatch = useSlideDispatch();
  const { manualSave } = useAutoSave();

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      switch (e.key) {
        case "s":
          e.preventDefault();
          manualSave();
          break;
        case "n":
          e.preventDefault();
          dispatch({ type: "ADD_SLIDE" });
          break;
        case "ArrowUp":
          e.preventDefault();
          dispatch({ type: "PREV_SLIDE" });
          break;
        case "ArrowDown":
          e.preventDefault();
          dispatch({ type: "NEXT_SLIDE" });
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, manualSave]);

  function handleBack() {
    manualSave();
    dispatch({ type: "CLOSE_FILE" });
  }

  return (
    <div className="h-screen flex flex-col">
      <Toolbar onSave={manualSave} onBack={handleBack} />
      <div className="flex flex-1 overflow-hidden">
        <SlidePreviewPanel />
        <div className="flex-1 relative">
          <SlideCanvas />
        </div>
      </div>
    </div>
  );
}
```
    case "NEXT_SLIDE":
      return {
        ...state,
        currentSlideIndex: Math.min(
- [ ] **Step 2: Verify the full app works**

```bash
npm run tauri dev
```

Expected:
1. Launch screen appears with "ideaSlide" title and New/Open buttons
2. Click "New" → select a directory → editor opens with one blank slide
3. Draw something on the canvas with Excalidraw tools
4. "Saving..." indicator appears after ~2.5s, then shows "Saved"
5. Click "+ Slide" → new blank slide added, preview updates
6. Click a slide in the preview panel → switches to that slide
7. Click "←" → returns to launch screen
8. Reopen → see the file in recent files list

- [ ] **Step 3: Commit**

```bash
git add src/components/EditorLayout.tsx
git commit -m "feat: wire up full editor layout with keyboard shortcuts and auto-save"
```

---

### Task 13: Final cleanup and integration test

**Files:**
- Modify: `src/index.css`
- Clean up: remove scaffold files

- [ ] **Step 1: Clean up default scaffold files**

Remove default template files that are no longer needed:

```bash
rm -f src/assets/react.svg src/App.css
```

- [ ] **Step 2: Ensure index.css imports Tailwind**

Verify `src/index.css` contains:

```css
@import "tailwindcss";
```

Remove any other default styles.

- [ ] **Step 3: Update Tauri window config**

In `src-tauri/tauri.conf.json`, update the window settings:

Set `"title"` to `"ideaSlide"`, `"width"` to `1200`, `"height"` to `800`, and `"minWidth"` to `800`, `"minHeight"` to `600`.

- [ ] **Step 4: Full integration test**

```bash
npm run tauri dev
```

Test the complete flow:
1. Launch screen shows correctly with "ideaSlide" title
2. Create a new presentation → editor opens
3. Draw on canvas → auto-save triggers
4. Add slides, delete slides, navigate between slides
5. Close to launch screen → file appears in recent files
6. Reopen the file → all slides and content preserved
7. Keyboard shortcuts work: Cmd+S (save), Cmd+N (new slide), Cmd+↑/↓ (navigate)

- [ ] **Step 5: Final commit**

```bash
git add src/index.css src/App.tsx src/main.tsx src-tauri/tauri.conf.json
git commit -m "feat: complete ideaSlide MVP with editor, auto-save, and file management"
```

---

## Deferred to Phase 2

The following features are intentionally omitted from this MVP plan (see spec Phase 2+):

- **Thumbnail rendering** — Preview panel currently shows placeholder text. Phase 2 will use Excalidraw's `exportToCanvas` API to render actual thumbnails (200x150px).
- **PDF export** — Toolbar export button deferred. Phase 2 will use `exportToBlob` + `jsPDF`.
- **Style settings panel** — Color, stroke width, font controls in toolbar deferred.
- **Resizable preview width keyboard shortcut** — `Cmd+[/]` deferred.
- **`Cmd+Delete` shortcut** — For slide deletion, deferred.
- **Backup cleanup** — Cleaning up `.is.bak` files older than 7 days on app exit.
