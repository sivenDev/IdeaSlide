---
id: "F047"
title: "Polish Light and Dark Themes with a ChatGPT-Inspired Visual System"
type: "feature"
status: "complete"
summary: "Refine IdeaNote into two complete, accessible Light and Dark visual systems inspired by the restrained hierarchy of the ChatGPT desktop client."
source: "docs/superplan/human/features.md"
created: "2026-08-12"
order: 60
depends_on: ["F046-04"]
parent: ""
---

# Polish Light and Dark Themes with a ChatGPT-Inspired Visual System Plan

**Goal:** Give IdeaNote a calm, cohesive Light and Dark appearance with clearer hierarchy and more consistent interaction states across the complete desktop workbench.
**Scope:** Refine the existing persisted Light and Dark themes using a ChatGPT-inspired but IdeaNote-owned neutral visual system. Apply one semantic token contract to the native workbench crown, Workspace, editor host, Agent, Settings, menus, dialogs, notices, Markdown chrome and preview, and application-owned IdeaSketch chrome. Light uses warm white and soft neutral-gray layers; Dark uses deep charcoal layers rather than pure black. Use restrained green for primary/selected application actions, preserve blue for document/editor semantics, and keep danger, warning, success, focus, hover, pressed, disabled, and selection states independently readable. Preserve System as an automatic resolver to these same two palettes, with immediate preview and persisted Settings behavior unchanged.
**Non-Goals:** This feature does not copy ChatGPT trademarks, icons, proprietary assets, exact layouts, or branded typography. It does not add additional theme choices, remove System, change Settings persistence or credential behavior, restructure the three-region workbench, change native window-control geometry, alter Workspace/file operations, redesign Agent execution, replace Radix or editor libraries, or rewrite editor-owned document colors. Excalidraw scene backgrounds/elements and Markdown document content remain document-owned.
**Architecture:** Keep `SettingsProvider` and the existing `light | dark | system` preference as the only theme state. The resolved `data-theme` and `color-scheme` remain the runtime boundary; no component-local theme stores or duplicated palettes are introduced. Replace surface-specific and raw-color styling with semantic variables grouped by canvas, elevated surface, inset surface, text hierarchy, border strength, interaction state, status, accent, overlay, shadow, and editor integration. The visual direction is an **quiet layered workbench**: subtle tonal separation and precise one-pixel boundaries create hierarchy without gradients, glass effects, or decorative saturation. B034 continues to own workbench geometry, native safe areas, Settings dimensions, and overlay behavior; F047 owns the follow-up palette and theme-state presentation on top of that committed structure.
**Baseline:** The committed B034 implementation already provides functional Light/Dark/System resolution, immediate Settings preview, a reviewed three-region shell, root theme variables, and focused parity tests. The code index places theme resolution in `SettingsProvider` and theme selection in `GeneralSettings`. Styling remains concentrated in `src/index.css`, which contains roughly 500 raw hex/RGB declarations; many predate the semantic theme contract and can produce inconsistent contrast or light-colored islands in Dark. Existing B034 tests intentionally pin its first-pass palette and will need to become F047 semantic/behavior contracts rather than preserving superseded exact colors. The PRD requires readable shell, Settings, menus, Markdown, Agent, focus, disabled, warning, and error states in Light, Dark, and System while leaving document-owned colors unchanged.
**Exit Criteria:** Appearance still offers Light, Dark, and System, previews immediately, saves through the existing explicit Settings lifecycle, discards unsaved previews, persists across restart, and follows operating-system changes only in System. Light and Dark each provide intentional canvas, Workspace, editor, Agent, crown, elevated, inset, hover, active, selected, focus, disabled, overlay, border, and status colors with no unthemed application-owned surface. Text and meaningful controls meet WCAG AA contrast targets in normal states; visible focus is distinguishable from selection; disabled controls remain legible but clearly inactive. Workspace rows, document crown, Welcome, panel dividers, menus/popovers, dialogs, Settings controls, Agent transcript/activity/composer, Markdown edit/split/preview chrome, notices, empty/loading/error states, and application-owned IdeaSketch navigation all look coherent in both schemes. System resolves to the identical corresponding Light or Dark palette. Theme switching does not remount editors, lose selection/history, mutate Excalidraw scene colors, alter Markdown content, or change workbench geometry. Reduced-motion users receive no color-transition animation, and normal theme transitions are brief and limited to application-owned paint properties.

## Task 1: Establish the Semantic Light and Dark Token Contract

**Outcome:** Every application-owned surface and interaction state can be styled from a compact, documented two-palette contract instead of scattered raw colors.
**Files:**
- Modify: `src/index.css`
- Modify: `tests/reviewedDemoParity.test.mjs`
- Create: `tests/themeVisualContract.test.mjs`

**Change Map:**
- palette: define IdeaNote-owned Light and Dark canvas/surface/text/border/accent/status/overlay/shadow tokens inspired by ChatGPT's restrained neutral hierarchy
- semantics: distinguish primary, secondary, tertiary, elevated, inset, hover, pressed, selection, focus, disabled, danger, warning, and success roles without encoding component names into color values
- raw-color audit: migrate application-owned declarations that bypass the theme contract; retain deliberate document/file-type colors and third-party/editor compatibility values behind explicit exceptions
- regression contract: replace B034's superseded exact first-pass palette assertions with complete token presence, resolved-theme coverage, contrast-oriented state pairs, and bounded raw-color exceptions

**Verification:**
- `node --test tests/themeVisualContract.test.mjs tests/reviewedDemoParity.test.mjs tests/settings.test.mjs`
- Cases: every required semantic role exists in both themes; no theme token resolves to an empty or circular value; raw application colors are absent outside approved document/editor exceptions; key text/background and focus/background pairs satisfy the chosen contrast thresholds.

- [x] Capture the incomplete semantic roles and residual hard-coded color families as focused failures.
- [x] Define the two restrained palettes and migrate shared foundations without changing theme state or layout geometry.
- [x] Verify token completeness, contrast, System equivalence, and the explicit editor/document color exception list.

## Task 2: Apply the Visual System Across the Workbench and Transient UI

**Outcome:** Workspace, editor host, Agent, Settings, menus, dialogs, and all common states read as one coherent desktop application in Light and Dark.
**Files:**
- Modify: `src/index.css`
- Modify: `src/components/SettingsCenter.tsx`
- Modify: `src/components/settings/GeneralSettings.tsx`
- Modify: `src/components/WorkbenchCrown.tsx`
- Modify: `src/components/WorkspaceSidebar.tsx`
- Modify: `src/components/WorkspaceResourceRow.tsx`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/agent/AgentThreadHeader.tsx`
- Modify: `tests/reviewedDemoParity.test.mjs`
- Modify: `tests/settingsCenter.test.mjs`
- Modify: `tests/workspaceExplorerWiring.test.mjs`
- Modify: `tests/agentPanel.test.mjs`

**Change Map:**
- workbench hierarchy: tune crown, Workspace, editor, Agent, divider, Welcome, and restore-rail layers so adjacency remains visible without heavy outlines
- common controls: unify button, icon button, input, select, switch, theme card, menu, popover, tooltip, dialog, scrollbar, focus, hover, pressed, disabled, and destructive states
- Settings appearance: show recognizable Light/Dark previews using the real semantic palette while System remains an automatic choice, not a third visual palette
- Agent and Workspace: preserve file-type/editor accents and activity meaning while removing unrelated saturated or light-only islands
- motion: use one short paint transition for theme changes and disable it under `prefers-reduced-motion`

**Verification:**
- `node --test tests/themeVisualContract.test.mjs tests/reviewedDemoParity.test.mjs tests/settingsCenter.test.mjs tests/workspaceExplorerWiring.test.mjs tests/agentPanel.test.mjs tests/agentInteraction.test.mjs`
- Browser/Tauri cases at 1440x875, 1200x850, 1100x850, and 850x850: Welcome and active document; panels open/closed; long names; menus/popovers; Settings; Agent empty/running/completed/error; hover/focus/disabled/destructive states; Light/Dark/System; reduced motion; no horizontal overflow.

- [x] Apply the semantic contract to every shell and transient surface while preserving B034 geometry and Radix behavior.
- [x] Refine Appearance cards and common states so the two palettes are understandable before save and consistent after restart.
- [x] Inspect both themes at all target sizes and remove remaining unthemed islands or ambiguous interaction states.

## Task 3: Integrate Editors Without Changing Document-Owned Colors

**Outcome:** Markdown and IdeaSketch chrome follow the application theme while editor state, content, history, and serialized colors remain untouched.
**Files:**
- Modify: `src/index.css`
- Modify: `src/components/MarkdownEditor.tsx`
- Modify: `src/components/DocumentEditorHost.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `tests/markdownEditorRefinement.test.mjs`
- Modify: `tests/markdownEditorContract.test.mjs`
- Modify: `tests/slideCanvasProps.test.mjs`
- Modify: `tests/themeVisualContract.test.mjs`

**Change Map:**
- Markdown: align CodeMirror gutters, selection, caret, active line, preview, outline, split divider, search/history controls, and notices with the resolved theme
- IdeaSketch: pass only the resolved application theme into supported Excalidraw UI chrome and align app-owned Pages/Cameras/navigation overlays with semantic tokens
- content boundary: retain serialized Excalidraw `viewBackgroundColor`, element colors, images, export appearance, Markdown source, and preview content styling unless the document itself defines otherwise
- lifecycle: change paint/configuration in place without remounting CodeMirror or Excalidraw, resetting history, changing dirty state, or interrupting Agent editor bindings

**Verification:**
- `node --test tests/themeVisualContract.test.mjs tests/markdownEditorContract.test.mjs tests/markdownEditorRefinement.test.mjs tests/slideCanvasProps.test.mjs tests/agentEditorBridge.test.mjs`
- Cases: Light/Dark/System switches in Edit/Split/Preview and IdeaSketch; selection/history/Undo/Redo survives; current Page and camera state survive; Agent adapter identity remains stable; Excalidraw document colors and serialized output are byte/semantic equivalent apart from unrelated user edits.

- [x] Add editor-theme regressions proving chrome changes without editor remounts or document-color mutation.
- [x] Apply the resolved semantic theme through supported CodeMirror, Markdown preview, Excalidraw, Pages, and Cameras boundaries.
- [x] Verify editor history, dirty state, Agent binding, save/reopen behavior, presentation, and exports across theme changes.

## Task 4: Verify and Deliver the Theme Polish

**Outcome:** F047 ships with current automated, visual, native, accessibility, and workflow evidence in one isolated commit.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F047-polish-light-and-dark-themes.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- regression evidence: theme persistence/preview/System behavior, semantic token coverage, workbench states, transient UI, Markdown, IdeaSketch, Agent, native window chrome, accessibility, and reduced motion
- visual evidence: same-state Light/Dark captures for Welcome, Markdown, IdeaSketch, Agent activity, Settings, menus, notices, and minimum-width layouts
- workflow: compare final diff with every exit criterion, record intentional third-party/document color exceptions, complete F047 only after verification, refresh the plan index, and create one `feat(F047)` commit

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `cd src-tauri && cargo test`
- `npm run tauri dev`
- Browser/native visual and interaction review at 1440x875, 1200x850, 1100x850, and 850x850 in Light, Dark, and System, including keyboard-only focus, reduced motion, windowed/fullscreen chrome, open/closed panels, Settings preview/save/discard, Markdown, IdeaSketch, Agent, menus, notices, and error states.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run focused checks while styling and one stabilized full frontend/build/native regression after implementation stops changing.
- [x] Review genuine Light/Dark/System application states for contrast, hierarchy, focus, motion, editor ownership, and B034 geometry preservation.
- [x] Mark F047 complete/done, refresh the plan index, and create a separate `feat(F047)` task commit containing only this feature.

## Delivery Evidence

- Theme contract and focused regressions passed for semantic token completeness, WCAG contrast pairs, Settings preview/System resolution, Workspace, Agent, Markdown, and IdeaSketch/Excalidraw integration.
- Full frontend regression passed: `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`.
- Production frontend verification passed: `npm run build`; Vite reported only the existing Excalidraw mixed-import and large-chunk warnings.
- Rust regression passed `156/156`: `cd src-tauri && cargo test`; only existing dead-code warnings were reported.
- Native startup smoke passed: `npm run tauri dev` compiled the application and launched `target/debug/idea-slide` before a controlled shutdown.
- Live browser review covered Light and Dark Welcome and Settings states plus the effective minimum-width Settings layout. No horizontal overflow, focus loss, console warning, or console error was observed; resolved Dark surfaces were verified as charcoal (`#141414`, `#191919`, and `#212121`) with restrained green accent `#0f7b5c`.
- Editor ownership remains explicit: Excalidraw receives the resolved application theme for its chrome, its independent theme menu is removed, and the document-owned `viewBackgroundColor: "#ffffff"` remains unchanged. Markdown application chrome now uses semantic classes rather than Light-only literals.
- Reduced motion disables theme paint transitions, System resolves to the same Light or Dark palette, and the final source audit preserves B034 workbench geometry and existing Settings persistence behavior.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-01-settings-and-ai-gating.md`
- `docs/superplan/plans/features/F040-implement-workspace-loom-production-shell.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-02-settings-themes-and-markdown.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-04-native-integration-cleanup-and-verification.md`
- `docs/superplan/plans/bugs/B034-restore-reviewed-demo-parity-in-tauri.md`
- `src/hooks/useSettings.tsx`
- `src/components/settings/GeneralSettings.tsx`
- `src/index.css`
