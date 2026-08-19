---
id: "F064"
title: "Import Excalidraw Files into IdeaSketch"
type: "feature"
status: "complete"
summary: "Import .excalidraw scenes into new .is files or Pages through the shared IdeaSketch model and safe native file boundary."
source: "docs/superplan/human/features.md"
created: "2026-08-19"
order: 64
depends_on: ["04", "F027", "F051", "F053"]
parent: ""
---

# Import Excalidraw Files into IdeaSketch Plan

**Goal:** Let users bring an existing `.excalidraw` scene into IdeaNote without losing editable Excalidraw content, either as a new Workspace `.is` file or as a new Page in the active IdeaSketch document.
**Scope:** Add a dedicated Import dropdown beside the existing creation actions for the Workspace root and directory rows without changing either “+” menu; its initial Import Excalidraw item selects a local `.excalidraw`/`.excalidraw.json` file, validates and normalizes its scene, creates a new `.is` file in the selected Workspace directory through the existing atomic document save path, refreshes and opens it, and preserves supported scene elements plus embedded files. Add the same dedicated Import dropdown beside Add Page in the Pages navigator; its Import Excalidraw item selects one file, converts it to a new Page in the active editable IdeaSketch document, selects that Page, and marks the document dirty for the existing save/autosave pipeline. Keep all user-facing copy in English and preserve read-only, cancellation, conflict, and unsupported-file safety behavior.
**Non-Goals:** Do not place import commands inside or replace the existing “+” creation menus, register `.excalidraw` as an openable Workspace/editor file type, replace the source file, import multiple files in one action, import `.drawio`, migrate legacy `.is` versions, expose Excalidraw native Save, or change Workspace archive/import-export semantics. Do not silently overwrite an existing `.is`; do not add AI conversion or rasterize vector content.
**Architecture:** A pure `excalidrawImport` module owns JSON shape validation, scene normalization, title/filename derivation, and conversion to the existing `IdeaSketchPage`/`IdeaSketchDocument` model. A small desktop boundary adds safe native byte/text reading for a user-selected local file and reuses the registry serializer plus `save_file`/`save_workspace_document` for `.is` output; Workspace imports target a validated sibling path and use the existing create/atomic-write policy. A reusable `ImportMenu` component built on the existing dropdown primitive keeps the Import trigger, accessible labeling, menu structure, and initial Excalidraw item consistent while destination owners retain their current responsibilities: `WorkspaceSidebar` coordinates root imports, `WorkspaceResourceRow` coordinates directory imports, and `PageOrganizer` receives an injected Page-import callback. The existing creation menus remain unchanged. All entry points call the same import service and differ only in destination and post-import session handling.
**Baseline:** IdeaSketch v1 already serializes pages as `manifest.json` plus `slides/{id}.json`; `PageOrganizer` owns the Add Page action; Workspace root and directory “+” controls already own creation menus; and Tauri has native dialogs plus atomic `save_file`/`save_workspace_document` commands. The current action rows have no distinct import affordance, there is no safe frontend file-content read command for arbitrary selected files, there is no Excalidraw JSON parser/normalizer, and the Pages navigator has no import callback.
**Exit Criteria:** From a writable Workspace root or directory row, a dedicated accessible Import button sits beside the unchanged “+” menu and opens a dropdown containing Import Excalidraw; selecting a valid `.excalidraw` file creates a non-conflicting `.is` sibling with one titled Page, opens it, and keeps the source untouched. From an editable IdeaSketch Pages navigator, a dedicated Import button sits beside the unchanged Add Page “+” action and its Import Excalidraw item adds and selects one new Page containing the imported scene and embedded files; saving/reopening preserves elements, appState, files, and Page title. Import actions are hidden or disabled truthfully for read-only destinations, creation actions retain their existing behavior, and cancel, malformed JSON, unsupported shapes/fields, external-change/conflict state, and existing target names produce clear English feedback without data loss or silent overwrite. Focused import, menu separation, Page wiring, Rust command, full frontend/Rust regressions, build, diff checks, and representative desktop smoke pass.

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

- [x] Add focused behavior tests for the parser and projections.
- [x] Implement the pure import module and make all focused cases pass.

## Task 2: Add the Native File Boundary and Dedicated Workspace Import Menus

**Outcome:** Workspace users can select an Excalidraw file and receive a new `.is` file safely opened in the current Workspace.
**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs` (register command)
- Modify: `src/lib/tauriCommands.ts`
- Create: `src/components/ImportMenu.tsx`
- Modify: `src/components/WorkspaceSidebar.tsx`
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/index.css`
- Create: `tests/excalidrawWorkspaceImport.test.mjs`
- Modify: `tests/workspaceSidebar.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`
- Create or modify: `src-tauri` command tests for read boundary and collision-safe destination

**Change Map:**
- native read: add a bounded UTF-8 text/byte read command for a user-selected path, with explicit file/size/readability checks and no Workspace traversal expansion
- import coordinator: open the native file picker with `.excalidraw` and `.json` filters, parse through the shared module, choose a sanitized non-conflicting `<name>.is` destination in the selected directory, serialize via the existing IdeaSketch registry, and save atomically
- shared import menu: compose the maintained dropdown and tooltip primitives with an import-oriented Lucide icon, an English accessible label, and the initial Import Excalidraw item; let each caller supply availability and destination behavior
- Workspace UI: keep root and directory “+” creation menus unchanged; add the adjacent shared Import dropdown, route selected root/directory context to the same coordinator, refresh the tree, and open the created document
- safety: cancellation is silent, read-only Workspace and failed writes leave the source and existing files unchanged, and errors use the existing Workspace action dialog path

**Verification:**
- `node --test tests/excalidrawWorkspaceImport.test.mjs tests/workspaceSidebar.test.mjs tests/workspaceExplorerWiring.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml read_workspace_file -- --nocapture` plus focused new command tests
- `npm run build`
- Cases: root/subfolder destination, name collision suffixing, source untouched, cancel/no write, malformed file, read-only Workspace, and refresh/open behavior.

- [x] Add failing Workspace import, dedicated-menu separation, and native-read regressions.
- [x] Implement the command, coordinator, and root/directory Import dropdown wiring without changing “+” menu contents.
- [x] Verify collision safety and open/refresh behavior.

## Task 3: Add the Pages Import Menu and Complete Delivery

**Outcome:** Active IdeaSketch users can import one Excalidraw file as a new selected Page through the existing dirty/save lifecycle.
**Files:**
- Modify: `src/components/PageOrganizer.tsx`
- Modify: `src/components/IdeaSketchNavigator.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/index.css`
- Create or modify: `tests/pageOrganizerImport.test.mjs`
- Modify: `tests/pageOrganizer.test.mjs`
- Modify: `tests/ideaSketchNavigator.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/editorChromeNavigation.test.mjs`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F064-import-excalidraw-files-into-ideasketch.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- navigator contract: inject an `onImport` callback, keep Add Page unchanged, and render an adjacent accessible Import dropdown whose initial item is Import Excalidraw without changing Cameras behavior or Page view modes
- editor transaction: flush the active draft, append one imported Page, select it, preserve Page ordering, and mark the current session dirty through the existing reducer/session boundary
- delivery evidence: focused suites, full frontend/Rust regressions, production build, diff checks, and a desktop smoke covering both entry points and reopen persistence; then mark F064 complete/done and create a separate `feat(F064)` commit

**Verification:**
- `node --test tests/pageOrganizerImport.test.mjs tests/pageOrganizer.test.mjs tests/ideaSketchNavigator.test.mjs tests/ideaSketchEditor.test.mjs tests/editorChromeNavigation.test.mjs`
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `npm run build`
- `git diff --check`
- Tauri smoke: import into Workspace root and nested folder, import into an existing Page list, cancel both dialogs, save/reopen, and compare scene/files/title/order.

- [x] Add failing Page import callback, dedicated-menu separation, and dirty-session regressions.
- [x] Implement the Page Import dropdown and editor transaction without changing Add Page behavior.
- [x] Run full verification, update F064 evidence/status/index, and create the task commit.

## Delivery Evidence

- Shared parser and projection coverage: `node --test tests/excalidrawImport.test.mjs` (5/5).
- Import menu, Workspace coordinator, and Page wiring coverage: `node --test tests/excalidrawWorkspaceImport.test.mjs tests/workspaceSidebar.test.mjs tests/workspaceExplorerWiring.test.mjs tests/tauriCommands.test.mjs` (20/20 across the focused suites).
- Full frontend regression: `node --test tests/*.test.mjs` (443/443).
- Native import boundary: focused command test passed (1/1), with oversized-file coverage also passing in the same command module. The full Rust suite reached 174 passed / 1 failed; the only failure was the pre-existing installed-Codex handshake test because the local runtime is not the pinned `0.147.0`.
- Production build: `npm run build` passed with only existing chunk-size and dynamic-import warnings.
- Diff hygiene: `git diff --check` passed.
- Behavior implemented: dedicated Import dropdowns beside unchanged creation/Add Page controls; bounded UTF-8 native reads; collision-safe Workspace `.is` creation with atomic save and cleanup; Page import flushes the active draft, adds/selects a Page, and uses the existing dirty/autosave lifecycle; cancellation is silent and malformed input reports an English error.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/features/F019-add-page-list-view-mode-switch.md`
- `docs/superplan/plans/features/F027-simplify-workspace-explorer-root-header.md`
- `docs/superplan/plans/features/F051-add-workspace-tree-refresh-action.md`
- `docs/superplan/plans/features/F053-migrate-unified-ideasketch-drawer-to-tauri.md`
- `src/lib/ideaSketchDocument.ts`
- `src/lib/fileTypeRegistry.ts`
- `src/lib/tauriCommands.ts`
- `src/components/WorkspaceSidebar.tsx`
- `src/components/WorkspaceResourceRow.tsx`
- `src/components/PageOrganizer.tsx`
- `src/components/IdeaSketchNavigator.tsx`
