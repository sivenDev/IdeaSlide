---
id: "F044-04"
title: "Add Reliability Scenarios and Package the Complete Review Demo"
type: "feature"
status: "draft"
summary: "Expose deterministic reliability and failure scenarios, complete responsive interaction QA, and package the full mocked desktop experience for human review."
source: "docs/superplan/human/features.md"
created: "2026-08-11"
order: 54
depends_on: ["F044-03"]
parent: "F044"
---

# Add Reliability Scenarios and Package the Complete Review Demo Plan

**Goal:** Make every important normal, protected, degraded, and failure state directly reviewable before any production migration decision.
**Scope:** Complete only the isolated F044 demo. Add a clearly labeled prototype-only `Review Scenarios` Settings section backed by deterministic scenario fixtures, not hidden query parameters or developer-only controls. Scenarios must cover normal Workspace and standalone flows plus read-only Workspace, save failure, Workspace-state failure after document success, external modification of clean and dirty documents, file rename/move/delete, missing Workspace root, Recovery available/corrupt, unsupported file, mixed Markdown line endings, recent target missing, AI disabled, Provider configuration required, Codex healthy, Compatibility fallback, Agent retry/cancellation/terminal failure, context warning/New Thread recommendation, invalid custom Skill, and stale/read-only/conflict editor Tool rejection. Complete unsaved/recovery/external-change/missing/status UI, resizable Workspace/IdeaSketch Navigator/Agent boundaries, keyboard commands, command palette, mock application exit decisions, responsive defaults, accessibility, review screenshots, capability matrix, and run/reset instructions. Leave the browser preview running on the default Welcome state for the human.
**Non-Goals:** This plan does not claim reliability against real files, OS permissions, processes, credentials, native fullscreen, system Trash, or network providers; modify production code; add future IdeaTable/IdeaWorkflow/Import-Export/Cloud/Collaboration features; hide mock labels; turn the scenario selector into production UI; or approve migration. Production migration remains a new feature after explicit human review.
**Architecture:** `ReviewScenarioRegistry` composes fixture overlays and failure policies into the same `MockDesktopApi`, settings, and Agent contracts used by normal interaction; components never branch directly on scenario names. Reset restores a deterministic seed and clears namespaced review storage. Scenario selection lives inside Settings to avoid a permanent developer toolbar and is visually subordinate to real product controls. Shell and editor resizing use bounded pointer/keyboard dividers with stored mock preferences. Keyboard routing is capture-aware so presentation/editor shortcuts do not leak into shell commands. Accessibility verification covers names, disclosure, dialog focus/return, status announcements, menu navigation, keyboard dragging alternatives where present, reduced motion, and contrast. Review evidence maps every capability to an interaction path and identifies what is real frontend behavior versus mocked platform behavior.
**Baseline:** F044-01 through F044-03 provide the complete shell, mock platform, workspace/document lifecycle, two real editor surfaces, Settings, Agent, and editor Tool transactions. Reliability states exist as API/session concepts but are not yet uniformly selectable or packaged for review. F043 currently documents only the outer-shell prototype and four representative screenshots.
**Exit Criteria:** A reviewer can select or reset every named scenario without reloading or editing source, and each scenario exercises the same product UI used by normal operation. Recovery offers Restore/Discard; external change offers safe actions; dirty conflicts never silently overwrite; missing/read-only/unsupported/recent errors provide concrete next steps; document-save success remains success when only Workspace-state persistence fails; mock exit uses Save/Discard/Cancel; Agent/Tool failures are bounded and actionable. Workspace, editor navigator, and Agent resizing/collapse remain independent and overflow-free at 1440x900, 1200x850, 1100x850, and 850x850. All visible copy is English; console is clean; IDs/names/focus are valid; reduced motion works; real PNG evidence and a complete README/capability matrix are current. Full demo tests and build pass, production paths are unchanged, each F044 plan has a separate commit, and F044 is marked done only after all plans complete. The live browser ends on default Light Welcome for human review.

## Task 1: Add Prototype-only Review Scenario Infrastructure

**Outcome:** Normal and failure states can be reproduced deterministically through the product UI without contaminating component logic.
**Files:**
- Create: `.temp/f041-native-workbench-review/src/scenarios/reviewScenarioRegistry.js`
- Create: `.temp/f041-native-workbench-review/src/components/settings/ReviewScenariosSettings.jsx`
- Modify: `.temp/f041-native-workbench-review/src/mock/fixtures.js`
- Modify: `.temp/f041-native-workbench-review/src/mock/mockDesktopApi.js`
- Modify: `.temp/f041-native-workbench-review/src/mock/mockAgentRuntime.js`
- Modify: `.temp/f041-native-workbench-review/src/lib/settingsRegistry.js`
- Test: `.temp/f041-native-workbench-review/tests/reviewScenarios.test.mjs`

**Change Map:**
- scenario registry: fixture overlays, failure policies, deterministic reset, and storage cleanup
- Settings contribution: grouped normal/filesystem/recovery/Agent scenarios with concise impact descriptions
- platform/Agent mocks: scenario-neutral policy hooks instead of component branches
- labeling: persistent but quiet indication that backend results are simulated

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/reviewScenarios.test.mjs`
- Cases: every scenario resolves; reset is idempotent; normal flow restored; no scenario name reaches product components; failures affect only their declared contract.

- [ ] Implement the registry, complete scenario catalog, and deterministic reset.
- [ ] Surface scenarios inside Settings without adding a permanent demo toolbar.
- [ ] Keep mock/failure policy below component and editor boundaries.

## Task 2: Complete Recovery, External-change, Missing, and Exit UX

**Outcome:** The full protected-document lifecycle can be reviewed through concrete decisions rather than static notices.
**Files:**
- Create: `.temp/f041-native-workbench-review/src/components/dialogs/RecoveryPrompt.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/notices/ExternalChangeNotice.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/notices/DocumentProblemNotice.jsx`
- Modify: `.temp/f041-native-workbench-review/src/components/dialogs/UnsavedChangesDialog.jsx`
- Modify: `.temp/f041-native-workbench-review/src/components/editor/EditorHost.jsx`
- Modify: `.temp/f041-native-workbench-review/src/components/workspace/WorkspacePanel.jsx`
- Modify: `.temp/f041-native-workbench-review/src/app/DemoApp.jsx`
- Test: `.temp/f041-native-workbench-review/tests/reliabilityInteractions.test.mjs`

**Change Map:**
- recovery: available/corrupt records, Restore/Discard, preserved source, and post-restore dirty state
- external changes: clean reload, dirty conflict, Save As/Cancel, move/rename/delete, and watcher notices
- failures: read-only, missing root/file, unsupported, recent missing, save failure, and metadata-only failure
- exit/switch: Save/Discard/Cancel and protected-session retention

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/reliabilityInteractions.test.mjs`
- Browser cases: each scenario action; no silent overwrite; successful document save with metadata warning; selection rollback; focus return; explicit recovery next steps.

- [ ] Deliver every protected and failure-state decision path.
- [ ] Verify no scenario can silently discard or overwrite a dirty mock document.
- [ ] Keep shell status concise and editor-specific explanations inside Editor Host.

## Task 3: Finish Resizing, Keyboard, Command, and Responsive Behavior

**Outcome:** The full-function demo remains desktop-coherent across target window sizes and input methods.
**Files:**
- Create: `.temp/f041-native-workbench-review/src/components/layout/ResizableDivider.jsx`
- Create: `.temp/f041-native-workbench-review/src/components/commands/CommandPalette.jsx`
- Modify: `.temp/f041-native-workbench-review/src/app/DemoApp.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Test: `.temp/f041-native-workbench-review/tests/layoutCommands.test.mjs`

**Change Map:**
- resizing: bounded Workspace, IdeaSketch Navigator, split Markdown, and Agent widths with pointer and keyboard controls
- shell commands: Command/Ctrl+K, Command/Ctrl+,, save, save as, undo/redo routing, presentation capture, Escape priority, and panel toggles
- responsive states: desktop, compact, and minimum defaults without forced reopening or page overflow
- focus/motion: visible focus, focus return, reduced motion, and no shortcut collision with Excalidraw/CodeMirror

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/layoutCommands.test.mjs`
- Browser inspection at 1440x900, 1200x850, 1100x850, and 850x850 with Workspace/Agent/editor navigator open and closed combinations.
- Cases: keyboard divider; palette actions; shortcut priority; presentation capture; modal Escape order; zero page overflow.

- [ ] Implement bounded independent resizing and complete command routing.
- [ ] Prove every target viewport and panel combination remains usable.
- [ ] Preserve context-gated Agent controls and editor-owned internal navigation.

## Task 4: Package the Complete Demo for Human Review

**Outcome:** The user can run, inspect, reset, and critique the complete mocked Tauri frontend with traceable evidence.
**Files:**
- Modify: `.temp/f041-native-workbench-review/README.md`
- Create: `.temp/f041-native-workbench-review/CAPABILITY_MATRIX.md`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-light-1440x900.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-dark-1200x850.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-compact-1100x850.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-minimum-850x850.png`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-04-reliability-scenarios-browser-qa-and-review-package.md`

**Change Map:**
- README: run/reset, mock boundaries, default walkthrough, scenario walkthroughs, and explicit migration gate
- capability matrix: current production frontend capability, demo interaction path, mocked backend contract, and evidence status
- evidence: representative Welcome, editor, Settings/Agent, compact/minimum, protected, and failure states
- workflow: complete all F044 plans, exact plan commits, human request lifecycle, and generated index

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/*.test.mjs`
- `./node_modules/.bin/vite build --config .temp/f041-native-workbench-review/vite.config.js`
- Browser console, accessibility, interaction, responsive, and screenshot inspection.
- `file .temp/f041-native-workbench-review/screenshots/*.png`
- `git diff --exit-code HEAD -- index.html src tests src-tauri`
- `git diff --check`
- Superplan registry/index validation.

- [ ] Complete the capability matrix and refreshed real-PNG review evidence.
- [ ] Run the full demo verification matrix and leave the live default Welcome open.
- [ ] Complete F044 only after all four plans and separate commits are delivered.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-01-mock-desktop-platform-and-workspace-session-demo.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-02-ideasketch-and-markdown-editor-experiences.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-03-settings-agent-and-editor-tool-experience.md`
- `.temp/f041-native-workbench-review/README.md`
- `src/components/RecoveryPrompt.tsx`
- `src/components/ExternalChangeNotice.tsx`
- `src/components/UnsavedChangesDialog.tsx`
- `src/components/ResizableDivider.tsx`
- `src/components/WorkspaceStatusNotice.tsx`
