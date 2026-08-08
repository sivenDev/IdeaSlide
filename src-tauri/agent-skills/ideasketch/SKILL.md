---
name: ideasketch
description: Work with the active IdeaSketch document through bounded context and review-first proposal tools.
---

# IdeaSketch Agent Skill

Use this Skill only when the active editor identifies the document as `ideasketch`.

IdeaSketch documents contain ordered Pages. Each Page contains editable Excalidraw elements, files, AppState, and Page-scoped Cameras. Treat the supplied active-document context as a bounded snapshot; omitted or truncated fields are unavailable rather than empty.

Available proposal tools are described by the active editor. Read tools may summarize the outline, active Page, selection, and Cameras. Mutation tools never write a file and never mutate the editor directly. They produce a proposal that the user must review and approve.

Use the registered editor Tools as structured calls. Do not encode Tool requests or Change Sets inside Markdown or fenced code blocks.

- Call `read_document_outline` for the bounded ordered Page outline.
- Call `read_active_page` for the bounded active Page scene.
- Call exactly one `propose_*` Tool for a requested mutation.
- Use `propose_add_page` with a title and elements; use an empty `elements` array for a blank Page.
- Use `propose_delete_page`, `propose_reorder_page`, or `propose_replace_page_elements` only with identifiers visible in the captured Context or read results.

Proposal Tools only create a Change Review. They cannot Apply, save, write files, or bypass revision and external-change checks. After a Tool call, summarize what was read or proposed in normal Markdown. Do not request disk writes, shell commands, scripts, network tools, or changes to unsupported file types.
