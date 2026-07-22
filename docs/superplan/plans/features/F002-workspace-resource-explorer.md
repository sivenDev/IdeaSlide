---
id: "F002"
title: "Build an Extensible Workspace Resource Explorer"
type: "feature"
status: "draft"
summary: "Replace slide-centric navigation with a persisted workspace resource tree, canvas editor, and compact canvas-scoped camera list."
source: "docs/superplan/human/features.md"
created: "2026-07-22"
order: 2
depends_on: []
parent: ""
---

# Build an Extensible Workspace Resource Explorer Plan

**Goal:** Reframe IdeaSlide as a visual workspace whose current resource type is an Excalidraw canvas, while leaving stable extension points for additional resource types.
**Scope:** Treat one `.is` file as one workspace. Add a hierarchical resource model and left explorer that initially supports `folder` and `canvas` nodes, with persisted string type ids, stable ids, names, parent/order metadata, optional content references, and a registry boundary for type-specific creation, icon, editor, and presentation behavior. Users can create folders and canvases, expand/collapse folders, select and inline-rename nodes, drag nodes to reorder or reparent them, and delete nodes with protection for destructive folder deletion. Selecting a canvas flushes the previous draft and opens that canvas in the center. A compact right Cameras sidebar lists only the selected canvas's cameras. Both sidebars independently collapse from divider markers. Neither sidebar renders thumbnails. Legacy flat-slide workspaces migrate in memory to root-level canvases without losing content or order; saves persist the resource tree while retaining a deterministic canvas compatibility order for existing presentation and MCP slide operations.
**Non-Goals:** This plan does not implement editors for resource types other than canvas, arbitrary external-file links, a plugin marketplace, tabs or multiple simultaneously open resources, search, multi-select or batch actions, slide/camera thumbnails, camera naming, freeform sidebar resizing, a presentation-mode redesign, or pixel-for-pixel imitation of another product. It does not promise that folder hierarchy survives opening and saving the workspace in an older IdeaSlide build that does not understand workspace resources.
**Architecture:** A normalized `WorkspaceResource` collection is the workspace navigation source of truth. Every node has a stable id, persisted string `type`, display name, nullable parent id, sibling order, and optional content reference; only registered resource types receive active editors and creation behavior. `folder` owns children but no content. `canvas` points to the existing Excalidraw scene payload and owns its camera elements. Unknown types remain round-trip safe, appear with a generic icon and unsupported-editor state, and cannot be silently deleted or rewritten. The `.is` manifest gains an optional workspace-resource section while retaining the existing flat slide content index as a compatibility projection; legacy files synthesize root canvas resources, and new saves derive the flat canvas order by depth-first tree traversal. The frontend store selects resources by id rather than array index and keeps type-specific canvas content separate from generic tree metadata. `EditorLayout` composes the explorer, active resource editor, and cameras sidebar; a small resource-type registry resolves icons, create defaults, editor components, and whether a resource participates in presentation. Existing MCP slide tools remain compatibility aliases over canvas resources and must update both the tree and content projection atomically.
**Baseline:** The Rust `Manifest` currently contains only `version`, timestamps, and a flat `slides: Vec<SlideEntry>` whose entries contain `id` and `title`; `read_is_file` reads `slides/{id}.json` in manifest order. The frontend `Slide` model contains only id and Excalidraw scene data, `EditorLayout` selects the active slide by numeric index, and Toolbar owns compact slide/camera dropdowns. Camera elements already live inside the current scene. `CameraList` and preview hooks are thumbnail-oriented but are not mounted in the current editor shell. MCP tools expose slide list/add/delete/reorder/content operations and therefore form a compatibility boundary for a hierarchical resource migration.
**Exit Criteria:** The default editor shows a thumbnail-free Workspace tree, selected resource editor, and thumbnail-free Cameras list; left and right divider markers independently collapse and restore their panels while the canvas remains correctly sized and interactive. Users can create nested folders and canvases, rename them, reorder/reparent them, and safely delete them; selecting a canvas preserves the previous pending draft and opens the correct scene by id. Cameras are scoped to the active canvas and support select, reorder, delete, and an instructive empty state. Resource hierarchy and names, canvas data, camera order, and active canvas identity survive save and reopen. Legacy flat-slide files open as root canvases in original order. Unknown resource types survive load/save and show a non-destructive unsupported state. Presentation and existing MCP slide operations use the same deterministic depth-first canvas projection without corrupting the tree. Focused migration/store/UI/MCP tests, the complete frontend and Rust suites, production build, and editor smoke matrix pass.

## Task 1: Add a Forward-Compatible Workspace Resource Manifest

**Outcome:** `.is` workspaces persist a generic resource hierarchy while legacy flat-slide files remain readable and canvas content stays recoverable.
**Files:**
- Modify: `src-tauri/src/file_format.rs`
- Modify: `src/types.ts`
- Create: `src/lib/workspaceResources.ts`
- Modify: `src/lib/tauriCommands.ts`
- Test: `src-tauri/src/file_format.rs`
- Test: `tests/workspaceResources.test.mjs`
- Test: `tests/tauriCommands.test.mjs`

**Change Map:**
- `src-tauri/src/file_format.rs`: optional workspace-resource manifest schema, validation, legacy synthesis inputs, unknown-field preservation boundary, and flat canvas content projection
- `src/types.ts`: generic workspace resource metadata, canvas resource content, and persisted workspace types
- `src/lib/workspaceResources.ts`: tree validation, deterministic sibling/depth-first ordering, legacy slide-to-canvas migration, unknown-type handling, and flat canvas compatibility projection
- `src/lib/tauriCommands.ts`: load/save conversion between `.is` manifest data and frontend workspace resources without dropping legacy canvases or unknown resource metadata

**Verification:**
- `node --test tests/workspaceResources.test.mjs tests/tauriCommands.test.mjs`
- `cd src-tauri && cargo test file_format -- --nocapture`
- Behavior cases: missing workspace metadata synthesizes root canvases in slide order; duplicate ids, missing parents, cycles, and invalid content references fail safely; unknown types and metadata round-trip; depth-first canvas projection is deterministic; folder hierarchy and canvas payloads round-trip together

- [ ] Add failing migration and round-trip tests for legacy, hierarchical, malformed, and unknown-type manifests.
- [ ] Define the persisted generic resource schema and frontend resource/content contracts.
- [ ] Implement validated legacy synthesis and deterministic canvas compatibility projection.
- [ ] Preserve unknown resource types and their opaque metadata across load/save.
- [ ] Run the focused Node and Rust format suites and record evidence.

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

- [ ] Add failing reducer/session tests for hierarchical creation, rename, reorder, reparent, guarded deletion, and active-canvas stability.
- [ ] Implement the normalized resource reducer and selectors around stable ids.
- [ ] Replace slide-index context wiring with workspace resource and canvas-content state.
- [ ] Make editor drafts commit by canvas resource id across selection and tree mutations.
- [ ] Run the focused state/session suite and record evidence.

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

- [ ] Add failing explorer, editor-host, camera-list, and divider interaction contracts.
- [ ] Add the sortable dependency and shared inline input only if the repository does not already contain them.
- [ ] Implement the resource-type registry host and unsupported fallback.
- [ ] Implement the hierarchical Workspace explorer and safe row interactions.
- [ ] Refactor Cameras into a compact vertical text list with no thumbnail dependency.
- [ ] Implement independent divider collapse controls and run the focused UI suite.

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
- `src-tauri/src/mcp/services/slide_service.rs`: keep legacy slide operations synchronized with canvas resources and reject mutations that would violate tree invariants
- `src-tauri/src/mcp/tools/slide_tools.rs` and `src-tauri/src/mcp/mod.rs`: retain the existing slide-named MCP contract as a canvas compatibility API

**Verification:**
- `node --test tests/editorChromeNavigation.test.mjs tests/tooltipWiring.test.mjs tests/workspacePresentationOrder.test.mjs tests/workspaceExplorerWiring.test.mjs tests/cameraSidebarWiring.test.mjs tests/resourceEditorHost.test.mjs tests/panelDividerWiring.test.mjs`
- `node --test tests/*.test.mjs`
- `cd src-tauri && cargo test -- --nocapture`
- `npm run build`
- Editor smoke matrix: create nested folders/canvases; rename, reorder, reparent, and delete; switch canvases with unsaved edits; collapse/restore each sidebar and verify pointer alignment; create/select/reorder/delete cameras; save/reopen; open a legacy workspace; verify unsupported-resource fallback; verify presentation canvas order and representative MCP list/add/reorder operations

- [ ] Add failing integration assertions for the three-pane workspace shell and shared canvas compatibility order.
- [ ] Remove slide/camera management dropdowns and integrate explorer/editor/cameras around the responsive center.
- [ ] Route presentation through the resource-tree canvas projection without redesigning presentation mode.
- [ ] Synchronize legacy MCP slide operations with workspace resource invariants.
- [ ] Run focused integration checks, the full Node and Rust suites, production build, and editor smoke matrix.
- [ ] Record final evidence before marking F002 complete.

## References
- `docs/superplan/human/features.md`
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
