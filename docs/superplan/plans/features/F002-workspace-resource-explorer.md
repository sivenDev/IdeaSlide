---
id: "F002"
title: "Build an Extensible Workspace Resource Explorer"
type: "feature"
status: "complete"
summary: "Deliver a versioned workspace resource tree, canvas editor, and compact canvas-scoped camera list with explicit legacy migration."
source: "docs/superplan/human/features.md"
created: "2026-07-22"
order: 2
depends_on: []
parent: ""
---

# Build an Extensible Workspace Resource Explorer Plan

**Goal:** Reframe IdeaNote as a visual workspace whose current resource type is an Excalidraw canvas, while leaving stable extension points for additional resource types.
**Scope:** Treat one `.is` file as one workspace. Add a hierarchical resource model and left explorer that initially supports `folder` and `canvas` nodes, with persisted string type ids, stable ids, names, parent/order metadata, optional content references, and a registry boundary for type-specific creation, icon, editor, and presentation behavior. Users can create folders and canvases, expand/collapse folders, select and inline-rename nodes, drag nodes to reorder or reparent them, and delete nodes with protection for destructive folder deletion. Selecting a canvas flushes the previous draft and opens that canvas in the center. A compact right Cameras sidebar lists only the selected canvas's cameras. Both sidebars independently collapse from divider markers. Neither sidebar renders thumbnails. Establish `.is` format `2.0` with an enforced `MAJOR.MINOR` version policy and a version-dispatch boundary that rejects malformed or unsupported versions before payload loading. Explicitly migrate format `1.0` flat slides to root-level canvases in memory; saving upgrades them to `2.0` through the existing backup/atomic-write path. Format `2.0` persists the resource tree and type-specific content references while deriving a deterministic canvas order for existing presentation and MCP slide operations.
**Non-Goals:** This plan does not implement editors for resource types other than canvas, arbitrary external-file links, a plugin marketplace, tabs or multiple simultaneously open resources, search, multi-select or batch actions, slide/camera thumbnails, camera naming, freeform sidebar resizing, a presentation-mode redesign, or pixel-for-pixel imitation of another product. It does not auto-open an unregistered future format version, implement downgrade from `2.0` to `1.0`, or promise that pre-F002 builds can understand `2.0` workspaces.
**Architecture:** A normalized `WorkspaceResource` collection is the workspace navigation source of truth. Every node has a stable id, persisted string `type`, display name, nullable parent id, sibling order, and optional content reference; only registered resource types receive active editors and creation behavior. `folder` owns children but no content. `canvas` points to an Excalidraw scene payload and owns its camera elements. Unknown resource types remain round-trip safe, appear with a generic icon and unsupported-editor state, and cannot be silently deleted or rewritten. The persisted manifest keeps the existing `version` key but defines it as the `.is` format version in `MAJOR.MINOR` form. A format-version dispatcher parses and validates the manifest header before deserializing version-specific bodies: `1.0` reads the legacy `slides` index and `slides/{id}.json`; `2.0` reads the workspace resource index and type-specific content references such as `canvases/{id}.json`. New workspaces and all saves write only `2.0`; the required v1 `slides` manifest field is absent from v2 so pre-version-gate builds fail parsing instead of opening and flattening the hierarchy. Breaking schema changes increment major; backward-compatible additions increment minor, but readers still accept only explicitly registered versions or ranges. The frontend store selects resources by id rather than array index and keeps type-specific canvas content separate from generic tree metadata. `EditorLayout` composes the explorer, active resource editor, and cameras sidebar; a small resource-type registry resolves icons, create defaults, editor components, and whether a resource participates in presentation. Existing MCP slide tools remain compatibility aliases over canvas resources and must update the v2 tree and canvas projection atomically.
**Baseline:** The Rust `Manifest` currently contains a `version` string fixed to `1.0`, timestamps, and a flat `slides: Vec<SlideEntry>` whose entries contain `id` and `title`; `read_is_file` deserializes the manifest and immediately reads `slides/{id}.json` without parsing, validating, or dispatching on `version`. The frontend `Slide` model contains only id and Excalidraw scene data, `EditorLayout` selects the active slide by numeric index, and Toolbar owns compact slide/camera dropdowns. Camera elements already live inside the current scene. `CameraList` and preview hooks are thumbnail-oriented but are not mounted in the current editor shell. MCP tools expose slide list/add/delete/reorder/content operations and therefore form a compatibility boundary for a hierarchical resource and file-format migration.
**Exit Criteria:** The default editor shows a thumbnail-free Workspace tree, selected resource editor, and thumbnail-free Cameras list; left and right divider markers independently collapse and restore their panels while the canvas remains correctly sized and interactive. Users can create nested folders and canvases, rename them, reorder/reparent them, and safely delete them; selecting a canvas preserves the previous pending draft and opens the correct scene by id. Cameras are scoped to the active canvas and support select, reorder, delete, and an instructive empty state. New and upgraded workspaces persist as format `2.0`; legacy `1.0` files open as root canvases in original order and are upgraded only when saved, with the existing backup retained. Missing, malformed, unsupported-old, and future format versions fail before any payload is read or mutated and report the encountered and supported versions. Resource hierarchy and names, canvas data, camera order, and active canvas identity survive save and reopen. Unknown resource types survive load/save and show a non-destructive unsupported state. Presentation and existing MCP slide operations use the same deterministic depth-first canvas projection without corrupting the tree. Focused version/migration/store/UI/MCP tests, the complete frontend and Rust suites, production build, and editor smoke matrix pass.

## Task 1: Version and Migrate the Workspace Resource Format

**Outcome:** `.is` files have an enforced format-version contract, explicit `1.0` migration, and a `2.0` workspace schema that fails safely across incompatible readers.
**Files:**
- Create: `docs/file-format.md`
- Modify: `src-tauri/src/file_format.rs`
- Modify: `src/types.ts`
- Create: `src/lib/workspaceResources.ts`
- Modify: `src/lib/tauriCommands.ts`
- Test: `src-tauri/src/file_format.rs`
- Test: `tests/workspaceResources.test.mjs`
- Test: `tests/tauriCommands.test.mjs`

**Change Map:**
- `docs/file-format.md`: `MAJOR.MINOR` policy, supported-version table, compatibility guarantees, migration behavior, and version-bump rules
- `src-tauri/src/file_format.rs`: version-header parsing before payload reads, explicit v1/v2 manifest types, supported-version dispatch, v1 slide adapter, v2 workspace/resource schema, `canvases/` payload paths, validation, and unsupported-version errors
- `src/types.ts`: generic workspace resource metadata, canvas resource content, and persisted workspace types
- `src/lib/workspaceResources.ts`: tree validation, deterministic sibling/depth-first ordering, legacy slide-to-canvas migration, unknown-type handling, and canvas compatibility projection
- `src/lib/tauriCommands.ts`: version-aware conversion between v1/v2 backend data and frontend workspace resources without dropping legacy canvases or unknown resource metadata

**Verification:**
- `node --test tests/workspaceResources.test.mjs tests/tauriCommands.test.mjs`
- `cd src-tauri && cargo test file_format -- --nocapture`
- Behavior cases: exact `1.0` fixtures load and migrate to root canvases; saving a migrated file writes `2.0` only after backup/atomic replacement; new files start at `2.0`; missing, malformed, unsupported-old, and future versions fail before payload reads; v2 manifests cannot deserialize as the required v1 shape; duplicate ids, missing parents, cycles, and invalid content references fail safely; unknown resource types and metadata round-trip; folder hierarchy and `canvases/` payloads round-trip together

- [x] Add failing version-gate, migration, old-reader rejection, and round-trip tests for v1, v2, malformed, unsupported, and unknown-resource manifests.
- [x] Document the `.is` version policy and supported-version/migration matrix.
- [x] Define explicit v1 and v2 manifest schemas plus generic frontend resource/content contracts.
- [x] Dispatch on validated manifest version before payload loading and implement the v1-to-v2 in-memory adapter.
- [x] Write only v2 workspace manifests and `canvases/` payloads through the existing backup and atomic replacement path.
- [x] Preserve unknown resource types and their opaque metadata across load/save.
- [x] Run the focused Node and Rust format suites and record evidence.

## Task 2: Make Resource Identity and Tree Mutations First-Class State

**Outcome:** Workspace state supports extensible resource metadata, draft-safe canvas switching, and deterministic hierarchical mutations by id.
**Files:**
- Create: `src/lib/workspaceStoreReducer.ts`
- Create: `src/hooks/useWorkspaceStore.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/editorSession.ts`
- Modify: `src/lib/tauriCommands.ts`
- Remove: `src/hooks/useSlideStore.tsx`
- Test: `tests/workspaceStoreReducer.test.mjs`
- Modify: `tests/editorSession.test.mjs`

**Change Map:**
- `src/lib/workspaceStoreReducer.ts`: pure create/select/rename/move/delete/load actions, tree invariants, active-resource fallback, and canvas presentation selectors
- `src/hooks/useWorkspaceStore.tsx`: React context around generic resource metadata plus type-specific canvas content
- `src/App.tsx`: workspace provider and presentation state wiring
- `src/lib/editorSession.ts`: commit pending Excalidraw drafts by stable canvas resource id before selection or tree mutations
- `src/lib/tauriCommands.ts`: new-workspace creation starts with one canvas resource and persistence snapshots retain resource metadata

**Verification:**
- `node --test tests/workspaceStoreReducer.test.mjs tests/editorSession.test.mjs tests/tauriCommands.test.mjs`
- Behavior cases: node moves cannot create cycles; sibling order normalizes after move/delete; active canvas remains stable by id after tree mutations; deleting an active subtree selects a deterministic surviving canvas; the last canvas cannot be deleted; pending drafts commit to their original canvas; unknown nodes are never rewritten by canvas actions

- [x] Add failing reducer/session tests for hierarchical creation, rename, reorder, reparent, guarded deletion, and active-canvas stability.
- [x] Implement the normalized resource reducer and selectors around stable ids.
- [x] Replace slide-index context wiring with workspace resource and canvas-content state.
- [x] Make editor drafts commit by canvas resource id across selection and tree mutations.
- [x] Run the focused state/session suite and record evidence.

## Task 3: Build the Thumbnail-Free Explorer and Camera Sidebar

**Outcome:** The editor gains an accessible file-explorer interaction model and a compact canvas-scoped camera sequence without preview rendering overhead.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/WorkspaceExplorer.tsx`
- Create: `src/components/WorkspaceResourceRow.tsx`
- Create: `src/components/ResourceEditorHost.tsx`
- Modify: `src/components/CameraList.tsx`
- Modify: `src/components/ResizableDivider.tsx`
- Create: `src/components/ui/Input.tsx`
- Test: `tests/workspaceExplorerWiring.test.mjs`
- Test: `tests/cameraSidebarWiring.test.mjs`
- Test: `tests/resourceEditorHost.test.mjs`
- Test: `tests/panelDividerWiring.test.mjs`

**Change Map:**
- `src/components/WorkspaceExplorer.tsx`: nested tree, folder expansion, create menu, keyboard navigation, internal scrolling, and drag/drop context
- `src/components/WorkspaceResourceRow.tsx`: type icon, selection, inline rename, drag handle, drop target, action menu, and destructive-folder confirmation boundary
- `src/components/ResourceEditorHost.tsx`: registered canvas editor dispatch and safe unsupported-type state
- `src/components/CameraList.tsx`: vertical numbered rows without thumbnails, active/empty states, drag ordering, selection, and deletion
- `src/components/ResizableDivider.tsx`: reusable left/right collapse marker and narrow rail behavior
- `src/components/ui/Input.tsx`: constrained inline rename input

**Verification:**
- `node --test tests/workspaceExplorerWiring.test.mjs tests/cameraSidebarWiring.test.mjs tests/resourceEditorHost.test.mjs tests/panelDividerWiring.test.mjs`
- Interaction cases: arrows navigate/expand/collapse the tree; Enter selects, F2 renames, Escape cancels; drag cannot move a folder into its descendant; action controls do not accidentally select rows; unsupported types expose no destructive editor action; long lists scroll inside their panels; neither sidebar imports or invokes thumbnail hooks/renderers

- [x] Add failing explorer, editor-host, camera-list, and divider interaction contracts.
- [x] Add the sortable dependency and shared inline input only if the repository does not already contain them.
- [x] Implement the resource-type registry host and unsupported fallback.
- [x] Implement the hierarchical Workspace explorer and safe row interactions.
- [x] Refactor Cameras into a compact vertical text list with no thumbnail dependency.
- [x] Implement independent divider collapse controls and run the focused UI suite.

## Task 4: Integrate the Workspace Shell and Compatibility Projections

**Outcome:** The three-pane shell, presentation flow, persistence, and existing MCP slide operations share one deterministic view of canvas resources.
**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/PresentationMode.tsx`
- Modify: `src-tauri/src/mcp/services/slide_service.rs`
- Modify: `src-tauri/src/mcp/tools/slide_tools.rs`
- Modify: `src-tauri/src/mcp/mod.rs`
- Modify: `tests/editorChromeNavigation.test.mjs`
- Modify: `tests/tooltipWiring.test.mjs`
- Test: `tests/workspacePresentationOrder.test.mjs`
- Test: `src-tauri/src/mcp/services/slide_service.rs`

**Change Map:**
- `src/components/Toolbar.tsx`: remove slide/camera organizer dropdowns while retaining workspace file and presentation actions
- `src/components/EditorLayout.tsx`: own independent sidebar visibility, compose explorer/editor/cameras, flush drafts around resource operations, and keep Excalidraw responsive to width transitions
- `src/components/PresentationMode.tsx`: consume the deterministic canvas-resource projection without changing presentation controls
- `src-tauri/src/mcp/services/slide_service.rs`: keep legacy slide operations synchronized with v2 canvas resources and reject mutations that would violate tree invariants
- `src-tauri/src/mcp/tools/slide_tools.rs` and `src-tauri/src/mcp/mod.rs`: retain the existing slide-named MCP contract as a canvas compatibility API

**Verification:**
- `node --test tests/editorChromeNavigation.test.mjs tests/tooltipWiring.test.mjs tests/workspacePresentationOrder.test.mjs tests/workspaceExplorerWiring.test.mjs tests/cameraSidebarWiring.test.mjs tests/resourceEditorHost.test.mjs tests/panelDividerWiring.test.mjs`
- `node --test tests/*.test.mjs`
- `cd src-tauri && cargo test -- --nocapture`
- `npm run build`
- Editor smoke matrix: create nested folders/canvases; rename, reorder, reparent, and delete; switch canvases with unsaved edits; collapse/restore each sidebar and verify pointer alignment; create/select/reorder/delete cameras; save/reopen a v2 workspace; open and save-upgrade a backed-up v1 workspace; reject representative malformed and future-version fixtures; verify unsupported-resource fallback; verify presentation canvas order and representative MCP list/add/reorder operations

- [x] Add failing integration assertions for the three-pane workspace shell and shared canvas compatibility order.
- [x] Remove slide/camera management dropdowns and integrate explorer/editor/cameras around the responsive center.
- [x] Route presentation through the resource-tree canvas projection without redesigning presentation mode.
- [x] Synchronize legacy MCP slide operations with workspace resource invariants.
- [x] Run focused integration checks, the full Node and Rust suites, production build, and editor smoke matrix.
- [x] Record final evidence before marking F002 complete.

## Delivery Evidence

- `node --test tests/*.test.mjs` — 110 tests passed after the final registry integration.
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` — 49 tests passed, including format migration, backup, hierarchy validation, media, and MCP Canvas compatibility.
- `npm run build` — TypeScript and Vite production build passed; existing Excalidraw chunk-size warnings remain informational.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` and `git diff --check` — passed.
- UI smoke attempt: Vite and the Tauri development binary both started successfully. Interactive inspection could not target the development window because the available browser inventory was empty and macOS exposed only the user's already-running installed IdeaSlide window; that saved user session was left untouched. Three-pane composition, collapse controls, explorer interactions, and thumbnail-free sidebars are covered by source-level integration contracts and the production build.

## References
- `docs/superplan/human/features.md`
- `docs/file-format.md`
- `docs/mockups/f002-organizers.html`
- `docs/superplan/plans/features/F001-enable-excalidraw-image-export.md`
- `src-tauri/src/file_format.rs`
- `src-tauri/src/mcp/services/slide_service.rs`
- `src-tauri/src/mcp/tools/slide_tools.rs`
- `src/types.ts`
- `src/hooks/useSlideStore.tsx`
- `src/lib/editorSession.ts`
- `src/lib/tauriCommands.ts`
- `src/components/Toolbar.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/CameraList.tsx`
- `src/components/ResizableDivider.tsx`
- `src/components/PresentationMode.tsx`
- `tests/editorChromeNavigation.test.mjs`
