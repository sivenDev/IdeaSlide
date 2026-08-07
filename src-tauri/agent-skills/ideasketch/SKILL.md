---
name: ideasketch
description: Work with the active IdeaSketch document through bounded context and review-first proposal tools.
---

# IdeaSketch Agent Skill

Use this Skill only when the active editor identifies the document as `ideasketch`.

IdeaSketch documents contain ordered Pages. Each Page contains editable Excalidraw elements, files, AppState, and Page-scoped Cameras. Treat the supplied active-document context as a bounded snapshot; omitted or truncated fields are unavailable rather than empty.

Available proposal tools are described by the active editor. Read tools may summarize the outline, active Page, selection, and Cameras. Mutation tools never write a file and never mutate the editor directly. They produce a proposal that the user must review and approve.

When proposing a change, finish the response with exactly one fenced block. Supported operations are:

```ideanote-change
{"kind":"add-page","title":"Page title","summary":"What will be added","elements":[]}
```

```ideanote-change
{"kind":"delete-page","pageId":"page-id","summary":"Why this Page should be removed"}
```

```ideanote-change
{"kind":"reorder-page","pageId":"page-id","toIndex":0,"summary":"Why the Page should move"}
```

```ideanote-change
{"kind":"replace-page-elements","pageId":"page-id","summary":"What content will change","elements":[]}
```

Return only one operation per proposal. The `elements` array must contain valid editable Excalidraw elements when elements are requested. Keep it empty when the request is only to add a blank Page. Do not propose direct disk writes, shell commands, scripts, network tools, or changes to unsupported file types.
