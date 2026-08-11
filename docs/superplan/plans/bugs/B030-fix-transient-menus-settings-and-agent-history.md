---
id: "B030"
title: "Fix Transient Menus, Settings, and Agent History"
type: "bugfix"
status: "complete"
summary: "Replace hand-built transient overlays with accessible primitives, simplify tested Provider configuration, and make conversation history the Agent header selector."
source: "docs/superplan/human/bugs.md"
created: "2026-08-11"
order: 30
depends_on: ["F045"]
parent: ""
---

# Fix Transient Menus, Settings, and Agent History Plan

**Goal:** Make the review demo's transient controls dismiss predictably, simplify AI configuration into a compact test-before-model flow, and make conversation history the primary Agent header control while keeping the composer anchored to the panel bottom.
**Scope:** Refine only `.temp/f041-native-workbench-review/`. Replace custom Workspace creation/overflow menus and Agent history/inspector overlays with maintained Radix UI primitives. Workspace menus close on outside interaction, focus transfer, or Escape and expose only context-valid actions, with no `Move to Archive` or `Cancel`. Regroup Settings into Application, AI, Editors, and Review sections; keep General focused on Appearance; move the AI feature switch into Agent; reduce explanatory copy; render Provider token as a standard password input; add a deterministic mock connection test; and show a model select only after a successful test. Replace the Agent mark and separate History action with a conversation-history popover, give each conversation a Rename/Delete overflow menu, replace Runtime Inspector's side rail with a dismissible dialog, and keep the composer at the bottom of the available Agent column.
**Non-Goals:** This bugfix does not migrate any prototype code into production `index.html`, `src/`, `tests/`, `src-tauri/`, or Tauri capabilities; add real Provider network or credential persistence; expose a stored token back to the browser; redesign editor-owned surfaces; change Workspace, file, Thread, Tool, Skill, or Agent runtime semantics; add archive behavior; change Light/Dark/System; or approve production migration.
**Architecture:** Use `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`, and `@radix-ui/react-dialog` as the interaction owners for open state, outside interaction, focus restoration, keyboard navigation, and Escape dismissal. Add small demo-local styled wrappers for visual consistency, but do not recreate primitive behavior. Mount Workspace row menus beside their triggers so the selected Workspace/entry remains the action source; remove document-level menu coordinates and open-menu state from `DemoApp`. Keep only dialog-worthy pending targets in application state. Provider testing goes through a deterministic `mockSettingsApi.testProvider` boundary that returns success/failure and a model catalog without persisting plaintext token data. Treat the model choice as valid only for the last successfully tested Provider endpoint/token configuration, invalidating it when either input changes. The Agent history selector uses a Radix Popover for the list and a Radix Dropdown Menu for each row's Rename/Delete actions; Rename, Delete confirmation, and Runtime Inspector use Radix Dialogs. The Agent panel is a bounded flex column whose transcript owns remaining height and scrolling while the composer remains a non-shrinking final child.
**Baseline:** F045 leaves Workspace `+` and overflow menus as fixed-position custom `<div role="menu">` overlays coordinated by `DemoApp`; they close only through explicit actions or Escape and stay visible after an outside click or focus transfer. The menu still includes `Move to Archive` and `Cancel`. Settings shows a verbose credential card, token reveal/save/removal actions, a model text field before Provider validation, and the AI feature gate in General. Agent header shows a static Agent mark plus a separate History button; history is an absolute side rail with Rename/Archive/Delete controls; Runtime Inspector is another absolute rail that does not dismiss on outside interaction; and transcript sizing does not reserve the remaining panel height, so the composer can rise above the bottom.
**Reproduction:** Run `.temp/f041-native-workbench-review/`, open any Workspace row overflow menu, then click or focus the editor: the menu remains open. Open Runtime Inspector and click or focus outside its rail: it also remains open. In Settings, AI Provider exposes credential management and Model before a connection test, while the AI gate remains in General. In Agent, History is a separate header action and side rail, history rows expose Archive, and a short transcript leaves the composer above the bottom edge.
**Root Cause:** Transient UI behavior is distributed across manually rendered fixed/absolute elements with ad hoc open flags, coordinates, and explicit close callbacks, so there is no shared dismissal boundary, focus lifecycle, or restoration behavior. Settings models credential administration and Provider selection as unrelated controls instead of one test-gated configuration state. Agent history and diagnostics were added as independent rails rather than transient controls owned by the header, and `.agent-thread` does not flex and scroll as the panel's remaining-height region.
**Exit Criteria:** Every Workspace root/directory `+` menu and every root/directory/file overflow menu uses maintained Radix behavior and closes on outside pointer interaction, outside focus, item selection, and Escape while restoring focus to its trigger. Workspace root menus contain Rename, Show in Finder, and Remove from Workspaces; entry menus contain Rename, Show in Finder, and Move to Trash; creation remains limited to Workspace roots/directories; no menu contains `Move to Archive` or `Cancel`. Settings navigation is clearly grouped without decorative prose; General contains Appearance only; Agent contains the AI feature switch; AI Provider contains compact Base URL, Token password, and Test controls; failed tests expose an inline actionable error and no model control; successful tests expose a model select populated by the mock response; editing Provider inputs invalidates the test and model state; and token values are not persisted or echoed. Agent header begins with a conversation-history selector and ends with New, Inspector, and panel controls; there is no separate History button or archive UI; each history row has Rename/Delete only; rename/delete confirmation and Runtime Inspector are accessible dialogs that close on outside interaction or Escape and restore focus. The transcript scrolls independently and the composer remains flush to the panel bottom at 1440x900, 1200x850, 1100x850, and 850x850. Light, Dark, System, keyboard navigation, responsive geometry, deterministic mocks, full demo tests/build, refreshed review evidence, clean console, and no-production-change checks pass.

## Task 1: Replace Hand-built Transient UI with Shared Radix Primitives

**Outcome:** Menus and dialogs have one accessible interaction lifecycle and Workspace actions remain bound to the row that opened them.
**Files:**
- Modify: `.temp/f041-native-workbench-review/package.json`
- Modify: `.temp/f041-native-workbench-review/package-lock.json`
- Create: `.temp/f041-native-workbench-review/src/components/primitives/AppMenu.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/primitives/AppDialog.jsx`
- Modify: `.temp/f041-native-workbench-review/src/components/workspace/WorkspacePanel.jsx`
- Modify: `.temp/f041-native-workbench-review/src/app/DemoApp.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Create: `.temp/f041-native-workbench-review/tests/transientOverlayRegression.test.mjs`

**Change Map:**
- dependencies: add maintained Radix Dropdown Menu, Popover, and Dialog packages at pinned compatible versions
- shared primitives: one token-driven menu surface and one dialog surface with consistent spacing, focus ring, danger treatment, portal layering, and accessible labels
- Workspace rows: inline root/directory creation triggers and root/directory/file overflow triggers own their menu primitives and selected target data
- application state: remove menu anchors, fixed coordinates, custom menu components, context-menu open flags, and explicit Cancel rows; retain only rename/remove/Trash confirmation state
- action sets: root Rename/Show in Finder/Remove from Workspaces; entry Rename/Show in Finder/Move to Trash; creation unchanged and available only on roots/directories

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/transientOverlayRegression.test.mjs .temp/f041-native-workbench-review/tests/workspaceNavigationRefinement.test.mjs .temp/f041-native-workbench-review/tests/shellChromeRefinement.test.mjs`
- Browser cases: outside pointer, focus transfer, Escape, item selection, and trigger-focus restoration for every menu class; keyboard arrows/Enter; nested tree rows; no archive/cancel labels; correct root/directory/file targets; no clipped portals at all target frames and themes.

- [x] Add focused failing regressions for outside dismissal, focus restoration, and obsolete menu actions.
- [x] Install and style Radix primitives, then move Workspace menus to their row triggers.
- [x] Remove custom overlay behavior without changing object-scoped creation or destructive confirmation semantics.

## Task 2: Simplify Settings and Gate Model Selection on Provider Test

**Outcome:** Settings presents a compact, coherent configuration flow and cannot choose a model until the current Provider inputs pass a test.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/components/settings/SettingsCenter.jsx`
- Modify: `.temp/f041-native-workbench-review/src/mock/mockSettingsApi.js`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Modify: `.temp/f041-native-workbench-review/tests/settingsExperience.test.mjs`

**Change Map:**
- navigation: group General under Application; AI Provider, Agent, and Skills under AI; IdeaSketch under Editors; Review Scenarios under Review
- General and Agent: leave Appearance in General and move `Enable AI features` to Agent without changing the feature gate contract
- Provider controls: compact Base URL, normal password Token, and Test connection action; remove credential card, token visibility control, remove-credential action, and nonessential descriptions
- test state: deterministic pending/success/failure states through `mockSettingsApi.testProvider`, concise inline feedback, and protection against stale out-of-order test results
- model state: render a native/select control only after current inputs test successfully; populate it from the returned catalog and invalidate it when Base URL or Token changes
- secret boundary: allow a configured credential to be tested without returning it to UI state; never persist or log newly typed token content

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/settingsExperience.test.mjs`
- Cases: grouped navigation order; Appearance-only General; AI gate in Agent; password input semantics; no credential card/remove/reveal copy; required inputs; pending lockout; deterministic failure; successful catalog; model selection; input-change invalidation; stale response ignored; theme and AI gate persistence unchanged; token absent from settings and browser storage.

- [x] Add failing settings contracts for the compact grouped layout and test-gated model catalog.
- [x] Implement the deterministic Provider test boundary and stale-result protection.
- [x] Simplify Settings controls and copy while preserving themes, AI gating, policy, Skills, and review scenarios.

## Task 3: Make Conversation History the Agent Selector and Pin the Composer

**Outcome:** Conversation selection, row actions, diagnostics, and composing form one compact Agent column with predictable transient behavior.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/components/agent/AgentPanel.jsx`
- Modify: `.temp/f041-native-workbench-review/src/app/DemoApp.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Modify: `.temp/f041-native-workbench-review/tests/agentInteraction.test.mjs`
- Create: `.temp/f041-native-workbench-review/tests/agentPanelRefinement.test.mjs`

**Change Map:**
- Agent crown: replace static mark with current-conversation title and disclosure trigger; remove separate History button and keep New, Inspector, and panel controls right-aligned
- history popover: selectable conversation rows, current/running state, empty state, outside/Escape dismissal, focus restoration, and no archive/show-archived branch
- row overflow: Radix menu with Rename and Delete only; prevent overflow interaction from accidentally switching the conversation
- safe mutations: Radix rename and delete dialogs, current-conversation fallback after delete, protected running-state behavior, deterministic focus return, and no resurrected rows
- diagnostics: replace the Runtime Inspector rail with a modal dialog using the same shared surface and dismissal semantics
- geometry: make Agent panel and thread bounded flex columns; give transcript `flex: 1 1 auto`, `min-height: 0`, and scrolling; keep composer as the final non-shrinking child at panel bottom

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/agentPanelRefinement.test.mjs .temp/f041-native-workbench-review/tests/agentInteraction.test.mjs .temp/f041-native-workbench-review/tests/layoutCommands.test.mjs`
- Browser cases: select, create, rename, cancel rename, delete, cancel delete, and current-thread fallback; row overflow contains only Rename/Delete; outside/Escape/focus restoration for popover, menu, and dialogs; Inspector outside/Escape dismissal; transcript overflow; composer bottom geometry with short/long/running transcripts, AI disabled, every target frame, and all themes.

- [x] Add failing contracts for the history selector, row menus, dialogs, and bottom composer geometry.
- [x] Replace history and inspector rails with Radix Popover/Menu/Dialog interactions.
- [x] Make transcript scrolling own remaining height and preserve all existing Agent runtime/tool behavior.

## Task 4: Refresh Review Evidence and Deliver B030

**Outcome:** The revised demo is fully reviewable, regression-tested, isolated from production, and recorded in one task commit.
**Files:**
- Modify: `.temp/f041-native-workbench-review/README.md`
- Modify: `.temp/f041-native-workbench-review/CAPABILITY_MATRIX.md`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-light-1440x900.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-dark-1200x850.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-compact-1100x850.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-minimum-850x850.png`
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/bugs/B030-fix-transient-menus-settings-and-agent-history.md`

**Change Map:**
- review guide and matrix: document primitive-backed menus, Provider test/model flow, Settings grouping, history selector/actions, Inspector dialog, composer geometry, and unchanged mock boundary
- browser evidence: capture representative Workspace menu, Provider success/model selection, conversation selector, Runtime Inspector dialog, bottom composer, themes, and responsive frames
- workflow: record B030 verification, protect production paths, regenerate the plan index, and create one separate `fix(B030)` commit only after approved implementation is complete

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/*.test.mjs`
- `./node_modules/.bin/vite build --config .temp/f041-native-workbench-review/vite.config.js`
- Browser console, keyboard/focus behavior, accessible names, portal stacking, responsive geometry, Theme coverage, deterministic Provider and Agent scenarios, and screenshot inspection.
- `file .temp/f041-native-workbench-review/screenshots/*.png`
- `git diff --exit-code HEAD -- index.html src tests src-tauri`
- `git diff --check`
- Superplan registry/index validation.

- [x] Refresh the complete review guide, capability matrix, and real PNG evidence.
- [x] Run the full stabilized demo, build, browser, accessibility, responsive, and production-isolation matrix.
- [x] Mark B030 done, inspect the final diff, and create the separate `fix(B030): refine menus settings and agent history` commit.

## Completion Evidence

- `npm test` in `.temp/f041-native-workbench-review/`: 39/39 tests passed, including unique conversation identities, Radix overlay contracts, Provider test gating, Agent history, and Workspace actions.
- `npm run build` in `.temp/f041-native-workbench-review/`: Vite production build passed; the pre-existing large-chunk advisory remains informational.
- Fresh in-app browser session: Workspace menus and the conversation selector closed on outside interaction; menus and Runtime Inspector closed on Escape; trigger focus was restored; conversation row menus contained exactly Rename/Delete; Rename/Delete dialogs opened and dismissed correctly; Runtime Inspector closed on outside interaction and Escape; browser console reported no errors or warnings.
- Responsive browser geometry: 1200x850, 1100x850, and 850x850 review frames had zero horizontal shell overflow; the Agent composer remained the final bottom-aligned panel child and the Editor Host retained usable width.
- Provider browser flow: Token rendered as `type=password`; Model was absent before Test, appeared after success, and disappeared after Provider input edits or failure; the AI feature switch appeared under Agent and not General.
- Review evidence: four refreshed screenshots are genuine PNG files at 1440x900, 1200x850, 1100x850, and 850x850 and were visually inspected.
- Isolation and hygiene: `git diff --exit-code HEAD -- index.html src tests src-tauri` and `git diff --check` passed.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F043-refine-prototype-navigation-settings-welcome-and-agent-affordance.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-03-settings-agent-and-editor-tool-experience.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-04-reliability-scenarios-browser-qa-and-review-package.md`
- `docs/superplan/plans/features/F045-refine-review-demo-workspace-actions-and-document-chrome.md`
- `.temp/f041-native-workbench-review/README.md`
- Human-supplied Settings screenshot and review feedback from 2026-08-11
