---
id: "B033"
title: "Refine Markdown Editor Navigation, View Switching, and Controls"
type: "bugfix"
status: "complete"
summary: "Keep Markdown view switching stable, simplify its editor chrome, and add a default-off line-number preference."
source: "docs/superplan/human/bugs.md"
created: "2026-08-11"
order: 33
depends_on: ["F044-03"]
parent: ""
---

# Refine Markdown Editor Navigation, View Switching, and Controls Plan

**Goal:** Make the review demo's Markdown editor behave like a stable, editor-owned writing surface with concise navigation, persistent native history, and an explicit line-number preference.
**Scope:** Refine only `.temp/f041-native-workbench-review/`. Move the Outline toggle to the far-left edge of the Markdown toolbar, keep the CodeMirror editor mounted while switching among Edit, Split, and Preview, remove the formatting/Search Tool buttons, and place native Undo/Redo controls in a compact lower-left floating cluster inside the Markdown editor area. Add an Editors → Markdown Settings page with a shared switch controlling CodeMirror line numbers; line numbers are off by default and update without replacing the active document or its CodeMirror history.
**Non-Goals:** This bugfix does not migrate prototype code into production `index.html`, `src/`, `tests/`, `src-tauri/`, or Tauri capabilities; change Markdown parsing, GFM rendering, outline extraction, line-ending normalization, persistence, Agent Tools, keyboard shortcuts, split resizing, or file/session behavior; remove CodeMirror native keyboard Undo/Redo or Search; redesign IdeaSketch/Excalidraw controls; add font, wrapping, minimap, or other Markdown preferences; or approve production migration.
**Architecture:** Keep the mounted CodeMirror `EditorView` authoritative across every view mode. Render its host for the complete Markdown editor lifetime, hide it only at the layout layer in Preview, and request a CodeMirror measure when returning to Edit/Split so selection, native Undo/Redo history, and editor adapter identity survive. Use a CodeMirror `Compartment` for the line-number extension so Settings can reconfigure gutters without rebuilding the editor state. Route `settings.markdown.showLineNumbers` through `DemoApp` → `EditorHost` → `MarkdownEditor`, with `false` as the mock settings default. Simplify the top chrome to `[Outline] [Edit | Split | Preview] … [line ending]`; render Undo/Redo as an editor-local lower-left pair using existing Lucide icons and CodeMirror commands. Preserve the Paper/Graphite/Cobalt tokens and use the existing shared `SettingsSwitch`.
**Baseline:** `MarkdownEditor` conditionally renders `.markdown-source` only when `mode !== "preview"`, while the effect that creates `EditorView` depends only on document session/read-only state. Entering Preview therefore destroys the source DOM host without destroying/rebinding the existing view, and returning creates an empty host that receives no new `EditorView`. The editor extensions always include `lineNumbers()`. Settings contributes only IdeaSketch under Editors and `EditorHost` passes only the IdeaSketch laser preference. The top toolbar places Outline last and mixes Heading, Bold, Italic, Link, List, Undo, Redo, and Search with the view selector.
**Reproduction:** Open a Markdown file in the review demo. The Outline toggle appears at the toolbar's far right, line numbers are visible with no Settings control, and formatting/Search/Undo/Redo occupy the top toolbar. Choose Preview, then choose Split or Edit: the source pane returns as a blank surface because its replacement host is not bound to CodeMirror. The preview content and document model remain present, demonstrating that the failure is the editor mount lifecycle rather than data loss.
**Root Cause:** The Markdown source DOM host is treated as a mode-specific projection even though the mounted CodeMirror view and native history are session-scoped. Conditional host removal breaks the view-to-DOM binding, but the initialization effect has no mode dependency and cannot attach a replacement view. Separately, line-number policy is embedded directly in the initial extension array instead of a reconfigurable editor preference, and all Markdown actions were grouped into one generic top toolbar rather than separated by navigation, view, and native-history ownership.
**Exit Criteria:** The Outline toggle is the first Markdown toolbar control and opens/closes the left outline without changing document content. Repeated Preview → Split/Edit → Preview transitions keep source text, selection, focus recovery, native Undo/Redo history, Agent adapter identity, split ratio, and preview output intact with no blank editor or duplicate CodeMirror instance. The Markdown top toolbar contains only Outline, Edit/Split/Preview, and line-ending state/normalization; it contains no Heading, Bold, Italic, Link, List, Search, Undo, or Redo buttons. Undo/Redo appear as a compact lower-left editor control pair, invoke CodeMirror native history, expose accessible labels/focus, and do not overlap the Outline, resize rail, or narrow frames. Settings → Editors contains Markdown with a Line numbers switch; the default is off, saving on/off persists through the mock settings boundary, and live changes reconfigure the active CodeMirror gutter without replacing editor history. Light, Dark, System, 1200x850/1100x850/850x850, focused/full demo tests, build, clean console, and production-isolation checks pass.

## Task 1: Stabilize Markdown View Lifetime and Simplify Editor Chrome

**Outcome:** Markdown view modes reuse one CodeMirror instance and present navigation, view selection, and native history in deliberate locations.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/editors/markdown/MarkdownEditor.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Modify: `.temp/f041-native-workbench-review/tests/markdownEditor.test.mjs`
- Create: `.temp/f041-native-workbench-review/tests/markdownEditorRefinement.test.mjs`

**Change Map:**
- CodeMirror host lifecycle: keep `.markdown-source` mounted in every mode and request layout measurement after Preview transitions
- top chrome: move Outline before the view selector and remove formatting/Search/history Tool buttons
- history controls: lower-left editor-local Undo/Redo pair backed by the same mounted `EditorView`
- responsive layout: preview/source visibility and floating controls remain contained with Outline open/closed and split resizing

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/markdownEditor.test.mjs .temp/f041-native-workbench-review/tests/markdownEditorRefinement.test.mjs`
- Browser: type and select source text; Preview → Split/Edit repeatedly; Undo/Redo before and after transitions; Outline open/closed; resize Split; keyboard focus; 1200x850, 1100x850, and 850x850; Light/Dark/System.

- [x] Capture focused contracts for the always-mounted CodeMirror host, Outline-first toolbar, removed Tool buttons, and lower-left history controls.
- [x] Preserve one EditorView and its selection/history across every Edit/Split/Preview transition.
- [x] Simplify the toolbar and position accessible Undo/Redo controls without overlapping editor content.

## Task 2: Add the Default-off Markdown Line-number Preference

**Outcome:** Line numbers are an explicit persisted Markdown preference and can change without resetting the active editor.
**Files:**
- Modify: `.temp/f041-native-workbench-review/src/mock/mockSettingsApi.js`
- Modify: `.temp/f041-native-workbench-review/src/components/settings/SettingsCenter.jsx`
- Modify: `.temp/f041-native-workbench-review/src/components/editor/EditorHost.jsx`
- Modify: `.temp/f041-native-workbench-review/src/app/DemoApp.jsx`
- Modify: `.temp/f041-native-workbench-review/src/editors/markdown/MarkdownEditor.jsx`
- Modify: `.temp/f041-native-workbench-review/src/styles.css`
- Modify: `.temp/f041-native-workbench-review/tests/settingsExperience.test.mjs`
- Modify: `.temp/f041-native-workbench-review/tests/markdownEditorRefinement.test.mjs`

**Change Map:**
- settings model: `markdown.showLineNumbers` defaults to `false` and persists through mock load/save/reset
- Settings navigation: add Editors → Markdown with one shared `SettingsSwitch` field
- editor plumbing: pass the preference through the generic host boundary only as editor configuration
- CodeMirror configuration: reconfigure `lineNumbers()` through a session-stable `Compartment` rather than remounting the editor

**Verification:**
- `node --test .temp/f041-native-workbench-review/tests/settingsExperience.test.mjs .temp/f041-native-workbench-review/tests/markdownEditorRefinement.test.mjs`
- Browser: default gutter absent; enable/save and verify gutter; disable/save and verify removal; toggle after edits and verify Undo/Redo/selection remain intact; reload persistence; Light/Dark/System.

- [x] Add persisted default-off Markdown settings coverage and active-editor wiring contracts.
- [x] Implement the Markdown Settings page and route the preference to the editor.
- [x] Reconfigure the gutter without replacing CodeMirror state, document identity, or native history.

## Task 3: Verify and Deliver B033

**Outcome:** The Markdown refinement is regression-safe, isolated from production, and recorded as one B033 delivery.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/bugs/B033-refine-markdown-editor-navigation-view-switching-and-controls.md`

**Change Map:**
- verification: focused behavior regression, complete demo tests/build, browser interaction/geometry/theme checks, and exact production-path protection
- workflow: B033 completion evidence, human/plan status, generated index, final diff inspection, and separate `fix(B033)` commit

**Verification:**
- `npm test` and `npm run build` in `.temp/f041-native-workbench-review/`
- Browser console, Outline/navigation, Preview transitions, native Undo/Redo, line-number Settings persistence, themes, and target frames.
- `git diff --exit-code HEAD -- index.html src tests src-tauri`
- `git diff --check`
- Superplan registry, plan catalog/related closure, and generated index validation.

- [x] Run focused and full regression, build, responsive/accessibility source review, and production-isolation checks; browser interaction was attempted but unavailable because the local browser transport closed before connection.
- [x] Mark B033 complete/done, regenerate the plan index, inspect the final diff, and create the separate `fix(B033)` commit.

## Completion Evidence

- Focused regression: `node --test tests/markdownEditor.test.mjs tests/markdownEditorRefinement.test.mjs tests/settingsExperience.test.mjs` passed 11/11 in `.temp/f041-native-workbench-review/`.
- Full regression: `npm test` passed 65/65 in `.temp/f041-native-workbench-review/`.
- Production build: `npm run build` completed successfully; Vite reported only its existing large-chunk advisory.
- Isolation and hygiene: `git diff --check` and `git diff --exit-code HEAD -- index.html src tests src-tauri` passed.
- Interactive browser verification was attempted against `http://127.0.0.1:4173/`, but the browser controller returned `Transport closed`; no screenshot or click-path claim is made from that attempt.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F038-markdown-editor-and-agent-extension/F038-01-generic-document-kernel-and-markdown-editor.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-02-ideasketch-and-markdown-editor-experiences.md`
- `docs/superplan/plans/features/F044-complete-mocked-tauri-review-demo/F044-03-settings-agent-and-editor-tool-experience.md`
- `docs/superplan/plans/bugs/B032-refine-agent-window-chrome-menus-and-workspace-dragging.md`
- `.temp/f041-native-workbench-review/src/editors/markdown/MarkdownEditor.jsx`
- Human-supplied Markdown editor screenshot and bug report from 2026-08-11
