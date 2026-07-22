<!-- managed-by: superplan:start -->
# Workflow Guardrails
1. Before starting any new task, inspect the current workspace and recent progress; when the task is done, create a separate commit for that task's changes.
2. At the start of every task, understand the current progress first; when the task is complete, update the progress accordingly. Plans live under `./docs/superplan/plans`.
3. Whenever a plan changes, review the entire related plan set until the plans are independent, the structure is clear, and dependencies are explicit.

# Development Rules
1. When implementing a code change, inspect the directly related code in the same area, and clean up directly related redundancy or bloat, but do not expand it into unrelated refactoring.
2. Correctness comes first; once correctness is ensured, performance must be considered, then balanced against memory usage.
3. Always choose the correct implementation. Do not avoid it just because the change is large; if key assumptions are unclear, clarify them before continuing.
<!-- managed-by: superplan:end -->

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
- `PresentationMode.tsx` — Fullscreen/preview slide presentation with keyboard nav; uses event capture phase to intercept keys before Excalidraw
- `ResizableDivider.tsx` — Interactive divider between editor and preview panel with toggle buttons
- `ThumbnailNavigator.tsx` — Slide thumbnail strip for presentation mode navigation
- `Toolbar.tsx` — Top toolbar with home button, presentation triggers, and slide actions

### Tauri Capabilities Gotcha
- New Tauri window/webview APIs require explicit permissions in `src-tauri/capabilities/default.json`. E.g., `core:window:allow-set-fullscreen` for `getCurrentWindow().setFullscreen()`. Calls fail silently without the permission.

### CSS Overflow Architecture
- `index.css` sets `overflow: hidden` on `html`, `body`, and `#root` globally — no document-level scrolling. All scrolling must be implemented within specific container elements using `overflow-y-auto`.
- Preview panel wrapper in `EditorLayout` must always have `overflow-hidden` to contain scrolling within `SlidePreviewPanel`'s internal scroll container.

### Excalidraw Integration Pitfalls
- Excalidraw CSS is loaded as a static asset from `public/excalidraw.css` (linked in `index.html`), not via JS imports — CSS module imports break Vite/Tauri builds.
- `appState.collaborators` must be initialized as `new Map()` in `initialData`, or Excalidraw throws `forEach is not a function`.
- Tailwind's base styles conflict with Excalidraw canvas rendering — overrides are in `src/index.css` (`.excalidraw canvas`, `.excalidraw svg`).
- The `onChange` callback must have a stable identity (via `useRef`) to prevent infinite re-render loops. `SlideCanvas` skips the first onChange call after mount to avoid feedback loops.
- `SlideCanvas` accepts `viewMode` prop — sets `viewModeEnabled` + `zenModeEnabled` in appState and disables onChange for read-only presentation rendering.
- Keyboard handlers in presentation mode must use capture phase (`addEventListener(event, handler, true)`) to intercept before Excalidraw consumes the events.

## Tech Stack
- **Tauri v2** (not v1 — uses `@tauri-apps/api` v2, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-opener`)
- **React 19** with JSX transform
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (not PostCSS)
- **Excalidraw 0.18**
- **Vite 7**
- **TypeScript** — strict mode, no unused locals/params

## Localization

The application UI is in English. All user-facing text should be in English.


<claude-mem-context>
# Memory Context

# [idea-slide] recent context, 2026-07-03 10:50am GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (13,796t read) | 2,945,709t work | 100% savings

### Apr 21, 2026
6353 11:52a ⚖️ Slide store reducer will be extracted into pure library module for testing
6362 11:59a ⚖️ IdeaSlide implementation will use same-session subagent-driven execution instead of parallel plan execution
6363 " ⚖️ IdeaSlide execution workflow requires isolated workspace before implementation starts
6364 " ⚖️ IdeaSlide task completion will require fresh verification evidence and explicit review requests
6365 12:00p ⚖️ IdeaSlide feature execution must leave `master` and use ignored `.worktrees` workspace
6383 12:05p 🔄 Slide store reducer moved into pure library module in IdeaSlide
6384 " 🟣 IdeaSlide slides now carry persistent title field and titled slide creation path
6387 12:06p 🔄 Slide store reducer extracted into pure module
6388 " 🟣 Slides now carry persistent title field
6389 " 🔴 Node test imports require explicit `.ts` path for reducer helper
6390 " 🔵 Title persistence helper still missing manifest serializer
6391 " ⚖️ Organizer and laser work split between persistent store logic and presentation-local pointer state
6392 12:09p 🔵 Editor session persistence flow preserves slide titles during draft commit and flush
6395 " 🟣 IS file conversions now persist slide titles through save and load
6396 " ✅ Title-aware editor session persistence passed focused tests and production build
6399 12:10p 🔵 Slide organizer wiring now guarded by source-level test for shared UI primitives
6402 " ✅ Slide organizer dependencies installed for popover and drag sorting
6403 " 🟣 Shared Popover primitive added for organizer surface
6406 " 🟣 Shared Input primitive added for slide organizer rename flow
6407 12:11p ✅ Shared organizer primitives committed with dependency graph update
6409 " ⚖️ Organizer migration will replace inline toolbar slide rows with dedicated popover component
6412 " 🔵 Toolbar still uses legacy slide dropdown and numeric slide summary
6413 " 🔵 EditorLayout already holds state needed for organizer persistence-safe toolbar migration
6414 12:13p 🔵 Organizer TDD now blocked by missing toolbar migration and absent SlideOrganizer component
6415 " 🔵 Editor and store layers already support title-aware organizer wiring
6424 12:16p ✅ Slide organizer popover wiring passes dedicated guard tests
6425 " 🔴 Toolbar build failure fixed after dropdown-to-popover migration
6426 " 🔵 IdeaSlide test setup is source-string based, not DOM-render based
6427 " 🔵 Slide title helper now normalizes manifest titles in both load and save paths
6431 " ✅ Slide organizer tests now require inline rename flow
6432 " 🔵 SlideOrganizer scaffold fails new rename contract at first missing input import
6437 12:17p 🟣 Slide organizer now supports inline title rename inside popover
6438 " ✅ Inline rename contract is green in tests and build
6448 12:18p 🟣 Slide organizer now supports drag reorder through dnd-kit sortable rows
6449 " ✅ Organizer reorder wiring verified with reducer regression coverage and production build
6450 " 🔵 Presentation laser pointer likely needs custom overlay instead of built-in Excalidraw collaborator API
6451 12:21p 🔵 Excalidraw package ships hidden type surface under dist/types despite sparse top-level install layout
6460 12:24p 🔵 SlideCanvas treats camera preview and collaborators as transient Excalidraw UI state
6461 " 🔵 Excalidraw public API supports laser pointers through collaborator scene updates
6462 " 🔵 PresentationMode test coverage exists for camera viewport flow but not laser toggle
6465 12:27p 🟣 Presentation mode now supports transient Excalidraw laser pointer toggled with K
6466 " 🟣 Presentation laser helper library added for scene-coordinate conversion and collaborator payloads
6467 " ✅ Presentation laser regression tests added and build stays green with known bundle warnings
6468 " ✅ Editor shell regression tests now lock organizer popover architecture instead of old inline slide rows
6469 " ✅ Organizer, title, reducer, camera, tooltip, and laser regression suites all pass together
6470 " ✅ Production build still succeeds after organizer and laser follow-up test updates
6473 12:28p ✅ Slide organizer and presentation laser implementation plan finished end to end
6490 2:05p 🔵 IdeaSlide Tauri dev flow boots Vite and Rust watcher together
6491 2:13p 🔵 Slide organizer now supports inline rename inside shared popover
6492 " 🔵 Toolbar slide control opens organizer through shared Popover

Access 2946k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
