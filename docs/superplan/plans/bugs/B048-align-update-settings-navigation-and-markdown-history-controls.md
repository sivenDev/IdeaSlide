---
id: "B048"
title: "Align Update, Settings Navigation, and Markdown History Controls"
type: "bugfix"
status: "complete"
summary: "Use the primary violet update action, flatten Application settings items, and move Markdown history controls into the top toolbar."
source: "docs/superplan/human/bugs.md"
created: "2026-08-13"
order: 48
depends_on: ["F048", "F056", "F057", "F046-02"]
parent: ""
---

# Align Update, Settings Navigation, and Markdown History Controls Plan

**Goal:** Restore visual and spatial consistency across the Workspace update affordance, Settings navigation, and Markdown editor toolbar.
**Scope:** Style the dismissed-update action beside Settings as a compact violet primary button; render General and About directly at the top of the Settings navigation without an Application heading while retaining AI and Editors group headings; move Markdown Undo and Redo immediately after Edit, Split, and Preview in the top toolbar. Preserve existing update lifecycle actions, Settings registry ownership, CodeMirror history behavior, disabled states, accessibility, themes, and responsive layout.
**Non-Goals:** This fix does not change updater discovery/download/install behavior, Settings section registration or persistence, AI/Editors grouping, Markdown history semantics, keyboard shortcuts, editor mounting, preview behavior, or other Workspace/editor chrome.
**Architecture:** Keep the three existing ownership boundaries intact: `WorkspaceSidebar` continues projecting updater state, `SettingsCenter` continues consuming the registry, and `MarkdownEditor` continues delegating history to the mounted CodeMirror view. Adjust only composition and semantic-token styling, using `var(--accent-primary)` and `var(--accent-contrast)` for the compact update action rather than adding a new color system.
**Baseline:** On clean `master` at `54ab605`, the compact update action is explicitly styled and tested as a transparent secondary button; `SettingsDialog` unconditionally renders labels for Application, AI, and Editors; and Markdown history is an absolutely positioned floating container at the source editor's lower-left edge. Existing focused source contracts encode all three current behaviors.
**Reproduction:** Dismiss an available-update card and observe the neutral outlined Update action beside Settings; open Settings and observe the redundant Application label above General and About; open a Markdown file in Edit or Split and observe Undo/Redo floating at the source pane's lower-left instead of beside the view-mode control.
**Root Cause:** Earlier feature contracts intentionally established a neutral compact updater action, three uniformly labeled Settings groups, and lower-left Markdown history. The present UX direction supersedes those composition choices, but the component markup, CSS, and focused regression assertions still enforce them.
**Exit Criteria:** The compact update action uses the shared violet primary fill and contrasting foreground in Light and Dark, including coherent hover/focus/disabled states. General and About are the first two Settings navigation items with no Application label, while AI and Editors retain their labels and registry-defined section order. Markdown Undo/Redo appear directly to the right of the Edit/Split/Preview group, disappear in Preview as today, and retain CodeMirror-backed enabled/disabled behavior and accessible labels. Focused UI contracts, the stabilized frontend suite, production build, visual inspection at normal and compact widths in Light/Dark, workflow validation, diff hygiene, and a separate `fix(B048)` commit pass.

## Task 1: Correct the Three UI Composition Contracts

**Outcome:** The affected controls match the requested hierarchy and primary-action treatment without changing their underlying behavior.
**Files:**
- Modify: `src/components/SettingsCenter.tsx`
- Modify: `src/components/MarkdownEditor.tsx`
- Modify: `src/index.css`
- Modify: `tests/appUpdateUi.test.mjs`
- Modify: `tests/settingsCenter.test.mjs`
- Modify: `tests/markdownEditorRefinement.test.mjs`

**Change Map:**
- compact update action: replace the neutral outline contract with the existing violet primary/contrast tokens and retain visible hover, focus, progress-disabled, and compact-width behavior
- Settings hierarchy: render Application sections as an unlabelled top-level block followed by the labelled AI and Editors groups, without moving section definitions out of the registry
- Markdown history: place the existing Undo/Redo `ToolbarButton`s immediately after the view-mode group, keep them hidden in Preview, and remove obsolete lower-left floating geometry
- regression contracts: update focused assertions to require violet semantics, the absence of the Application group label, preserved AI/Editors labels, and top-toolbar history ordering

**Verification:**
- `node --test tests/appUpdateUi.test.mjs tests/settingsCenter.test.mjs tests/markdownEditorRefinement.test.mjs tests/markdownEditorContract.test.mjs tests/themeVisualContract.test.mjs`
- Browser/Tauri visual inspection in Light and Dark at normal and compact Workspace widths and at the effective 850x850 minimum: dismissed update action, all Settings sections, Markdown Edit/Split/Preview, Undo/Redo enabled and disabled, keyboard focus, and no overflow.

- [x] Add focused regressions that fail against the current neutral update, labelled Application group, and lower-left history layout.
- [x] Apply the smallest composition and semantic-token changes in the existing component boundaries.
- [x] Verify behavior, accessibility, theme, and compact-layout acceptance for all three surfaces.

## Task 2: Verify and Deliver B048

**Outcome:** B048 closes with current regression, build, visual, workflow, and source-control evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B048-align-update-settings-navigation-and-markdown-history-controls.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- final regression: run the complete frontend suite after implementation stabilizes and build the production frontend
- delivery evidence: record focused/full checks and visual observations for Light/Dark plus compact geometry
- workflow: mark B048 complete/done only after verification, regenerate the plan index, inspect the exact diff, and create one isolated task commit

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run focused checks during implementation and one stabilized full frontend/build regression.
- [x] Record visual acceptance for the three requested surfaces in Light/Dark and compact geometry.
- [x] Mark B048 complete/done and create a separate `fix(B048)` commit containing only this task.

## Delivery Evidence

- The focused regressions first failed on all three shipped behaviors: `tests/appUpdateUi.test.mjs` found the neutral outlined compact Update action, `tests/settingsCenter.test.mjs` found the unconditional Application group, and `tests/markdownEditorRefinement.test.mjs` found absolute lower-left history geometry.
- The compact Update action now uses `var(--accent-primary)`, `var(--accent-primary-hover)`, and `var(--accent-contrast)`, with semantic disabled colors and unchanged updater action/focus behavior.
- Settings keeps its registry metadata and order, but renders Application sections through one unlabelled top-level block; General and About appear first, followed by the labelled AI and Editors groups.
- Markdown Undo/Redo remain CodeMirror-backed and appear immediately after Edit/Split/Preview. At 850x850 and 1200x850, the history group sits 8px after the view modes with no toolbar or editor horizontal overflow in Light or Dark. Typing enabled Undo, Undo enabled Redo, and Preview removed the history group as intended.
- Focused verification passed 24/24: `node --test tests/appUpdateUi.test.mjs tests/settingsCenter.test.mjs tests/markdownEditorRefinement.test.mjs tests/markdownEditorContract.test.mjs tests/themeVisualContract.test.mjs`.
- The stabilized full frontend suite passed: `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`.
- `npm run build` passed; only the existing Vite mixed-import and large-chunk advisories were reported.
- Browser visual inspection covered Settings and Markdown in Light/Dark at 850x850 plus 1200x850, with no console warnings or errors. The browser build has no real native updater result, so the compact Update state was verified through its focused semantic-theme contract rather than by fabricating updater state.

## References
- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F048-refine-settings-navigation-and-auto-apply.md`
- `docs/superplan/plans/features/F056-automatic-desktop-updates-from-github-releases.md`
- `docs/superplan/plans/features/F057-add-an-about-page-to-settings.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-02-settings-themes-and-markdown.md`
- Human-supplied update-button and Settings screenshots from `2026-08-13`
- `src/components/WorkspaceSidebar.tsx`
- `src/components/SettingsCenter.tsx`
- `src/components/MarkdownEditor.tsx`
- `src/index.css`
