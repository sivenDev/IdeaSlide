---
id: "F044-01"
title: "Build the Mock Desktop Platform and Workspace Session Demo"
type: "feature"
status: "complete"
summary: "Turn the isolated shell into a deterministic React desktop simulation with complete Workspace, Recent, file-operation, and document-session flows."
source: "docs/superplan/human/features.md"
created: "2026-08-11"
order: 51
depends_on: ["F043"]
parent: "F044"
---

# Build the Mock Desktop Platform and Workspace Session Demo Plan

**Goal:** Give the approved review shell a production-shaped application core so every Workspace, Recent, and document-session workflow can be experienced without Tauri or real filesystem access.
**Scope:** Refactor only `.temp/f041-native-workbench-review/` from the current single-file static prototype into a modular React review application. Preserve the F043 Open Frame shell, Welcome state, Workspaces/Recents hierarchy, Settings entry point, context-gated Agent button, Light/Dark/System appearance, and responsive panel behavior. Add one deterministic `MockDesktopApi` that mirrors the current frontend's Tauri-facing workspace, recent-item, document, save, watcher, and recovery contracts. Seed realistic workspace roots, directories, IdeaSketch/Markdown files, standalone recent files, unsupported files, document metadata, and protected session states. Implement Workspace and Single File modes, workspace opening/addition, recent reopening/removal, tree expansion, selection, registry-driven New File/New Folder, inline rename, cross-folder move, Trash confirmation, refresh, watcher updates, active-document switching, Save, Save As, autosave, dirty/read-only/missing/conflict indicators, unsaved-switch decisions, and one foreground Editor Host routed through a demo file-type registry. Until F044-02 supplies the editor-owned surfaces, the host may render a typed loading/placeholder boundary, but every session and shell workflow must already be functional.
**Non-Goals:** This plan does not change or import production `src/`, `tests/`, `src-tauri/`, Tauri capabilities, real user files, production settings, or production credentials. It does not implement actual IdeaSketch/Markdown editor surfaces, Agent conversations, Settings sections beyond the existing F043 appearance shell, cloud sync, collaboration, IdeaTable, IdeaWorkflow, Workspace import/export, real OS dialogs, real Trash, filesystem permissions, native window close, or real persistence security. Mock behavior must never claim that a real disk operation occurred.
**Architecture:** Use React 19, `react-dom`, `lucide-react`, and Vite inside the isolated project, with no imports from production application modules. `MockDesktopApi` is the only platform boundary and exposes Promise-based methods corresponding to current production frontend calls: recent files/workspaces; open/refresh workspace; create/rename/move/trash entries; open/create/save Workspace documents; open/save standalone documents; choose mock directories/files/save paths; workspace watcher subscription; workspace-state persistence; and recovery draft access. A fixture factory creates immutable baseline data; the API owns mutable in-memory state, configurable latency, deterministic IDs, event emission, and injected failures. A reducer/store owns session identity, active document, protected background sessions, selected/expanded paths, panel state, notices, and modal lifecycle. A demo file-type registry declares IdeaSketch and Markdown as creatable/openable and routes explicit unsupported files to a safe fallback. The visual direction keeps the existing native palette and typography. The signature remains **context-gated chrome**, extended with one restrained document-condition rail below the Editor crown to encode clean, dirty, saving, read-only, conflict, recovery, or missing state without adding a global toolbar or dashboard.
**Baseline:** F043 is a browser-runnable vanilla JavaScript shell with static sample files, one generic Editor Host aperture, a simple Settings modal, and static Agent content. It has no application store, file-type registry, document sessions, mock backend, file operations, Workspace/Standalone distinction, save lifecycle, protected states, recovery, watcher events, or reusable component structure. The current production frontend already exposes these concepts through `src/lib/tauriCommands.ts`, `src/lib/documentSession.ts`, `src/lib/fileTypeRegistry.ts`, `src/components/WorkspaceExplorer.tsx`, `src/components/EditorLayout.tsx`, and the accepted PRD.
**Exit Criteria:** The demo opens on Welcome with no active file and can enter a seeded Workspace or standalone file from Workspaces, Recents, Open Workspace, Open File, and New File flows. Workspace roots and directory trees expand/collapse; supported files open; `.ideanote/` and unsupported files never appear in Explorer; explicit unsupported opening shows a safe non-editable view. New IdeaSketch, Markdown, and Folder; inline rename; cross-directory move; Trash confirmation; refresh; recent removal; and mock watcher updates all change the same authoritative mock filesystem. Workspace and Single File modes share one document/session core and one registry-routed Editor Host. Switching files respects unsaved decisions and keeps Dirty, conflict, recovery, read-only, and missing background sessions protected. Save, Save As, autosave, and save-failure states are observable and truthful about being simulated. Workspace/Agent panels, Welcome, command palette, Settings entry points, themes, focus, reduced motion, and responsive defaults remain coherent. Focused mock/store tests, the isolated build, and browser interaction checks pass with zero production changes.

## Task 1: Establish the Modular Demo and Mock Desktop Contract

**Outcome:** The review project has a maintainable React foundation and one typed-by-convention platform boundary instead of UI-owned mock behavior.
**Files:**
- Modify: `.temp/f041-native-workbench-review/package.json`
- Modify: `.temp/f041-native-workbench-review/vite.config.js`
- Modify: `.temp/f041-native-workbench-review/index.html`
- Create: `.temp/f041-native-workbench-review/src/main.jsx`
- Create: `.temp/f041-native-workbench-review/src/app/DemoApp.jsx`
- Create: `.temp/f041-native-workbench-review/src/app/demoStore.js`
- Create: `.temp/f041-native-workbench-review/src/mock/mockDesktopApi.js`
- Create: `.temp/f041-native-workbench-review/src/mock/fixtures.js`
- Create: `.temp/f041-native-workbench-review/src/lib/fileTypeRegistry.js`
- Remove: `.temp/f041-native-workbench-review/src/main.js`
- Test: `.temp/f041-native-workbench-review/tests/mockDesktopApi.test.mjs`
- Test: `.temp/f041-native-workbench-review/tests/demoStore.test.mjs`

**Change Map:**
- demo runtime: React/Vite entry, component boundaries, and isolated dependencies
- platform boundary: deterministic Promise API, subscriptions, latency, failure injection, and resettable fixtures
- application state: shell, workspace, session, modal, notice, and asynchronous operation lifecycle
- file types: registry-driven visibility, creation, editor routing, icons, and unsupported fallback

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/mockDesktopApi.test.mjs .temp/f041-native-workbench-review/tests/demoStore.test.mjs`
- Cases: deterministic reset; no production import; Workspace and standalone envelopes; supported-file filtering; mutation collisions; recent ordering/removal; watcher delivery; save failure; recovery lookup.

- [x] Replace the static runtime with a modular React application while preserving the approved shell geometry and initial state.
- [x] Implement one deterministic mock platform contract and reducer-backed application state.
- [x] Lock registry, filesystem, recent, watcher, and document-session semantics with focused tests.

## Task 2: Deliver Workspaces, Recents, Explorer, and Mock File Operations

**Outcome:** Users can navigate and mutate realistic workspaces through the approved left-region interaction model.
**Files:**
- Create: `.temp/f041-native-workbench-review/src/components/workspace/WorkspacePanel.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/workspace/WorkspaceTree.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/workspace/WorkspaceRow.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/workspace/RecentsList.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/workspace/NewEntryMenu.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/dialogs/ConfirmDialog.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/dialogs/PathPickerDialog.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Test: `.temp/f041-native-workbench-review/tests/workspaceInteractions.test.mjs`

**Change Map:**
- Workspaces: add/open roots, selection, disclosure, empty roots, and read-only identity
- Recents: files/workspaces, time/path metadata, reopen, remove, and missing-item feedback
- Explorer commands: New IdeaSketch, New Markdown, New Folder, rename, move, Trash, refresh, expand/collapse
- mock pickers: deterministic folder/file/save choices without OS or filesystem claims

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/workspaceInteractions.test.mjs`
- Browser cases: keyboard/pointer disclosure; inline rename stem selection; collision error; cross-directory move; Trash cancel/confirm; recent removal; unsupported hidden in Explorer; mock picker cancel.

- [x] Build Workspaces and Recents on the same mock source of truth.
- [x] Implement every current Explorer mutation and its confirmation/error/empty states.
- [x] Keep the F043 density, panel toggles, English copy, and no-search decision intact.

## Task 3: Add Dual-mode Document Sessions and Save Lifecycle

**Outcome:** Workspace and standalone documents share one safe, observable session model before editor-specific UI is mounted.
**Files:**
- Create: `.temp/f041-native-workbench-review/src/lib/documentSessions.js`
- Create: `.temp/f041-native-workbench-review/src/components/editor/EditorHost.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/editor/DocumentCrown.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/editor/DocumentStatusRail.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/editor/UnsupportedFileView.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/dialogs/UnsavedChangesDialog.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/notices/WorkspaceStatusNotice.jsx`
- Modify: `.temp/f041-native-workbench-review/src/app/DemoApp.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Test: `.temp/f041-native-workbench-review/tests/documentSessions.test.mjs`

**Change Map:**
- document session: Workspace/standalone persistence adapters, one active editor, protected background sessions, source fingerprints, and revision/status transitions
- switching: editor draft commit, unsaved Save/Discard/Cancel gate, selection rollback on blocked switch
- persistence: explicit Save, Save As, debounce autosave, status rail, and truthful simulated results
- fallback states: unsupported, read-only, missing, conflict, recovery, and generic typed editor boundary

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/documentSessions.test.mjs`
- Browser cases: clean/dirty switching; Save/Discard/Cancel; Workspace/standalone Save As; autosave settle/fail; selected-path rollback; protected background indicators; Welcome return after closing standalone file.

- [x] Implement one dual-mode document session kernel and registry-routed Editor Host.
- [x] Make save, autosave, switch gating, and protected states fully experienceable.
- [x] Preserve one foreground editor and prevent shell controls from becoming editor-specific.

## Task 4: Verify the Workspace and Session Foundation

**Outcome:** F044-01 is independently stable enough for the editor and Agent plans to build on it.
**Files:**
- Modify: `.temp/f041-native-workbench-review/README.md`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Modify: `.temp/f041-native-workbench-review/src/app/DemoApp.jsx`

**Change Map:**
- review guide: mock-platform boundary, reset behavior, Workspace/standalone workflows, and known pending editor/Agent plans
- responsive QA: 1440, 1200, 1100, and 850 shell/session states
- accessibility: accessible names, disclosure state, dialog focus, visible focus, reduced motion, and zero page overflow

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/*.test.mjs`
- `./node_modules/.bin/vite build --config .temp/f041-native-workbench-review/vite.config.js`
- Browser inspection of Welcome, Workspace file, standalone file, dirty switch, read-only, and unsupported states.
- `git diff --exit-code HEAD -- index.html src tests src-tauri`
- `git diff --check`

- [x] Complete responsive browser QA with clean console and no production imports.
- [x] Document the mock boundary and the remaining F044 editor/Agent work.
- [x] Deliver F044-01 in a separate commit.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F043-refine-prototype-navigation-settings-welcome-and-agent-affordance.md`
- `.temp/f041-native-workbench-review/README.md`
- `src/lib/tauriCommands.ts`
- `src/lib/documentSession.ts`
- `src/lib/fileTypeRegistry.ts`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/EditorLayout.tsx`
