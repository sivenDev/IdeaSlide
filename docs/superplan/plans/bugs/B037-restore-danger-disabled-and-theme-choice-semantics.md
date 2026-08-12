---
id: "B037"
title: "Restore Danger, Disabled, and Theme-Choice Visual Semantics"
type: "bugfix"
status: "complete"
summary: "Restore clear destructive, disabled, and theme-choice semantics after the Ink Violet theme migration."
source: "docs/superplan/human/bugs.md"
created: "2026-08-12"
order: 37
depends_on: ["B036"]
parent: ""
---

# Restore Danger, Disabled, and Theme-Choice Visual Semantics Plan

**Goal:** Make the three reported states immediately legible again: destructive Workspace actions remain danger-red, an unavailable Settings save action reads as disabled rather than selected, and theme choices rely on their visual previews without redundant decorative icons.
**Scope:** Repair nested Workspace file and directory `Move to Trash` menu items, the disabled `Save changes` button in Settings, and the Light/Dark/System choice labels. Use the B036 Ink Violet Atelier semantic tokens and existing Radix/button structure. Preserve enabled primary Save styling, theme selection and persistence, keyboard focus, accessible names, menu behavior, Workspace operations, and Light/Dark/System layouts.
**Non-Goals:** This repair does not change the theme palette, add theme choices, redesign Settings geometry, change deletion confirmation or filesystem behavior, alter Workspace root/Recent menus already repaired by B036, or replace existing menu/button libraries.
**Architecture:** Treat the bug as three missing semantic mappings in the current component layer. Nested resource deletion adopts the same `is-danger` contract already used by Workspace roots and Recents. Disabled Save receives a complete disabled treatment that overrides primary-action border, focus, and cursor affordances. Theme cards keep the preview as the visual identifier and a plain text label as the accessible, scannable name; Lucide appearance icons are removed because they repeat the preview rather than add state or function.
**Baseline:** B036 established violet for navigation, selection, focus, and primary actions while reserving red for danger. Its final menu rules style only items carrying `is-danger`, but `WorkspaceResourceRow` still uses legacy utility classes. The shared disabled Settings rule overrides color and background but not the primary Save border, so the disabled button retains a violet action outline. `GeneralSettings` renders a miniature theme preview plus Sun, Moon, or Monitor beside each label, creating two competing visual identifiers in each compact card.
**Reproduction:** Open a Workspace containing a nested file and directory and open either row's overflow menu: `Move to Trash` appears like an ordinary action rather than the red root/Recent equivalent. Open Settings without changing any value: disabled `Save changes` retains a prominent violet outline and appears actionable. In Appearance, compare the Light/Dark/System cards: each already depicts its theme but repeats the meaning with a small icon beside the label.
**Root Cause:** The B036 danger regression covered `WorkspaceSidebar` but not the independently rendered `WorkspaceResourceRow`. The final semantic CSS groups disabled Settings controls but does not neutralize the stronger primary-button border declaration applied to `.ideanote-settings-save`. Theme card markup predates the richer visual previews and was not simplified when those previews became the primary differentiator.
**Exit Criteria:** Nested file and directory trash actions use danger-red text and a restrained danger surface in normal, hover, keyboard-focus, and Radix-highlighted states. Disabled Save has no violet emphasis or focus-like ring, uses disabled text/surface/subtle border tokens, and exposes a non-actionable cursor while enabled Save remains the violet primary action. Appearance cards show preview plus plain Light/Dark/System label, retain selected/focus states and accessible names, and do not shift or overflow in Light, Dark, or compact layouts. Focused regressions, the full frontend suite, production build, Rust tests, native startup smoke, workflow validation, diff hygiene, and a separate `fix(B037)` commit pass.

## Task 1: Capture the Three Regressions as Failing Contracts

**Outcome:** Focused tests demonstrate the missing danger class, incomplete disabled-state override, and redundant icon markup before implementation changes.
**Files:**
- Modify: `tests/themeVisualContract.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`
- Modify: `tests/settingsCenter.test.mjs`
- Modify: `tests/settings.test.mjs`

**Change Map:**
- Workspace contract: require nested resource `Move to Trash` to use the shared `is-danger` semantic class
- disabled contract: require disabled Save to neutralize primary border/focus/cursor affordances while leaving enabled Save primary
- theme-choice contract: require preview plus text labels and reject Sun/Moon/Monitor presentation icons

**Verification:**
- `node --test tests/themeVisualContract.test.mjs tests/workspaceExplorerWiring.test.mjs tests/settingsCenter.test.mjs tests/settings.test.mjs`
- Cases: the current source fails each new assertion before repair; existing root/Recent danger coverage and Settings/theme behavior continue to pass.

- [x] Add a focused failing regression for nested file and directory danger semantics.
- [x] Add a focused failing regression for the disabled Save visual contract.
- [x] Add a focused failing regression for preview-led theme cards without redundant icons.

## Task 2: Restore the Intended Visual Semantics

**Outcome:** All three states consume the established semantic theme roles with less visual noise and no behavior changes.
**Files:**
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Modify: `src/components/settings/GeneralSettings.tsx`
- Modify: `src/index.css`
- Modify: focused tests from Task 1

**Change Map:**
- nested resources: replace legacy red utility classes with `is-danger` so the authoritative menu contract owns normal and highlighted states
- disabled Save: explicitly set subtle border, disabled surface/text, no violet shadow or outline, and `not-allowed` cursor for the disabled state
- theme choices: remove Lucide appearance imports and icon rendering, retain semantic button markup, preview, label, `aria-pressed`, and selection behavior
- label layout: simplify spacing/alignment after icon removal without changing card grid geometry

**Verification:**
- `node --test tests/themeVisualContract.test.mjs tests/workspaceExplorerWiring.test.mjs tests/settingsCenter.test.mjs tests/settings.test.mjs tests/reviewedDemoParity.test.mjs`
- Visual cases in Light and Dark: Workspace root/Recent/nested file/nested directory danger actions; normal, hover, keyboard-focus, and highlighted menu states; clean/disabled versus dirty/enabled Save; Light/Dark/System cards selected and unselected; 850x850 compact layout.

- [x] Apply the shared danger class to nested resource trash actions.
- [x] Make disabled Save unmistakably inactive while preserving enabled primary styling.
- [x] Remove redundant theme icons and refine the text-label alignment.

## Task 3: Verify and Deliver the Repair

**Outcome:** B037 closes with regression, visual, native, workflow, and source-control evidence in an isolated commit.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B037-restore-danger-disabled-and-theme-choice-semantics.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- visual review: verify both themes and compact geometry with keyboard and pointer states
- regression: run the stabilized full frontend, production build, Rust suite, and native startup checks
- workflow: record evidence, complete B037/done, refresh the catalog, and stage only B037-related paths

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `cd src-tauri && cargo test`
- `npm run tauri dev`
- Light/Dark review at desktop and 850x850, including menu highlight, Settings clean/dirty state, theme selection, keyboard focus, overflow, and console errors.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run focused checks during implementation and one full stabilized regression after changes stop moving.
- [x] Inspect genuine Light/Dark states for danger, disabled, selected, hover, and focus legibility.
- [x] Mark B037 complete/done and create a separate `fix(B037)` commit containing only this repair.

## Delivery Evidence

- Focused regression first failed on all three shipped conditions: nested `WorkspaceResourceRow` trash used legacy red utility classes instead of `is-danger`; disabled Save lacked a neutral border, no-ring, and inactive-cursor contract; and `GeneralSettings` still rendered Sun, Moon, and Monitor beside previews. The same focused set then passed `23/23` after repair.
- Nested file and directory `Move to Trash` now uses the shared `is-danger` Radix item contract. Existing CSS keeps danger-red text and a restrained danger surface through normal, focus, hover, and `data-highlighted` states, matching Workspace root and Recent removal actions.
- Disabled `Save changes` now resolves to semantic disabled text and surface colors, a subtle neutral border, no shadow or focus outline, and a `not-allowed` cursor. The enabled dirty-state Save remains the violet primary action and receives the normal focus-visible ring.
- Light, Dark, and System cards now use their miniature workbench previews as the sole visual identifiers with plain labels below. Lucide appearance icons and their unused spacing were removed while `aria-pressed`, accessible button names, selection, theme resolution, and draft persistence remain unchanged.
- Browser inspection verified genuine Dark and Light Settings states plus the effective 850x850 compact layout. The disabled Dark Save computed to neutral background/border/text, no shadow, and `not-allowed`; changing to Light enabled the violet Save; theme labels were exactly Light/Dark/System with zero label SVGs; there was no horizontal overflow and no console warning or error. Browser-only mode cannot load Tauri Workspace fixtures, so nested danger rendering is covered by the shared semantic selector and source regression.
- Full frontend regression passed: `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`.
- Production build passed: `npm run build`; only the existing Excalidraw mixed-import and large-chunk warnings were reported.
- Rust regression passed `156/156`: `cd src-tauri && cargo test`; only existing dead-code warnings were reported.
- Native startup smoke passed after terminating the task-owned visual-review Vite process that initially occupied port 1420: `npm run tauri dev` compiled and launched `target/debug/idea-slide` before controlled shutdown.
- Workflow and source hygiene passed registry/index validation and `git diff --check`; deletion behavior, Settings persistence, theme palette values, layout geometry, and editor behavior remain unchanged.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/bugs/B036-unify-light-and-dark-theme-palette.md`
- Human-supplied Workspace and Settings screenshots from `2026-08-12`
- `src/components/WorkspaceResourceRow.tsx`
- `src/components/SettingsCenter.tsx`
- `src/components/settings/GeneralSettings.tsx`
- `src/index.css`
- `tests/themeVisualContract.test.mjs`
