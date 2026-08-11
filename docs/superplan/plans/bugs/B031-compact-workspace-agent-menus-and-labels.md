---
id: "B031"
title: "Compact Workspace and Agent Menus and Remove Redundant Labels"
type: "bugfix"
status: "complete"
summary: "Remove the invalid Workspace read-only state and make transient menus and Settings titles compact, adjacent, and non-redundant."
source: "docs/superplan/human/bugs.md"
created: "2026-08-11"
order: 31
depends_on: ["B030"]
parent: ""
---

# Compact Workspace and Agent Menus and Remove Redundant Labels Plan

**Goal:** Make Workspace and Agent actions feel attached to the object that opened them, while removing invalid state and repeated navigation copy from the review demo.
**Scope:** Refine only `.temp/f041-native-workbench-review/`. Remove Workspace-level read-only state from fixtures, navigation, mock mutations, and review scenarios while retaining document-scoped read-only behavior. Make Radix action menus size from their action labels instead of a shared fixed width, remove decorative object-name menu headings, and keep each menu adjacent to its trigger. Remove the Agent history `Conversations`/count header, compact the history surface, and top-align each Rename/Delete menu with its row trigger. Remove Settings kickers so the left navigation owns categorization and each content page renders one clear title. Preserve the existing native Paper/Graphite/Cobalt visual system, Radix dismissal/focus behavior, and the mock-only review boundary.
**Non-Goals:** This bugfix does not migrate prototype code into production `index.html`, `src/`, `tests/`, `src-tauri/`, or Tauri capabilities; remove document-level read-only/recovery testing; change Workspace action sets or destructive confirmations; change conversation persistence, selection, rename, or deletion semantics; redesign editor-owned surfaces; change Provider testing, Agent runtime behavior, themes, or responsive panel widths; or approve production migration.
**Architecture:** Treat writable Workspace roots as a demo invariant at the mock platform boundary: Workspace fixtures and APIs no longer carry or branch on `workspace.readOnly`, while a file/session may still be read-only. Keep Radix Dropdown Menu and Popover as the interaction owners. Simplify `AppMenu` to render actions only, accept compact presentation and anchor offsets without reintroducing manual coordinates, and use content-driven min/max inline sizing. Workspace menus remain bottom-end anchored. Conversation row menus use a compact variant and right/start anchoring so their top edge follows the three-dot trigger; Radix collision handling remains enabled for narrow windows. The history Popover contains only the selectable records. Settings navigation retains Application/AI/Editors/Review grouping, while every content section drops its duplicated kicker and keeps one `h2` title. The design signature is a **tight action hinge**: a small surface opens directly from the row control, with no detached heading or unused width.
**Baseline:** B030 introduced accessible Radix primitives but `.app-menu` is globally fixed at `218px`, `AppMenu` optionally renders an object-name label, the conversation Popover is fixed at `300px` with a 37px `Conversations` header, and conversation row menus use `side="right"` with `align="end"`. The default `Operations Hub` fixture and its file are read-only, Workspace navigation renders a `Read-only` badge and disables creation, mock file operations branch on `workspace.readOnly`, and the read-only review scenario mutates the Workspace root. Every Settings section renders both a `.settings-kicker` and an `h2`, including exact repeats such as `Agent`/`Agent` and `Skills`/`Skills`.
**Reproduction:** At the 850x850 review frame, open `Operations Hub` overflow: the root shows `Read-only`, its `+` action is disabled, and the menu measures 218px wide with an `Operations Hub` heading, forcing the surface to begin near the Workspace panel's left edge. Open a standalone file, show Agent, open conversation history, then open a row overflow: the Popover measures 300px wide, includes `Conversations` and a count, and the 218px action menu begins 47px above its three-dot trigger because right-side/end alignment matches bottom edges. Open Settings → AI Provider: left navigation says `AI Provider`, content repeats `AI Provider`, then renders `Provider`; Agent and Skills repeat the same word as kicker and title.
**Root Cause:** The B030 shared primitive mixed interaction behavior with one fixed presentation size and optional contextual heading, so every menu inherited Workspace-scale width and redundant copy. Conversation row alignment used `end` on a right-side surface, which aligns the menu's bottom with the small trigger and creates deterministic upward drift. Workspace writability was modeled as a root attribute for reliability demonstrations instead of remaining a document/session concern, so a test fixture leaked an invalid product state into the default navigation. Settings sections retained legacy kicker/title pairs after grouping moved into the left navigation, leaving two owners for the same hierarchy.
**Exit Criteria:** No Workspace root exposes a read-only badge or disables creation because of Workspace state; `Operations Hub` is editable; mock Workspace creation, rename, move, Trash, and open behavior do not branch on `workspace.readOnly`; and the read-only scenario marks only the active document/session. Workspace overflow and creation menus contain actions only, have content-driven width below the previous 218px default where labels permit, and open directly below/end-aligned to their row triggers without clipping. Conversation history has no `Conversations` header or count; its Rename/Delete menu is compact, appears beside the selected three-dot control with its top edge aligned to that row, and still dismisses/restores focus through Radix. Settings pages contain no `.settings-kicker` and expose one content title each. Light, Dark, System, 1440x900, 1200x850, 1100x850, and 850x850, keyboard focus, outside/Escape dismissal, clean console, full demo tests/build, refreshed screenshots, and production-isolation checks pass.

## Task 1: Make Workspace Writability a Root Invariant

**Outcome:** Every added Workspace is editable while document-scoped read-only review behavior remains available.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/mock/fixtures.js`
- Modify: `.temp/f041-native-workbench-review/src/mock/mockDesktopApi.js`
- Modify: `.temp/f041-native-workbench-review/src/scenarios/reviewScenarioRegistry.js`
- Modify: `.temp/f041-native-workbench-review/src/components/workspace/WorkspacePanel.jsx`
- Modify: `.temp/f041-native-workbench-review/tests/mockDesktopApi.test.mjs`
- Modify: `.temp/f041-native-workbench-review/tests/reviewScenarios.test.mjs`
- Modify: `.temp/f041-native-workbench-review/tests/workspaceNavigationRefinement.test.mjs`

**Change Map:**
- Workspace fixtures: remove root/file read-only defaults from Operations Hub and replace read-only-specific sample copy
- mock platform: remove root read-only propagation and mutation guards; retain file/document `readOnly` enforcement in the document save path
- review scenarios: make `read-only` patch the active document/session only
- Workspace navigation: remove the root badge and read-only creation disable branch while preserving Missing behavior

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/mockDesktopApi.test.mjs .temp/f041-native-workbench-review/tests/reviewScenarios.test.mjs .temp/f041-native-workbench-review/tests/workspaceNavigationRefinement.test.mjs`
- Browser: default Operations Hub has no read-only label, its `+` menu opens, a nested entry can be created/renamed, and the read-only review scenario still blocks document editing and saving without changing the Workspace root.

- [x] Add focused contracts proving Workspace roots are writable and the read-only scenario is document-scoped.
- [x] Remove Workspace-level read-only data and branches at the fixture, API, scenario, and navigation boundaries.
- [x] Preserve document-level read-only notices, Save As, Agent mutation gating, and recovery behavior.

## Task 2: Turn Menus into Compact Trigger-Anchored Action Surfaces

**Outcome:** Workspace and conversation actions open as small, adjacent menus with no decorative headings or vertical drift.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/components/primitives/AppMenu.jsx`
- Modify: `.temp/f041-native-workbench-review/src/components/workspace/WorkspacePanel.jsx`
- Modify: `.temp/f041-native-workbench-review/src/components/agent/AgentPanel.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Modify: `.temp/f041-native-workbench-review/tests/transientOverlayRegression.test.mjs`
- Modify: `.temp/f041-native-workbench-review/tests/agentPanelRefinement.test.mjs`
- Create: `.temp/f041-native-workbench-review/tests/compactMenuGeometry.test.mjs`

**Change Map:**
- shared menu primitive: remove contextual labels, add optional presentation class and anchor offsets, and keep Radix collision/focus lifecycle
- Workspace menus: action-only bottom/end surfaces with natural sizing and no target-name row
- history Popover: remove header/count and reduce unused width/padding without changing record selection
- conversation row menu: compact Rename/Delete surface with right/start alignment and bounded collision fallback
- menu tokens: content-driven inline size, narrower compact variant, consistent icon/text grid, and restrained shadow/radius

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/transientOverlayRegression.test.mjs .temp/f041-native-workbench-review/tests/agentPanelRefinement.test.mjs .temp/f041-native-workbench-review/tests/compactMenuGeometry.test.mjs`
- Browser measurements: Workspace menus are narrower than the previous 218px surface and remain adjacent to `+`/overflow triggers; conversation menu top differs from its row trigger by no more than 4px when opened on the right; collision fallback remains fully visible at 850px; no action menu contains a decorative title; outside click, focus transfer, Escape, keyboard navigation, item selection, and trigger focus restoration still pass.

- [x] Capture the fixed-width, redundant-label, and right/end vertical-drift regressions before changing styles.
- [x] Simplify the shared primitive and apply object-appropriate compact menu variants.
- [x] Remove the history header and verify precise anchoring across target frames and themes.

## Task 3: Give Every Settings Page One Content Title

**Outcome:** Settings hierarchy is expressed once, with grouping in navigation and one page title in content.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/components/settings/SettingsCenter.jsx`
- Modify: `.temp/f041-native-workbench-review/src/components/settings/ReviewScenariosSettings.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Modify: `.temp/f041-native-workbench-review/tests/settingsExperience.test.mjs`

**Change Map:**
- Settings sections: remove every `.settings-kicker` and keep one concise `h2` per page
- navigation: preserve Application/AI/Editors/Review groups and current selection behavior
- spacing: reclaim kicker space so titles and first controls align consistently without adding explanatory copy

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/settingsExperience.test.mjs`
- Browser: General, AI Provider, Agent, Skills, IdeaSketch, and Review Scenarios each show one content title; Provider test/model gating and all existing controls remain unchanged.

- [x] Add a contract rejecting Settings kicker/title duplication.
- [x] Remove redundant content navigation labels and normalize page-title spacing.
- [x] Recheck every Settings section in Light, Dark, and System themes.

## Task 4: Refresh Review Evidence and Deliver B031

**Outcome:** The compact interaction revision is reviewable, fully verified, isolated from production, and recorded in one task commit.
**Files:**
- Modify: `.temp/f041-native-workbench-review/README.md`
- Modify: `.temp/f041-native-workbench-review/CAPABILITY_MATRIX.md`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-light-1440x900.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-dark-1200x850.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-compact-1100x850.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-minimum-850x850.png`
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/bugs/B031-compact-workspace-agent-menus-and-labels.md`

**Change Map:**
- review guide and matrix: writable Workspace invariant, compact action-only menus, headerless conversation history, and single-title Settings hierarchy
- browser evidence: representative Workspace menu, Agent history/row menu, Settings title, themes, and target frames
- workflow: B031 completion evidence, generated index, production path protection, and one separate `fix(B031)` commit

**Verification:**
- `npm test` and `npm run build` in `.temp/f041-native-workbench-review/`
- Browser console, keyboard/focus behavior, Radix dismissal, trigger/menu geometry, collision containment, every Settings section, read-only document scenario, themes, and responsive target frames.
- `file .temp/f041-native-workbench-review/screenshots/*.png`
- `git diff --exit-code HEAD -- index.html src tests src-tauri`
- `git diff --check`
- Superplan registry and generated plan index validation.

- [x] Refresh review documentation and genuine PNG evidence with the compact surfaces.
- [x] Run focused and full regression, build, browser, responsive, theme, and production-isolation checks.
- [x] Mark B031 done and create `fix(B031): compact menus and remove redundant labels` after approved delivery is complete.

## Completion Evidence

- Focused failing regressions reproduced all four baseline defects before implementation: Workspace root read-only state, fixed 218px menu width and decorative labels, conversation header/right-end drift, and Settings kickers.
- `npm test` in `.temp/f041-native-workbench-review/`: 43/43 tests passed, including the new writable-Workspace, document-scoped read-only, compact geometry, action-only menu, Agent history, and single-title Settings contracts.
- `npm run build` in `.temp/f041-native-workbench-review/`: Vite production build passed; the existing large-chunk advisory remains informational.
- Fresh browser geometry: Workspace overflow reduced from 218px to 171px and its create menu to 148px, both right-aligned to their row trigger; conversation Rename/Delete reduced to 128px with a 0-0.5px top offset from its row trigger.
- Responsive containment: conversation Popover shifts left to reserve the row-action lane; its menu stayed fully inside 1200x850, 1100x850, and 850x850 frames with zero shell horizontal overflow, while the composer remained bottom-aligned.
- Browser behavior: Operations Hub had no read-only badge and its create action was enabled; the read-only scenario showed the document notice and Save As without changing Workspace writability; Workspace and Agent menus closed on outside interaction/Escape and restored focus; browser console reported no errors or warnings.
- Settings browser matrix: General, AI Provider, Agent, Skills, IdeaSketch, and Review Scenarios each rendered exactly one content `h2` and zero `.settings-kicker` elements; Provider Test/Model behavior remained intact.
- Review evidence: refreshed Light, Dark, compact Settings, and minimum Agent screenshots are genuine PNG files at 1440x900, 1200x850, 1100x850, and 850x850 and were visually inspected.
- Isolation and hygiene: `git diff --exit-code HEAD -- index.html src tests src-tauri` and `git diff --check` passed.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/bugs/B030-fix-transient-menus-settings-and-agent-history.md`
- `docs/superplan/plans/features/F045-refine-review-demo-workspace-actions-and-document-chrome.md`
- `.temp/f041-native-workbench-review/README.md`
- Human-supplied Workspace, Kition menu, Agent history, and Settings screenshots from 2026-08-11
