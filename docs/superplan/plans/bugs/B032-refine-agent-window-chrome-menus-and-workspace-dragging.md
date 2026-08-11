---
id: "B032"
title: "Refine Agent Controls, Window Chrome, Menus, and Workspace Dragging"
type: "bugfix"
status: "in_progress"
summary: "Replace confusing Agent controls with model-aware response telemetry, make desktop chrome state-aware, re-anchor Workspace menus, and add reliable file-tree dragging."
source: "docs/superplan/human/bugs.md"
created: "2026-08-11"
order: 32
depends_on: ["B031"]
parent: ""
---

# Refine Agent Controls, Window Chrome, Menus, and Workspace Dragging Plan

**Goal:** Make the review demo's Agent and Workspace shell behave like a deliberate native AI workspace client, with understandable model controls, truthful response evidence, state-aware window chrome, precisely attached menus, and reliable file-tree movement.
**Scope:** Refine only `.temp/f041-native-workbench-review/`. Remove the visible Agent Skill picker and delivery-mode label from the composer. Add one compact model-and-reasoning selector whose choice applies to subsequent mocked Turns, and add a per-completed-response action row whose overflow opens a compact evidence card for Model, Reasoning, and Context Window usage. Replace the fixed upper-left control placement with a demo-local window-state boundary that represents macOS windowed, macOS fullscreen, Windows windowed/fullscreen, and browser states through shared safe-area tokens; macOS traffic lights appear only in the simulated windowed state, while the Workspace toggle reclaims their space in fullscreen and non-macOS layouts. Move Workspace overflow menus from bottom/end dropdown placement to right/start trigger placement with Radix collision fallback. Add dnd-kit pointer and keyboard dragging for visible Workspace files/folders so a source at any tree depth can move into another directory, outward into a parent or different tree branch, or back to the current Workspace root through `MockDesktopApi.moveEntry`, preserving active/open document identity after successful path changes.
**Non-Goals:** This bugfix does not migrate prototype code into production `index.html`, `src/`, `tests/`, `src-tauri/`, or Tauri capabilities; perform real Provider calls; expose hidden reasoning; add response voting; make Skills user-selectable in the composer; change internal mock delivery pacing; add same-parent manual ordering, Workspace-root sorting, cross-Workspace moves, multi-select dragging, or external file drops; redesign editor-owned surfaces; replace Radix or dnd-kit with custom interaction primitives; or approve production migration.
**Architecture:** Keep the existing Paper/Graphite/Cobalt palette and system/monospace typography. The distinctive interaction is a **response evidence hinge**: each completed assistant answer ends with a quiet action rail, and its final overflow control unfolds a dense three-row evidence card instead of adding permanent telemetry chrome. The composer ends with one concise `Model · Reasoning` control backed by a deterministic model catalog and Radix nested menu; each Turn captures an immutable execution snapshot so old response evidence does not change when the next model is selected. A `MockWindowApi` and `WindowChrome` component own platform/fullscreen state and expose CSS variables for left/right native-control safe areas, letting a later Tauri adapter replace the mock without rewriting shell geometry. `AppMenu` remains the Radix owner; Workspace overflow actions use right/start placement beside the three-dot trigger, while creation menus keep their existing compact bottom placement. One Workspace `DndContext` uses dnd-kit sensors and typed source/destination data; files and eligible folders are draggable, Workspace roots and directories are droppable, and `DemoApp` coordinates one mock move transaction plus selected/session path remapping. Same-parent, cross-Workspace, collision, and self-descendant drops do not mutate state, matching the established production B009/B010 behavior.
**Baseline:** B031 leaves Agent composer state with a native `Agent Skill` select whose first option is `Automatic Skill`, renders `settings.agent.deliveryMode` as the visible text `incremental`, and creates assistant transcript items with text only. There is no composer model selector and no response-level runtime evidence. Browser reproduction confirms `Automatic Skill` and `incremental` are visible and no model selector exists. The shell always renders simulated traffic lights and positions `.window-controls` at a fixed `left: 12px`; at 1200x850 the traffic-light group occupies x=13–65 and the Workspace toggle x=81–112, with no fullscreen/platform state. Workspace overflow menus use bottom/end anchoring: the `field-notes.md` trigger occupies x=221–245/y=234–257 while its menu opens at x=97–245/y=261–367, visually detaching 124px left from the trigger. `MockDesktopApi.moveEntry` already provides a same-Workspace directory move boundary, but `WorkspacePanel` has no drag context, sensors, droppable destinations, feedback, or path-remap caller.
**Reproduction:** Open `http://127.0.0.1:4176/?frame=1200x850`, open `launch-plan.is`, show Agent, and inspect the composer: `Automatic Skill` and `incremental` are visible, while there is no model/reasoning selector or assistant response evidence control. Return to the Workspace tree and open the `field-notes.md` three-dot menu: the menu drops below the row and stretches left to x=97 instead of opening beside the x=221 trigger. The traffic-light/toggle group keeps the same fixed geometry because the demo has no window-state input. Attempt to drag a visible file into another directory: no drag lifecycle or move request begins.
**Root Cause:** Agent selection, pacing, and transcript presentation were implemented as unrelated UI fragments: the composer exposes an internal Skill/pacing vocabulary, `runPrompt` does not pass a per-Turn model/reasoning choice, runtime events are not projected into assistant-item metadata, and completed answers have no action surface. Window controls are one absolute element with hard-coded offsets rather than a platform/fullscreen-owned layout contract. Workspace action menus reuse the B031 bottom/end default intended for dropdowns, so a narrow sidebar forces the entire content width left of the trigger. The mock platform already knows how to move entries, but no maintained drag primitive, typed destination policy, or post-move session remap connects the tree to that boundary.
**Exit Criteria:** The Agent composer contains no `Automatic Skill` select and no visible `incremental`, `burst`, or `atomic` delivery label. It exposes one keyboard-accessible model/reasoning control with deterministic `GPT 5.6 Sol`, `GPT 5.6 Terra`, `GPT 5.6 Luna`, and `GPT 5.5` choices plus supported effort levels; the compact button always reflects the current choice, and a submitted Turn retains that exact snapshot. Every completed assistant answer has a restrained action row and an overflow evidence card showing immutable Model, Reasoning, and Context Window usage; streaming answers do not claim final evidence before completion. macOS windowed shows the simulated traffic-light safe area and toggle placement from the supplied reference; macOS fullscreen hides traffic lights and moves the toggle into reclaimed left space; Windows/browser states do not reserve macOS space; right-side Windows native caption space is preserved; repeated fullscreen transitions do not overlap the Workspace toggle, document identity, Agent control, or draggable title region. Workspace three-dot menus open beside and top-aligned with their trigger, remain fully visible through Radix collision fallback at 850x850, and retain outside/Escape/focus-restoration behavior. Visible files/folders can be dragged with pointer or keyboard from any nesting level into another directory, upward/outward into a parent or different branch, or back to the current Workspace root; successful moves call the mock boundary once, update tree/path/session identity for the moved subtree, keep the moved open document active, and show restrained target feedback; same-parent ordering, cross-Workspace, external filesystem, collision, self/descendant, action-button, Missing, and unsupported drops do not mutate. Light, Dark, System, all target frames, clean console, full demo tests/build, refreshed review evidence, and production-isolation checks pass.

## Task 1: Replace Composer Internals with Model Selection and Response Evidence

**Outcome:** Agent choices are understandable before sending and each completed answer exposes concise, truthful execution evidence afterward.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/components/agent/AgentPanel.jsx`
- Modify: `.temp/f041-native-workbench-review/src/components/primitives/AppMenu.jsx`
- Modify: `.temp/f041-native-workbench-review/src/mock/mockAgentRuntime.js`
- Modify: `.temp/f041-native-workbench-review/src/mock/mockSettingsApi.js`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Modify: `.temp/f041-native-workbench-review/tests/agentInteraction.test.mjs`
- Modify: `.temp/f041-native-workbench-review/tests/agentPanelRefinement.test.mjs`
- Create: `.temp/f041-native-workbench-review/tests/agentModelAndEvidence.test.mjs`

**Change Map:**
- model catalog: deterministic ids, concise labels/descriptions, supported reasoning-effort options, and one default selection independent of Provider test presentation
- Turn snapshot: pass selected model/reasoning into `MockAgentRuntime.run`, emit them with timing/context evidence, and attach immutable metadata only to the completed assistant item for that Turn
- composer: delete visible Skill and delivery-mode rows; add one Radix-backed compound selector in the composer footer, with checked model/effort states and a compact current-value label
- response action rail: copy action, elapsed-time evidence, and an overflow-triggered Radix Popover or menu card containing Model, Reasoning, and Context Window rows without explanatory heading copy
- Inspector cleanup: remove selected-Skill and user-facing delivery-mode duplication while preserving runtime, capability, document, and policy diagnostics that remain useful

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/agentModelAndEvidence.test.mjs .temp/f041-native-workbench-review/tests/agentInteraction.test.mjs .temp/f041-native-workbench-review/tests/agentPanelRefinement.test.mjs`
- Browser cases: no `Automatic Skill`/delivery terminology; open/close selector by pointer, keyboard, outside click, and Escape; choose every model and supported effort; send two Turns with different choices and verify each old response retains its own evidence; streaming has no final metadata card; completed response card closes and restores focus; model control and composer fit at 850px; Light/Dark/System.

- [x] Add focused failing contracts for the removed controls, model/effort selection, immutable Turn snapshots, and response evidence lifecycle.
- [x] Implement the catalog, runtime projection, compact selector, and response evidence hinge without exposing hidden reasoning.
- [x] Remove redundant Skill/delivery copy and verify existing streaming, Tool, retry, steering, cancellation, and history behavior remains intact.

## Task 2: Make Window Chrome State-aware and Re-anchor Workspace Menus

**Outcome:** Native-control safe areas respond to platform/fullscreen state, and each Workspace overflow surface opens directly beside its row trigger.
**Files:**
- Create: `.temp/f041-native-workbench-review/src/components/layout/WindowChrome.jsx`
- Create: `.temp/f041-native-workbench-review/src/mock/mockWindowApi.js`
- Modify: `.temp/f041-native-workbench-review/src/app/DemoApp.jsx`
- Modify: `.temp/f041-native-workbench-review/src/components/primitives/AppMenu.jsx`
- Modify: `.temp/f041-native-workbench-review/src/components/workspace/WorkspacePanel.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Modify: `.temp/f041-native-workbench-review/tests/shellChromeRefinement.test.mjs`
- Modify: `.temp/f041-native-workbench-review/tests/compactMenuGeometry.test.mjs`
- Create: `.temp/f041-native-workbench-review/tests/windowChromeState.test.mjs`

**Change Map:**
- window boundary: query-seeded/mock-changeable platform and fullscreen state, event subscription, and a Tauri-shaped replacement seam
- chrome component: native-drag region, macOS windowed traffic-light simulation, fullscreen/non-macOS suppression, Workspace toggle, and accessible mock fullscreen review path without adding a permanent product toolbar
- safe-area tokens: shared titlebar height plus platform/fullscreen left/right insets applied to Workspace, editor, and Agent crowns so native controls never overlap interactive content
- Workspace overflow menus: right/start placement with a 2–4px trigger hinge, natural width, collision padding, viewport flip/shift, and no changes to creation-menu placement or action sets

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/windowChromeState.test.mjs .temp/f041-native-workbench-review/tests/shellChromeRefinement.test.mjs .temp/f041-native-workbench-review/tests/compactMenuGeometry.test.mjs .temp/f041-native-workbench-review/tests/transientOverlayRegression.test.mjs`
- Browser geometry: macOS windowed/fullscreen transition, Windows windowed/fullscreen, and browser fallback at 1440x900/1200x850/1100x850/850x850; no overlap or horizontal shell overflow; Workspace overflow top differs from trigger by at most 4px when right-side placement fits; collision fallback remains inside the frame; outside/Escape/focus restoration still passes.

- [x] Capture current fixed-inset and bottom/end menu geometry as failing regressions.
- [x] Add the mock window-state seam and safe-area token layout, preserving the restrained native chrome visual system.
- [x] Re-anchor only Workspace overflow menus beside the three-dot trigger and validate collision behavior through focused layout contracts.
- [x] Give the Workspace-root action menu enough width for its longest approved action without widening file or Agent menus.
- [x] Expose macOS fullscreen and Windows windowed chrome states through deterministic Settings review scenarios, resetting other scenarios to macOS windowed.

## Task 3: Connect Workspace Tree Dragging to the Mock Desktop Boundary

**Outcome:** Workspace files and folders move reliably between real directory destinations without inventing a parallel ordering model.
**Files:**
- Modify: `.temp/f041-native-workbench-review/package.json`
- Modify: `.temp/f041-native-workbench-review/package-lock.json`
- Modify: `.temp/f041-native-workbench-review/src/components/workspace/WorkspacePanel.jsx`
- Modify: `.temp/f041-native-workbench-review/src/app/DemoApp.jsx`
- Modify: `.temp/f041-native-workbench-review/src/mock/mockDesktopApi.js`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Modify: `.temp/f041-native-workbench-review/tests/mockDesktopApi.test.mjs`
- Modify: `.temp/f041-native-workbench-review/tests/workspaceNavigationRefinement.test.mjs`
- Create: `.temp/f041-native-workbench-review/tests/workspaceDragInteraction.test.mjs`

**Change Map:**
- dependencies: add maintained `@dnd-kit/core` and `@dnd-kit/utilities`; do not use native HTML5 dragging or a custom sensor framework
- tree drag contract: one `DndContext`, pointer activation constraint, keyboard sensor, typed source/destination data, full-row translation only, and isolation from disclosure/create/overflow actions
- valid targets: another directory at any branch/depth, a parent directory, or the same Workspace root when it differs from the source parent; nested sources support inward, lateral, and outward movement, with no same-parent ordering, cross-Workspace, external filesystem, file target, Missing target, or self/descendant target
- mock transaction: strengthen `moveEntry` validation for root destinations and descendant rejection, emit old/new paths once, refresh only after success, and return enough identity for caller remapping
- session remap: update selected/expanded keys and all affected open document paths/session metadata after a successful subtree move while preserving dirty content and active editor ownership
- feedback: small folder/root inside highlight and drag overlay consistent with the existing neutral tree styling, with reduced-motion-safe transitions

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/workspaceDragInteraction.test.mjs .temp/f041-native-workbench-review/tests/mockDesktopApi.test.mjs .temp/f041-native-workbench-review/tests/workspaceNavigationRefinement.test.mjs .temp/f041-native-workbench-review/tests/demoStore.test.mjs`
- Browser cases: root file/folder into a nested directory; nested file/folder into its parent; nested item laterally into a different branch; nested item outward to Workspace root; moved active clean/dirty document remains open under the new path; same-parent, cross-Workspace, external filesystem, collision, self/descendant, Missing, unsupported, and action-button drags are inert or surface the existing concise error; pointer and keyboard paths; dragged row dimensions remain stable; menu/disclosure clicks still work.

- [x] Add failing API, wiring, and interaction contracts for cross-directory/root dragging and post-move session identity.
- [x] Install dnd-kit and connect the tree to one validated mock move transaction.
- [x] Preserve deterministic sibling order, active documents, action controls, responsive geometry, and accessibility during successful and rejected drops.

## Task 4: Refresh Review Evidence and Deliver B032

**Outcome:** The full interaction revision is reviewable, verified, isolated from production, and recorded in one task commit.
**Files:**
- Modify: `.temp/f041-native-workbench-review/README.md`
- Modify: `.temp/f041-native-workbench-review/CAPABILITY_MATRIX.md`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-light-1440x900.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-dark-1200x850.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-compact-1100x850.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-minimum-850x850.png`
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/bugs/B032-refine-agent-window-chrome-menus-and-workspace-dragging.md`

**Change Map:**
- review guide and matrix: Agent model/evidence flow, window-state review paths, adjacent Workspace menus, dnd-kit file moves, mock/Tauri boundary, and explicit exclusions
- browser evidence: completed response evidence card, model/effort selector, macOS windowed/fullscreen chrome, side-anchored Workspace menu, drag target feedback, themes, and target frames
- workflow: B032 completion evidence, generated index, exact production-path protection, and one separate `fix(B032)` commit after approved implementation is complete

**Verification:**
- `npm test` and `npm run build` in `.temp/f041-native-workbench-review/`
- Browser console, keyboard/focus, Radix dismissal, model/evidence state, window/fullscreen geometry, menu trigger geometry, pointer/keyboard drag behavior, active-document path preservation, themes, and responsive frames.
- `file .temp/f041-native-workbench-review/screenshots/*.png`
- `git diff --exit-code HEAD -- index.html src tests src-tauri`
- `git diff --check`
- Superplan registry, exhaustive plan catalog/related closure, and generated index validation.

- [ ] Refresh the review documentation, capability matrix, and genuine PNG evidence.
- [ ] Run focused and full regression, build, browser, responsive, theme, interaction, and production-isolation checks.
- [ ] Mark B032 done/complete, regenerate the plan index, inspect the final diff, and create `fix(B032): refine agent chrome and workspace dragging`.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-01-mock-desktop-platform-and-workspace-session-demo.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-03-settings-agent-and-editor-tool-experience.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-04-reliability-scenarios-browser-qa-and-review-package.md`
- `docs/superplan/plans/features/F045-refine-review-demo-workspace-actions-and-document-chrome.md`
- `docs/superplan/plans/bugs/B030-fix-transient-menus-settings-and-agent-history.md`
- `docs/superplan/plans/bugs/B031-compact-workspace-agent-menus-and-labels.md`
- `docs/superplan/plans/bugs/B009-keep-f012-drag-targets-active-through-drop.md`
- `docs/superplan/plans/bugs/B010-limit-workspace-drag-to-cross-directory-moves.md`
- `docs/superplan/plans/features/F029-preview-laser-trail-and-fullscreen-toolbar.md`
- `.temp/f041-native-workbench-review/README.md`
- Human-supplied ChatGPT response evidence, model selector, macOS window-control, and Workspace menu screenshots from 2026-08-11
