---
id: "F066"
title: "Add IdeaSketch Excalidraw and IS Page Export Actions"
type: "feature"
status: "complete"
summary: "Move Page import below the navigator and add current-Page Excalidraw and single-Page IdeaSketch exports."
source: "docs/superplan/human/features.md"
created: "2026-08-19"
order: 66
depends_on: ["F053", "F064"]
parent: ""
---

# Add IdeaSketch Excalidraw and IS Page Export Actions Plan

**Goal:** Put Page file interchange in the IdeaSketch drawer's lower action area and let users export the current Page as either an editable Excalidraw scene or a standalone one-Page `.is` document.
**Scope:** Remove the existing Import Page button from the Pages `View` toolbar and add `Import Excalidraw`, `Export Excalidraw`, and `Export .is` actions below the Pages/Cameras navigation in the existing drawer command section. Import keeps the F064 behavior: select one local `.excalidraw`/`.json` scene, append and select a new Page, and use the existing dirty/autosave lifecycle. Both exports flush the current live Page draft before projection, suggest sanitized Page-title filenames, open the native desktop save dialog, and write through the existing safe file boundary without mutating the source document. Excalidraw export emits a standard editable scene with elements, app state, and embedded files; `.is` export emits a valid canonical v1 document containing only the current Page. Export remains available for read-only documents, while import and Canvas mutations retain truthful read-only disabling. All user-facing copy remains English.
**Non-Goals:** Do not add Workspace-level export commands, export all Pages, replace the existing image or draw.io exports, register `.excalidraw` as an openable IdeaNote document type, change `.is` v1, overwrite the current document, mark exports dirty, add multi-file selection, or move Page Add/view controls out of their toolbar. Do not silently overwrite without the native save confirmation path or remove embedded media from either export.
**Architecture:** `IdeaSketchEditor` remains the owner of the active Page draft and file-operation callbacks. A pure Page-export module projects an `IdeaSketchPage` into a standard Excalidraw JSON object or a fresh canonical one-Page `IdeaSketchDocument`, owns Page-title filename sanitization, and delegates `.is` serialization to the registry-owned IdeaSketch serializer. A small export coordinator reuses the existing Tauri save picker and generic atomic byte/document write commands, with browser download fallback only where the established export boundary already supports it. `IdeaSketchDrawerCommands` owns the relocated Import action and the two new export controls below navigation; `PageOrganizer` and `IdeaSketchNavigator` shed only the import prop/control and otherwise preserve Pages/Cameras behavior. Export callbacks read the flushed Page through the editor session boundary so unsaved Canvas changes are included without changing dirty state.
**Baseline:** F064 currently renders a dedicated Import Page dropdown beside Add Page in the Pages toolbar and wires it to `IdeaSketchEditor.importPage`. F053 renders `IdeaSketchDrawerCommands` below the navigator with image export, draw.io export, background, and clear actions. `SlideCanvas` already exposes live Canvas commands; `chooseStandaloneSavePath`, `writeFileBytes`, the file-type registry serializer, and canonical `.is` v1 serialization already provide native safe-save and format boundaries. There is no standard Excalidraw scene exporter and no single-Page `.is` projection/export action.
**Exit Criteria:** The Pages toolbar contains only its existing view switch and Add Page action, with no import button. Below the navigation, users can invoke `Import Excalidraw`, `Export Excalidraw`, and `Export .is` alongside the existing Canvas/export commands. Import still appends and selects one editable Page and is disabled for read-only documents. Each export includes the latest live current-Page elements, app state, and files; Excalidraw output opens as an editable scene, while `.is` output reopens in IdeaNote as one Page with the same title and content under canonical v1 serialization. Suggested filenames are sanitized, cancellation writes nothing, failures show clear English feedback, exports do not dirty or modify the current document, and existing image/draw.io/background/clear, Page/Camera, autosave, recovery, and external-change behavior remains intact. Focused source/behavior tests, full frontend regression, production build, relevant Rust safe-write tests, diff checks, and a representative Tauri save/reopen smoke pass.

## Task 1: Build the Current-Page Export Projections

**Outcome:** One live IdeaSketch Page can be projected deterministically into interoperable Excalidraw JSON and a canonical one-Page IdeaSketch document without mutating the source.
**Files:**
- Create: `src/lib/ideaSketchPageExport.ts`
- Create: `tests/ideaSketchPageExport.test.mjs`
- Modify: `src/lib/ideaSketchDocument.ts` only if a narrow public one-Page factory avoids duplicated v1 timestamp/id rules

**Change Map:**
- Excalidraw projection: emit the standard scene envelope and preserve current Page elements, app state, embedded files, and unknown editable fields by value
- IdeaSketch projection: create a fresh v1 document with one Page preserving title/scene/media while keeping a valid independent document identity and timestamps
- filename contract: sanitize Page titles, preserve the required `.excalidraw` or `.is` suffix, and provide a deterministic fallback
- source safety: clone projections so later edits or serialization cannot mutate the mounted editor draft

**Verification:**
- `node --test tests/ideaSketchPageExport.test.mjs tests/ideaSketchDocument.test.mjs`
- Cases: full/minimal Page, embedded files, app state, custom element fields, unsafe/empty titles, source immutability, valid one-Page v1 round-trip, and no orphan media.

- [x] Add focused projection and round-trip regressions.
- [x] Implement the pure current-Page export model through the established format registry boundary.

## Task 2: Relocate Import and Add Native Page Export Actions

**Outcome:** Page file interchange appears below navigation and uses the current live Page plus safe native save flows.
**Files:**
- Modify: `src/components/PageOrganizer.tsx`
- Modify: `src/components/IdeaSketchNavigator.tsx`
- Modify: `src/components/IdeaSketchDrawerCommands.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/lib/tauriCommands.ts` only if a narrow text/JSON save helper is needed
- Modify: `src/index.css`
- Modify: `tests/pageOrganizer.test.mjs`
- Modify: `tests/ideaSketchNavigator.test.mjs`
- Modify: `tests/ideaSketchDrawer.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Create: `tests/ideaSketchPageExportWiring.test.mjs`

**Change Map:**
- Pages toolbar: remove the F064 Import control and its organizer/navigator prop without changing view modes, Add Page, sorting, duplication, rename, delete, or thumbnails
- drawer commands: add clearly labeled Import Excalidraw, Export Excalidraw, and Export `.is` controls in the existing lower action grid while preserving current image/draw.io/background/clear ownership and accessible disabled states
- editor import: retain the existing F064 picker/parser/reducer behavior and route it to the relocated command
- editor export: flush the active draft, resolve the current Page, project it through the new module, choose a native save path, write safely, and show cancellation/error/success feedback without dispatching model changes
- availability: require Canvas/editor readiness for current live data, keep exports available in read-only sessions, and disable only import plus mutation commands in read-only mode

**Verification:**
- `node --test tests/ideaSketchPageExport.test.mjs tests/ideaSketchPageExportWiring.test.mjs tests/pageOrganizer.test.mjs tests/ideaSketchNavigator.test.mjs tests/ideaSketchDrawer.test.mjs tests/ideaSketchEditor.test.mjs tests/tauriCommands.test.mjs`
- Cases: relocated control, no duplicate import button, newest unsaved draft exported, Excalidraw/`.is` filenames and payloads, cancel/no write, visible errors, read-only export/import semantics, and unchanged existing drawer commands.

- [x] Add failing relocation, wiring, live-draft, cancellation, and read-only regressions.
- [x] Implement the lower command surface and both safe export coordinators without changing document state.

## Task 3: Verify and Deliver F066

**Outcome:** The new interchange actions ship with regression-safe format, UI, native-save, workflow, and Git evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F066-add-ideasketch-excalidraw-and-is-page-export-actions.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F066 request/plan: completion status, checked outcomes, focused/full/build/Rust/native evidence, and any environment limitation
- generated plan index: current F066 status and dependencies

**Verification:**
- Run the focused Task 1–2 suites.
- `node --test tests/*.test.mjs`
- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml write_file -- --nocapture`
- `git diff --check`
- Tauri smoke: import from the lower drawer action; export a Page with unsaved edits and embedded media to `.excalidraw` and `.is`; cancel both dialogs; reopen both outputs in their target applications; verify read-only export and no source dirty-state change.

- [x] Run the complete verification matrix once implementation stabilizes and inspect meaningful warnings.
- [x] Compare the final diff with every Exit Criterion, complete F066, refresh progress, and create a separate `feat(F066)` task commit.

**Verification Evidence:**
- `node --test tests/*.test.mjs` → 458 pass, 0 fail (includes the relocated import regression in `tests/excalidrawWorkspaceImport.test.mjs`, the projection/round-trip suite, and the new `tests/ideaSketchPageExportWiring.test.mjs`).
- `npm run build` → TypeScript strict check clean; Vite production build succeeds (only the pre-existing bundle chunk-size advisory, unrelated to F066).
- Rust safe-write boundary: `cargo test … safe_write` (2 pass) and `cargo test … binary_export` (1 pass) cover the atomic byte/document write path both exports use; `cargo test … write_file` matched no test names, so the boundary was verified through those modules instead.
- `git diff --check` → clean.
- Environment limitation: the interactive Tauri save/reopen smoke (native save dialog, reopening `.excalidraw`/`.is` outputs, read-only export, dirty-state check) could not run headlessly in this environment; it remains a manual pre-release step.

## References
- `docs/superplan/human/features.md#F066`
- `docs/superplan/plans/01-shared-document-kernel-and-is-v1.md`
- `docs/superplan/plans/features/F022-export-editor-content-as-drawio.md`
- `docs/superplan/plans/features/F053-migrate-unified-ideasketch-drawer-to-tauri.md`
- `docs/superplan/plans/features/F064-import-excalidraw-files-into-ideasketch.md`
- `docs/superplan/plans/bugs/B039-refine-ideasketch-drawer-controls.md`
- `docs/superplan/plans/bugs/B040-refine-ideasketch-navigator-density.md`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/IdeaSketchDrawerCommands.tsx`
- `src/components/IdeaSketchNavigator.tsx`
- `src/components/PageOrganizer.tsx`
- `src/lib/excalidrawImport.ts`
- `src/lib/ideaSketchDocument.ts`
- `src/lib/fileTypeRegistry.ts`
- `src/lib/tauriCommands.ts`
