---
id: "F045"
title: "Refine Review Demo Workspace Actions and Document Chrome"
type: "feature"
status: "complete"
summary: "Move creation and overflow actions onto Workspace tree rows, make Recents standalone-only, and simplify the document and Agent chrome around one active editor."
source: "docs/superplan/human/features.md"
created: "2026-08-11"
order: 55
depends_on: ["F044-04"]
parent: ""
---

# Refine Review Demo Workspace Actions and Document Chrome Plan

**Goal:** Make the complete mock frontend feel more like a native workspace client by putting actions on the object they affect and removing redundant editor and Agent chrome.
**Scope:** Refine only `.temp/f041-native-workbench-review/`. Remove creation controls from the `Workspaces` section header. Every Workspace root receives a trailing `+` and overflow action; every directory receives the same pair; files receive only overflow. `+` creates an IdeaSketch file, Markdown file, or folder inside that exact Workspace root or directory. Overflow menus expose only context-valid rename, move, reveal-in-Finder simulation, remove-Workspace, and Move-to-Trash actions with safe confirmation. Keep Open Workspace available through the command palette and an empty-Workspaces action instead of a permanent header button. Make `Recents` contain only standalone files opened outside a Workspace; opening a Workspace or any Workspace-owned file must not add or retain a Recent. Fix the zero-width Workspace state so Editor Host remains visible and receives the released width. Replace the document crown's dedicated Save, Close, editor-owner explanation, overflow decoration, and separate status rail with one accessible leading status/close control before the file icon and title: it shows clean, dirty, saving, warning, or error state at rest and becomes Close on hover or keyboard focus. Keep autosave, `Command/Ctrl + S`, Save As, conflict/recovery decisions, and screen-reader status announcements. When Agent is closed, keep the context-gated robot toggle in Editor Host; when open, move the panel toggle into the Agent header after New Thread, History, and Inspector. Remove Agent header subtitles and first-use feature-description copy, and right-align the action cluster.
**Non-Goals:** This feature does not migrate code into production `src/`, `tests/`, `src-tauri/`, or Tauri capabilities; change editor-owned IdeaSketch or Markdown controls; add real Finder, filesystem, or Trash access; add Workspace files to Recents; remove keyboard save or protected-document behavior; redesign Settings, Threads, runtime diagnostics, Skills, Tool activity, or the Welcome page; add new editor formats; or approve production migration.
**Architecture:** Preserve the Open Frame three-region shell and registry-owned editor aperture. Use explicit CSS grid areas so conditional panel mounting cannot change the Editor Host column. Keep the existing neutral native token system—Paper `#ffffff`, Workspace `#e9eae7`, Agent `#f4f4f2`, Graphite `#252930`, Cobalt `#2f5dcc`, and Danger `#b4433c`—with the system UI face for controls and the existing monospace face for paths/status. Route row actions through one context object containing Workspace, entry, and target directory instead of relying on the globally active Workspace. Split recent semantics at the mock platform boundary: only `openStandalone()` may call `touchRecent()`, fixtures seed standalone-only rows, and UI/commands consume that invariant. The distinctive design move is a **status-close lens**: one calm leading control carries document condition until direct interaction reveals Close, reducing chrome without hiding state or safety.
**Baseline:** F044 delivers a complete browser-runnable mock frontend, but its Workspaces header owns two creation buttons, Workspace roots have no row actions, directories and files share the same overflow-only treatment, and creation always targets the active Workspace root. Mock recents include Workspace roots and Workspace-owned files. Because the Workspace panel is conditionally unmounted without explicit grid placement, Editor Host can auto-place into the collapsed first column and appear blank. Editor Host currently shows Save, Close, an editor-owner explanation, overflow, and a full-width 25px status rail. Agent header includes a runtime subtitle and verbose first-use copy while its action alignment leaves reserved right padding for an external toggle.
**Exit Criteria:** The Workspaces heading has no action buttons. Workspace roots show `+` then overflow; directories show `+` then overflow; files show overflow only. Creation always lands in the clicked root/directory, and every context menu is anchored to and labeled for its target. Workspace removal never claims to delete disk content; reveal actions are visibly simulated; destructive entry actions retain confirmation. Open Workspace remains reachable without restoring a header button. Baseline and newly opened Recents contain standalone files only, while Workspace navigation never changes that list. Closing Workspaces leaves Editor Host fully visible, interactive, and expanded at every target viewport. The editor crown has no dedicated Save/Close buttons, owner explanation, decorative overflow, or separate status rail; the leading status-close lens communicates every document state, supports keyboard focus and Close, and keeps autosave/shortcuts/protected decisions intact. Agent header has no explanatory subtitle or first-use feature paragraph, its actions align to the right, and its open-panel toggle occupies the far-right position while the closed robot affordance remains in Editor Host. Light, Dark, and System, resizing, command routing, deterministic scenarios, accessibility, clean console, responsive geometry, full demo tests/build, refreshed evidence, and no-production-change checks pass.

## Task 1: Put Workspace and Recent Behavior on Truthful Object Boundaries

**Outcome:** Navigation actions operate on the row the user chose, while Recents has one unambiguous standalone-file meaning.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/components/workspace/WorkspacePanel.jsx`
- Modify: `.temp/f041-native-workbench-review/src/app/DemoApp.jsx`
- Modify: `.temp/f041-native-workbench-review/src/mock/mockDesktopApi.js`
- Modify: `.temp/f041-native-workbench-review/src/mock/fixtures.js`
- Modify: `.temp/f041-native-workbench-review/src/components/commands/commandRegistry.js`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Test: `.temp/f041-native-workbench-review/tests/mockDesktopApi.test.mjs`
- Create: `.temp/f041-native-workbench-review/tests/workspaceNavigationRefinement.test.mjs`

**Change Map:**
- Workspace rows: root/directory `+`, root/directory/file overflow, hover/focus visibility, accessible target labels, and target-relative menu anchoring
- creation contract: carry `workspaceId` and directory path through menu, dialog, API call, refresh, and optional file opening
- actions: context-valid rename/move/reveal/remove/Trash behavior, safe confirmation, and truthful mock notices
- Recents: standalone-only fixtures and platform invariant; remove Workspace branches from recent rendering/opening and add an Open Workspace command/empty action

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/mockDesktopApi.test.mjs .temp/f041-native-workbench-review/tests/workspaceNavigationRefinement.test.mjs`
- Cases: create at root and nested directory; no `+` on files; root/directory/file menu sets; rename/move/remove/Trash confirmations; simulated reveal; Workspace open/file open leave Recents unchanged; standalone open deduplicates and orders Recents.

- [x] Move all creation and overflow behavior onto the selected Workspace tree row.
- [x] Enforce standalone-only Recents below the mock platform boundary.
- [x] Preserve Open Workspace without restoring permanent section-header controls.

## Task 2: Simplify Shell Placement, Document Identity, and Agent Chrome

**Outcome:** Closing panels never loses the editor, and the top chrome communicates identity and actions without redundant rows or explanations.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/components/editor/EditorHost.jsx`
- Modify: `.temp/f041-native-workbench-review/src/components/agent/AgentPanel.jsx`
- Modify: `.temp/f041-native-workbench-review/src/app/DemoApp.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Create: `.temp/f041-native-workbench-review/tests/shellChromeRefinement.test.mjs`

**Change Map:**
- shell grid: explicit Workspace, Editor Host, and Agent placement across mounted/unmounted panel combinations
- document crown: leading status-close lens, file type, title/path/revision, hidden live status, and removal of Save/Close/owner/overflow/status-rail chrome
- document behavior: autosave, shortcut Save, Save As, dirty switch/close gate, recovery, external change, and read-only/conflict state remain unchanged
- Agent crown: title-only identity, right-aligned Thread/History/Inspector/open-panel toggle, and removal of non-actionable feature-description copy

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/shellChromeRefinement.test.mjs .temp/f041-native-workbench-review/tests/reliabilityInteractions.test.mjs .temp/f041-native-workbench-review/tests/layoutCommands.test.mjs`
- Browser cases: Workspace open/closed with Welcome and both editors; every document condition at rest/hover/focus; keyboard Close; dirty Close decision; Agent closed/open/control order; AI disabled; 1440x900, 1200x850, 1100x850, and 850x850 with zero overflow.

- [x] Pin Editor Host to its grid area and prove every panel combination remains visible.
- [x] Replace redundant document chrome with the accessible status-close lens.
- [x] Move the open Agent toggle into the simplified right-aligned Agent crown.

## Task 3: Refresh the Review Package and Deliver F045

**Outcome:** The revised interaction can be reviewed with current instructions, evidence, and an isolated commit.
**Files:**
- Modify: `.temp/f041-native-workbench-review/README.md`
- Modify: `.temp/f041-native-workbench-review/CAPABILITY_MATRIX.md`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-light-1440x900.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-dark-1200x850.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-compact-1100x850.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-minimum-850x850.png`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/features/F045-refine-review-demo-workspace-actions-and-document-chrome.md`

**Change Map:**
- review guide and matrix: object-scoped Workspace actions, standalone-only Recents, status-close lens, panel placement, Agent crown, and unchanged mock boundary
- browser evidence: representative root/directory menus, active document crown, collapsed Workspace, open Agent, dark, compact, and minimum states
- workflow: F045 completion evidence, exact production-path protection, generated index, and one `feat(F045)` commit

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/*.test.mjs`
- `./node_modules/.bin/vite build --config .temp/f041-native-workbench-review/vite.config.js`
- Browser console, accessible names/focus, menu interaction, status announcements, responsive geometry, and screenshot inspection.
- `file .temp/f041-native-workbench-review/screenshots/*.png`
- `git diff --exit-code HEAD -- index.html src tests src-tauri`
- `git diff --check`
- Superplan registry/index validation.

- [x] Refresh the complete review guide, capability matrix, and real PNG evidence.
- [x] Prove full demo regression, build, browser QA, and production isolation.
- [x] Mark F045 done and create one separate task commit only after human-approved delivery is complete.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F042-codex-style-workspace-agent-panel-toggles.md`
- `docs/superplan/plans/features/F043-refine-prototype-navigation-settings-welcome-and-agent-affordance.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-01-mock-desktop-platform-and-workspace-session-demo.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-03-settings-agent-and-editor-tool-experience.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-04-reliability-scenarios-browser-qa-and-review-package.md`
- `.temp/f041-native-workbench-review/README.md`
- Human-supplied Workspace menu and editor chrome screenshots from 2026-08-11
