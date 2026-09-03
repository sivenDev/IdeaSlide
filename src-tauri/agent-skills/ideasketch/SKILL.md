---
name: ideasketch
description: Work with the active IdeaSketch document through bounded context and safe direct editor tools.
---

# IdeaSketch Agent Skill

Use this Skill only when the active editor identifies the document as `ideasketch`.

IdeaSketch documents contain ordered Pages. Each Page contains editable Excalidraw elements, files, AppState, and Page-scoped Cameras. Treat the supplied active-document context as a lean metadata snapshot; omitted fields are unavailable rather than empty, and Page elements must be obtained through a read Tool. Element reads return bounded semantic summaries with stable `element:<id>` references, bounds, text, bindings, and ordering where available; they do not expose an unrestricted raw Excalidraw scene.

Available tools are described by the active editor and are bound to an explicit Agent Tool protocol. The default semantic catalog is protocol v2; legacy protocol v1 is available only to a caller that explicitly pins its version and schema digest. The current v1/v2 catalogs expose bounded document-outline and active-Page reads; Camera counts or summaries may appear in those results, but dedicated selection, Camera-control, IO, and Presentation Tools are unavailable. Mutation tools apply through the active editor; they never write a file directly or bypass the editor save pipeline. Active-Page scene mutations participate in IdeaSketch's native Undo/Redo history. Page add, delete, and reorder are document-structure changes and are not covered by Excalidraw canvas history.

Use the registered editor Tools as structured calls. Do not encode Tool requests or Change Sets inside Markdown or fenced code blocks.

- Call `read_document_outline` for the bounded ordered Page outline.
- Call `read_active_page` for the bounded active Page scene.
- Treat `complete`, `nextCursor`, and `coverage` as authoritative. Do not infer omitted Pages or elements, and target an existing element only when its stable ref is mutation-ready in the captured read coverage.
- Complete every prerequisite named by a mutation Tool descriptor before calling that mutation Tool. A failed read does not satisfy a prerequisite.
- Call exactly one matching mutation Tool after its prerequisite reads complete.
- In protocol v2, use `add_page` with an optional title and bounded semantic `initialScene.operations`; do not send raw `elements`. In pinned protocol v1 only, the legacy `title` plus raw `elements` shape remains available for compatibility.
- Use `delete_page` or `reorder_page` only with identifiers visible in the captured Context or read results.
- `replace_page_elements` is a protocol v1 compatibility Tool only. Always call `read_active_page` before it, then use the active Page id returned by that read; protocol v2 cannot discover or call it.
- Prefer `apply_drawing_plan` for incremental diagrams. Use one ordered protocol v2 plan on the active Page, with at most 40 semantic shape, arrow, binding, and text operations.
- Give each created shape or arrow a short unique temporary `ref`. A binding may target an earlier temporary shape ref or a stable `element:<id>` ref returned by `read_active_page`.
- Create an arrow before binding it. Bind at least one endpoint, and only bind to rectangles, ellipses, or diamonds visible in the current read or created earlier in the same plan.
- Express geometry and supported style fields semantically. Do not send arbitrary Excalidraw element JSON through `apply_drawing_plan`, and do not mix Pages in one plan.
- For standalone text, use `create-text` with exactly one of `text` or `originalText`, then use `set-text`, `set-text-style`, or `set-text-layout` for content, size, color, alignment, line height, and bounded wrapping. For shape text, use `upsert-bound-text` or create a standalone text followed by `bind-text`; shape containers own bound-text width and placement.
- Prefer `apply_layout_plan` when refining an existing diagram. Call `read_active_page` first, then use only stable `element:<id>` references returned by that read. Express movement as bounded `dx`/`dy` deltas and resizing as bounded `width`/`height`; do not rewrite absolute coordinates or target elements from another Page.
- A layout plan may contain at most 40 ordered `move-element` or `resize-element` operations. Moving a shape also moves its bound text; existing arrow endpoint bindings are preserved.

Mutation Tools succeed only after the active editor validates and applies the transaction. One drawing plan is assembled completely before the editor applies it as one native canvas history capture, preserving unrelated elements. IdeaSketch owns native canvas Undo/Redo and normal persistence; Page-structure mutations do not advertise canvas Undo. Tools cannot save, write files directly, or bypass Page, revision, fingerprint, read-only, cancellation, and external-change checks. Do not call an unlisted Tool or substitute a JSSDK method name for an unavailable Agent Tool; explain that the requested scope is unavailable in the captured catalog. After a Tool call, summarize what was read or changed in normal Markdown. Do not request disk writes, shell commands, scripts, network tools, or changes to unsupported file types.
