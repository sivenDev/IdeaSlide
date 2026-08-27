---
id: "F068"
title: "Support Tab Indentation in the Markdown Editor"
type: "feature"
status: "complete"
summary: "Bind Tab and Shift+Tab in the CodeMirror Markdown editor to native indentation so list items can be nested and un-nested."
source: "docs/superplan/human/features.md"
created: "2026-08-27"
order: 68
depends_on: []
parent: ""
---

# Support Tab Indentation in the Markdown Editor Plan

**Goal:** Make Markdown list nesting usable from the keyboard by giving Tab and Shift+Tab their expected indentation behavior.
**Scope:** Add CodeMirror's native Tab indentation binding to the registry-driven Markdown source editor. Tab indents the current line or selected lines using the active Markdown language indentation service (including list items), and Shift+Tab reduces indentation. Keep read-only protection, native history, selection behavior, and all existing Edit/Split/Preview and autosave flows unchanged.
**Non-Goals:** Do not change Markdown parsing or preview rendering, add a configurable tab width, insert literal tab characters in the default Tab action, alter non-Markdown editors, or redesign the editor toolbar.
**Architecture:** Keep keyboard behavior inside `useCodeMirrorEditor`, where the single CodeMirror state already owns language services, history, read-only configuration, and keymaps. Add `indentWithTab` alongside the existing default/history/search keymaps so Markdown's language-aware indentation service handles both single cursors and selections without introducing a parallel text-mutation path.
**Baseline:** `useCodeMirrorEditor` currently enables `defaultKeymap`, `historyKeymap`, and `searchKeymap`, but does not bind Tab. CodeMirror's Markdown language service already computes list indentation when `indentMore`/`indentLess` are invoked.
**Exit Criteria:** In a writable Markdown editor, Tab on a list item creates the next Markdown nesting level, Shift+Tab removes one level where possible, and selecting multiple lines applies the same operation to the selection. Each operation appears as one native CodeMirror history step, updates the document/autosave path, and leaves read-only documents unchanged. Existing focused Markdown contract tests, the full Node suite, production build, and whitespace checks pass.

## Task 1: Wire and Prove Markdown Tab Indentation

**Outcome:** The Markdown CodeMirror hook exposes standard Tab and Shift+Tab indentation while preserving existing keymap ordering and editor safety boundaries.
**Files:**
- Modify: `src/hooks/useCodeMirrorEditor.ts`
- Modify: `tests/markdownEditorContract.test.mjs`

**Change Map:**
- CodeMirror keymap: import and register `indentWithTab` after the existing standard keymaps so Tab/Shift+Tab invoke language-aware `indentMore`/`indentLess`.
- Markdown contract test: assert the binding is present and remains coupled to the existing history, read-only, and single-host editor setup.

**Verification:**
- `node --test tests/markdownEditorContract.test.mjs tests/markdownEditorRefinement.test.mjs`
- Exercise a Markdown CodeMirror state with `- parent\\n- child`, cursor on the second item: Tab yields `- parent\\n  - child`; Shift+Tab restores the original text; read-only state rejects both commands.

- [x] Add the `indentWithTab` binding to the shared CodeMirror Markdown hook.
- [x] Add focused source-level and behavior-level coverage for list nesting, outdenting, selection handling, history, and read-only safety.

## Task 2: Verify and Deliver F068

**Outcome:** The feature is complete with current regression, build, plan-index, and task-scoped Git evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F068-support-tab-indentation-in-markdown-editor.md`
- Modify: `docs/superplan/plans/README.md`

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.7.0+codex.20260820095924/skills/using-superplan/scripts/human_requests.py validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.7.0+codex.20260820095924/skills/using-superplan/scripts/generate_plans_readme.py --write --check`

- [x] Run focused and full verification after implementation stabilizes.
- [x] Mark F068 delivered, refresh the plan index, inspect the task-only diff, and create a separate `feat(F068)` commit.

## Completion Evidence

- `indentWithTab` is registered in the shared CodeMirror Markdown hook, delegating Tab and Shift+Tab to Markdown's native language-aware indentation service.
- Focused Markdown tests prove list nesting, outdenting, multi-line selection indentation, one-step native Undo, and read-only protection.
- `node --test tests/*.test.mjs` passed all 466 tests; `npm run build`, `git diff --check`, human-request validation, and plan-index validation passed.

## References
- `docs/superplan/human/features.md`
- `src/hooks/useCodeMirrorEditor.ts`
- `tests/markdownEditorContract.test.mjs`
