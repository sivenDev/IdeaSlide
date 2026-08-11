# IdeaNote Complete Frontend Review

This is an isolated browser review of the current IdeaNote desktop frontend. It never imports production application code, calls Tauri, reads local files, stores real credentials, or invokes a model.

## Current delivery state

F044-01 provides the application foundation:

- the approved Open Frame shell with independent Workspaces, Editor Host, and Agent regions;
- deterministic `MockDesktopApi` fixtures and latency;
- Workspaces and Recents backed by one in-memory mock filesystem;
- Workspace and Single File document modes sharing one session core;
- supported-file filtering and an explicit unsupported-file fallback;
- create IdeaSketch, create Markdown, create Folder, rename, move to Archive, Trash, and Recent removal;
- dirty, saving, clean, read-only, recovery, conflict, missing, and save-error session states;
- explicit Save, automatic Save, unsaved-switch decisions, and mock recovery writes;
- Light, Dark, and System appearance.

F044-02 adds the real editor-owned surfaces:

- IdeaSketch mounts Excalidraw with Pages, Cameras, reordering, duplication, presentation, laser pointer, clean-diagram conversion, and browser PNG/SVG/draw.io exports;
- Markdown mounts CodeMirror 6 with Edit/Split/Preview, GFM, formatting, Outline, search and native Undo/Redo;
- both editors participate in the shared Dirty/Save/Recovery lifecycle and expose bounded Agent adapters.

F044-03 adds the complete application-owned AI experience:

- Settings categories for General, AI Provider, Agent, Skills, and IdeaSketch;
- truthful configured/unconfigured credential status with no saved-key readback;
- automatic Runtime evidence, policy controls, delivery modes and managed custom Skills;
- persistent local Threads, history, rename/archive/delete, Skill selection, streaming, steering, cancellation, retry and Runtime Inspector;
- chronological public activity and Tool rows without hidden reasoning;
- bounded Agent reads and one native CodeMirror or Excalidraw mutation with normal Dirty/Save and native Undo.

F044-04 will expose deterministic reliability scenarios and finish the review package.

## Run

```bash
cd .temp/f041-native-workbench-review
npm install
npm run dev
```

Open `http://127.0.0.1:4176/`.

## Foundation walkthrough

1. Start on Welcome and confirm there is no Agent button.
2. Open `launch-plan.is` or `product-brief.md`; the document-condition rail appears and the Agent affordance becomes available.
3. Edit Markdown in the temporary surface and observe Dirty, Saving, then Saved.
4. Edit and immediately switch documents to review Save, Discard, and Cancel.
5. Use the Workspaces actions to create an item. Use a row action to rename, move to Archive, or Trash it.
6. Open `personal-notes.md` from Recents to enter Single File mode.
7. Add a Workspace or open a file through the clearly labeled mock picker.
8. Open Settings and switch Light, Dark, and System.

All displayed paths start with `/Mock` and every persistence result is simulated. Production migration remains out of scope until a separate human approval.
