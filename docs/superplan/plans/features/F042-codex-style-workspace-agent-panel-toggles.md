---
id: "F042"
title: "Use Codex-style Workspace and Agent Panel Toggles in the Review Prototype"
type: "feature"
status: "complete"
summary: "Make both outer review-prototype panels fully close and restore from persistent top-chrome controls modeled on the Codex client interaction."
source: "docs/superplan/human/features.md"
created: "2026-08-10"
order: 49
depends_on: ["F041"]
parent: ""
---

# Use Codex-style Workspace and Agent Panel Toggles in the Review Prototype Plan

**Goal:** Make the isolated shell prototype reclaim editor space with the same clear, low-friction panel-toggle model shown in the Codex client reference.
**Scope:** Refine only `.temp/f041-native-workbench-review/`. Remove the seam-mounted Workspace and Agent controls and the persistent 48px collapsed rails. Give each outer panel one always-available top-chrome toggle: while a panel is open, its control reads as part of that panel's crown; when the panel closes completely, the same logical control remains in the adjacent Editor Host crown so the panel can be restored. Keep macOS traffic lights grouped with the left toggle, allow Workspace and Agent to close and restore independently, return all released width to the generic Editor Host, and preserve Light, Dark, System, command palette, file identity, Agent attachment, keyboard focus, reduced motion, and responsive defaults. Update the review screenshots and README after interaction QA.
**Non-Goals:** This feature does not migrate any prototype code into production `src/`, modify Tauri or Rust code, redesign Workspace content or Agent thread/composer content, create any table, IdeaSketch, Markdown, Workflow, or other editor-owned UI, add panel resizing or persistence, copy ChatGPT/Codex branding or assets, reintroduce a global title bar, or change F039-F041 historical evidence.
**Architecture:** Keep the F041 Vite prototype and neutral Open Frame token system. Replace the two layout seam buttons and both rail contents with two persistent shell-level toggle controls layered into the 44px local top chrome. The left control cluster contains the existing macOS traffic lights and a `PanelLeft` control, matching the supplied Codex reference without turning the cluster into a full-width application toolbar. The right `PanelRight` control mirrors that behavior at the outer edge. Open Workspace and Agent widths remain 252px and 352px; closed width becomes 0px, so CSS grid gives the entire released width to the Editor Host. State remains independent in `data-workspace` and `data-agent`, with a shared toggle helper updating pressed state, labels, tooltip copy, and layout. Responsive buckets may choose initial open/closed states only when the bucket changes and must not prevent later manual restoration. The distinctive design move is a **migrating crown control**: the button stays visually stationary in the window chrome while ownership beneath it changes from outer panel to Editor Host, making collapse feel native without preserving a decorative rail.
**Baseline:** F041 currently uses 13px chevron buttons centered on the seams between regions. A closed panel still occupies a 48px rail with Workspace or Agent branding/actions, so the center never receives the panel's full width. The supplied Codex screenshot instead highlights a recognizable panel icon beside the macOS window controls in the top chrome. Computer Use resolves the locally running app as display name `ChatGPT` with bundle id `com.openai.codex`, but safety policy blocks automated inspection of that app; the human-provided screenshot is therefore the authoritative interaction reference.
**Exit Criteria:** The prototype has no seam collapse buttons and no Workspace or Agent collapsed rail. Closing Workspace changes its region to 0px and expands the Editor Host by the full released width; the left traffic-light/toggle cluster remains visible and restores Workspace. Closing Agent behaves symmetrically from an always-visible right top-chrome toggle. Either panel can be toggled without changing the other panel, active file, attached Agent document, theme, or editor ownership boundary. Toggle buttons use panel icons, visible hover/focus/pressed states, truthful English labels/tooltips, and stable positions without overlapping document identity or Agent actions. Desktop, compact, and minimum widths retain coherent default states and allow both panels to be reopened without page-level horizontal overflow. Light, Dark, and System remain legible, reduced motion is respected, browser console is clean, the README describes the Codex-style behavior, updated screenshots show representative open and closed states, and production files remain unchanged.

## Task 1: Replace Rails and Seams with Persistent Crown Toggles

**Outcome:** Workspace and Agent fully release their width while each remains immediately restorable from the top chrome.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/main.js`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`

**Change Map:**
- shell composition: remove both seam buttons and rail markup; add one persistent left window-control cluster and one persistent right panel control
- panel state: centralize independent toggle state, ARIA pressed/labels, tooltip text, and responsive-bucket defaults
- layout: change closed outer columns from 48px to 0px and reserve collision-free crown insets for the persistent controls
- interaction polish: preserve keyboard focus, reduced motion, local-header hierarchy, and theme tokens

**Verification:**
- Pointer and keyboard cases: close/restore Workspace; close/restore Agent; close/restore both; switch file and theme before and after each state change.
- Inspect computed region widths and accessible toggle labels in every state.

- [x] Remove the seam/rail interaction model and implement the two persistent crown controls.
- [x] Prove independent state and collision-free local-header layout in Light, Dark, and System.

## Task 2: Verify Responsive Behavior and Refresh the Review Package

**Outcome:** The revised interaction is directly reviewable at the target native window sizes.
**Files:**
- Modify: `.temp/f041-native-workbench-review/README.md`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-light-1440x900.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-dark-1200x850.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-compact-1100x850.png`
- Modify: `.temp/f041-native-workbench-review/screenshots/workbench-minimum-850x850.png`

**Change Map:**
- viewport QA: inspect 1440x900, 1200x850, 1100x850, and 850x850 with representative left/right open and closed combinations
- screenshot evidence: show the Codex-style buttons, full-width release, dark theme, compact default, and minimum-width restoration affordances
- review documentation: replace rail/seam language with crown-toggle behavior and record current measured widths

**Verification:**
- Build with the isolated Vite config and inspect all four target viewports.
- Confirm zero page-level horizontal overflow, zero console warnings/errors, no unlabeled controls, and no editor-specific surface nodes.
- Confirm `git diff --exit-code HEAD -- index.html src tests src-tauri` so the review refinement remains production-isolated.

- [x] Exercise and capture all target viewports after the panel behavior stabilizes.
- [x] Update the README and preserve the separate production-migration approval gate.

## Task 3: Record and Commit the F042 Review Refinement

**Outcome:** The prototype adjustment and its evidence are traceable without claiming production migration.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F042-codex-style-workspace-agent-panel-toggles.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F042 request/plan: final lifecycle and interaction/build evidence
- generated index: current F042 status
- Git delivery: exact task-only staging and one `feat(F042)` commit

**Verification:**
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Complete F042 only after browser evidence satisfies every exit criterion.
- [x] Mark F042 done, refresh the index, and create a separate F042 commit.

## Delivery Evidence

- Removed both seam-mounted chevron buttons and the Workspace/Agent collapsed-rail markup and styling. The two outer columns now use `0px` when closed, while persistent `PanelLeft` and `PanelRight` controls remain at the top-left and top-right window edges.
- The left toggle stays grouped with the macOS traffic lights. When Workspace is closed, Editor Host reserves a collision-free leading inset beneath that fixed control cluster; the right toggle behaves symmetrically and reserves trailing Editor Host space only while Agent is closed.
- Browser interaction verified independent close/restore states and truthful `Hide`/`Show` labels plus `aria-pressed`. Switching to `field-notes.md`, closing Workspace, and restoring it retained the active file, Agent attachment, and activity label.
- Geometry passed with zero page-level horizontal overflow: 1440 default `252 / 834 / 352`, Workspace closed `0 / 1086 / 352`, both closed `0 / 1438 / 0`; 1200 dark capture with Agent closed `252 / 946 / 0`; 1100 compact default `0 / 778 / 320`; 850 default `0 / 848 / 0`; and 850 both restored `252 / 276 / 320`.
- Light and Dark interaction states passed. System preference resolved to the current dark operating-system theme, while the interface preserved visible focus, reduced-motion styling, and the format-neutral editor boundary.
- Browser inspection found no warnings or errors, unlabeled buttons, non-English interface copy, seam/rail nodes, or editor-specific surface nodes. The four refreshed review captures are valid PNG files at their named viewport dimensions.
- `node --check` and the isolated Vite production build passed. `git diff --exit-code HEAD -- index.html src tests src-tauri` proved no production frontend, test, or Tauri file changed.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F041-prototype-native-workbench-before-migration.md`
- `.temp/f041-native-workbench-review/README.md`
- `.temp/f041-native-workbench-review/src/main.js`
- `.temp/f041-native-workbench-review/src/styles.css`
- Human-supplied Codex/ChatGPT client screenshot from 2026-08-10
