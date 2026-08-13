---
id: "B047"
title: "Match Tauri Markdown Selection to the Approved Demo"
type: "bugfix"
status: "complete"
summary: "Apply the demo's exact Markdown-scoped native selection boundary in the Tauri editor."
source: "docs/superplan/human/bugs.md"
created: "2026-08-13"
order: 47
depends_on: ["B046"]
parent: ""
---

# Match Tauri Markdown Selection to the Approved Demo Plan

**Goal:** Make Tauri Markdown selections render with the same character-tight geometry already accepted in the review demo.
**Scope:** Give the production Markdown source host an explicit stable class and move native selection styling to the same host-scoped `.cm-content`, `.cm-line`, and descendant `::selection` selectors used by the demo. Remove the approximate `EditorView.theme` selection selectors, retain the existing Light/Dark semantic tokens, and verify inline and cross-line ranges in the running Tauri app.
**Non-Goals:** This fix does not change CodeMirror selection state, document content, history, Agent context, dirty state, Markdown preview behavior, view modes, global selection styling, or the accepted demo.
**Architecture:** Treat the production Markdown host DOM and global semantic CSS as the styling boundary, matching the accepted demo exactly. CodeMirror remains the sole editor state owner with one mounted `EditorView`; no selection overlay, decoration, React state, or custom range geometry is introduced.
**Baseline:** B046 removed `drawSelection()` in both surfaces, but production kept selection rules inside `EditorView.theme` as broad `&.cm-focused ::selection` and `&:not(.cm-focused) ::selection` selectors. The accepted demo instead targets the actual Markdown host descendants through `.markdown-source .cm-content::selection`, `.markdown-source .cm-line::selection`, and `.markdown-source .cm-line *::selection`. The Tauri source host currently has only utility classes and therefore cannot reuse that proven boundary.
**Reproduction:** In the running Tauri Markdown editor, drag an inline or cross-line selection and compare it with the accepted review demo. The production highlight still differs from the demo even though both use native selection, because Tauri does not apply the demo's exact host and text-node selector boundary.
**Root Cause:** B046 migrated the rendering mechanism but not the complete demo styling boundary. Production approximated the demo with EditorView theme ancestor selectors instead of applying the explicit Markdown-host descendant selectors that reliably style CodeMirror's content and line DOM.
**Exit Criteria:** Tauri uses a Markdown-specific host class and the same three native selection selector shapes as the approved demo. The obsolete theme-local selection selectors are absent. Inline and cross-line selections hug characters in Light and Dark without CodeMirror selection-layer nodes, while one `EditorView`, Undo/Redo, Agent selection context, and Edit/Split/Preview behavior remain unchanged. Focused regressions, full frontend regression, production build, real Tauri browser/UI acceptance, workflow validation, diff checks, and a separate B047 commit pass.

## Task 1: Port the Exact Demo Selection Boundary

**Outcome:** Production selection styling targets the same CodeMirror DOM descendants as the accepted demo.
**Files:**
- Modify: `src/components/MarkdownEditor.tsx`
- Modify: `src/hooks/useCodeMirrorEditor.ts`
- Modify: `src/index.css`
- Modify: `tests/markdownSelection.test.mjs`

**Change Map:**
- Markdown source host: add a stable production class equivalent to the demo's `.markdown-source` boundary
- production semantic CSS: style `.cm-content::selection`, `.cm-line::selection`, and `.cm-line *::selection` under that host with existing selection tokens
- EditorView theme: remove the approximate focused/unfocused ancestor rules without restoring `drawSelection()`
- regression: require the exact demo-shaped selector boundary and reject selection ownership in the hook

**Verification:**
- `node --test tests/markdownSelection.test.mjs tests/markdownEditorRefinement.test.mjs tests/themeVisualContract.test.mjs tests/markdownEditorContract.test.mjs`
- Real Tauri acceptance in Light and Dark: inline pointer selection, cross-line pointer and keyboard selection, wrapped text, focus movement, Undo/Redo, and Edit/Split/Preview.

- [x] Add a regression that fails until production uses the demo's exact host-scoped selector shapes.
- [x] Port the host and CSS boundary and remove the approximate hook-local selectors.
- [x] Verify selection geometry and unchanged editor lifecycle in the running Tauri app.

## Task 2: Verify and Deliver B047

**Outcome:** The demo/Tauri mismatch is closed with current regression, build, visual, workflow, and source-control evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B047-match-tauri-markdown-selection-to-approved-demo.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- delivery evidence: record exact selector parity and real Tauri inline/cross-line observations
- workflow: mark B047 complete/done only after verification and create an isolated task commit

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run focused checks and one stabilized full frontend/build regression.
- [x] Confirm Tauri matches the accepted demo for inline and cross-line selection geometry.
- [x] Mark B047 complete/done and create a separate `fix(B047)` commit.

## Delivery Evidence

- The focused regression first failed because `useCodeMirrorEditor.ts` still owned broad `&.cm-focused ::selection` and unfocused selectors, while production had no Markdown source host class or Demo-shaped descendant selectors.
- Production now gives the single CodeMirror host the stable `ideanote-markdown-source` class and copies the accepted Demo selector structure exactly: `.cm-content::selection`, `.cm-line::selection`, and `.cm-line *::selection` under that host. The hook no longer owns any `::selection` rule and `drawSelection()` remains absent.
- Focused verification passed: `node --test tests/markdownSelection.test.mjs tests/markdownEditorRefinement.test.mjs tests/themeVisualContract.test.mjs tests/markdownEditorContract.test.mjs` (16/16). The stabilized full frontend suite passed and `npm run build` passed with only the existing mixed-import and large-chunk advisories.
- The initially opened `/Applications/IdeaNote.app` / release-bundle window was identified as stale and explicitly excluded from acceptance. The old release process was stopped before valid visual verification.
- Current-source native acceptance used the exact repository artifact `/Users/zhengxiwan/ide-workspace/idea-slide/src-tauri/target/debug/bundle/macos/IdeaNote.app`, built after the B047 changes. Keyboard-created inline selection highlighted only the `IdeaNote` characters, and cross-line selection ended at actual selected characters without CodeMirror selection-layer slabs. Both Light and Dark themes were verified, including selection retention through the Settings theme change.
- `npm run tauri build -- --debug` produced the current debug app and DMG. Bundling completed; only updater archive signing failed afterward because `TAURI_SIGNING_PRIVATE_KEY` is not configured, which does not affect the generated `.app` used for acceptance.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/bugs/B046-replace-blocky-markdown-selection-geometry.md`
- `docs/superplan/plans/features/F059-improve-markdown-selection-and-rich-code-previews.md`
- `.temp/f041-native-workbench-review/src/styles.css`
- `src/components/MarkdownEditor.tsx`
- `src/hooks/useCodeMirrorEditor.ts`
- `src/index.css`
