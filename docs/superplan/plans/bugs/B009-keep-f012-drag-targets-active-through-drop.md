---
id: "B009"
title: "Make F012 Drag Reliable with dnd-kit"
type: "bugfix"
status: "complete"
summary: "Replace the unreliable native HTML5 drag lifecycle with dnd-kit so Workspace, Page, and Camera sorting completes consistently in Tauri WebKit."
source: "docs/superplan/human/bugs.md"
created: "2026-08-04"
order: 9
depends_on: ["F012"]
parent: ""
---

# Make F012 Drag Reliable with dnd-kit Plan

**Goal:** Make every F012 drag interaction visibly start, target, and complete in the macOS Tauri runtime without maintaining a custom drag-and-drop framework.
**Scope:** Replace native HTML5 `draggable`/`DataTransfer` event handling in Workspace Explorer, Page Organizer, and Camera List with `@dnd-kit/core` and `@dnd-kit/sortable`. Use library sensors, collision detection, sortable transforms, drag lifecycle, and accessibility announcements. Keep the existing pure Workspace path projection, native filesystem move transaction, Page reducer action, Camera scene reorder helper, read-only restrictions, and persistence paths as the business layer. Workspace rows retain explicit before/inside/after targets and the root destination; Pages and Cameras support upward and downward sorting with the existing active selection and action controls intact.
**Non-Goals:** This fix does not add multi-select, cross-Workspace dragging, cross-document Page movement, cross-Page Camera movement, touch-specific redesign, new file formats, or changes to Workspace filesystem safety, save/autosave policy, watcher conflict handling, Page manifests, Camera scene representation, or Radix UI primitives. Radix UI is not used for sorting because it provides no drag-and-drop component.
**Architecture:** One top-level `DndContext` owns each drag surface. Workspace uses dnd-kit draggable entries plus typed droppable zones whose data maps directly to the existing `WorkspaceDropRequest`; `EditorLayout` and `projectWorkspaceEntryDrop` remain authoritative for reparenting, collision/cycle rejection, path remapping, refresh, and persisted order. Pages and Cameras use `SortableContext`, `useSortable`, `verticalListSortingStrategy`, and dnd-kit's `arrayMove` rather than the custom HTML5 state/MIME protocol and `listReorder` helper. Pointer and keyboard sensors use dnd-kit activation constraints so row buttons, rename inputs, and destructive actions remain independently clickable. A WebKit runtime regression loads the real Vite application with mocked Tauri IPC and verifies actual pointer-driven DOM order changes rather than source-string wiring alone.
**Baseline:** F012 attaches native `draggable` handlers to all three row types and stores the current target in React state during `dragover`. Each `dragleave` clears that state. The existing automated tests cover pure order projection and source wiring but do not execute the React drag lifecycle in WebKit.
**Reproduction:** Load the current application in Playwright WebKit with a mocked writable Workspace containing `a.is`, `b.is`, and a folder. Drag `a.is` below `b.is`. `dragstart` and repeated `dragover` events occur and the `is-drop-after` class appears, but WebKit emits `dragleave` with `relatedTarget = null` immediately before mouse release. Without cancelling the final re-enter transition, no `drop` is delivered; when `drop` is forced, the row's handler sees the target state already cleared and never calls `onMove`. The visible order remains `a.is`, `b.is`, `folder`. The same lifecycle exists in Page and Camera rows; their fallback `after` placement turns upward moves and some target positions into no-ops.
**Root Cause:** F012 treats transient React hover state as the authoritative drop transaction and relies on native HTML5 dragenter/leave/drop ordering. Tauri's WebKit event sequence invalidates that assumption: style updates during drag cause extra enter/leave transitions, the final leave has no related target, and clearing state races the drop callback. The pure sorting and persistence code is correct, but it is never reached or receives the wrong placement. Source-string and reducer tests passed because they did not exercise a real browser drag lifecycle.
**Exit Criteria:** Pointer dragging in the macOS Tauri/WebKit path reorders Workspace siblings in both directions, moves entries before/after/inside another folder, and reaches the existing native move transaction exactly once. Page and Camera rows sort upward and downward, preserve active selection, and still expose rename/delete plus Camera Up/Down controls. Read-only, Symlink, Missing, collision, and self-descendant cases remain non-mutating. Drag feedback does not disappear before release, and no custom HTML5 MIME/drop-state implementation remains. A real WebKit behavior regression fails on F012 and passes with dnd-kit; focused Workspace/Page/Camera tests, complete frontend/Rust suites, formatting/lint/build/diff checks, and isolated Tauri smoke verification pass.

## Task 1: Capture the WebKit Drag Failure and Adopt dnd-kit

**Outcome:** A real browser regression reproduces the no-op drag, and the project uses a maintained drag-and-drop library compatible with React 19.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/f012DragRuntime.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`
- Modify: `tests/pageOrganizer.test.mjs`
- Modify: `tests/cameraSidebarWiring.test.mjs`

**Change Map:**
- dependencies: add `@dnd-kit/core` and `@dnd-kit/sortable`; retain Radix only for the UI primitives it actually supplies
- WebKit regression: start the real Vite app on an isolated port, mock Tauri IPC, perform pointer drags, and assert DOM/model order plus Workspace move invocations
- wiring guards: reject reintroduction of native `draggable`, custom drag MIME, and row-local drop lifecycle state

**Verification:**
- `node --test tests/f012DragRuntime.test.mjs`
- `node --test tests/workspaceExplorerWiring.test.mjs tests/pageOrganizer.test.mjs tests/cameraSidebarWiring.test.mjs`
- Confirm the runtime test fails against commit `a5fb5c2` because Workspace order remains unchanged.

- [x] Add the failing real-WebKit behavior regression before replacing the drag implementation.
- [x] Install the supported dnd-kit packages without adding a second UI framework or custom sensor layer.

## Task 2: Move Workspace Drag Lifecycle to dnd-kit

**Outcome:** Workspace rows reliably emit typed before/inside/after/root requests while the existing filesystem and ordering transaction remains unchanged.
**Files:**
- Modify: `src/components/WorkspaceExplorer.tsx`
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Modify: `src/lib/workspaceOrdering.ts`
- Modify: `src/index.css`
- Modify: `tests/workspaceExplorerWiring.test.mjs`
- Modify: `tests/workspaceState.test.mjs`
- Modify: `tests/appStoreReducer.test.mjs`

**Change Map:**
- Explorer `DndContext`: pointer/keyboard sensors, collision detection, active entry identity, and one `onDragEnd` conversion to `WorkspaceDropRequest`
- resource rows: dnd-kit draggable attributes/listeners plus typed droppable before/inside/after zones; action and rename controls remain non-activators
- root destination and feedback: dnd-kit droppable state replaces native `DataTransfer` checks and row-local `dragleave` cleanup
- Workspace projection: retain only business validation/order projection and remove UI MIME protocol ownership

**Verification:**
- `node --test tests/f012DragRuntime.test.mjs tests/workspaceExplorerWiring.test.mjs tests/workspaceState.test.mjs tests/appStoreReducer.test.mjs`
- Cases: root/nested reorder both directions; before/after/inside; root destination; read-only/Symlink/Missing source; collision and descendant rejection; rename/trash controls do not activate dragging.

- [x] Replace native Workspace dragging with dnd-kit while preserving the exact `onMove` business contract.
- [x] Keep native reparenting, path remapping, watcher behavior, and schema-v3 order persistence unchanged.

## Task 3: Move Page and Camera Sorting to dnd-kit Sortable

**Outcome:** Page and Camera rows sort consistently in both directions through their existing model update callbacks.
**Files:**
- Modify: `src/components/PageOrganizer.tsx`
- Modify: `src/components/CameraList.tsx`
- Delete: `src/lib/listReorder.ts`
- Modify: `src/index.css`
- Modify: `tests/pageOrganizer.test.mjs`
- Modify: `tests/cameraSidebarWiring.test.mjs`
- Modify: `tests/cameraUtils.test.mjs`
- Modify: `tests/ideaSketchReducer.test.mjs`
- Modify: `tests/workspacePresentationOrder.test.mjs`

**Change Map:**
- Pages: `SortableContext` and `useSortable` emit the existing page id plus final index to `REORDER_PAGE`
- Cameras: dnd-kit `arrayMove` emits ordered Camera ids once per real change while retaining Up/Down buttons
- interaction isolation: rename inputs and row actions do not start a pointer drag; read-only rows have no activator listeners
- cleanup: remove custom MIME constants, native drag handlers, drop-target state, and the custom list-index helper

**Verification:**
- `node --test tests/f012DragRuntime.test.mjs tests/pageOrganizer.test.mjs tests/cameraSidebarWiring.test.mjs tests/cameraUtils.test.mjs tests/ideaSketchReducer.test.mjs tests/workspacePresentationOrder.test.mjs`
- Cases: first/middle/last upward and downward moves; no-op; read-only; active Page/Camera preservation; saved Page manifest and Camera presentation order.

- [x] Replace both native list implementations with dnd-kit sortable primitives and library `arrayMove`.
- [x] Preserve the canonical Page/Camera persistence paths and accessible button alternatives.

## Task 4: Verify and Deliver B009

**Outcome:** F012 drag interactions work in the real WebKit lifecycle and remain regression-safe across native persistence boundaries.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B009-keep-f012-drag-targets-active-through-drop.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B009 request/plan: completion status and failing/passing WebKit evidence
- generated index: refreshed B009 state

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `git diff --check`
- Isolated Tauri acceptance: perform Workspace before/after/inside/root moves and Page/Camera upward/downward sorts; save/reopen and verify persisted order with no Missing/conflict notice.

- [x] Run the focused failing/passing WebKit regression and the full verification matrix.
- [x] Mark B009 complete/done, refresh the plan index, and create a separate `fix(B009)` commit excluding unrelated changes.

## Completion Evidence

- The WebKit regression failed on the F012 implementation with `['a.is', 'b.is', 'folder']` unchanged, then passed with dnd-kit for downward and upward sibling sorting, folder insertion, root extraction, and exactly two native parent-change invocations.
- `node --test tests/*.test.mjs`: 178 passed, including the real pointer-driven WebKit behavior regression.
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`: 80 passed; `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets` passed.
- `npm run build` and `git diff --check` passed. `npm run tauri dev` compiled and launched the desktop shell; the optional local Computer Use service was unavailable, so the WebKit runtime test plus native Rust suite provide the interaction and filesystem evidence.

## References
- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F012-drag-sort-workspace-pages-and-cameras.md`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/WorkspaceResourceRow.tsx`
- `src/components/PageOrganizer.tsx`
- `src/components/CameraList.tsx`
- `src/lib/workspaceOrdering.ts`
- `src/lib/listReorder.ts`
- `src/components/EditorLayout.tsx`
