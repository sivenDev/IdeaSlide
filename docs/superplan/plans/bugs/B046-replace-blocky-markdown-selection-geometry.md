---
id: "B046"
title: "Replace Blocky Markdown Selection Geometry"
type: "bugfix"
status: "complete"
summary: "Prove character-tight Markdown selections in the review demo before migrating them to production."
source: "docs/superplan/human/bugs.md"
created: "2026-08-13"
order: 46
depends_on: ["B045", "F059"]
parent: ""
---

# Replace Blocky Markdown Selection Geometry Plan

**Goal:** Make Markdown selections follow the selected characters instead of CodeMirror's line-filling selection rectangles.
**Scope:** First implement and visually verify a native browser selection treatment in the tracked review demo. Cover inline, cross-line, wrapped-line, reversed, select-all, focused, unfocused, Light, and Dark cases with real CodeMirror interaction. Only after the demo meets acceptance, migrate the proven boundary to the production Tauri Markdown editor and repeat the same verification. Preserve the existing focused/unfocused semantic colors where the browser surface supports them, with character-tight geometry taking priority over artificial full-line continuity.
**Non-Goals:** This fix does not replace CodeMirror, add a custom selection model, change selection semantics, modify text/history/dirty state, change Agent selection context, alter Edit/Split/Preview behavior, introduce rectangular selection, redesign the Markdown editor, or change other application selection colors.
**Architecture:** Remove CodeMirror's `drawSelection()` extension from the demo and then production editor so the browser's native `::selection` paints actual glyph ranges. Keep the single mounted `EditorView`, native CodeMirror state, history, transactions, cursor, and DOM selection synchronization. Scope semantic `::selection` styling to each Markdown editor surface; do not synthesize selection rectangles or mirror ranges into React state. Because native selection does not remain painted after focus leaves the editable content on every engine, demo acceptance will explicitly determine the product behavior: prefer accurate character geometry, and preserve unfocused visibility only when the platform can do so without reintroducing line-filling overlays.
**Baseline:** F059 enabled CodeMirror `drawSelection()` and styled its `.cm-selectionBackground` rectangles. B045 removed their border, but screenshots still show large central rectangles and line-edge blocks. CodeMirror's own implementation documents that `drawSelection()` intentionally fills horizontal space after a line when a selection continues past it; `RectangleMarker.forRange` supplies the observed geometry. Both the tracked review demo and production editor currently enable this extension.
**Reproduction:** In either Markdown editor, select part of one line or select from the middle of one line into the next. The highlight is rendered by `.cm-selectionLayer` rectangles rather than the exact browser text range. Cross-line selection includes horizontal fill and detached edge blocks, matching the supplied screenshots; removing shadow/border does not change those rectangles.
**Root Cause:** The wrong geometry is intrinsic to the selected rendering mechanism, not its palette. `drawSelection()` hides the browser's native selection and replaces it with rectangle markers designed to fill inter-line horizontal space. Styling those markers cannot make them character-tight; the renderer must change.
**Exit Criteria:** In the review demo, inline and cross-line selections hug actual selected characters with no full-width middle slab or detached left/right blocks in Light and Dark. Wrapped, reversed, select-all, keyboard, pointer, and theme-change behavior is verified, and cursor/edit/history behavior remains intact. The same proven implementation is then migrated to production, where Edit/Split/Preview, toolbar focus, Undo/Redo, dirty state, Agent selection context, and one mounted `EditorView` remain unchanged. Focused demo and production tests, browser acceptance for both surfaces, full frontend regression, production build, workflow validation, and diff checks pass.

## Task 1: Prove Character-Tight Selection in the Review Demo

**Outcome:** The review demo provides a visually accepted CodeMirror selection implementation before production code changes.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/editors/markdown/MarkdownEditor.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Modify: `.temp/f041-native-workbench-review/tests/markdownEditorRefinement.test.mjs`

**Change Map:**
- demo editor extensions: remove `drawSelection()` while retaining one `EditorView`, CodeMirror history, cursor, wrapping, editable/read-only behavior, and Agent adapter selection reads
- demo theme: add scoped native `::selection` color using existing Light/Dark semantic tokens, without line-layer rectangles or custom range state
- demo regression: reject `drawSelection()` and `.cm-selectionBackground` ownership while asserting native selection styling and preserved editor lifecycle boundaries

**Verification:**
- `cd .temp/f041-native-workbench-review && node --test tests/markdownEditor.test.mjs tests/markdownEditorRefinement.test.mjs tests/agentEditorTools.test.mjs`
- `cd .temp/f041-native-workbench-review && npm run build`
- Demo browser acceptance: pointer and keyboard inline selection; selection across two and three lines; wrapped line; reversed range; Select All; type/Undo/Redo after selection; Light/Dark; focus movement observation; screenshots and DOM Range geometry must show no full-width middle slab or detached blocks.

- [x] Add a failing demo regression that distinguishes native character selection from CodeMirror rectangle-layer selection.
- [x] Implement scoped native selection in the demo without changing editor state or tools.
- [x] Obtain real demo browser evidence for every geometry/theme/focus case before touching production.

## Task 2: Migrate the Proven Selection Boundary to Production

**Outcome:** The production Tauri Markdown editor uses the demo-approved character-tight selection behavior.
**Files:**
- Modify: `src/hooks/useCodeMirrorEditor.ts`
- Modify: `tests/markdownSelection.test.mjs`
- Inspect: `src/index.css`
- Inspect: `tests/markdownEditorRefinement.test.mjs`
- Inspect: `tests/themeVisualContract.test.mjs`

**Change Map:**
- production editor extensions: remove `drawSelection()` and the obsolete rectangle-layer selectors, retaining one mounted `EditorView` and all transaction/history/selection APIs
- production theme: scope native `::selection` colors to Markdown and keep theme contrast readable without styling artificial rectangles
- production regressions: prove no selection layer is installed, no secondary state is introduced, native selection styling exists, and editor/Agent lifecycle contracts stay unchanged

**Verification:**
- `node --test tests/markdownSelection.test.mjs tests/markdownEditorRefinement.test.mjs tests/themeVisualContract.test.mjs tests/markdownEditorContract.test.mjs`
- Production browser acceptance repeats the approved demo matrix in Light and Dark, including Edit/Split/Preview changes, toolbar focus observation, Undo/Redo, and Agent selection reads.

- [x] Port only the demo-proven extension and styling boundary.
- [x] Verify production selection geometry and lifecycle parity against demo evidence.
- [x] Remove obsolete F059/B045 rectangle-layer contracts without unrelated theme changes.

## Task 3: Verify and Deliver B046

**Outcome:** The second selection regression is closed only after demo-first and production evidence agree.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B046-replace-blocky-markdown-selection-geometry.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- evidence: record demo-first screenshots/geometry observations, production parity, focus tradeoffs, focused/full regression, and build warnings
- workflow: complete B046 only after all demo and production acceptance passes, then regenerate the index and stage exact B046 paths

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run demo focused/build checks, production focused checks, and one stabilized full frontend/build regression.
- [x] Confirm demo and production both satisfy the screenshot geometry requirement and document any native-focus limitation honestly.
- [x] Mark B046 complete/done and create a separate `fix(B046)` commit.

## Delivery Evidence

- Demo-first implementation removed CodeMirror `drawSelection()` and added Markdown-scoped native `::selection` styling. The regression rejects `drawSelection`, `.cm-selectionBackground`, secondary selection state, and multiple `EditorView` mounts.
- Demo focused verification passed: `node --test tests/markdownEditor.test.mjs tests/markdownEditorRefinement.test.mjs tests/agentEditorTools.test.mjs` (8/8). The demo full test suite and `npm run build` also passed before the production migration.
- Real demo browser measurement selected `Alpha beta gamma\nSecond line`: the editor content width was approximately 624.55 px while the two native range rectangles were approximately 115.59 px and 79.48 px (maximum ratio 0.185). No `.cm-selectionLayer` or `.cm-selectionBackground` nodes existed. Light and Dark selection colors resolved to `rgb(217, 226, 247)` and `rgb(37, 58, 98)`, respectively.
- Production migrated only the proven renderer boundary: `drawSelection()` and rectangle-layer selectors were removed while the existing single `EditorView`, transactions, history, editor adapter, and semantic focused/unfocused tokens remained. `src/index.css` and unrelated theme contracts required no change.
- Real production browser measurement of the same range reported an editor content width of approximately 671.5 px and native range rectangles of approximately 125.23 px and 86.09 px (maximum ratio 0.1865), with zero custom selection-layer nodes. Light and Dark colors worked, Undo/Redo remained functional, and Preview to Split retained exactly one `.cm-editor`.
- Moving focus to Settings in the demo and Sync Scroll in production left the DOM `Range` intact. Native unfocused painting remains platform-dependent by design; accurate character geometry takes priority and no line-filling overlay was reintroduced.
- Production focused verification passed: `node --test tests/markdownSelection.test.mjs tests/markdownEditorRefinement.test.mjs tests/themeVisualContract.test.mjs tests/markdownEditorContract.test.mjs` (16/16). The stabilized demo and production full frontend suites passed, and both builds passed. Production retained only the existing mixed static/dynamic import and large-chunk advisories.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/bugs/B045-fix-fragmented-markdown-selection-range-styling.md`
- `docs/superplan/plans/features/F059-improve-markdown-selection-and-rich-code-previews.md`
- `.temp/f041-native-workbench-review/src/editors/markdown/MarkdownEditor.jsx`
- `.temp/f041-native-workbench-review/src/styles.css`
- `src/hooks/useCodeMirrorEditor.ts`
- `src/index.css`
