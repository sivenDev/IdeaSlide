---
id: "01"
title: "Establish the Shared Document Kernel and .is v1 Contract"
type: "required"
status: "complete"
summary: "Replace the .is v2 workspace model with a shared document kernel and a lossless, protected .is v1 reader/writer."
source: "docs/superplan/human/prd.md"
created: "2026-08-03"
order: 1
depends_on: []
parent: ""
---

# Establish the Shared Document Kernel and .is v1 Contract Plan

**Goal:** Make one extensible document kernel own file-type detection, parsing, editing models, serialization, and save safety in both Workspace Mode and Single File Mode.
**Scope:** Introduce symmetric frontend/backend document modules. On the frontend, add `DocumentSession`, `DocumentModel`, persistence-adapter, and file-type registry boundaries whose first registered type is IdeaSketch (`.is`). On the backend, add a document-format registry and move IdeaSketch recognition, validation, reading, writing, and safety rules into its own Rust module behind generic commands. Restore the canonical `.is v1` manifest and `slides/{id}.json` payload contract for all new files and saves, preserve Page names/order and complete Excalidraw scene data, use same-directory temporary files plus atomic replacement without creating `.is.bak`, and detect `.is v2` before editor hydration so it can be shown as a protected legacy format that cannot be overwritten by the v1 writer. Replace current v2-oriented frontend conversions with explicit IdeaSketch v1 adapters without yet changing the application shell to a real directory Workspace.
**Non-Goals:** This plan does not open directories, build the real Workspace Explorer or Tabs UI, implement Markdown/IdeaTable/IdeaWorkflow, migrate `.is v2`, add an Agent, rename repository/package/bundle identifiers, remove existing Camera/Present behavior, or redesign editor chrome. It does not silently flatten or downgrade a v2 archive.
**Architecture:** Frontend file extensions select a `FileTypeDefinition`, while a format-specific module owns validation, empty-model creation, parse, serialize, and editor routing. Editors consume typed document models and never branch on Workspace versus Standalone persistence. Backend paths select a `DocumentFormatDefinition`; generic Tauri commands dispatch to `document_formats/idea_sketch.rs` and do not embed `.is` schema logic. The IdeaSketch Rust module parses only the manifest header first, accepts canonical `1.0`, returns a typed legacy-format outcome for `2.0`, and rejects malformed or unknown versions before reading scene payloads. Its v1 writer emits the required `version`, timestamps, ordered `slides` entries, and `slides/{id}.json` scenes through a same-directory temp-file and atomic-replace boundary; it never creates a sibling backup archive. Scene `elements`, required `appState`, and `files` remain lossless; fixture tests determine compatibility for existing image-bearing v1 files without introducing v2 resource-manifest fields. Product-facing copy may use IdeaNote, but technical identifiers stay unchanged in this MVP.
**Baseline:** The current backend reads both v1 and v2 into one v2 `Manifest { resources }` model and always writes v2 resource manifests, `canvases/`, and media index entries. The frontend converts every opened `.is` into a `WorkspaceDocument` whose resources act as Pages, `saveFile` serializes that workspace back to v2, and the current resource registry describes internal workspace nodes rather than real file types. Opening v1 therefore upgrades it on save, which directly conflicts with the accepted PRD.
**Exit Criteria:** New and saved IdeaSketch files contain a `1.0` manifest with ordered titled `slides` entries and readable `slides/{id}.json` scenes; Page order, names, elements, app state, files, Cameras, and timestamps survive reopen. Existing valid v1 fixtures open without mutation and remain v1 after save. A v2 archive is identified before payload hydration, produces a clear English Legacy Workspace message, and exposes no overwrite-capable Save action. Malformed, missing, old-unknown, and future versions fail safely. The file-type registry resolves `.is`, creates a valid empty IdeaSketch model, and exposes stable extension points without claiming future editors are available. Focused Node/Rust suites, complete regressions, format checks, and production build pass.

## Task 1: Lock the Canonical v1 and Protected-v2 Compatibility Matrix

**Outcome:** Executable fixtures and documentation define exactly what current builds read, write, preserve, and refuse.
**Files:**
- Modify: `docs/file-format.md`
- Create: `tests/fixtures/is-v1/manifest.json`
- Create: `tests/fixtures/is-v1/slide.json`
- Create: `tests/fixtures/is-v2/manifest.json`
- Test: `src-tauri/src/document_formats/idea_sketch.rs`
- Test: `tests/tauriCommands.test.mjs`

**Change Map:**
- `docs/file-format.md`: IdeaNote terminology, canonical v1 writer structure, v2 legacy-protection behavior, no-backup atomic-write policy, and compatibility table
- format fixtures: titled multi-Page v1 scenes, image/file-bearing scene coverage, and a representative v2 manifest that must never enter the v1 save path
- format tests: header-first version dispatch, exact v1 output shape, lossless scene round-trip, and protected-v2 errors

**Verification:**
- `node --test tests/tauriCommands.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml document_formats -- --nocapture`
- Inspect a generated archive and verify `manifest.json` plus `slides/{id}.json` ordering and absence of v2 `resources`/`canvases` fields.

- [x] Add compatibility fixtures and failing tests for canonical v1 read/write, scene preservation, and v2 overwrite protection.
- [x] Rewrite the format document around v1 as the only writable format and v2 as deferred legacy input.
- [x] Confirm malformed and unsupported headers fail before any scene payload is parsed.

## Task 2: Restore the Backend v1 Reader and Writer

**Outcome:** Tauri exposes a typed, safe IdeaSketch v1 persistence boundary instead of converting all files into v2 workspaces.
**Files:**
- Create: `src-tauri/src/document_formats/mod.rs`
- Create: `src-tauri/src/document_formats/idea_sketch.rs`
- Remove: `src-tauri/src/file_format.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/document_formats/idea_sketch.rs`

**Change Map:**
- `src-tauri/src/document_formats/mod.rs`: backend registry, extension dispatch, and generic create/open/save boundary
- `src-tauri/src/document_formats/idea_sketch.rs`: explicit manifest header, v1 manifest/Page entry types, scene payload validation, legacy-v2 detection, empty v1 creation, and v1-only atomic writer
- `src-tauri/src/commands.rs`: generic registry dispatch and results that distinguish editable v1 documents from protected legacy or unsupported formats
- `src-tauri/src/lib.rs`: command registration and English error/result propagation without changing file-association behavior

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml document_formats -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- Behavior cases: new v1; multi-Page round-trip; overwrite creates no `.is.bak`; failed write leaves original intact and removes its temp file; v2 never reaches the writer.

- [x] Replace the current v2 writer schema with explicit v1 data types and archive paths.
- [x] Preserve same-directory atomic replacement, remove `.is.bak` creation, and clean temporary artifacts on failure.
- [x] Return structured version outcomes that the frontend can map to editable, legacy-protected, or invalid states.

## Task 3: Introduce the File-Type and Document-Session Core

**Outcome:** Workspace and Standalone callers can share one IdeaSketch adapter and Editor Host contract.
**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/documentSession.ts`
- Create: `src/lib/fileTypeRegistry.ts`
- Create: `src/lib/ideaSketchDocument.ts`
- Modify: `src/lib/tauriCommands.ts`
- Test: `tests/fileTypeRegistry.test.mjs`
- Test: `tests/ideaSketchDocument.test.mjs`
- Test: `tests/documentSession.test.mjs`
- Modify: `tests/tauriCommands.test.mjs`

**Change Map:**
- `src/types.ts`: `DocumentSession`, file status, persistence mode, typed IdeaSketch Page/document, and protected-format result contracts
- `src/lib/documentSession.ts`: path identity, dirty/revision metadata, and persistence-adapter interfaces without UI ownership
- `src/lib/fileTypeRegistry.ts`: extension detection, open/create capabilities, icon/editor keys, and only the current IdeaSketch registration
- `src/lib/ideaSketchDocument.ts`: empty document factory, stable Page helpers, backend conversion, and v1 validation
- `src/lib/tauriCommands.ts`: thin IPC wrappers that no longer project files into v2 `WorkspaceDocument` resources

**Verification:**
- `node --test tests/fileTypeRegistry.test.mjs tests/ideaSketchDocument.test.mjs tests/documentSession.test.mjs tests/tauriCommands.test.mjs`
- Cases: case-insensitive `.is` resolution; unsupported extension fallback; empty IdeaSketch has one titled Page; duplicate Page ids fail; v2 result creates a protected read-only session; mode does not change parser/serializer selection.

- [x] Add failing registry/session/adapter contracts around shared-core behavior.
- [x] Implement the IdeaSketch registration and typed document model.
- [x] Remove v2 workspace conversion from normal open/save helpers while retaining clear legacy detection.

## Task 4: Verify the Shared Kernel Boundary

**Outcome:** The format rollback is safe enough for the directory and multi-session work that follows.
**Files:**
- Modify: `docs/superplan/plans/01-shared-document-kernel-and-is-v1.md`

**Change Map:**
- plan evidence: final fixture, regression, archive inspection, and compatibility results

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `npm run build`
- `git diff --check`

- [x] Run the focused and complete verification matrix after the kernel stabilizes.
- [x] Record representative v1/v2 archive evidence before marking the plan complete.

## Delivery Evidence

- `node --test tests/*.test.mjs` — 136 tests passed, including File Type Registry, document-session, IdeaSketch v1 adapter, typed backend envelope, Cameras, Present, editor shell, and persistence regressions.
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` — 37 tests passed, including exact v1 archive paths, repository fixtures, header-first v2 protection, malformed/future versions, Page ordering, media compatibility, MCP Page operations, no-backup replacement, and temp cleanup on failure.
- `npm run build` — TypeScript and Vite production build passed; existing Excalidraw dynamic-import and large-chunk warnings remain informational.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` and `git diff --check` — passed.
- `document_formats::idea_sketch::tests::archive_uses_v1_manifest_and_slide_paths` inspected an archive produced by the writer and verified `manifest.version == "1.0"`, `slides/page-*.json` entries, no `resources`, no `canvases/`, no `.is.bak`, and no remaining `.is.tmp`.
- A fresh codebase graph index found no production references to the removed `file_format` module or v2 `manifest.resources`/`data.contents` access paths.

## References
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F002-workspace-resource-explorer.md`
- `docs/file-format.md`
- `src-tauri/src/document_formats/idea_sketch.rs`
- `src-tauri/src/commands.rs`
- `src/lib/tauriCommands.ts`
- `src/lib/resourceTypeRegistry.ts`
- `src/types.ts`
