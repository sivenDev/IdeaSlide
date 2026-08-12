---
id: "B036"
title: "Unify Light and Dark Theme Palette and Remove Legacy Accent Conflicts"
type: "bugfix"
status: "complete"
summary: "Replace the fragmented green, blue, and legacy-purple interface with one art-directed violet-led Light and Dark system."
source: "docs/superplan/human/bugs.md"
created: "2026-08-12"
order: 36
depends_on: ["F047"]
parent: ""
---

# Unify Light and Dark Theme Palette and Remove Legacy Accent Conflicts Plan

**Goal:** Give IdeaNote one recognizable, calm visual identity in both themes by making violet the sole application interaction accent over disciplined paper-gray and ink-charcoal surfaces.
**Scope:** Deliver an art-directed **Ink Violet Atelier** palette across the complete application-owned workbench. Light uses cool paper whites and misted violet-grays; Dark uses violet-biased charcoal rather than neutral black. Violet owns navigation, selection, focus, active editing state, primary buttons, and Agent actions. Blue remains only for document/file semantics and links. Green remains only for success, connected, online, and completed states. Warning, danger, disabled, and editor/document-owned colors keep independent meaning. Migrate legacy application-owned purple, green-selection, blue-selection, and mismatched neutral literals that currently escape the semantic contract in Workspace rows, IdeaSketch navigation, Markdown chrome, Settings, Agent, menus, dialogs, notices, and common controls. Preserve the existing Light/Dark/System preference, layout, component behavior, persistence, and editor state.
**Non-Goals:** This repair does not add theme choices, gradients, decorative illustrations, new fonts, layout changes, density changes, glass effects, or branded assets. It does not recolor file-type glyph semantics, Markdown-authored content, Excalidraw elements, scene backgrounds, exports, success/warning/danger states, or native macOS traffic lights. It does not complete or broaden B034; B034 continues to own geometry and interaction parity while B036 corrects the newer F047 palette result.
**Architecture:** Keep the F047 semantic token boundary and replace its palette plus incomplete component integration rather than adding another independent theme layer. The visual signature is a narrow violet location cue: selection surfaces remain low-chroma and quiet, while a stronger violet appears only on focus rings, current-item markers, and primary actions. Light foundation: Canvas `#F6F5F8`, Primary `#FCFCFD`, Workspace `#F0EFF4`, Agent `#F4F3F7`, Ink `#25232A`, Violet `#6557B8`, Selection `#E9E5F5`. Dark foundation: Canvas `#121116`, Primary `#1C1A20`, Workspace `#17161B`, Agent `#211F26`, Ink `#F2EFF6`, Violet `#A99AF2`, Selection `#342E4B`. Semantic aliases remain the only bridge for legacy component variable names; final component rules must reference semantic roles rather than repeat palette literals. System continues resolving to the identical Light or Dark contract.
**Baseline:** F047 introduced complete green-led semantic tokens and a final authoritative CSS layer, but the shipped screenshot shows green Workspace selection, purple active Markdown/file state, blue file glyphs, and several unrelated white/gray surface families at the same time. Source inspection finds application-owned legacy violet literals such as `#6965db`, `#625dd6`, `#ecebff`, `#eeedff`, and `#37338e` still used across Settings, Agent, resource rows, and IdeaSketch variables. The resource-row active selector retains legacy `--idea-slide-accent-soft` after the F047 layer, while the Workspace root and Markdown controls use the new green selection token. This produces the observed fragmented hierarchy even though the root token contract itself is complete.
**Reproduction:** Open a Markdown document in Light with Workspace and Agent visible, select a Workspace, select the Markdown file, enable Split, select source text, and inspect Agent messages. The Workspace root, Markdown toolbar, editor selection, active file, file glyphs, and Agent status use green, purple, and blue simultaneously; the left rail, editor, preview, and Agent also use visibly unrelated gray/white temperatures. Switch to Dark and inspect the same active states: the semantic theme changes, but legacy application-owned accent variables and literals remain separate from the root contract.
**Root Cause:** F047 changed the root semantic palette and appended broad component overrides without fully retiring the pre-existing component-specific token systems. CSS cascade and selector coverage allow `--idea-slide-accent`, `--idea-slide-accent-soft`, hard-coded Settings/Agent purples, and earlier shell surface literals to survive in states not named by the final layer. Tests prove token presence and a few semantic classes, but do not reject legacy application accent families or assert that every active-row/control boundary consumes the same semantic selection and focus roles.
**Exit Criteria:** Light and Dark each read as one intentional system at a glance. All application-owned active rows, selected view modes, focused controls, primary buttons, and Agent actions derive from the violet semantic roles; no green selection or legacy saturated purple island remains. Blue appears only for file/document/link semantics, and green only for successful/connected/completed meaning. Workspace, editor, preview, and Agent surfaces have restrained but visible depth without looking like unrelated products. Text and primary/selection/status pairs satisfy WCAG AA; focus remains distinct from selection; reduced motion and System behavior are unchanged. Markdown and Excalidraw content colors, history, dirty state, persistence, and exports remain unchanged. Focused regressions, full frontend tests, production build, Rust tests, native startup, Light/Dark visual inspection, workflow validation, diff hygiene, and a separate `fix(B036)` commit pass.

## Task 1: Establish the Ink Violet Atelier Contract and Failing Regression

**Outcome:** The exact artistic palette and allowed semantic exceptions are executable, and the current legacy accent conflict fails a focused test before repair.
**Files:**
- Modify: `src/index.css`
- Modify: `tests/themeVisualContract.test.mjs`

**Change Map:**
- root palette: replace green-led selection/action roles with the Ink Violet Atelier Light/Dark values and keep status/document roles independent
- palette policy: encode violet interaction, blue document, green success, and warning/danger boundaries
- legacy audit: reject application-owned legacy accent literals and component-local accent variables outside explicit editor/document exceptions
- contrast: verify text, selection, primary action, focus, disabled, and status pairs for both themes

**Verification:**
- `node --test tests/themeVisualContract.test.mjs tests/reviewedDemoParity.test.mjs`
- Cases: current legacy violet/green conflict fails before repair; every palette role exists in both themes; System shares the resolved palettes; required contrast pairs pass; forbidden accent families are absent from application-owned state styling.

- [x] Add a focused regression that detects the shipped mixed-accent state and incomplete semantic migration.
- [x] Replace the Light and Dark tokens with the exact Ink Violet Atelier contract.
- [x] Prove violet interaction, blue document, green success, and document-owned color boundaries.

## Task 2: Migrate Every Application-Owned Active and Surface State

**Outcome:** Workspace, IdeaSketch chrome, Markdown, Agent, Settings, menus, dialogs, and notices consume one palette without changing structure or behavior.
**Files:**
- Modify: `src/index.css`
- Modify: `tests/themeVisualContract.test.mjs`
- Modify: `tests/reviewedDemoParity.test.mjs`

**Change Map:**
- Workspace: unify root, file, recent, drag target, inline rename, and row-action states; use violet selection with blue limited to file glyph meaning
- IdeaSketch: map application-owned Pages, Cameras, navigator controls, active indices, and focus to semantic tokens while leaving Excalidraw scene colors untouched
- Markdown: align toolbar, view modes, outline, CodeMirror selection/active line, split rail, preview chrome, code surfaces, and notices
- Agent and Settings: replace legacy local purples and green selection backgrounds with shared active/focus/action tokens; retain green runtime success and warning/danger meanings
- surface hierarchy: harmonize left rail, document crown/editor, preview, Agent, inset areas, and elevated overlays with subtle temperature and luminance steps

**Verification:**
- `node --test tests/themeVisualContract.test.mjs tests/reviewedDemoParity.test.mjs tests/settingsCenter.test.mjs tests/workspaceExplorerWiring.test.mjs tests/agentPanel.test.mjs tests/markdownEditorRefinement.test.mjs tests/slideCanvasProps.test.mjs`
- Browser cases in Light/Dark/System: the supplied Markdown Split state, Welcome, Settings, Agent empty/activity/error, IdeaSketch Pages/Cameras, menus, dialogs, selection, hover, focus, disabled, drag, and minimum-width layout.

- [x] Replace component-local interaction colors and aliases with the semantic theme roles.
- [x] Balance surface temperature and luminance so the three workbench regions form one composition.
- [x] Verify all meaningful states without recoloring documents or changing layout geometry.

## Task 3: Verify and Deliver the Corrected Themes

**Outcome:** B036 closes with automated, visual, native, accessibility, and workflow evidence in one isolated commit.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B036-unify-light-and-dark-theme-palette.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- visual review: compare equivalent Light and Dark Welcome, Markdown Split, IdeaSketch, Agent, Settings, menus, and compact layouts
- regression: run stabilized full frontend, production build, Rust, and native startup checks
- workflow: record evidence, complete B036/done, refresh index, and stage only B036 paths

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `cd src-tauri && cargo test`
- `npm run tauri dev`
- Browser/native review at 1440x875, 1200x850, 1100x850, and 850x850 in Light/Dark/System, including keyboard focus and reduced motion.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run focused checks during repair and one full stabilized regression after implementation stops changing.
- [x] Inspect genuine Light/Dark/System states for artistic unity, hierarchy, contrast, focus, status meaning, and editor ownership.
- [x] Mark B036 complete/done and create a separate `fix(B036)` commit containing only this repair.

## Delivery Evidence

- Focused regression first reproduced the shipped green-led palette instead of the approved Ink Violet Atelier values, then passed after the semantic palette and component-local accent migration. The contract rejects the legacy `#6965db`, `#625dd6`, `#5b57cf`, `#7772dd`, `#ecebff`, `#eeedff`, and `#37338e` accent family.
- Light now resolves Canvas `#F6F5F8`, Primary `#FCFCFD`, Workspace `#F0EFF4`, Agent `#F4F3F7`, Ink `#25232A`, Violet `#6557B8`, and Selection `#E9E5F5`; Dark resolves Canvas `#121116`, Primary `#1C1A20`, Workspace `#17161B`, Agent `#211F26`, Ink `#F2EFF6`, Violet `#A99AF2`, and Selection `#342E4B`.
- Application-owned Settings, Agent, Workspace rows, IdeaSketch navigation, Markdown chrome, Excalidraw-owned app controls, resize/focus states, theme previews, and selection actions now derive from the shared semantic roles. Blue remains the document/link accent and green remains the success/completed accent.
- Danger semantics were restored after human visual feedback: Workspace and Recent removal actions now use the shared `is-danger` contract, and focus, hover, and Radix highlighted states retain danger-red text with a pale danger surface instead of violet selection styling.
- Browser review verified Light and Dark Welcome/Settings states and the compact effective minimum viewport. Light and Dark theme cards match the new palette; System is a calm half-Light/half-Dark preview; no horizontal overflow, focus loss, console warning, or console error was observed.
- Full frontend regression passed: `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`.
- Production build passed: `npm run build`; only the existing Excalidraw mixed-import and large-chunk warnings were reported.
- Rust regression passed `156/156`: `cd src-tauri && cargo test`; only existing dead-code warnings were reported.
- Native startup smoke passed: `npm run tauri dev` compiled and launched `target/debug/idea-slide` before controlled shutdown.
- Source hygiene passed `git diff --check`; theme switching, reduced motion, Settings persistence, document-owned Excalidraw colors, Markdown content, editor history, dirty state, and workbench geometry remain unchanged.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F047-polish-light-and-dark-themes.md`
- `docs/superplan/plans/bugs/B034-restore-reviewed-demo-parity-in-tauri.md`
- Human-supplied Light-theme screenshot and palette feedback from `2026-08-12`
- `src/index.css`
- `tests/themeVisualContract.test.mjs`
- `tests/reviewedDemoParity.test.mjs`
