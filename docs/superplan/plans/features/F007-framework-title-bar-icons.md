---
id: "F007"
title: "Standardize Title Bar File Action Icons"
type: "feature"
status: "complete"
summary: "Replace title-bar text glyphs with consistent framework icons while preserving the compact file-action workflow."
source: "docs/superplan/human/features.md"
created: "2026-08-03"
order: 7
depends_on: ["F006"]
parent: ""
---

# Standardize Title Bar File Action Icons Plan

**Goal:** Make IdeaNote's title-bar file actions visually clear and consistent by using a maintained React icon framework instead of font-dependent symbols.
**Scope:** Add `lucide-react` as the shared icon dependency for the title bar. Replace the current Home, New File, Open, Save, and save-options glyphs with Lucide icons sized and stroked consistently for the compact toolbar. Add matching icons to Open Workspace, Open File, Save, Save As, and Save All menu items while preserving their existing English labels, callbacks, tooltips, accessible names, menu structure, save indicator, native drag region, and centered document title.
**Non-Goals:** This plan does not redesign the title-bar layout, change toolbar dimensions or colors, migrate every custom SVG elsewhere in the application, alter keyboard shortcuts, change file/workspace behavior, replace the saved-state dot, or introduce icon-only menu items.
**Architecture:** `Toolbar` remains the sole composition boundary for window-level file actions and imports named Lucide components directly so Vite can tree-shake unused icons. `ToolbarAction` continues to own button interaction, focus, disabled, and tooltip behavior; icon components remain decorative through `aria-hidden` because the controls retain explicit accessible names. `DropdownMenuItem` keeps visible text alongside small leading icons. A focused source contract protects framework imports and prevents the legacy Unicode glyphs from returning.
**Baseline:** `src/components/Toolbar.tsx` currently renders `⌂`, `＋`, `▱`, `⌑`, and `⌄` as toolbar content. These symbols vary by platform font and do not form a coherent icon family. The application already uses Radix UI primitives for interactions but has no installed icon component package. Existing toolbar tests protect file actions and title placement but do not constrain icon implementation.
**Exit Criteria:** The title bar renders coherent framework icons for Home, New File, Open, Save, and save options; each dropdown row has an appropriate leading framework icon and readable label. No legacy toolbar glyph remains. Existing callbacks, tooltips, ARIA labels, native dragging, centered title, save status, and responsive compact behavior remain intact. Focused tests, the full Node suite, production build, diff checks, and a Tauri/editor visual smoke check pass.

## Task 1: Lock the Framework Icon Contract

**Outcome:** A focused regression contract distinguishes the current font glyph implementation from the requested framework-icon composition.
**Files:**
- Modify: `tests/editorChromeNavigation.test.mjs`

**Change Map:**
- toolbar contract: require named `lucide-react` imports and their placement in the window file-action controls
- regression boundary: reject `⌂`, `＋`, `▱`, `⌑`, and `⌄` in `Toolbar`
- accessibility boundary: retain the existing file-action ARIA labels and visible dropdown text

**Verification:**
- `node --test tests/editorChromeNavigation.test.mjs`

- [x] Add the focused framework-icon assertions and confirm they fail against the current glyph implementation.
- [x] Keep assertions tied to visible action semantics and accessibility rather than generated SVG markup.

## Task 2: Replace Title Bar Glyphs with Lucide Components

**Outcome:** The compact title bar and its file-action menus use one crisp, platform-independent icon language without behavioral changes.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/components/Toolbar.tsx`

**Change Map:**
- dependencies: add `lucide-react` as a production dependency
- `Toolbar`: import named icons for Home, New File, Open, Save, save options, and dropdown rows
- icon semantics: use consistent size/stroke properties and mark decorative icons hidden from assistive technology

**Verification:**
- Run the focused Task 1 test.
- Inspect the rendered title bar at normal and compact widths for alignment, hover/focus states, menu spacing, and save-status stability.

- [x] Add the icon dependency and replace every legacy title-bar glyph with a semantic framework icon.
- [x] Add matching menu-row icons without changing labels, callbacks, or menu grouping.
- [x] Review the diff for accidental toolbar layout or behavior changes.

## Task 3: Verify and Deliver F007

**Outcome:** The icon refresh ships as an isolated, documented F007 change with regression and visual evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/features/F007-framework-title-bar-icons.md`

**Change Map:**
- F007 feature and plan: completion status, checked outcomes, and final verification evidence
- generated plan index: refreshed F007 state

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Tauri/editor smoke for title-bar icons, tooltips, dropdown rows, centered title, drag region, and saved/dirty/saving states

- [x] Run the complete Node regression suite and production build once after implementation stabilizes.
- [x] Complete the title-bar visual smoke matrix and record any environment limitation.
- [x] Mark F007 and its human request complete, refresh the plan index, and create a separate `feat(F007)` commit without staging `AGENTS.md`.

## Delivery Evidence

- TDD red: the focused `editorChromeNavigation` run failed in the expected toolbar contract because `Toolbar` had no `lucide-react` import and still rendered the five legacy Unicode glyphs.
- Focused green: `node --test tests/editorChromeNavigation.test.mjs` passed 4/4 after the framework-icon replacement.
- `node --test tests/*.test.mjs` — all 159 frontend/library regressions passed.
- `npm run build` — TypeScript and Vite production build passed. The existing Excalidraw mixed dynamic/static import and large-chunk warnings remain informational.
- Dependency verification: `npm ls lucide-react --depth=0` resolved `lucide-react@1.28.0`, whose peer contract includes React 19. The install repeated the existing Excalidraw-internal legacy Radix peer warnings without changing their dependency versions.
- `git diff --check` — passed against the stabilized implementation.
- Native visual smoke: an isolated `IdeaNote F007 Acceptance.app` with identifier `com.zhengxiwan.ideanote.f007` built and launched. The title bar showed aligned House, File Plus, Folder Open, Save, and Chevron icons at the intended compact scale; the centered filename and Unsaved changes status retained their positions. Accessibility exposed the unchanged Back to Home, New File, Open, Save, and More Save options controls. Computer Use could not reliably open the Radix WebView dropdown overlay for screenshot inspection, so menu-row icon composition is covered by the focused source contract and production build. The isolated acceptance process was stopped without touching the installed IdeaSlide application.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F006-revision-c-editor-shell-defaults.md`
- `src/components/Toolbar.tsx`
- `src/components/SaveIndicator.tsx`
- `src/components/ui/ToolbarAction.tsx`
- `src/components/ui/DropdownMenu.tsx`
- `tests/editorChromeNavigation.test.mjs`
