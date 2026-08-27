---
id: "F067"
title: "Hide Markdown Metadata in Preview"
type: "feature"
status: "complete"
summary: "Keep leading YAML frontmatter out of Markdown Preview while preserving source/editor content."
source: "docs/superplan/human/features.md"
created: "2026-08-27"
order: 67
depends_on: ["F059"]
parent: ""
---

# Hide Markdown Metadata in Preview Plan

**Goal:** Keep Markdown document metadata useful in the source editor without exposing it as document content in Preview.
**Scope:** Detect a leading YAML frontmatter block delimited by `---` (and the standard closing `...`) and omit that block from the rendered Markdown Preview. Apply the same preview-only projection to special-code-block indexing so fenced blocks after metadata retain their correct behavior. Preserve the original Markdown text for editing, outline/source navigation, save, Recovery, Agent context, and serialization.
**Non-Goals:** This feature does not parse, validate, rewrite, or remove metadata from Markdown files; add metadata editing UI; hide arbitrary horizontal rules or later delimiter blocks; change Markdown persistence, headings, links, images, code rendering, scroll synchronization, or Agent behavior; or add a metadata schema/dependency.
**Architecture:** Keep frontmatter handling as a pure, dependency-free preview projection in `src/lib/markdownPreview.ts`. `MarkdownPreview` will render the projected text while receiving the unchanged source text from `MarkdownEditor`; the existing editor model and save pipeline remain authoritative. The projection recognizes only a delimiter at the beginning of the document (allowing a UTF-8 BOM and CRLF) and requires a matching closing delimiter before stripping, so ordinary Markdown remains unchanged.
**Baseline:** `MarkdownEditor` passes `model.text` through a debounced `previewText` state, and `MarkdownPreview` sends that text directly to `ReactMarkdown` and `indexSpecialCodeBlocks`. A leading frontmatter block is therefore interpreted as ordinary Markdown (including a visible horizontal rule and metadata lines) instead of being treated as source-only metadata. Existing F059 preview helpers and renderer boundaries are the correct home for a pure text projection.
**Exit Criteria:** Markdown Preview and Split mode omit a valid leading YAML frontmatter block, including BOM/CRLF and `...` closing forms, while rendering the body exactly as before. Documents without a complete leading frontmatter block—including ordinary top-of-file horizontal rules—remain unchanged. Source/editor text, dirty state, headings/Agent ranges, save/Recovery serialization, and special code block rendering remain based on the original document model. Focused frontmatter and Markdown editor contract tests plus the production build pass.

## Task 1: Project Frontmatter Out of Markdown Preview

**Outcome:** Preview renders Markdown body content without leading YAML metadata while preserving the source document and existing rich-preview behavior.
**Files:**
- Modify: `src/lib/markdownPreview.ts`
- Modify: `src/components/MarkdownPreview.tsx`
- Create: `tests/markdownFrontmatterPreview.test.mjs`
- Modify: `tests/markdownEditorContract.test.mjs`

**Change Map:**
- `stripMarkdownFrontmatter`: pure, delimiter-aware projection with BOM and CRLF support, complete-block requirement, and unchanged fallback
- `MarkdownPreview`: derive one projected text value before special-block indexing and `ReactMarkdown`, without mutating props or editor state
- regression coverage: valid YAML delimiters, closing `...`, BOM/CRLF, incomplete/mid-document delimiters, horizontal-rule preservation, source-preservation wiring, and rich-preview integration

**Verification:**
- `node --test tests/markdownFrontmatterPreview.test.mjs tests/markdownEditorContract.test.mjs tests/markdownRichPreview.test.mjs`
- `npm run build`
- Cases: metadata with headings/links/code after it; empty metadata; BOM and CRLF; `...` close; missing close; non-leading delimiters; ordinary horizontal rules; unchanged editor model/save source; correct Mermaid/HTML/code fence indexing after stripped lines.

- [x] Add focused pure projection and renderer-wiring regressions for valid and invalid frontmatter.
- [x] Integrate the preview-only projection before Markdown parsing and special-block indexing.
- [x] Verify source preservation, rich preview behavior, and the production build.

## Completion Evidence

- `node --test tests/markdownFrontmatterPreview.test.mjs tests/markdownEditorContract.test.mjs tests/markdownRichPreview.test.mjs` passed 12/12.
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs` passed with exit code 0.
- `npm run build` completed successfully; Vite emitted only the repository's existing dynamic-import and large-chunk advisories.
- `stripMarkdownFrontmatter` handles complete leading YAML blocks with BOM, CRLF, and `...`, while leaving incomplete/non-leading delimiters and ordinary horizontal rules unchanged. `MarkdownPreview` applies the projection only to rendered text and rich-fence indexing, leaving the editor model and persistence source untouched.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F059-improve-markdown-selection-and-rich-code-previews.md`
- `src/components/MarkdownEditor.tsx`
- `src/components/MarkdownPreview.tsx`
- `src/lib/markdownPreview.ts`
