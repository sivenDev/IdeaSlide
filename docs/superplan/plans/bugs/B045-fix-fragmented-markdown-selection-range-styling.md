---
id: "B045"
title: "Fix Fragmented Markdown Selection Range Styling"
type: "bugfix"
status: "complete"
summary: "Restore continuous Markdown selection highlighting without detached boundary blocks."
source: "docs/superplan/human/bugs.md"
created: "2026-08-13"
order: 45
depends_on: ["F059"]
parent: ""
---

# Fix Fragmented Markdown Selection Range Styling Plan

**Goal:** Make multi-line Markdown selections read as one continuous range without detached purple blocks at line boundaries.
**Scope:** Correct the CodeMirror selection-layer styling introduced by F059 so focused and unfocused selections remain visibly distinct through theme changes and focus movement, while wrapped and multi-line selections have no per-fragment outline artifacts.
**Non-Goals:** This fix does not change selection behavior, selection persistence, document content, dirty state, native Undo/Redo, Agent selection context, CodeMirror mounting, search highlighting, active-line styling, Markdown preview, or the broader theme palette.
**Architecture:** Keep CodeMirror's `drawSelection()` layer and the existing single mounted `EditorView`. Remove the per-rectangle four-sided boundary treatment and rely on deliberate focused/unfocused semantic fills that remain readable without outlining each internal selection fragment. Retire the unused boundary token rather than preserving a misleading styling contract.
**Baseline:** F059 added focused and unfocused selection colors plus `boxShadow: inset 0 0 0 1px` to every `.cm-selectionBackground` element. CodeMirror represents a multi-line selection as multiple positioned rectangles, including narrow line-boundary pieces, so each rectangle receives its own complete border.
**Reproduction:** Select text across two or more Markdown lines, including a line boundary. The selection fill spans the text, but small independently bordered purple rectangles appear at the left or right edge, matching the screenshot supplied with B045. Moving focus away changes the fill but preserves the detached border artifacts.
**Root Cause:** The selection range is correct; the visual defect begins in the F059 EditorView theme. A four-sided inset `box-shadow` is applied independently to CodeMirror's internal selection rectangles, exposing their implementation segmentation instead of presenting one continuous user selection.
**Exit Criteria:** Focused and unfocused Markdown selections remain unmistakable in Light and Dark themes. Multi-line, wrapped, reversed, and select-all ranges show continuous fill with no detached blocks or internal per-line borders. Focus movement, history, dirty state, Agent context, and the single-EditorView contract remain unchanged. Focused selection regressions, the relevant theme/editor checks, full frontend regression, production build, browser acceptance, workflow validation, and diff checks pass.

## Task 1: Remove Per-Fragment Selection Borders

**Outcome:** CodeMirror renders a continuous focused or unfocused selection surface without revealing its internal rectangle segmentation.
**Files:**
- Modify: `src/hooks/useCodeMirrorEditor.ts`
- Modify: `src/index.css`
- Modify: `tests/markdownSelection.test.mjs`

**Change Map:**
- `useCodeMirrorEditor` selection theme: remove the inset border from focused and unfocused selection rectangles while retaining precise selectors and distinct semantic fills
- Markdown editor tokens: remove the unused selection-border token and preserve adequate focused/unfocused contrast
- selection regression: fail if a per-fragment border or shadow returns, while preserving the single-EditorView and no-secondary-state assertions

**Verification:**
- `node --test tests/markdownSelection.test.mjs tests/markdownEditorRefinement.test.mjs tests/themeVisualContract.test.mjs`
- Browser acceptance in Light and Dark: select across line boundaries and wrapped lines, then move focus to toolbar and Preview; inspect for continuous fill and absence of detached edge blocks.

- [x] Add a focused regression that rejects per-fragment selection borders or shadows.
- [x] Remove the root-cause styling and obsolete token without weakening focused/unfocused distinction.
- [x] Verify multi-line selection appearance and unchanged editor lifecycle behavior.

## Task 2: Verify and Deliver B045

**Outcome:** The visual regression is closed with current focused, full-regression, build, workflow, and source-control evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B045-fix-fragmented-markdown-selection-range-styling.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- final verification: compare focused/unfocused and single/multi-line selection behavior against the screenshot and F059 acceptance contract
- workflow: complete B045 only after verification, regenerate the plan index, and stage only B045 changes

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run focused checks during implementation and one stabilized full frontend/build regression.
- [x] Confirm the screenshot artifact is gone across focus and theme states without selection lifecycle regressions.
- [x] Mark B045 complete/done and create a separate `fix(B045)` commit.

## Delivery Evidence

- The focused regression first failed against the F059 implementation because `.cm-selectionBackground` still carried an inset `boxShadow` and the `--ideanote-editor-selection-border` token. It now rejects both contracts while retaining focused/unfocused selectors, `drawSelection()`, one `EditorView`, and no secondary selection state.
- The root-cause fix removes only the per-fragment shadows and obsolete border token. Focused and unfocused selection fills remain distinct and continue to use the existing semantic Light/Dark theme boundary.
- Focused verification passed: `node --test tests/markdownSelection.test.mjs tests/markdownEditorRefinement.test.mjs tests/themeVisualContract.test.mjs` (13/13).
- Browser acceptance reproduced a multi-line select-all range in Dark and Light themes. Every CodeMirror selection rectangle reported `box-shadow: none` and `border-width: 0`, while focused and unfocused computed background colors remained different; the detached purple edge blocks from the supplied screenshot were absent at the root styling boundary.
- The stabilized frontend regression passed: `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`. Production TypeScript/Vite build passed with only the existing mixed static/dynamic import and large-chunk advisories.
- Final workflow validation, generated-index validation, diff checks, and exact task-path review passed before the B045 commit.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F059-improve-markdown-selection-and-rich-code-previews.md`
- `src/hooks/useCodeMirrorEditor.ts`
- `src/index.css`
- `tests/markdownSelection.test.mjs`
