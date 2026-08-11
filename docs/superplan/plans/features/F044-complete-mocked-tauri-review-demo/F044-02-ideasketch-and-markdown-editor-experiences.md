---
id: "F044-02"
title: "Add Complete IdeaSketch and Markdown Editor Experiences"
type: "feature"
status: "complete"
summary: "Mount realistic IdeaSketch and Markdown editors in the demo with their navigators, editing, preview, presentation, export, and native-history interactions."
source: "docs/superplan/human/features.md"
created: "2026-08-11"
order: 52
depends_on: ["F044-01"]
parent: "F044"
---

# Add Complete IdeaSketch and Markdown Editor Experiences Plan

**Goal:** Replace the generic typed placeholders with production-shaped editor experiences so the redesigned shell can be reviewed around real editor-owned density and interaction.
**Scope:** Extend only the isolated F044 demo. Register two concrete editor adapters behind the F044-01 Editor Host: IdeaSketch and Markdown. Use the installed open-source editor libraries rather than hand-built fake controls: embed Excalidraw for the active IdeaSketch Page and CodeMirror 6 for Markdown source, with `react-markdown` and `remark-gfm` for safe preview. Recreate the current user-visible frontend workflows that affect product layout and interaction. IdeaSketch includes Pages/Cameras tabs in an editor-owned navigator, list/thumbnail Page modes, add/rename/duplicate/delete/reorder Pages, Page activation, add/rename/delete/reorder Cameras, Camera badges, Present from the first Camera, preview navigation, optional laser pointer/trail, Navigator collapse/resize, export PNG/SVG, export draw.io, and convert-selection-to-clean-diagram feedback. Markdown includes Edit/Split/Preview, formatting commands, CodeMirror search and native Undo/Redo, resizable source/preview panes, collapsible Outline, heading jump, safe GFM rendering, same-document anchors, bounded relative-document links/images, line-ending/BOM metadata, and explicit LF/CRLF choice for an edited mixed-ending fixture. Both editors feed the shared session dirty/autosave/recovery/external-state lifecycle and expose format-neutral context/tool adapter hooks for F044-03.
**Non-Goals:** This plan does not copy production components or proprietary editor content into the demo, guarantee byte-identical `.is` ZIP or Markdown serialization, access real files, use a real preview renderer window, implement cloud assets, load network images, execute Markdown HTML/scripts, implement IdeaTable/IdeaWorkflow, add Agent UI, or migrate any editor code into production. Export downloads are browser-generated review artifacts and must be labeled as simulated where native save dialogs would normally apply.
**Architecture:** Add editor definitions to the demo registry with `createModel`, `render`, `getSnapshot`, `applySnapshot`, `markDirty`, `saveProjection`, `buildAgentContext`, and `applyAgentTransaction` boundaries. IdeaSketch stores Pages as ordered Excalidraw scenes and Cameras as ordered viewport records inside the mock document model; the mounted Excalidraw instance is authoritative for current-Page Undo/Redo and selection. Markdown's mounted CodeMirror `EditorView` is authoritative for source and Undo/Redo; preview/outline derive from bounded projections and never become editing state. Both adapters use F044-01 document revisions and persistence rather than editor-owned saving. Excalidraw CSS is copied into the demo `public/` directory and loaded from `index.html`, not imported from JavaScript. Editor-owned Navigator and toolbar controls remain strictly inside the center region; the application Agent continues to own the far-right region.
**Baseline:** F044-01 supplies the React shell, mock platform, dual-mode session kernel, registry-routed Editor Host, save lifecycle, and typed placeholders. Production currently contains IdeaSketch with Excalidraw, Pages, Cameras, presentation, exports, conversion, and navigator behavior, plus a CodeMirror-based Markdown editor with Edit/Split/Preview, outline, safe preview, links/images, and shared persistence/reliability behavior. The F043 shell intentionally left the center empty; this plan is the explicit change that makes editor content part of the review.
**Exit Criteria:** Opening `.is` mounts Excalidraw and the IdeaSketch navigator only inside Editor Host. Page and Camera operations change the current mock document, preserve order, participate in dirty/autosave state, and use editor-native Undo/Redo. Presentation starts at the first Camera when present, supports navigation/exit and the configured laser pointer, and does not alter document content. Export and conversion actions produce clear progress/success/error feedback without native filesystem claims. Opening `.md` mounts CodeMirror and supports Edit/Split/Preview, formatting, search, native Undo/Redo, outline navigation, safe GFM, bounded local images/links, and mixed-line-ending choice. Switching between editors remounts only the active heavy editor, keeps protected background sessions, and never changes outer shell ownership. Agent adapter hooks can read current context and apply one native transaction but are not yet exposed in UI. Focused editor tests, build, browser editing, responsive layout, and no-production-change checks pass.

## Task 1: Mount the IdeaSketch Canvas and Editor-owned Navigator

**Outcome:** IdeaSketch feels like a real visual editor inside the approved shell rather than a placeholder or shell-drawn mock canvas.
**Files:**
- Modify: `.temp/f041-native-workbench-review/package.json`
- Modify: `.temp/f041-native-workbench-review/index.html`
- Create: `.temp/f041-native-workbench-review/public/excalidraw.css`
- Create: `.temp/f041-native-workbench-review/src/editors/ideasketch/IdeaSketchEditor.jsx`
- Create: `.temp/f041-native-workbench-review/src/editors/ideasketch/IdeaSketchNavigator.jsx`
- Create: `.temp/f041-native-workbench-review/src/editors/ideasketch/PagesPanel.jsx`
- Create: `.temp/f041-native-workbench-review/src/editors/ideasketch/CamerasPanel.jsx`
- Create: `.temp/f041-native-workbench-review/src/editors/ideasketch/ideaSketchModel.js`
- Modify: `.temp/f041-native-workbench-review/src/lib/fileTypeRegistry.js`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Test: `.temp/f041-native-workbench-review/tests/ideaSketchEditor.test.mjs`

**Change Map:**
- active canvas: current-Page Excalidraw scene, selection, viewport, native history, and draft commits
- Pages: list/thumbnail modes, add, rename, duplicate, delete, activation, and drag ordering
- Cameras: Page-scoped list, add from viewport, rename, delete, ordering, and canvas badges
- navigator: editor-owned collapse/restore/resize independent from Workspace and Agent

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/ideaSketchEditor.test.mjs`
- Browser cases: draw/edit/undo; switch Pages without draft contamination; reorder Pages/Cameras; dirty/autosave; navigator independence; active editor remount stability.

- [x] Embed Excalidraw with a Page-scoped mock document model and native history.
- [x] Implement complete Pages and Cameras management in the editor-owned navigator.
- [x] Preserve shell/editor/Agent ownership boundaries at every panel state.

## Task 2: Add Presentation, Laser, Conversion, and Export Workflows

**Outcome:** The current visual-presentation actions can be reviewed end to end without native dialogs or a separate renderer process.
**Files:**
- Create: `.temp/f041-native-workbench-review/src/editors/ideasketch/PresentationMode.jsx`
- Create: `.temp/f041-native-workbench-review/src/editors/ideasketch/CameraOverlay.jsx`
- Create: `.temp/f041-native-workbench-review/src/editors/ideasketch/ideaSketchExports.js`
- Create: `.temp/f041-native-workbench-review/src/components/dialogs/ExportDialog.jsx`
- Modify: `.temp/f041-native-workbench-review/src/editors/ideasketch/IdeaSketchEditor.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Test: `.temp/f041-native-workbench-review/tests/ideaSketchPresentationExport.test.mjs`

**Change Map:**
- presentation: first-Camera start, previous/next/exit keyboard controls, fullscreen-like surface, and no editor-state mutation
- laser: optional pointer/trail with bounded presentation-only lifecycle
- conversion: selected elements normalize to a clean diagram style in one native transaction
- exports: PNG/SVG/draw.io browser artifacts, simulated path choice, and progress/result messaging

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/ideaSketchPresentationExport.test.mjs`
- Browser cases: no-Camera presentation; first-Camera start; laser on/off; Escape/arrow capture; convert then one-step Undo; export success/cancel/failure.

- [x] Implement the production-shaped Camera presentation and laser interaction.
- [x] Add selection conversion and all current export entry points with honest mock boundaries.
- [x] Keep presentation events isolated from Excalidraw editing and shell shortcuts.

## Task 3: Mount the Markdown Source, Preview, and Outline Experience

**Outcome:** Markdown behaves as a real second editor and proves the shell around a dense text workflow.
**Files:**
- Create: `.temp/f041-native-workbench-review/src/editors/markdown/MarkdownEditor.jsx`
- Create: `.temp/f041-native-workbench-review/src/editors/markdown/MarkdownToolbar.jsx`
- Create: `.temp/f041-native-workbench-review/src/editors/markdown/MarkdownPreview.jsx`
- Create: `.temp/f041-native-workbench-review/src/editors/markdown/MarkdownOutline.jsx`
- Create: `.temp/f041-native-workbench-review/src/editors/markdown/markdownModel.js`
- Modify: `.temp/f041-native-workbench-review/src/lib/fileTypeRegistry.js`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Test: `.temp/f041-native-workbench-review/tests/markdownEditor.test.mjs`

**Change Map:**
- source: CodeMirror 6, formatting commands, search, keyboard behavior, native history, and session draft commits
- views: Edit/Split/Preview, bounded pane resize, preview safety, and scroll/navigation coordination
- outline: projected headings, stable anchors, current heading, and jump-to-source
- persistence metadata: BOM, LF/CRLF/mixed state, explicit normalization, local link/image confinement, and unsupported scheme errors

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/markdownEditor.test.mjs`
- Browser cases: type/format/search/undo; mode switching; pane resize; outline jump; GFM; safe/unsafe links; local image bounds; mixed-ending save decision; autosave and recovery.

- [x] Implement the CodeMirror-authoritative Markdown editor and safe preview.
- [x] Add complete mode, outline, formatting, link/image, and line-ending interactions.
- [x] Reuse the F044-01 session and save pipeline without editor-specific shell branches.

## Task 4: Expose Editor Context and Native Transaction Adapters

**Outcome:** F044-03 can exercise one generic Agent against both real demo editors without bypassing their native histories.
**Files:**
- Create: `.temp/f041-native-workbench-review/src/lib/editorAgentAdapters.js`
- Modify: `.temp/f041-native-workbench-review/src/editors/ideasketch/IdeaSketchEditor.jsx`
- Modify: `.temp/f041-native-workbench-review/src/editors/markdown/MarkdownEditor.jsx`
- Modify: `.temp/f041-native-workbench-review/src/app/demoStore.js`
- Test: `.temp/f041-native-workbench-review/tests/editorAgentAdapters.test.mjs`

**Change Map:**
- context: active document, active Page/selection, Markdown selection/outline, revision, source fingerprint, and protected state
- reads: bounded format-aware summaries without direct mock filesystem access
- mutations: target validation and exactly one Excalidraw or CodeMirror native transaction
- undo: editor-native one-step reversal and normal dirty/autosave propagation

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/editorAgentAdapters.test.mjs`
- Cases: read-before-mutate; stale revision; read-only/conflict/missing; inactive target; IdeaSketch transaction Undo; Markdown transaction Undo; no direct persistence write.

- [x] Add format-aware context/read/mutation adapters behind one generic contract.
- [x] Prove both editors apply Agent-shaped changes through native history and normal saving.
- [x] Deliver F044-02 in a separate commit after browser editor QA.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F038-markdown-editor-and-agent-extension/F038-01-generic-document-kernel-and-markdown-editor.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-01-mock-desktop-platform-and-workspace-session-demo.md`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/IdeaSketchNavigator.tsx`
- `src/components/PageOrganizer.tsx`
- `src/components/PresentationMode.tsx`
- `src/components/MarkdownEditor.tsx`
