---
name: ideasketch
description: Work with the active IdeaSketch document through bounded context and safe direct editor tools.
---

# IdeaSketch Agent Skill

Use this Skill only when the active editor identifies the document as `ideasketch`.

IdeaSketch documents contain ordered Pages. Each Page contains editable Excalidraw elements, files, AppState, and Page-scoped Cameras. Treat the supplied active-document context as a lean metadata snapshot; omitted fields are unavailable rather than empty, and Page elements must be obtained through a read Tool. Element reads return bounded semantic summaries with stable `element:<id>` references, bounds, text, bindings, and ordering where available; they do not expose an unrestricted raw Excalidraw scene.

Available tools are described by the active editor. Read tools may summarize the outline, active Page, selection, and Cameras. Mutation tools apply through the active editor; they never write a file directly or bypass the editor save pipeline. Active-Page canvas replacement participates in IdeaSketch's native Undo/Redo history. Page add, delete, and reorder are document-structure changes and are not covered by Excalidraw canvas history.

Use the registered editor Tools as structured calls. Do not encode Tool requests or Change Sets inside Markdown or fenced code blocks.

- Call `read_document_outline` for the bounded ordered Page outline.
- Call `read_active_page` for the bounded active Page scene.
- Complete every prerequisite named by a mutation Tool descriptor before calling that mutation Tool. A failed read does not satisfy a prerequisite.
- Call exactly one matching mutation Tool after its prerequisite reads complete.
- Use `add_page` with a title and elements; use an empty `elements` array for a blank Page.
- Use `delete_page` or `reorder_page` only with identifiers visible in the captured Context or read results.
- Always call `read_active_page` before `replace_page_elements`, then use the active Page id returned by that read; do not target a non-active Page.
- Prefer `apply_drawing_plan` for incremental diagrams. Use one ordered plan on the active Page, with at most 40 `create-shape`, `create-arrow`, and `bind-arrow` operations.
- Give each created shape or arrow a short unique temporary `ref`. A binding may target an earlier temporary shape ref or a stable `element:<id>` ref returned by `read_active_page`.
- Create an arrow before binding it. Bind at least one endpoint, and only bind to rectangles, ellipses, or diamonds visible in the current read or created earlier in the same plan.
- Express geometry and supported style fields semantically. Do not send arbitrary Excalidraw element JSON through `apply_drawing_plan`, and do not mix Pages in one plan.

Mutation Tools succeed only after the active editor validates and applies the transaction. One drawing plan is assembled completely before the editor applies it as one native canvas history capture, preserving unrelated elements. IdeaSketch owns native canvas Undo/Redo and normal persistence; Page-structure mutations do not advertise canvas Undo. Tools cannot save, write files directly, or bypass Page, revision, fingerprint, read-only, cancellation, and external-change checks. After a Tool call, summarize what was read or changed in normal Markdown. Do not request disk writes, shell commands, scripts, network tools, or changes to unsupported file types.
