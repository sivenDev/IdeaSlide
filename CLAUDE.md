# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is This

IdeaSlide is a Tauri v2 desktop application for creating slide presentations using Excalidraw as the drawing canvas. The native file format is `.is` (a zip archive containing a JSON manifest and individual slide JSON files).

## Commands

### Development
```bash
npm run tauri dev          # Start Tauri dev mode (launches native window + Vite dev server on :1420)
npm run dev                # Start Vite dev server only (frontend without Tauri shell)
npm run build              # TypeScript check + Vite production build
```

### Rust Backend
```bash
cd src-tauri && cargo build       # Build Rust backend
cd src-tauri && cargo test        # Run Rust unit tests (file_format, recent_files)
cd src-tauri && cargo test -- --nocapture  # Run with stdout
```

## Architecture

### Two-Process Model (Tauri v2)
- **Frontend** (`src/`): React 19 + TypeScript + Tailwind CSS v4 + Excalidraw
- **Backend** (`src-tauri/src/`): Rust — file I/O, zip handling, recent files tracking

Frontend communicates with backend via Tauri's `invoke()` IPC. The TypeScript wrapper is in `src/lib/tauriCommands.ts`, which handles conversion between the frontend `Slide` type and the backend `IsFileData` zip format.

### State Management
`src/hooks/useSlideStore.tsx` — React Context + `useReducer`. Actions: `LOAD_PRESENTATION`, `ADD_SLIDE`, `DELETE_SLIDE`, `SET_CURRENT_SLIDE`, `UPDATE_SLIDE`, `MARK_SAVED`, `MARK_DIRTY`. No external state library.

### .is File Format (Zip Archive)
Managed by `src-tauri/src/file_format.rs`. Structure inside the zip:
```
manifest.json          # version, timestamps, slide index
slides/{id}.json       # per-slide Excalidraw scene data
media/                 # reserved for future use
thumbnails/            # reserved for future use
```
Saves use atomic write (write to `.is.tmp`, then rename). Backups created as `.is.bak` before overwrite.

### Tauri Commands (IPC boundary)
Registered in `src-tauri/src/lib.rs`:
- `create_file`, `open_file`, `save_file`, `write_file_bytes` (in `commands.rs`)
- `get_recent_files`, `add_recent_file` (in `recent_files.rs`)

### Key Frontend Components
- `App.tsx` — Routes between `LaunchScreen` (file picker) and `EditorLayout`
- `EditorLayout.tsx` — Main editor: toolbar + slide preview panel + canvas
- `SlideCanvas.tsx` — Wraps `@excalidraw/excalidraw`; uses `key={slideId}` to remount on slide switch

### Excalidraw Integration Pitfalls
- Excalidraw CSS is loaded as a static asset from `public/excalidraw.css` (linked in `index.html`), not via JS imports — CSS module imports break Vite/Tauri builds.
- `appState.collaborators` must be initialized as `new Map()` in `initialData`, or Excalidraw throws `forEach is not a function`.
- Tailwind's base styles conflict with Excalidraw canvas rendering — overrides are in `src/index.css` (`.excalidraw canvas`, `.excalidraw svg`).
- The `onChange` callback must have a stable identity (via `useRef`) to prevent infinite re-render loops. `SlideCanvas` skips the first onChange call after mount to avoid feedback loops.

## Tech Stack
- **Tauri v2** (not v1 — uses `@tauri-apps/api` v2, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-opener`)
- **React 19** with JSX transform
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (not PostCSS)
- **Excalidraw 0.18**
- **Vite 7**
- **TypeScript** — strict mode, no unused locals/params
