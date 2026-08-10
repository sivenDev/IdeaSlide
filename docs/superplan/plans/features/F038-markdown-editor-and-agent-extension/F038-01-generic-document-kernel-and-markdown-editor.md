---
id: "F038-01"
title: "Generalize the Document Kernel and Deliver the Markdown Editor"
type: "feature"
status: "complete"
summary: "Turn the IdeaSketch-only document seams into a real editor registry and deliver a safe CodeMirror-based Markdown editor in both application modes."
source: "docs/superplan/human/features.md"
created: "2026-08-10"
order: 44
depends_on: ["F011", "B015", "B023"]
parent: "F038"
---

# Generalize the Document Kernel and Deliver the Markdown Editor Plan

**Goal:** Make Markdown the first production second editor while proving that future editors can reuse one registry-driven document, persistence, recovery, and shell core.
**Scope:** Generalize the frontend `DocumentModel`, Editor Host, editor lifecycle callbacks, snapshots, autosave, Recovery, standalone creation/open filters, and backend document envelope/format registry so they no longer assume IdeaSketch. Register standard `.md` files for Workspace and Single File modes. Add a direct CodeMirror 6 source editor, safe GFM preview, Edit/Split/Preview modes, a collapsible document outline, resizable synchronized source/preview panes, heading anchors, same-document references, safe relative document links and images, editor-native search and Undo/Redo, formatting commands, and responsive keyboard-accessible UI. Preserve UTF-8 BOM and ordinary LF/CRLF policy, fail closed on invalid UTF-8, expose mixed-line-ending normalization before a lossy save, and retain all existing atomic-write, external-change, autosave, Recovery, and no-silent-overwrite behavior.
**Non-Goals:** This plan does not copy or link GPL-3.0 TizuMark source; add WYSIWYG editing, tabs, cross-file full-text search, Git integration, collaborative editing, Mermaid, KaTeX, executable/raw HTML, arbitrary URL schemes, automatic network image fetching, image insertion/copy workflows, PDF/DOCX export, custom Markdown plugins, or a separate Markdown persistence path per application mode. It does not implement the Markdown Agent Extension, which is owned by F038-02, or change the outer Workspace/editor/Agent three-column layout.
**Architecture:** TizuMark commit `8b63993845fa84fc317a3cb12f6379fb78d526c9` is a behavior reference only: retain its useful Edit/Preview/Split, resizable panes, outline, scroll synchronization, search, link, and large-document ideas without copying GPL code. Use direct MIT-licensed CodeMirror 6 packages so the mounted `EditorView` is the authoritative editing SDK and its transaction history remains the only Markdown Undo/Redo system. Use the existing `react-markdown` plus `remark-gfm` renderer with raw HTML disabled; one Markdown projection service owns headings, stable GitHub-style slugs, source positions, safe URL classification, and bounded preview metadata. A typed editor-contribution registry maps a file type/editor key to one lifecycle adapter; `DocumentEditorHost` and `EditorLayout` invoke that adapter without format branches. `DocumentModel` becomes a discriminated union, while each frontend file-type module and Rust document-format module owns format parsing and serialization. The Markdown backend returns decoded source plus BOM and line-ending metadata, rejects invalid UTF-8 before hydration, and writes through the existing Workspace staging or Standalone atomic-replacement boundary. Mixed line endings remain byte-stable while untouched and require an explicit LF/CRLF normalization choice before an edited save. Relative links resolve against the current document, remain Workspace-root confined when applicable, open registered documents through the existing session coordinator, and route external `https`/`http` links through the platform opener; all other schemes fail closed.
**Baseline:** `DocumentModel` is an alias for `IdeaSketchDocument`; `DocumentEditorHost` accepts only `renderIdeaSketch`; `EditorLayout` stores IdeaSketch-only snapshot and Recovery providers and directly mounts `IdeaSketchEditor`; `AppContent` creates only `Untitled.is`; frontend open/save helpers hard-code `.is`, `requireIdeaSketchDefinition`, and IdeaSketch envelope unwrapping; and the Rust `DocumentFormatKind`/`DocumentFileData` enums dispatch only IdeaSketch. The backend Workspace scanner is already registry-driven, so adding a real Markdown definition will automatically make `.md` files visible. `react-markdown` and `remark-gfm` are already dependencies, while CodeMirror 6 is not installed. The approved shell already provides one left Workspace Explorer, one center editor, and one independent right Agent column.
**Exit Criteria:** Workspace Explorer shows and creates `.md`; Home can create an unnamed Markdown document and Open File accepts `.is` and `.md`; both modes open the same Markdown editor and save through the same generic command path. Edit, Split, and Preview work without changing the outer three-column shell; split width is bounded and resizable; outline clicks, heading anchors, source-to-preview and preview-to-source navigation, and loop-guarded scroll synchronization work; CodeMirror search, formatting commands, keyboard focus, IME input, and native Undo/Redo remain correct. GFM tables, task lists, strikethrough, links, code, and safe relative images render without raw HTML execution. Registered relative document links activate the target through the existing save-gated session flow; external links use the platform opener; traversal and unsafe schemes are rejected. LF, CRLF, and BOM round-trip; invalid UTF-8 never opens editable or overwrites the source; an edited mixed-ending file cannot save until the user chooses LF or CRLF normalization. Markdown participates in dirty state, explicit save, debounce autosave, Recovery, crash restore, external-change/conflict/read-only/missing handling, Save As, and restart/reopen. IdeaSketch behavior remains unchanged. Focused, complete frontend/Rust, strict build, package, accessibility, performance, and native dual-mode verification pass.

## Task 1: Generalize the Frontend Editor and Document Contracts

**Outcome:** A second editor can register one typed lifecycle adapter without adding format branches to the host, shell, persistence coordinator, or Recovery pipeline.
**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/editorRegistry.ts`
- Modify: `src/lib/fileTypeRegistry.ts`
- Modify: `src/lib/documentSession.ts`
- Modify: `src/components/DocumentEditorHost.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/lib/recovery.ts`
- Modify: `src/App.tsx`
- Test: `tests/editorRegistry.test.mjs`
- Modify: `tests/fileTypeRegistry.test.mjs`
- Modify: `tests/documentEditorHost.test.mjs`
- Modify: `tests/recovery.test.mjs`
- Modify: `tests/ideaSketchEditorContract.test.mjs`

**Change Map:**
- document model: replace the IdeaSketch alias with a discriminated union and keep session revision/status/persistence semantics format-neutral
- editor contribution: typed render/lifecycle adapter for model changes, dirty state, snapshots, autosave, Recovery, optional editor state, and optional Agent binding
- host/shell: registry dispatch with one active mounted editor; generic snapshot/Recovery maps and no `renderIdeaSketch` prop or file-type switch
- IdeaSketch adapter: preserve existing Excalidraw, Pages, Cameras, Present, native history, autosave, and Agent behavior behind the new contract
- application creation: registry-driven standalone new-document selection instead of a fixed IdeaSketch factory

**Verification:**
- `node --test tests/editorRegistry.test.mjs tests/fileTypeRegistry.test.mjs tests/documentEditorHost.test.mjs tests/recovery.test.mjs tests/ideaSketchEditorContract.test.mjs`
- Cases: two differently typed synthetic registrations; wrong model rejected; one active heavy editor; generic snapshot/save/Recovery callbacks; unsupported fallback; IdeaSketch parity; no Workspace/Standalone branch inside an editor.

- [x] Lock the current IdeaSketch coupling with focused failing second-editor contracts.
- [x] Add the typed editor registry and migrate the host/shell lifecycle without weakening session safety.
- [x] Re-prove all IdeaSketch editor, native Undo/Redo, presentation, and Agent boundaries through the adapter.

## Task 2: Add a Loss-aware Markdown Format Module and Generic IPC Envelopes

**Outcome:** Rust and frontend format modules can create, open, validate, and atomically save standard Markdown without lossy decoding or IdeaSketch-specific command logic.
**Files:**
- Create: `src-tauri/src/document_formats/markdown.rs`
- Modify: `src-tauri/src/document_formats/mod.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/workspace.rs`
- Create: `src/lib/markdownDocument.ts`
- Modify: `src/lib/tauriCommands.ts`
- Modify: `src/lib/fileTypeRegistry.ts`
- Test: `src-tauri/src/document_formats/markdown.rs`
- Modify: `src-tauri/src/document_formats/mod.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `tests/tauriCommands.test.mjs`
- Modify: `tests/fileTypeRegistry.test.mjs`
- Test: `tests/markdownDocument.test.mjs`

**Change Map:**
- backend registry: Markdown kind/definition and tagged `DocumentFileData::Markdown` dispatch for create/open/write
- Markdown parser/writer: UTF-8 validation, BOM metadata, LF/CRLF/mixed classification, untouched mixed-byte preservation, explicit normalization metadata, empty-file creation, and atomic safe write
- generic IPC: remove `requireIdeaSketchDefinition`, fixed `.is` filters, and IdeaSketch-only envelope unwrapping from active open/save paths
- frontend module: Markdown model validation, empty model, tagged backend conversion, line-ending normalization request, and serializer handoff
- Workspace visibility/creation: `.md` becomes openable/creatable through the same backend/frontend definitions

**Verification:**
- `cargo test --manifest-path src-tauri/Cargo.toml document_formats::markdown -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml document_formats -- --nocapture`
- `node --test tests/markdownDocument.test.mjs tests/tauriCommands.test.mjs tests/fileTypeRegistry.test.mjs`
- Cases: empty/new file; Unicode; no final newline; LF; CRLF; BOM; mixed untouched; mixed edited without normalization rejected; explicit LF/CRLF normalization; invalid UTF-8 protected; failed replacement leaves original intact; Workspace temp files remain under `.ideanote/tmp`; Standalone creates no `.ideanote`.

- [x] Add byte-level fixtures and failing round-trip/loss-prevention contracts before the writer.
- [x] Implement symmetric Markdown modules behind the existing safe-write boundaries.
- [x] Make open/create/save dialogs and IPC envelopes registry-driven for both supported types.

## Task 3: Build the CodeMirror Source Editor and Safe GFM Preview

**Outcome:** Markdown has a polished source-first editor with native history and a safe readable preview.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/MarkdownEditor.tsx`
- Create: `src/components/MarkdownPreview.tsx`
- Create: `src/components/MarkdownOutline.tsx`
- Create: `src/hooks/useCodeMirrorEditor.ts`
- Create: `src/lib/markdownPreview.ts`
- Modify: `src/index.css`
- Test: `tests/markdownEditor.test.mjs`
- Test: `tests/markdownPreview.test.mjs`
- Test: `tests/markdownOutline.test.mjs`
- Test: `tests/markdownEditorContract.test.mjs`

**Change Map:**
- dependencies: exact direct use of maintained MIT CodeMirror 6 state/view/commands/search/language/Markdown packages plus maintained slug/AST helpers where required
- CodeMirror adapter: controlled external-document replacement, editor-owned transactions/history, IME-safe input, search, selection, focus, read-only compartments, and one snapshot provider
- commands: headings, bold, italic, strikethrough, inline code, fenced code, quote, ordered/unordered/task lists, and links as selection-aware CodeMirror transactions
- preview: safe GFM renderer, raw HTML disabled, stable duplicate-safe heading ids, source-position markers, safe URL/image transforms, and explicit unsupported-link UI
- design: quiet `#F7F8FA` canvas, `#FFFFFF` reading paper, `#1F2937` ink, `#667085` utility text, `#E3E7EE` rules, and restrained `#6D5BD0` active accents; system sans for controls, `ui-monospace` for source, and a high-legibility platform reading stack for preview. The signature element is one violet document spine shared by the outline and active preview heading, encoding document structure rather than decorating it.

**Verification:**
- `node --test tests/markdownEditor.test.mjs tests/markdownPreview.test.mjs tests/markdownOutline.test.mjs tests/markdownEditorContract.test.mjs`
- Browser cases: typing/IME; native Undo/Redo; search; formatting with empty/selected text; GFM fixtures; duplicate headings; raw HTML/script/event attributes; unsafe schemes; keyboard-only toolbar/outline; visible focus; reduced motion; narrow center width.

- [x] Install and wrap CodeMirror 6 without introducing a parallel text/history model.
- [x] Implement the safe Markdown projection and source-aware preview from one editor source of truth.
- [x] Apply the reviewed visual system and accessibility states to real content rather than placeholder copy.

## Task 4: Deliver Edit, Split, Preview, Outline, Links, and Scroll Synchronization

**Outcome:** The center editor provides the strongest reusable TizuMark-inspired interactions while staying native to IdeaNote's shell and safety model.
**Files:**
- Modify: `src/components/MarkdownEditor.tsx`
- Modify: `src/components/MarkdownPreview.tsx`
- Modify: `src/components/MarkdownOutline.tsx`
- Modify: `src/components/ResizableDivider.tsx`
- Modify: `src/lib/markdownPreview.ts`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Modify: `tests/markdownEditor.test.mjs`
- Modify: `tests/markdownPreview.test.mjs`
- Modify: `tests/editorChromeNavigation.test.mjs`
- Modify: `tests/externalFileChanges.test.mjs`

**Change Map:**
- layout: compact internal Markdown toolbar above `[optional outline | source | split rail | preview]`; outer Explorer remains left and Agent remains the independent right column
- view state: Edit/Split/Preview segmented control, bounded split ratio, collapsible outline, and session-safe state reset on document identity change
- synchronization: source-line/preview-block interpolation in both directions, animation-frame throttling, explicit loop guards, and disabled synchronization when either projection is stale
- navigation: heading/outline activation, same-document anchors, registered relative document activation through save-gated switching, external opener routing, safe relative image loading, traversal rejection, and clear missing-target feedback
- large documents: debounced preview projection, stale-preview indicator, bounded outline work, and performance thresholds that never delay source input or autosave

**Verification:**
- Focused Markdown interaction tests plus `node --test tests/editorChromeNavigation.test.mjs tests/externalFileChanges.test.mjs`.
- Browser/native cases: resize and mode switching; outline jump; source↔preview scroll without oscillation; anchor back/forward; open relative `.md`; dirty target switch Save/Discard/Cancel; external link; missing/traversal/unsafe link; local image; 5,000-line editing responsiveness and preview catch-up.

- [x] Build the three view modes and outline inside the center editor only.
- [x] Add loop-guarded scroll and source navigation using source positions.
- [x] Route every file/link action through existing session, root, and platform safety boundaries.

## Task 5: Integrate Reliability and Verify Markdown End to End

**Outcome:** Markdown reaches feature parity with the shared save/recovery/conflict lifecycle and ships without IdeaSketch regressions.
**Files:**
- Modify: `src/components/MarkdownEditor.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/appStoreReducer.ts`
- Modify: `src/lib/recovery.ts`
- Modify: `tests/appStoreReducer.test.mjs`
- Modify: `tests/saveAll.test.mjs`
- Modify: `tests/recovery.test.mjs`
- Modify: `tests/externalFileChanges.test.mjs`
- Modify: `docs/superplan/human/prd.md`
- Modify: `docs/file-format.md`
- Modify: `docs/workspace-format.md`
- Modify: `docs/superplan/plans/features/F038-markdown-editor-and-agent-extension/F038-01-generic-document-kernel-and-markdown-editor.md`

**Change Map:**
- lifecycle: dirty/revision propagation, explicit Save/Save As, existing-file autosave, Recovery snapshots, restore/discard, external modify/delete/conflict/read-only/root-missing, and active-editor switching
- startup: unnamed Markdown Recovery and registered recent/open-file behavior without hard-coded IdeaSketch model checks
- product/format contract: make Markdown a current supported editor, document its UTF-8/BOM/line-ending and safe-preview policy, and update the registry-visible Workspace file set without weakening lazy metadata
- acceptance: real Workspace and Standalone Markdown files, line-ending fixtures, links/images, crash restore, external edits, source responsiveness, accessibility, and unchanged IdeaSketch workflows
- delivery: complete only after full current evidence, artifact inspection, refreshed Superplan state, and a separate `feat(F038-01)` commit

**Verification:**
- `node --test tests/*.test.mjs`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`
- `npm run build`
- `npm run tauri build -- --debug`
- `git diff --check`
- Native matrix: create/open/edit/Undo/Redo/autosave/save/reopen Markdown in Workspace and Standalone; Edit/Split/Preview/outline/links/images; LF/CRLF/BOM/mixed/invalid UTF-8; Recovery; external conflict/delete; read-only; restart; then representative IdeaSketch Pages/Cameras/Present/Agent regression.

- [x] Connect Markdown to every existing document reliability path and add behavior-level regressions.
- [x] Run full automated, build, package, accessibility, performance, and native dual-mode acceptance.
- [x] Record evidence, complete F038-01, refresh the plan index, and create its isolated task commit before F038-02.

## Delivery Evidence

- `node --test tests/*.test.mjs`: 332 passed, 0 failed, including registry, Recovery, shell, save, external-change, native-history, and Markdown editor contracts.
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`: 135 passed, 0 failed, including UTF-8/BOM/line-ending round trips, atomic Markdown writes, invalid UTF-8 rejection, Workspace dispatch, and confined local-image reads.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets`, `npm run build`, and `git diff --check`: passed. Rust reports only the existing unused future-adapter warnings; Vite reports the existing Excalidraw import and large-chunk warnings.
- `npm run tauri build -- --debug`: passed and produced `src-tauri/target/debug/bundle/macos/IdeaNote.app` and `src-tauri/target/debug/bundle/dmg/IdeaNote_0.1.0_aarch64.dmg`.
- Browser acceptance at `http://127.0.0.1:1420/`: Home created `Untitled.md`; the outer Agent remained an independent right column; source input projected GFM headings, lists, emphasis, and tables; Outline updated; Edit/Split/Preview switched correctly; native Undo removed the complete edit transaction and Redo restored it exactly; Preview mode unmounted the source projection; no console errors or warnings were observed.
- Safety inspection: raw HTML remains disabled; relative document links pass through save-gated registered-document opening; local images are confined to the current document directory, limited to PNG/JPEG/GIF/WebP and 10 MB, and reject traversal and remote fetches; edited mixed endings require explicit LF/CRLF normalization.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/01-shared-document-kernel-and-is-v1.md`
- `docs/superplan/plans/05-workspace-reliability-and-recovery.md`
- `docs/superplan/plans/06-single-active-editor.md`
- `src/types.ts`
- `src/lib/fileTypeRegistry.ts`
- `src/components/DocumentEditorHost.tsx`
- `src/components/EditorLayout.tsx`
- `src-tauri/src/document_formats/mod.rs`
- `https://github.com/tizuio/TizuMark/tree/8b63993845fa84fc317a3cb12f6379fb78d526c9` (GPL-3.0 behavior reference only; no source reuse)
- `https://codemirror.net/` (MIT)
- `https://github.com/remarkjs/react-markdown` (MIT)
- `https://github.com/remarkjs/remark-gfm` (MIT)
