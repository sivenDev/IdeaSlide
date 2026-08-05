---
id: "04"
title: "Integrate IdeaSketch into Workspace and Standalone Sessions"
type: "required"
status: "complete"
summary: "Attach the existing Excalidraw, Pages, Cameras, Present, and MCP behaviors to active .is v1 document sessions."
source: "docs/superplan/human/prd.md"
created: "2026-08-03"
order: 4
depends_on: ["03"]
parent: ""
---

# Integrate IdeaSketch into Workspace and Standalone Sessions Plan

**Goal:** Preserve IdeaNote's mature drawing and presentation behavior while making each `.is v1` file an independent IdeaSketch document in the new multi-file shell.
**Scope:** Add an IdeaSketch editor adapter that mounts the existing Excalidraw canvas for the active document, restores multi-Page add/rename/reorder/delete/select behavior from the v1 `slides` array, commits drafts to the correct session, and keeps Cameras scoped to the active Page. Present remains in the Cameras header, stays available with zero Cameras, and plays only the current Page's ordered Cameras. Workspace sessions use debounced autosave plus explicit Save; standalone sessions use explicit Save by default. Save, Save As, and Save All flush the right editor drafts and serialize only the targeted document. Preserve image export, Excalidraw save interception, presentation-exit refresh, and current MCP slide/canvas compatibility over v1 Pages without adding an Agent UI.
**Non-Goals:** This plan does not add Page or Camera thumbnails, make presentation cross-file or cross-Page, implement future editors, watch external files, implement recovery/conflict UI, migrate v2, add Workspace Import/Export, or expose new AI Agent tools. It does not keep the old archive-internal Workspace resource tree.
**Architecture:** `IdeaSketchEditor` owns one active `IdeaSketchDocument` and delegates canvas mechanics to `SlideCanvas`. A pure reducer manages Page identity/order/title and makes draft commits explicit before Page or document switches. A compact document-scoped Pages popover in the IdeaSketch editor chrome provides Page management without consuming the real-file Explorer or adding thumbnails. `CameraList` and `PresentationMode` derive only from the selected Page. The generic `DocumentSession` supplies mode-specific persistence policy while the editor uses identical model/change/save callbacks. Existing MCP slide-named operations become compatibility aliases over v1 Pages within the addressed `.is` file and must use the same reader/writer; no Workspace-wide Agent abstraction is introduced.
**Baseline:** Excalidraw, Camera drawing, Camera ordering, PresentationMode, image export, save interception, editor refresh, and draft helpers exist, but they are wired to one v2 `WorkspaceDocument` and a selected `canvas` resource. The current left Explorer is also the Page selector, so replacing it with a real file tree would otherwise remove multi-Page navigation. Autosave currently applies to every file path without distinguishing Workspace and Standalone policy.
**Exit Criteria:** Multiple `.is v1` Tabs can each retain independent Page selection, dirty state, Excalidraw model, Cameras, and saved viewport. A compact thumbnail-free Pages control supports create, rename, reorder, delete-with-last-Page protection, and selection; switching Pages or Tabs never commits edits to the wrong document. Cameras and Present remain contextual to the active Page, zero-Camera Present uses the saved Page viewport, and Camera-backed presentation never advances into another Page or file. Workspace edits autosave after debounce and remain explicitly saveable; standalone edits do not silently overwrite and save only on explicit action. Save As updates session identity, Save All isolates failures, and each save writes only one v1 archive. Existing image export, native-save suppression, presentation refresh, and representative MCP Page operations pass regressions.

## Task 1: Make IdeaSketch Page State Independent per Document

**Outcome:** Each `.is` Tab owns a stable, testable multi-Page model and draft lifecycle.
**Files:**
- Create: `src/lib/ideaSketchReducer.ts`
- Modify: `src/lib/ideaSketchDocument.ts`
- Modify: `src/lib/editorSession.ts`
- Modify: `src/hooks/useEditorSession.ts`
- Test: `tests/ideaSketchReducer.test.mjs`
- Modify: `tests/editorSession.test.mjs`
- Modify: `tests/editorSessionRenderStability.test.mjs`

**Change Map:**
- `ideaSketchReducer`: Page select/add/rename/reorder/delete, stable fallback, last-Page protection, and per-document active Page
- editor session helpers: commit by document session id plus Page id, flush on Page/Tab switch, and stable projection identity
- IdeaSketch helpers: ordered Page serialization and complete scene preservation

**Verification:**
- `node --test tests/ideaSketchReducer.test.mjs tests/editorSession.test.mjs tests/editorSessionRenderStability.test.mjs`
- Cases: two open documents with identical Page ids remain isolated; pending edits commit to original Page; reorder/title persist; last Page cannot be removed.

- [x] Add failing multi-document Page and draft-isolation tests.
- [x] Implement pure Page state and session-aware draft commits.

## Task 2: Add the IdeaSketch Editor and Pages Control

**Outcome:** The active `.is` Tab exposes Excalidraw plus compact, thumbnail-free Page management.
**Files:**
- Create: `src/components/IdeaSketchEditor.tsx`
- Create: `src/components/PageOrganizer.tsx`
- Modify: `src/components/DocumentEditorHost.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/components/CanvasPresentationControls.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Test: `tests/ideaSketchEditor.test.mjs`
- Test: `tests/pageOrganizer.test.mjs`
- Modify: `tests/cameraBadgeWiring.test.mjs`
- Modify: `tests/canvasPresentationControls.test.mjs`

**Change Map:**
- `IdeaSketchEditor`: active Page projection, Excalidraw API/draft boundary, Pages control, Cameras toggle, and editor-refresh forwarding
- `PageOrganizer`: titled Page list, add, inline rename, drag reorder, delete, and selected state without thumbnails
- `DocumentEditorHost`: route only registered `.is` sessions into IdeaSketch and retain unsupported fallback
- `SlideCanvas`/Canvas controls: preserve Excalidraw integration behavior under document-session props

**Verification:**
- `node --test tests/ideaSketchEditor.test.mjs tests/pageOrganizer.test.mjs tests/cameraBadgeWiring.test.mjs tests/canvasPresentationControls.test.mjs`
- Interaction cases: Pages popover opens from the active document chrome; add/rename/reorder/delete/select works; Canvas controls stay top-right; Excalidraw never exposes native scene Save.

- [x] Implement the IdeaSketch host and compact Pages organizer.
- [x] Preserve stable Excalidraw onChange/API identities and presentation-exit refresh behavior.

## Task 3: Rebind Cameras and Present to the Active Page

**Outcome:** Presentation remains a Page-scoped IdeaSketch feature after the file/session migration.
**Files:**
- Modify: `src/components/CameraList.tsx`
- Modify: `src/components/PresentationMode.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/cameraUtils.ts`
- Modify: `tests/cameraSidebarWiring.test.mjs`
- Modify: `tests/workspacePresentationOrder.test.mjs`
- Modify: `tests/editorChromeNavigation.test.mjs`

**Change Map:**
- Camera/Presentation components: current document and Page identity, ordered Camera extraction, zero-Camera fallback, and no cross-Page/file traversal
- `App`: presentation overlay references the originating document session/Page and returns to the correct mounted editor
- compatibility test: replace v2 resource-depth order assumptions with v1 current-Page isolation

**Verification:**
- `node --test tests/cameraSidebarWiring.test.mjs tests/workspacePresentationOrder.test.mjs tests/editorChromeNavigation.test.mjs tests/cameraUtils.test.mjs`
- Cases: Camera edits affect only active Page; Present zero/nonzero Camera behavior; Page/Tab cannot change presentation sequence; exit refreshes originating editor.

- [x] Adapt Cameras and Present to document/Page identity without changing their approved placement.
- [x] Replace obsolete workspace-resource presentation contracts with current-Page contracts.

## Task 4: Apply Mode-specific Save Policies and MCP Compatibility

**Outcome:** Every save path and existing automation command targets one canonical v1 document safely.
**Files:**
- Modify: `src/hooks/useAutoSave.ts`
- Modify: `src/lib/autoSaveSignature.ts`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/lib/tauriCommands.ts`
- Modify: `src-tauri/src/mcp/services/file_service.rs`
- Modify: `src-tauri/src/mcp/services/slide_service.rs`
- Modify: `src-tauri/src/mcp/mod.rs`
- Test: `tests/autoSaveSignature.test.mjs`
- Test: `tests/tauriCommands.test.mjs`
- Test: `src-tauri/src/mcp/services/slide_service.rs`

**Change Map:**
- autosave: enabled only for writable Workspace sessions, scoped by document id/revision, and never serializes another open document
- editor save orchestration: flush active/inactive document models correctly for Save, Save As, and Save All
- MCP services: v1 Page list/add/delete/reorder/content operations through the canonical format layer, with legacy-v2 protection and no new Agent UI/API promises

**Verification:**
- `node --test tests/autoSaveSignature.test.mjs tests/tauriCommands.test.mjs tests/ideaSketchReducer.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml mcp -- --nocapture`
- Cases: Workspace debounce; standalone no silent overwrite; Save All per-file results; MCP operations preserve titles/order/Cameras and output v1.

- [x] Implement Workspace-only autosave and explicit standalone save.
- [x] Route all editor and MCP persistence through the same v1 reader/writer.

## Task 5: Verify IdeaSketch End to End

**Outcome:** Existing drawing and presentation capabilities survive the architectural migration.
**Files:**
- Modify: `docs/superplan/plans/04-ideasketch-editor-integration.md`

**Change Map:**
- plan evidence: multi-document editing, Pages, Cameras, Present, save policies, export, and MCP results

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `npm run build`
- `git diff --check`
- Tauri smoke: open two v1 files, edit/switch Pages and Tabs, add/reorder Cameras, Preview/Fullscreen, export image, save Workspace/Standalone documents, reopen and compare.

- [x] Run complete regression and native interaction matrices.
- [x] Inspect representative saved archives before completion.

## Delivery Evidence

- `node --test tests/*.test.mjs` — all 145 frontend/library regressions passed, including new pure Page reducer coverage, document/Page draft isolation, Pages organizer contracts, frozen presentation origin, Workspace-only autosave identity, and zero-Camera viewport persistence.
- `cargo test --manifest-path src-tauri/Cargo.toml mcp -- --nocapture` — all 19 MCP-scoped Rust tests passed; v1 Page list/add/delete/reorder/content operations preserve titles, order, payload alignment, and last-Page protection.
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` — all 56 Rust tests passed, including canonical v1 archive layout, no-backup replacement, legacy-v2 protection, Workspace persistence, and representative archive round trips.
- `npm run build` and `git diff --check` — passed; only the existing Excalidraw import-overlap and large-chunk informational warnings remain.
- Browser smoke at `http://127.0.0.1:1420/`: New File opened a dirty standalone `Untitled.is`, the thumbnail-free Pages popover created and selected Page 2, Cameras stayed collapsed until the canvas control opened the right panel, Present remained available with zero Cameras, Preview entered presentation, and Escape returned to the originating editor.
- The canonical Rust archive tests inspect the produced `manifest.json` plus `slides/{id}.json` entries and verify Page title/order/scene/media round trips; no `.is.bak` is produced.

## References
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/01-shared-document-kernel-and-is-v1.md`
- `docs/superplan/plans/03-multifile-workspace-shell.md`
- `docs/superplan/plans/features/F003-canvas-presentation-controls.md`
- `docs/superplan/plans/features/F005-align-workspace-camera-actions.md`
- `docs/superplan/plans/features/F006-revision-c-editor-shell-defaults.md`
- `docs/superplan/plans/bugs/B001-disable-excalidraw-native-save.md`
- `docs/superplan/plans/bugs/B002-refresh-editor-after-presentation-exit.md`
- `docs/superplan/plans/bugs/B004-stabilize-editor-session-slide.md`
- `src/components/SlideCanvas.tsx`
- `src/components/CameraList.tsx`
- `src/components/PresentationMode.tsx`
- `src/hooks/useEditorSession.ts`
