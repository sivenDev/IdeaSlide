---
id: "F026"
title: "Refine Unsaved-state Danger Color and Dialog Scale"
type: "feature"
status: "complete"
summary: "Unify the dirty save indicator on an accessible danger red and reduce the unsaved-changes dialog to 260 by 200 pixels."
source: "docs/superplan/human/features.md"
created: "2026-08-06"
order: 26
depends_on: ["F025"]
parent: ""
---

# Refine Unsaved-state Danger Color and Dialog Scale Plan

**Goal:** Make the unsaved state visually coherent and reduce the decision dialog's footprint without weakening its hierarchy or accessibility.
**Scope:** Use one accessible danger red for both the title-bar dirty dot and `Unsaved changes` label, with a restrained matching halo. Reduce the unsaved dialog from its current approximately 480 by 338-pixel card to an exact 260 by 200-pixel desktop card with proportionally tighter padding, typography, action spacing, button height, radius, and shadow while preserving the same copy and action order.
**Non-Goals:** This feature does not change save-state calculation, `Saving...` or `Saved` styling, dialog behavior, exit orchestration, button labels, action priority, overlay dismissal, focus management, responsive edge gutters, or any persistence and recovery logic.
**Architecture:** Keep `SaveIndicator` and `UnsavedChangesDialog` markup unchanged. Promote the existing shell danger token to an accessible deep berry-red `#C83F47` that fits IdeaNote's cool purple-gray palette and provides approximately 4.9:1 contrast against the white title bar. Apply that token to the dirty dot and label, and derive the dot halo from the same RGB hue. Limit the dialog refinement to its existing CSS selectors so F025's Radix accessibility and Promise coordination boundaries remain untouched.
**Baseline:** F025 colors the dirty label `#D92D20` but leaves the adjacent dot gray, so the two-part status reads as visually inconsistent. Its rendered dialog is approximately 480 by 338 pixels, with 32-pixel padding, a 26-pixel title, 52-pixel buttons, and a 28-pixel radius; the provided follow-up reference shows that this scale feels oversized for the editor chrome.
**Exit Criteria:** The dirty dot, its halo, and `Unsaved changes` label read as one danger state using `#C83F47`; the small label retains at least WCAG AA contrast on the title-bar background. `Saving...` and `Saved` retain their existing colors. The dialog renders at exactly 260 by 200 pixels on a normal desktop viewport, keeps the heading, filename copy, and all three actions legible with compact desktop-sized controls, and continues to fit narrow supported windows without clipping. Existing focus, Escape, backdrop, reduced-motion, save, discard, and cancel behavior remains unchanged. Focused styling contracts, the frontend suite, production build, visual inspection, and diff checks pass.

## Task 1: Align the Danger Indicator and Compact the Dialog

**Outcome:** The title-bar dirty state uses one product-consistent danger treatment and the unsaved decision card feels proportionate to the editor.
**Files:**
- Modify: `src/index.css`
- Modify: `tests/editorChromeNavigation.test.mjs`
- Modify: `tests/unsavedChangesDialog.test.mjs`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F026-refine-unsaved-state-danger-and-dialog-scale.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- shell danger token: deepen `--idea-slide-danger` to accessible `#C83F47`
- dirty save indicator: use the token for both dot and label, plus a hue-matched low-opacity halo
- unsaved dialog scale: use an exact 260 by 200-pixel card with 14-pixel padding, an 18-pixel radius, a 16-pixel title, tight vertical rhythm, and 34-pixel action buttons
- visual regression contracts: require shared danger-token usage and the compact dialog metrics while retaining F025 accessibility selectors

**Verification:**
- `node --test tests/editorChromeNavigation.test.mjs tests/unsavedChangesDialog.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- Browser/Tauri visual check at normal and minimum supported window sizes.
- `git diff --check`

**Completion Evidence (2026-08-06):**
- Focused editor-chrome and unsaved-dialog contracts passed: 7/7 tests.
- Complete frontend suite passed: 240/240 tests.
- `npm run build` and `git diff --check` passed; existing Vite mixed-import and large-chunk warnings remain unchanged.
- Browser measurements confirmed an exact 260 by 200-pixel card, 14-pixel padding, 18-pixel radius, 16-pixel title, 34-pixel buttons, and no scroll overflow at normal and 1200 by 850 viewports.
- Browser computed styles confirmed the dirty dot and label both use `rgb(200, 63, 71)` (`#C83F47`), with a matching 14% halo; Escape cancelled the dialog and retained the open editor.

- [x] Add focused contracts for the unified danger treatment and compact dialog scale.
- [x] Apply the CSS-only visual refinement without changing component behavior.
- [x] Verify, complete F026 workflow records, and create a separate `feat(F026)` commit.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F025-three-action-unsaved-changes-dialog.md`
- `src/components/SaveIndicator.tsx`
- `src/components/UnsavedChangesDialog.tsx`
- `src/index.css`
- `tests/editorChromeNavigation.test.mjs`
- `tests/unsavedChangesDialog.test.mjs`
