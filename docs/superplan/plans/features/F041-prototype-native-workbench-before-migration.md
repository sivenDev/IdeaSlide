---
id: "F041"
title: "Prototype a Redesigned Native Workspace Shell Before Production Migration"
type: "feature"
status: "complete"
summary: "Restore the pre-F040 production UI and deliver an isolated review-ready native desktop shell that leaves every editor surface fully editor-owned."
source: "docs/superplan/human/features.md"
created: "2026-08-10"
order: 48
depends_on: ["F040"]
parent: ""
---

# Prototype a Redesigned Native Workspace Shell Before Production Migration Plan

**Goal:** Replace the rejected F040 production presentation with a safe rollback and a higher-fidelity, review-first desktop prototype that can be approved before any second production migration begins.
**Scope:** Reverse the production source and test changes introduced by commit `b7e2394` while preserving the committed F039 Cursor/Kition/Teable research, the F040 historical plan/evidence, and all earlier product work. The restored production application must match the pre-F040 `a776d49` behavior and build state. Separately create a standalone frontend project under `.temp/f041-native-workbench-review/` that simulates a real macOS Tauri window without importing production code or invoking Tauri commands. The prototype designs only the outer client shell: native window integration, persistent left Workspace, flexible center `Editor Host` aperture, independent right Agent, panel dividers/restore behavior, command entry points, settings, and Light/Dark/System preview. It deliberately removes the global application title bar: macOS traffic lights sit inside the Workspace region, each shell region owns its own compact local header, and Save/Home controls do not occupy a permanent app-wide strip. The center is a generic editor-owned aperture that can host table, IdeaSketch/Excalidraw, Markdown, Workflow, or future editors without the prototype rendering any of those interfaces. Workspace file selection may update only shell-owned document identity and the Agent's active-document label; it must not introduce format-specific tools, views, selections, or content. Deliver browser screenshots and a short review README that names the shell decisions and the explicit no-migration boundary.
**Non-Goals:** This plan does not design, simulate, or style table, IdeaSketch/Excalidraw, Markdown, Workflow, or any future editor content, toolbar, navigator, inspector, selection, or command. It does not migrate the prototype into `src/`, change Tauri Rust code or capabilities, connect the prototype to user files, add IdeaTable to production, change Agent runtime/providers/Tools, delete or rewrite the F039 research, erase the F040 historical record, or claim that the new design has human approval. It does not create multiple visual concepts, copy Cursor/Kition/Teable screens, add gradients, glass effects, oversized empty-state branding, pastel Agent surfaces, decorative context lines, or a replacement global title bar.
**Architecture:** Apply the rollback as a reverse patch of `b7e2394` limited to `index.html`, `src/**`, and `tests/**`; do not revert `docs/superplan/**` or `docs/superplan/human/prd.md`. Verify those production paths are identical to the `a776d49` tree. The prototype is an isolated Vite-style static frontend with `index.html`, `src/main.js`, `src/styles.css`, `package.json`, and `vite.config.js`; production code and the production build never reference `.temp`. Use a restrained native token system: frost `#f1f2f4`, paper `#ffffff`, graphite `#23272e`, steel `#69727e`, cobalt `#2f5dcc`, and rust `#a85c3b`, with a corresponding neutral dark set. Typography uses the native system stack for interface language and `ui-monospace` only for paths and status metadata. The layout uses a 252px Workspace, flexible editor aperture, and 352px Agent at desktop width. The signature **Open Frame** is the deliberate absence of application-owned content inside the center: two precisely articulated shell seams and three independent local headers make the editor boundary legible without placing a toolbar, dashboard, product logo, or mock editor over it. The prototype can switch among `.is`, `.md`, `.table`, and `.workflow` sample file identities only to prove format neutrality; the center continues to display the same neutral editor-owned aperture. Corners stay between 3px and 7px, shadows are limited to transient menus, and hierarchy comes from rules, spacing, typography, and selection state.
**Baseline:** F040 currently opens into a persistent shell but still renders the existing full-width top title bar with file/save/settings controls. Its light theme uses a deep-ink rail, pale-mint Agent surface, centered empty-state branding, and bordered action cards; the human review identifies this as visually generic and recognizably AI-generated. Commit `b7e2394` contains all F040 production changes and follows the research-only `a776d49` commit. The Git worktree is clean, so an exact path-limited reverse patch can be inspected and committed without mixing unrelated work. `.temp` is not ignored by the repository and can hold a review artifact while remaining disconnected from production.
**Exit Criteria:** Production `index.html`, `src/**`, and `tests/**` match commit `a776d49`; `LaunchScreen` and the prior production routing are restored; the F039 research and F040 Superplan history remain present; the production test suite and build pass after rollback. `.temp/f041-native-workbench-review/` runs as a standalone local frontend and visibly contains no global title bar, centered product title, or permanent Save/Home toolbar. At 1440x900, 1200x850, 1100x850, and 850x850 it preserves a coherent Workspace/Editor Host/Agent relationship without page-level horizontal overflow. The center remains a format-neutral editor-owned aperture with no table grid, canvas, Markdown source, Workflow nodes, editor toolbar, editor navigator, or editor inspector. Region-local shell headers remain compact, the Agent uses neutral application chrome, and no gradients, glass panels, mint wash, oversized logo empty state, or decorative context thread remains. Selecting `.is`, `.md`, `.table`, and `.workflow` sample identities updates only shell-owned document identity and Agent document scope; both outer regions collapse and restore independently; the theme preview exposes Light, Dark, and System; keyboard focus is visible; reduced motion is respected; and the browser console is clean. The README and screenshots make the prototype directly reviewable and state that production migration requires a new explicit approval.

## Task 1: Restore the Pre-F040 Production Application

**Outcome:** The production Tauri frontend returns exactly to its last accepted pre-F040 source and test state without deleting research or workflow history.
**Files:**
- Modify: `index.html`
- Modify: `src/**`
- Modify: `tests/**`
- Preserve: `docs/design-research/f039-workspace-agent-layouts/**`
- Preserve: `docs/superplan/plans/features/F040-implement-workspace-loom-production-shell.md`

**Change Map:**
- production rollback: reverse only the `index.html`, `src/**`, and `tests/**` portions of `b7e2394`
- historical boundary: keep F039 research, F040 request/plan/evidence, PRD target language, and subsequent Superplan records intact
- safety proof: compare the rolled-back production paths directly with tree `a776d49`

**Verification:**
- `git diff --exit-code a776d49 -- index.html src tests`
- `node --test tests/*.test.mjs`
- `npm run build`

- [x] Reverse the F040 production source and test patch without reverting Superplan or research artifacts.
- [x] Prove the restored production paths match `a776d49` exactly.
- [x] Run the complete restored frontend test and build checks.

## Task 2: Build the Isolated Open Frame Shell Prototype

**Outcome:** A realistic review project demonstrates a native-feeling Workspace + generic Editor Host + Agent shell without touching production code or editor-owned UI.
**Files:**
- Create: `.temp/f041-native-workbench-review/package.json`
- Create: `.temp/f041-native-workbench-review/vite.config.js`
- Create: `.temp/f041-native-workbench-review/index.html`
- Create: `.temp/f041-native-workbench-review/src/main.js`
- Create: `.temp/f041-native-workbench-review/src/styles.css`
- Create: `.temp/f041-native-workbench-review/README.md`

**Change Map:**
- native window composition: integrate traffic lights into the Workspace region and use separate 44px region-local headers instead of a full-width title bar
- Workspace hierarchy: show Workspace, folders, heterogeneous file types, recent items, and shell-level create/open/settings entry points with compact density and one truthful active-document marker
- Open Frame: keep the center as a neutral editor-owned aperture, showing only shell-level document identity and a clear ownership label without rendering editor content or controls
- format-neutral proof: let sample `.is`, `.md`, `.table`, and `.workflow` files switch the active document label while preserving one identical center host boundary
- Agent utility: use neutral chrome, compact thread controls, active-document metadata, chronological work/result rows, and a grounded composer without editor-specific context presentation
- themes and panels: preview Light/Dark/System and independent Workspace/Agent collapse without adding production state

**Verification:**
- Start the isolated Vite project without importing `src/` from the production application.
- Exercise every interactive control with pointer and keyboard input.
- Confirm all interface copy is English and no production or Tauri command is invoked.

- [x] Implement the Open Frame token system and native desktop composition exactly as specified.
- [x] Add realistic heterogeneous Workspace and Agent content plus bounded shell interactions while leaving the editor aperture untouched.
- [x] Add theme preview, independent panel behavior, focus states, and reduced-motion support.

## Task 3: Critique and Package the Prototype for Human Review

**Outcome:** The prototype is visually inspected at native target sizes and can be reviewed without opening production IdeaNote.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Modify: `.temp/f041-native-workbench-review/src/main.js`
- Modify: `.temp/f041-native-workbench-review/README.md`
- Create: `.temp/f041-native-workbench-review/screenshots/workbench-light-1440x900.png`
- Create: `.temp/f041-native-workbench-review/screenshots/workbench-dark-1200x850.png`
- Create: `.temp/f041-native-workbench-review/screenshots/workbench-compact-1100x850.png`
- Create: `.temp/f041-native-workbench-review/screenshots/workbench-minimum-850x850.png`

**Change Map:**
- visual critique: remove any element that resembles the rejected global toolbar, generic AI dashboard, decorative glass card, or unearned visual accent
- viewport QA: verify region proportions, the generic Editor Host aperture, long-name truncation, panel restore behavior, menu placement, and Agent composer reachability
- review package: document how to run the prototype, what changed from F040, interaction coverage, known prototype-only limitations, and the explicit approval gate for migration

**Verification:**
- Browser inspection at 1440x900, 1200x850, 1100x850, and 850x850.
- Confirm `document.documentElement.scrollWidth === document.documentElement.clientWidth` at every viewport.
- Confirm no console errors, missing local assets, inaccessible unlabeled controls, non-English copy, or reduced-motion violations.
- `git diff --check`

- [x] Capture and inspect all four review viewport states, including one dark-theme state.
- [x] Complete a design self-critique and remove residual generic AI styling.
- [x] Finish the review README and keep production migration explicitly out of scope.

## Task 4: Record the Rollback and Review Artifact

**Outcome:** The rollback and prototype are traceable in one F041 commit while remaining isolated from production migration.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F041-prototype-native-workbench-before-migration.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F041 progress: record rollback evidence, prototype interaction/viewport evidence, and the pending separate human migration decision
- generated index: reflect the final F041 lifecycle without changing F039/F040 history
- Git delivery: stage only the rollback, `.temp/f041-native-workbench-review/`, and F041 workflow files

**Verification:**
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Mark F041 complete only after production rollback and all prototype review evidence are ready.
- [x] Mark F041 done, refresh the plan index, and create a separate `feat(F041)` task commit.

## Delivery Evidence

- Reversed the F040 production patch only for `index.html`, `src/**`, and `tests/**`. The staged production tree compares exactly with commit `a776d49`; F039 research, the F040 request/plan/evidence, the current PRD, and later Superplan history remain present.
- The restored production frontend passed 354/354 Node tests and `npm run build`. Vite reported only the existing Excalidraw static/dynamic import overlap and large-chunk warnings.
- Delivered the isolated Vite-style review project under `.temp/f041-native-workbench-review/` with no production imports or Tauri commands. Its source contains no gradient, table grid, Excalidraw surface, Markdown editor, or Workflow canvas implementation.
- The Open Frame shell has no global title bar, centered product title, permanent Save/Home toolbar, decorative context line, glass treatment, or colored Agent wash. Workspace, generic Editor Host, and Agent use independent region-local crowns; the center remains one identical editor-owned aperture for `.is`, `.md`, `.table`, and `.workflow` sample identities.
- Verified file-identity and Agent attachment updates, Command/Ctrl+K commands, Light/Dark/System preview, reduced-motion styling, and independent Workspace/Agent collapse/restore. At 850px both rails default closed, either can be restored independently, both can be restored together, and no page-level horizontal overflow occurs.
- Browser geometry passed at 1440x900 (252 / 834 / 352), 1200x850 (252 / 594 / 352), 1100x850 (48 / 730 / 320), and 850x850 (48 / 752 / 48 default). Browser inspection found no warnings/errors, missing labels, non-English interface copy, global title-bar node, or editor-specific surface node.
- Preserved four review captures under `.temp/f041-native-workbench-review/screenshots/` and documented the run command, design boundary, review interactions, verified widths, and separate production-migration approval gate in the prototype README.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F039-workspace-first-ai-agent-layout-concepts.md`
- `docs/superplan/plans/features/F040-implement-workspace-loom-production-shell.md`
- `docs/design-research/f039-workspace-agent-layouts/README.md`
- `docs/design-research/f039-workspace-agent-layouts/sources/comparison.md`
- `docs/design-research/f039-workspace-agent-layouts/mockups/workspace-loom.html`
- `src/App.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/Toolbar.tsx`
- `src/components/AgentPanel.tsx`
- `src/index.css`
