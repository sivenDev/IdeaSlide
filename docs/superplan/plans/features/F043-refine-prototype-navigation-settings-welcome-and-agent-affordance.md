---
id: "F043"
title: "Refine Prototype Navigation, Settings, Welcome State, and Agent Affordance"
type: "feature"
status: "complete"
summary: "Turn the review shell into a workspace-and-recents launcher with a real Settings dialog, a fileless Welcome state, and context-aware Agent controls."
source: "docs/superplan/human/features.md"
created: "2026-08-10"
order: 50
depends_on: ["F042"]
parent: ""
---

# Refine Prototype Navigation, Settings, Welcome State, and Agent Affordance Plan

**Goal:** Make the isolated shell prototype read as a practical workspace client before a file opens and reveal Agent affordances only when an editor context exists.
**Scope:** Refine only `.temp/f041-native-workbench-review/`. Remove the `IdeaNote Lab / Local Workspace` brand switcher from the left panel. Keep the macOS controls and Workspace panel toggle, then begin content with a `Workspaces` section that lists added workspace roots, exposes one add-workspace action, and contains no search control. Follow it with a `Recents` section whose rows are recently opened heterogeneous editor files and open the selected file. Replace the bottom sync/preference content with a single `Settings` action that opens an accessible configuration dialog; move Light, Dark, and System into that dialog. Start the prototype with no selected file, no Agent panel, and a restrained shell-owned Welcome page in the Editor Host. Selecting a Workspace file or Recent file replaces Welcome with the unchanged generic editor-owned aperture, makes the Agent toggle available, and keeps Agent initially closed. While Agent is closed its top-right toggle uses a robot icon; while Agent is open it uses the right-panel navigation icon. Returning to Welcome closes Agent and hides the Agent toggle.
**Non-Goals:** This feature does not migrate prototype code into production, connect Workspaces/Recents/Settings to Tauri commands or user files, persist panel or theme state, implement real workspace addition, remove history items, design editor-owned content, add a Home route outside the Editor Host, brand the Welcome page with an oversized logo, add Agent access without an active file, change Agent thread/runtime behavior, or rewrite F039-F042 history.
**Architecture:** Keep the F042 Open Frame grid, neutral light/dark tokens, fixed left Workspace toggle, and zero-width closed panels. Replace the current brand crown and file-tree composition with two truthful shell navigation groups: `Workspaces` owns workspace-root disclosure and nested sample files; `Recents` owns direct file entries. Introduce an explicit `activeFile` shell state initialized to `null`. `setFile()` publishes document identity, activates the generic aperture, enables the Agent toggle, and updates Agent attachment; `showWelcome()` clears identity, closes Agent, hides its toggle, and renders the Welcome surface. The Editor Host crown shows a small `Welcome` identity without file metadata until a file opens. The Settings dialog is one modal with a left configuration category list and a right General/Appearance surface; theme choice remains functional through the existing `setTheme()` runtime. Use `aria-modal`, labeled close, Escape, backdrop dismissal, and focus transfer. Add a `bot` icon to the local icon map and let `setPanelState("agent", ...)` swap the Agent toggle SVG and tooltip without changing its stationary crown position. The signature interaction is **context-gated chrome**: the right edge stays completely quiet on Welcome, then gains a robot affordance only when the Editor Host has a document that the Agent can truthfully attach to.
**Baseline:** F042 starts with `launch-plan.is` active, Agent open, and the right toggle always present. The left panel has a tall `IdeaNote Lab / Local Workspace` brand switcher, one `Workspace` header with Add and Search, folders rendered directly as the active workspace tree, an `Archive` row, a sync status, and `Preferences`. Appearance uses a small anchored popover rather than a configuration dialog. The generic Editor Host aperture never displays a fileless Welcome state.
**Exit Criteria:** The left panel contains no `IdeaNote Lab`, `Local Workspace`, workspace-switcher mark, search action, `Archive`, sync status, or `Preferences` copy. Its first content heading is `Workspaces`, with one accessible add action and multiple workspace-root rows; expanded workspace roots can expose heterogeneous file rows. A separate `Recents` heading lists recently opened `.is`, `.md`, `.table`, and `.workflow` files, and clicking either a workspace file or recent file opens the same file identity. The bottom contains one `Settings` action. Settings opens a centered accessible configuration dialog, Light/Dark/System work inside it, Escape/backdrop/close dismiss it, and no legacy theme popover remains. Initial load shows Welcome with no selected tree/recent row, no attached Agent, Agent width `0px`, and no Agent toggle node visible. Opening a file renders the unchanged format-neutral editor aperture, shows a robot icon labeled `Show Agent`, keeps Agent closed, and preserves the selected file when Agent opens. While Agent is open, the same top-right button changes to the panel-navigation icon labeled `Hide Agent`; closing it returns to the robot icon. All states remain coherent at 1440x900, 1200x850, 1100x850, and 850x850 with zero page overflow, English copy, visible focus, reduced motion, clean console, refreshed screenshots, and no production file changes.

## Task 1: Recompose the Workspace Navigation and Fileless Welcome Lifecycle

**Outcome:** The shell opens as a workspace launcher and transitions cleanly from Welcome to one active file context.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/main.js`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`

**Change Map:**
- left navigation: remove the brand switcher, search, Archive, and sync state; add Workspaces roots plus Recents file rows and one bottom Settings action
- shell state: initialize without an active file, add Welcome/file transitions, and keep workspace/recent selection synchronized
- editor boundary: render a restrained Welcome surface only while no file is selected, then restore the unchanged generic editor-owned aperture
- Agent affordance: hide and close Agent on Welcome; use robot/panel icons and truthful labels for closed/open file-bound Agent states

**Verification:**
- Initial state contains Welcome, no active file, no visible Agent toggle, and Agent width 0px.
- Open every sample type from Workspaces and Recents; verify identical shell-owned identity and generic editor aperture behavior.
- Open/close Agent after a file selection and verify robot/panel icon changes without losing the file context.

- [x] Replace the branded file tree with Workspaces and Recents navigation plus the Settings footer.
- [x] Implement the explicit Welcome/file lifecycle and context-gated Agent control.

## Task 2: Replace the Theme Popover with a Configuration Dialog

**Outcome:** Settings behaves like a real desktop configuration entry point while preserving functional theme preview.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/main.js`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`

**Change Map:**
- Settings modal: category rail, General/Appearance content, close control, focus transfer, Escape, and backdrop dismissal
- theme runtime: move Light/Dark/System controls into the dialog and preserve System live resolution
- command entry points: route `Command/Ctrl + ,` and command-palette Appearance to the Settings dialog

**Verification:**
- Pointer and keyboard cases: open Settings from footer, shortcut, and command palette; switch all themes; close by button, Escape, and backdrop.
- Confirm one modal, no legacy popover, truthful labels, visible focus, and no console errors.

- [x] Build the Settings dialog and move all appearance controls into it.
- [x] Verify modal lifecycle and theme behavior in both Welcome and active-file states.

## Task 3: Refresh Responsive Evidence and Deliver F043

**Outcome:** The revised launcher, Welcome state, Agent affordance, and Settings dialog are ready for human review without production migration.
**Files:**
- Modify: `.temp/f041-native-workbench-review/README.md`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-light-1440x900.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-dark-1200x850.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-compact-1100x850.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-minimum-850x850.png`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F043-refine-prototype-navigation-settings-welcome-and-agent-affordance.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- viewport evidence: Welcome, active file with closed Agent, open Agent, Settings dialog, compact/minimum states, and current region geometry
- review guide: Workspaces/Recents, Settings, Welcome, dynamic Agent icon, and separate migration gate
- workflow: verified completion metadata and task-only F043 commit

**Verification:**
- `node --check .temp/f041-native-workbench-review/src/main.js`
- `./node_modules/.bin/vite build --config .temp/f041-native-workbench-review/vite.config.js`
- Browser inspection at 1440x900, 1200x850, 1100x850, and 850x850.
- `git diff --exit-code HEAD -- index.html src tests src-tauri`
- `git diff --check`

- [x] Capture and inspect the four review states with zero overflow, clean console, and no editor-specific UI.
- [x] Complete F043, refresh Superplan, and create one separate `feat(F043)` commit.

## Delivery Evidence

- Removed the `IdeaNote Lab / Local Workspace` switcher, search action, Archive, sync state, and Preferences copy. The left shell now begins with `Workspaces`, exposes one truthful Add Workspace review notice, lists three workspace roots, follows with heterogeneous `Recents`, and ends with one `Settings` action.
- Initial browser load verified `data-document="welcome"`, no active file rows, Agent closed at `0px`, and a hidden Agent toggle. Welcome remains shell-owned and transitions to the unchanged generic Editor Host aperture through `Open most recent`, `Browse Workspaces`, Workspace files, and Recent files.
- Opening `.is`, `.md`, `.table`, and `.workflow` samples synchronized their Workspace and Recent rows, updated shell document identity and Agent attachment, and preserved Agent open state on later file switches. The first file keeps Agent closed and reveals a robot button labeled `Show Agent`; opening Agent changes the same control to the right-panel icon labeled `Hide Agent`.
- Settings passed from the footer, `Command/Ctrl + ,`, and the command palette. General/Agent category switching, Light/Dark/System, focus return, close button, Escape, and backdrop dismissal all passed. Selected category, theme, and workspace disclosure state expose current ARIA semantics.
- Responsive browser inspection passed with zero page overflow: 1440 Welcome `252 / 1186 / 0`, 1200 dark Settings `252 / 946 / 0`, 1100 compact active file `0 / 1098 / 0`, and 850 minimum Welcome `0 / 848 / 0`. Browser logs contained no warnings or errors, every button had an accessible name, IDs were unique, and document language remained English.
- The four refreshed review captures are real PNG files at 1440x900, 1200x850, 1100x850, and 850x850. The prototype README now documents Welcome, Workspaces/Recents, Settings, context-gated Agent controls, current geometry, and the separate production-migration gate.
- `node --check`, the isolated Vite production build, `git diff --check`, and `git diff --exit-code HEAD -- index.html src tests src-tauri` passed. No production frontend, test, Rust, or Tauri capability file changed.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F042-codex-style-workspace-agent-panel-toggles.md`
- `docs/superplan/plans/features/F016-refine-launch-actions-and-add-recent-workspaces.md`
- `.temp/f041-native-workbench-review/README.md`
- `.temp/f041-native-workbench-review/src/main.js`
- `.temp/f041-native-workbench-review/src/styles.css`
- Human-supplied left-navigation screenshot and six requested refinements from 2026-08-10
