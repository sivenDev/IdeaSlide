---
id: "F059"
title: "Improve Markdown Selection and Rich Code Previews"
type: "feature"
status: "draft"
summary: "Make Markdown selections unmistakable and add safe HTML, highlighted code, Mermaid, and isolated HTML previews."
source: "docs/superplan/human/features.md"
created: "2026-08-13"
order: 59
depends_on: ["F038-01", "B033", "F046-02", "F047"]
parent: ""
---

# Improve Markdown Selection and Rich Code Previews Plan

**Goal:** Make Markdown editing easier to read and expand Preview into a safe, useful surface for HTML and fenced code content.
**Scope:** Give CodeMirror selections a clearly bounded, theme-aware appearance while focused or unfocused, including multi-line selections. Extend the production Markdown preview to render an explicitly allowlisted subset of inline/block HTML after sanitization. Present every fenced code block in a consistent framed surface with a language label, copy action, syntax highlighting for known languages, and plain-text fallback. Treat `mermaid` fences as bounded diagram previews and `html` fences as isolated HTML previews while retaining a block-local way to inspect the original source. Keep Mermaid and HTML failures local to their block with clear English status text, and preserve existing Edit, Split, Preview, Outline, scroll synchronization, links, local images, autosave, Recovery, native Undo/Redo, themes, and Agent range-edit behavior.
**Non-Goals:** This feature does not add WYSIWYG editing, execute JavaScript or arbitrary Markdown HTML in the application document, grant HTML previews same-origin privileges, allow forms/popups/navigation/network loading, fetch remote preview assets, add a general plugin marketplace, execute non-HTML code blocks, add KaTeX, change Markdown persistence or file format, alter global Settings, or extend the Agent Tool surface. It does not change the Agent transcript Markdown renderer.
**Architecture:** Keep the mounted CodeMirror `EditorView` as the only Markdown edit state and history owner; selection work is an editor-theme/decorations change, not a parallel selection model. Extract production preview rendering from the growing `MarkdownEditor` component into focused preview/code-block components and pure safety helpers. Use maintained renderer integrations: `rehype-raw` followed immediately by `rehype-sanitize` for allowlisted Markdown HTML, a maintained syntax highlighter with a bounded language registry and plain fallback, and lazy-loaded Mermaid configured with `securityLevel: "strict"`. Mermaid rendering is debounced, capped by document/block size and count, and never blocks source input. HTML fence preview content is sanitized, wrapped in a restrictive Content Security Policy, and mounted in an iframe with an empty `sandbox` token set so scripts, same-origin access, forms, navigation, popups, and external resource loads stay unavailable. Inline Markdown HTML and fenced HTML deliberately use separate policies: allowlisted document markup may join the preview DOM, while full-fragment HTML remains inside the isolated preview boundary. Block-local Source/Preview state is ephemeral UI state and never mutates Markdown text or document editor state.
**Baseline:** F038-01 delivered the registry-driven CodeMirror Markdown editor and safe GFM preview with raw HTML disabled. B033 and F046-02 stabilized one mounted editor across Edit/Split/Preview and production Markdown chrome. F047 owns the semantic Light/Dark selection and editor tokens. `MarkdownEditor.tsx` currently renders `ReactMarkdown` with only `remark-gfm`, maps headings/links/images inline, and delegates every code fence to the renderer's default `<pre><code>` output. `useCodeMirrorEditor.ts` calls `drawSelection()` but applies one low-opacity selection color through a broad `.cm-selectionBackground, ::selection` selector, with no explicit unfocused or multi-line boundary treatment. The repository has no Mermaid, raw-HTML sanitation, HTML iframe preview, or syntax-highlighting dependency or implementation.
**Exit Criteria:** A keyboard or pointer selection is unmistakable in Light and Dark themes while the editor is focused and after focus moves to Preview or toolbar controls; multi-line selections show a continuous readable range without hiding text, and selection clarity does not change document content, dirty state, history, or Agent context. Safe common HTML elements such as headings, paragraphs, emphasis, lists, tables, details/summary, and layout-neutral containers render in Markdown Preview, while scripts, event handlers, unsafe URLs, embedded browsing contexts, forms, and dangerous attributes are removed or rejected. Ordinary fenced blocks show a language label, keyboard-accessible copy action, highlighted known-language source, and readable plain-text fallback. `mermaid` fences show bounded diagrams with a Source option; syntax/security/limit failures stay inside the block and do not break the document preview. `html` fences show a Source/Preview surface whose preview cannot run script, access the parent/origin, submit forms, navigate, open popups, or load external resources. Large documents remain source-responsive, lazy preview work cleans up on changes/unmount, Edit/Split/Preview and scroll sync stay stable, and focused/full frontend tests plus the production build pass.

## Task 1: Make CodeMirror Selection Ranges Unmistakable

**Outcome:** Markdown selections remain clearly visible and readable across focus changes, themes, multiple lines, scrolling, and normal editor transactions.
**Files:**
- Modify: `src/hooks/useCodeMirrorEditor.ts`
- Modify: `src/index.css`
- Modify: `tests/markdownEditorRefinement.test.mjs`
- Modify: `tests/themeVisualContract.test.mjs`
- Create: `tests/markdownSelection.test.mjs`

**Change Map:**
- `useCodeMirrorEditor` theme: target CodeMirror's real selection layer and native selection fallback precisely; define focused, unfocused, and selection-match treatments without rebuilding the `EditorView`
- semantic editor tokens: add selection fill/boundary values derived from the existing Light/Dark contract with sufficient contrast against editor text, active line, and search matches
- selection lifecycle: preserve selection through toolbar/preview focus, external value synchronization, native history, Agent edits, line-number reconfiguration, and theme changes
- regression contract: cover single-line, multi-line, reversed, unfocused, read-only, and scrolled selections without introducing a second state store

**Verification:**
- `node --test tests/markdownSelection.test.mjs tests/markdownEditorRefinement.test.mjs tests/themeVisualContract.test.mjs`
- Browser cases in Light and Dark: pointer drag, Shift+Arrow, Shift+PageDown, Select All, selection across wrapped lines, toolbar focus, Split/Preview focus, Undo/Redo, and theme switching.

- [ ] Add focused failures that distinguish focused/unfocused and multi-line selection visibility from active-line and search highlighting.
- [ ] Apply selection-specific CodeMirror styling through the existing semantic theme boundary without remounting the editor.
- [ ] Verify selection, history, dirty state, Agent context, and theme behavior together.

## Task 2: Build a Safe Extensible Markdown Preview Boundary

**Outcome:** Markdown Preview can render useful HTML and dispatch fenced blocks through explicit safe renderers without weakening link, image, or application security.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/components/MarkdownEditor.tsx`
- Create: `src/components/MarkdownPreview.tsx`
- Create: `src/lib/markdownPreview.ts`
- Modify: `tests/markdownEditorContract.test.mjs`
- Create: `tests/markdownRichPreview.test.mjs`
- Modify: `docs/file-format.md`

**Change Map:**
- dependencies: add pinned maintained raw-HTML parse/sanitize and syntax-highlighting packages; keep Mermaid lazy so documents without diagrams do not pay its startup cost
- `MarkdownPreview`: own ReactMarkdown plugins, headings, links, images, code dispatch, stale-preview behavior, and preview-local error boundaries while `MarkdownEditor` retains document/editor lifecycle and pane orchestration
- sanitized Markdown HTML: define an explicit element/attribute/protocol schema, preserve application link/image handlers, and reject scripts, events, unsafe URLs, iframes/objects/embeds/forms, style injection, and unexpected data attributes
- preview classification: normalize fence language aliases, apply size/count budgets, and return ordinary, Mermaid, HTML, unsupported, or limited block descriptors through pure testable helpers
- format contract: replace the obsolete "raw HTML disabled" statement with the exact sanitized-inline and isolated-fence policy

**Verification:**
- `node --test tests/markdownRichPreview.test.mjs tests/markdownEditorContract.test.mjs tests/markdownEditorRefinement.test.mjs`
- Fixtures: allowed semantic HTML; nested tables/details; script/style/event handlers; unsafe links; iframe/object/form/meta/base tags; malformed HTML; known/unknown/no-language fences; oversized and excessive special blocks.

- [ ] Add failing pure-policy and renderer-wiring tests for allowlisted HTML, rejected content, fence classification, and bounded work.
- [ ] Extract the preview boundary and integrate sanitized HTML without regressing headings, links, local images, scroll sync, or stale-preview behavior.
- [ ] Document and verify the exact supported HTML/security contract.

## Task 3: Deliver Ordinary, Mermaid, and HTML Code Block Experiences

**Outcome:** Every code fence is readable and useful, while Mermaid and HTML previews remain bounded, isolated, reversible to source, and failure-safe.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/MarkdownCodeBlock.tsx`
- Create: `src/components/MermaidCodePreview.tsx`
- Create: `src/components/HtmlCodePreview.tsx`
- Modify: `src/components/MarkdownPreview.tsx`
- Modify: `src/lib/markdownPreview.ts`
- Modify: `src/index.css`
- Modify: `tests/markdownRichPreview.test.mjs`
- Modify: `tests/themeVisualContract.test.mjs`

**Change Map:**
- ordinary code: framed code surface, normalized language label, accessible Copy action and feedback, maintained syntax highlighting for a bounded common-language registry, and plain-text fallback that never interprets source as markup
- Mermaid: lazy one-time initialization, strict security mode, unique render ids, debounced/cancelled rendering, theme-aware redraw, source toggle, size/count budgets, sanitized SVG acceptance, and local syntax/security error UI
- HTML fence: source/preview toggle, sanitized fragment, restrictive inline CSP, iframe `sandbox` without permissions, automatic bounded height, and explicit blocked/invalid-content messaging
- styling/accessibility: Light/Dark code tokens, visible focus, horizontal overflow, long-line wrapping policy, copy feedback, reduced motion, and block-local loading/error states

**Verification:**
- `node --test tests/markdownRichPreview.test.mjs tests/themeVisualContract.test.mjs tests/markdownEditorContract.test.mjs`
- Browser cases: copy by keyboard/pointer; common and unknown languages; multiple Mermaid diagrams; Mermaid syntax error and oversize limit; Mermaid Light/Dark redraw; HTML layout/styles; script/event/form/navigation/popup/external-image attempts; rapid editing and unmount during async rendering.

- [ ] Implement the shared code-block frame and ordinary highlighted/plain fallback behavior.
- [ ] Add bounded strict Mermaid rendering with cleanup, theme response, source access, and local failures.
- [ ] Add sandboxed CSP-constrained HTML preview and prove hostile examples cannot escape or fetch externally.

## Task 4: Verify and Deliver F059

**Outcome:** The Markdown enhancement ships with current security, interaction, regression, build, workflow, and source-control evidence in one isolated commit.
**Files:**
- Modify: `docs/superplan/human/prd.md`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F059-improve-markdown-selection-and-rich-code-previews.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- product contract: record selection clarity, sanitized Markdown HTML, ordinary code blocks, Mermaid, and isolated HTML fences without changing Markdown file ownership or shared lifecycle principles
- final regression: selection/history, Edit/Split/Preview, Outline, scroll sync, links/images, autosave, Recovery, Agent edits, Light/Dark/System, sanitization, sandboxing, async cleanup, and large-document responsiveness
- workflow: compare the final diff with every Exit Criterion, record evidence and meaningful warnings, complete F059 only after verification, refresh the index, and stage only F059 changes

**Verification:**
- `node --test tests/markdownSelection.test.mjs tests/markdownRichPreview.test.mjs tests/markdownEditorContract.test.mjs tests/markdownEditorRefinement.test.mjs tests/themeVisualContract.test.mjs`
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `npm run tauri dev`
- Native/browser acceptance in Light, Dark, and System for focused/unfocused selections, ordinary code, Mermaid success/failure, HTML success/blocked content, Edit/Split/Preview switching, scroll sync, copy, keyboard focus, reduced motion, a 5,000-line document, and rapid special-block edits.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [ ] Run focused checks while implementing and one stabilized full frontend/build/native regression after behavior stops changing.
- [ ] Review real hostile HTML/Mermaid fixtures, selection states, themes, keyboard access, performance, and lifecycle preservation against every Exit Criterion.
- [ ] Mark F059 complete/done, refresh the plan index, and create a separate `feat(F059)` task commit containing only this feature.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F038-markdown-editor-and-agent-extension/F038-01-generic-document-kernel-and-markdown-editor.md`
- `docs/superplan/plans/bugs/B033-refine-markdown-editor-navigation-view-switching-and-controls.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-02-settings-themes-and-markdown.md`
- `docs/superplan/plans/features/F047-polish-light-and-dark-themes.md`
- `docs/file-format.md`
- `src/components/MarkdownEditor.tsx`
- `src/hooks/useCodeMirrorEditor.ts`
- `src/index.css`
