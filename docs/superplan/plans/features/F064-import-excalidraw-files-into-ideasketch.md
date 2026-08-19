---
id: "F064"
title: "Import Excalidraw Files into IdeaSketch"
type: "feature"
status: "draft"
summary: "Import .excalidraw scenes into new .is files or Pages through the shared IdeaSketch model and safe native file boundary."
source: "docs/superplan/human/features.md"
created: "2026-08-19"
order: 64
depends_on: ["04", "F013", "F019"]
parent: ""
---

# Import Excalidraw Files into IdeaSketch Plan

**Goal:** Let users bring an existing `.excalidraw` scene into IdeaNote without losing editable Excalidraw content, either as a new Workspace `.is` file or as a new Page in the active IdeaSketch document.
**Scope:** Add an Import Excalidraw action to the Workspace “+” menu that selects a local `.excalidraw`/`.excalidraw.json` file, validates and normalizes its scene, creates a new `.is` file in the selected Workspace directory through the existing atomic document save path, refreshes and opens it, and preserves supported scene elements plus embedded files. Add an Import Excalidraw action to the Pages navigator that selects one file, converts it to a new Page in the active editable IdeaSketch document, selects that Page, and marks the document dirty for the existing save/autosave pipeline. Keep all user-facing copy in English and preserve read-only, cancellation, conflict, and unsupported-file safety behavior.
**Non-Goals:** Do not register `.excalidraw` as an openable Workspace/editor file type, replace the source file, import multiple files in one action, import `.drawio`, migrate legacy `.is` versions, expose Excalidraw native Save, or change Workspace archive/import-export semantics. Do not silently overwrite an existing `.is`; do not add AI conversion or rasterize vector content.
**Architecture:** A pure `excalidrawImport` module owns JSON shape validation, scene normalization, title/filename derivation, and conversion to the existing `IdeaSketchPage`/`IdeaSketchDocument` model. A small desktop boundary adds safe native byte/text reading for a user-selected local file and reuses the registry serializer plus `save_file`/`save_workspace_document` for `.is` output; Workspace imports target a validated sibling path and use the existing create/atomic-write policy. `WorkspaceSidebar`/`WorkspaceResourceRow` expose the action through the existing registry-driven “+” affordance, while `PageOrganizer` receives an injected import callback so the navigator remains editor-agnostic. Both entry points call the same import service and differ only in destination and post-import session handling.
**Baseline:** IdeaSketch v1 already serializes pages as `manifest.json` plus `slides/{id}.json`, `PageOrganizer` owns Pages actions, Workspace “+” exposes new folder/document commands, and Tauri has native dialogs plus atomic `save_file`/`save_workspace_document` commands. There is no safe frontend file-content read command for arbitrary selected files, no Excalidraw JSON parser/normalizer, and no import callback in the Pages navigator.
**Exit Criteria:** From a writable Workspace, the “+” menu offers Import Excalidraw; selecting a valid `.excalidraw` file creates a non-conflicting `.is` sibling with one titled Page, opens it, and keeps the source untouched. From an editable IdeaSketch Pages navigator, Import Excalidraw adds and selects one new Page containing the imported scene and embedded files; saving/reopening preserves elements, appState, files, and Page title. Cancel, malformed JSON, unsupported shapes/fields, read-only destinations, external-change/conflict state, and existing target names produce clear English feedback without data loss or silent overwrite. Focused import, menu wiring, Page wiring, Rust command, full frontend/Rust regressions, build, diff checks, and representative desktop smoke pass.

## Task 1: Build and Test the Shared Excalidraw Import Model

**Outcome:** Valid Excalidraw JSON becomes a safe, editable IdeaSketch Page/document model with deterministic naming and no mutation of the source.
**Files:**
- Create: `src/lib/excalidrawImport.ts`
- Create: `tests/excalidrawImport.test.mjs`
- Modify: `src/types.ts` (only if a narrow import result type is needed)

**Change Map:**
- parser/normalizer: accept standard Excalidraw scene JSON, validate `elements`/`appState`/`files`, drop deleted elements only when the source marks them deleted, preserve unknown element fields, and normalize missing collections to safe defaults
- page/document projection: derive a sanitized Page title from source metadata or filename, create valid IdeaSketch ids, preserve embedded file records/data URLs, and produce a one-Page v1 document for Workspace import
- failure contract: distinguish cancellation from malformed/unsupported input and return actionable English errors without partial output

**Verification:**
- `node --test tests/excalidrawImport.test.mjs`
- Cases: valid scene, minimal scene, malformed JSON, missing/invalid elements, deleted elements, embedded files, title/filename sanitization, deterministic fallback title, unknown fields, and source immutability.

- [ ] Add focused behavior tests for the parser and projections.
- [ ] Implement the pure import module and make all focused cases pass.

## Task 2: Add the Native File Boundary and Workspace “+” Import

**Outcome:** Workspace users can select an Excalidraw file and receive a new `.is` file safely opened in the current Workspace.
**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs` (register command)
- Modify: `src/lib/tauriCommands.ts`
- Modify: `src/components/WorkspaceSidebar.tsx`
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Create: `tests/excalidrawWorkspaceImport.test.mjs`
- Create or modify: `src-tauri` command tests for read boundary and collision-safe destination

**Change Map:**
- native read: add a bounded UTF-8 text/byte read command for a user-selected path, with explicit file/size/readability checks and no Workspace traversal expansion
- import coordinator: open the native file picker with `.excalidraw` and `.json` filters, parse through the shared module, choose a sanitized non-conflicting `<name>.is` destination in the selected directory, serialize via the existing IdeaSketch registry, and save atomically
- Workspace UI: add one English Import Excalidraw item to the top-level and row “+” menus; route selected directory/file context to the same coordinator, refresh the tree, and open the created document
- safety: cancellation is silent, read-only Workspace and failed writes leave the source and existing files unchanged, and errors use the existing Workspace action dialog path

**Verification:**
- `node --test tests/excalidrawWorkspaceImport.test.mjs tests/workspaceExplorer.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml read_workspace_file -- --nocapture` plus focused new command tests
- `npm run build`
- Cases: root/subfolder destination, name collision suffixing, source untouched, cancel/no write, malformed file, read-only Workspace, and refresh/open behavior.

- [ ] Add failing Workspace import/menu and native-read regressions.
- [ ] Implement the command, coordinator, and “+” menu wiring.
- [ ] Verify collision safety and open/refresh behavior.

## Task 3: Add Pages Navigator Import and Complete Delivery

**Outcome:** Active IdeaSketch users can import one Excalidraw file as a new selected Page through the existing dirty/save lifecycle.
**Files:**
- Modify: `src/components/PageOrganizer.tsx`
- Modify: `src/components/IdeaSketchNavigator.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Create or modify: `tests/pageOrganizerImport.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/editorChromeNavigation.test.mjs`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F064-import-excalidraw-files-into-ideasketch.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- navigator contract: inject an `onImport` callback and render an accessible Import Excalidraw button beside the existing Pages actions without changing Cameras behavior or view modes
- editor transaction: flush the active draft, append one imported Page, select it, preserve Page ordering, and mark the current session dirty through the existing reducer/session boundary
- delivery evidence: focused suites, full frontend/Rust regressions, production build, diff checks, and a desktop smoke covering both entry points and reopen persistence; then mark F064 complete/done and create a separate `feat(F064)` commit

**Verification:**
- `node --test tests/pageOrganizerImport.test.mjs tests/ideaSketchEditor.test.mjs tests/editorChromeNavigation.test.mjs`
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `npm run build`
- `git diff --check`
- Tauri smoke: import into Workspace root and nested folder, import into an existing Page list, cancel both dialogs, save/reopen, and compare scene/files/title/order.

- [ ] Add failing Page import callback and dirty-session regressions.
- [ ] Implement Page import UI and editor transaction.
- [ ] Run full verification, update F064 evidence/status/index, and create the task commit.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/features/F013-compact-workspace-and-navigator-layout.md`
- `docs/superplan/plans/features/F019-add-page-list-view-mode-switch.md`
- `src/lib/ideaSketchDocument.ts`
- `src/lib/fileTypeRegistry.ts`
- `src/lib/tauriCommands.ts`
- `src/components/WorkspaceSidebar.tsx`
- `src/components/WorkspaceResourceRow.tsx`
- `src/components/PageOrganizer.tsx`
- `src/components/IdeaSketchNavigator.tsx`
