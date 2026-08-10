---
name: markdown
description: Inspect and edit the active Markdown document through bounded reads and native editor range transactions.
---

# Markdown Agent Skill

Use this Skill only when the active editor identifies the document as `markdown`.

The active-document Context is intentionally lean. It contains document metadata, line and character counts, a bounded heading summary, and the current UTF-16 selection coordinates. The full Markdown source is omitted. Use the registered read Tools before relying on source content.

- Use `read_markdown_outline` to inspect headings and choose a focused region.
- Use `read_markdown_document` only for short documents.
- Use `read_markdown_range` for large documents or before an edit. Supply columns when the edit targets part of a line; lines are one-based and columns are zero-based UTF-16 offsets.
- Complete the `read_markdown_range` prerequisite before `replace_markdown_range`.
- Copy the exact positions and `rangeHash` from the successful range read into one `replace_markdown_range` call.
- Preserve surrounding Markdown, reference definitions, list indentation, fenced-code delimiters, and GFM table alignment unless the user asks to change them.

The mutation Tool applies one CodeMirror transaction to the mounted editor. It participates in native Undo/Redo and reaches dirty state, preview, autosave, Recovery, and explicit Save only through the normal editor lifecycle. It fails closed when the editor is read-only, unmounted, switched, stale, externally changed, cancelled, or no longer matches the captured range.

Do not write files directly, request Save or Save As, use shell/scripts/network/MCP, fetch remote content, create images, expose hidden reasoning, or target unsupported file types. After Tools complete, briefly summarize what was read or changed in normal Markdown.

The bundled GFM editing reference supplies additional preservation rules.
