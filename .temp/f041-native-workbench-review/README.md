# IdeaNote Complete Frontend Review

This directory is the complete browser-runnable review replica of the current IdeaNote Tauri frontend. It preserves the approved Open Frame shell: Workspaces on the left, an editor-owned center, and an independent Agent on the right. It does not import or modify production `src`, `tests`, `src-tauri`, or Tauri capabilities.

## Run

```bash
cd .temp/f041-native-workbench-review
npm install
npm run dev -- --port 4176
```

Open `http://127.0.0.1:4176/`.

Run verification with:

```bash
npm test
npm run build
```

## Reset

Open the Command Palette with `Command/Ctrl+K` and run **Reset review scenario**, or open **Settings → Review Scenarios → Reset demo to Welcome**. Reset restores deterministic fixtures, Light appearance, the Welcome state, normal runtime policy, and clears only the demo's namespaced Settings, Thread, and layout storage.

## Complete walkthrough

1. Start on Welcome. Agent is intentionally unavailable until a document opens.
2. Open `launch-plan.is` for the Excalidraw-based IdeaSketch editor. Use the canvas's top-left menu button to open the review-only left tool drawer, then review its counted Pages/Cameras tabs, reordering, presentation, laser pointer, clean-diagram conversion, canvas actions, and PNG/SVG/draw.io browser exports. Resize the drawer on desktop and confirm it overlays the Canvas at narrow widths; this interaction is a prototype for review, not production migration approval.
3. Open `product-brief.md` for CodeMirror 6 Markdown. Review Edit/Split/Preview, GFM, Outline, formatting, search, line-ending choice, and native Undo/Redo.
4. Edit a document and observe the leading status/close lens move through Unsaved, Saving, Saved, warning, and error states. Hover or focus it to reveal Close, then close while dirty to exercise Save, Discard, and Cancel. Manual save remains available through `Command/Ctrl+S` and the Command Palette.
5. Use each writable Workspace root or directory `+` to create IdeaSketch, Markdown, or Folder entries at that exact location. Radix-backed overflow menus open beside and top-aligned with their three-dot trigger, size to their actions, and dismiss on outside interaction or Escape. Root overflow contains Rename, Show in Finder, and Remove from Workspaces; entry overflow contains Rename, Show in Finder, and Move to Trash. Files intentionally have overflow only.
6. Drag a visible file or folder by its main row into another directory, a parent directory, a different branch, or the current Workspace root. Pointer and keyboard dragging use dnd-kit. Same-folder ordering, cross-Workspace movement, files as destinations, missing roots, collisions, and self/descendant targets do not mutate. Move an open dirty document to confirm its editor content and active session remain intact under the new path.
7. Confirm Recents contains only standalone files opened outside a Workspace. Workspace roots and Workspace-owned files never enter the list; Open Workspace remains available through the Command Palette and the empty-Workspaces action.
8. Collapse Workspaces on Welcome and with an active editor. The Editor Host remains visible, interactive, and expands into the released width. Resize Workspaces, IdeaSketch Navigator, Markdown split, and Agent with a pointer or keyboard.
9. Review window chrome with `?platform=macos`, `?platform=windows`, or `?platform=browser`; add `&fullscreen=1` for the fullscreen state. macOS windowed reserves traffic-light space, macOS fullscreen reclaims it, Windows windowed preserves the right caption-button area, and browser/fullscreen states add no unnecessary inset. `Control+Command+F` toggles the mock fullscreen state.
10. Open Agent after selecting a document. The current conversation is the left-side history selector; its compact list starts directly with records, without a redundant Conversations/count header. New conversation, Runtime Inspector, and Hide Agent remain right-aligned. Each conversation has a trigger-aligned compact Rename/Delete menu, Runtime Inspector opens as a dismissible dialog, and the composer stays pinned to the panel bottom while the transcript scrolls independently. Choose `Model · Reasoning` before sending, then open the completed answer's three-dot evidence hinge to review its immutable Model, Reasoning, and Context Window snapshot. Review steering, cancellation, Retry, public activity, Tool chronology, bounded editor mutations, and native Undo.
11. Open Settings to review the grouped Application, AI, Editors, and Review navigation. General owns Light/Dark/System Appearance. Agent owns the AI feature gate. AI Provider uses a password Token field and reveals its Model select only after the current Base URL and Token pass Test connection; changing either input invalidates that result.
12. Open the Command Palette for recent files, Open Workspace, Settings, new documents, Save, Save As, panel toggles, reset, and simulated application exit.

## Reliability scenario walkthrough

Open **Settings → Review Scenarios**. Each choice resets platform fixtures before applying one deterministic contract, so scenarios do not accumulate.

- **Filesystem:** document-scoped read-only protection, document-save failure with Recovery, and document success with a Workspace-state warning.
- **External changes:** clean reload, dirty conflict with Save As / Reload / Cancel, rename, file deletion, and missing Workspace root.
- **Recovery:** restorable draft and corrupt recovery while the source remains preserved.
- **Documents:** unsupported file fallback, mixed Markdown line endings, and missing Recent target.
- **Agent:** AI disabled, Provider configuration required, Compatibility fallback, terminal failure and Retry, context pressure, invalid custom Skill, and protected editor Tool rejection.

No dirty conflict silently overwrites or discards content. Recovery requires Restore or Discard. Missing files preserve the editor session until Close or Save As. Simulated exit uses Save, Discard, and Cancel when the active document is dirty.

## Mock boundary

The frontend interactions, editor transactions, state machines, keyboard routing, accessibility semantics, responsive shell, and browser exports are real. The following platform results are deterministic mocks:

- filesystem paths, dialogs, watchers, atomic persistence, Recovery, Trash, and Workspace metadata;
- OS window close/fullscreen/platform events and application exit; `MockWindowApi` supplies the replaceable demo seam;
- credential storage/status, Provider connection tests and model catalogs, Codex process health, context counts, and runtime diagnostics;
- Agent responses, streaming timing, per-Turn model/reasoning/context evidence, Tool results, and Skill import/validation.

All displayed file paths are under `/Mock`. Provider tokens never enter saved browser settings or return to the UI. No model request, local filesystem access, process launch, or Tauri command occurs.

See [CAPABILITY_MATRIX.md](./CAPABILITY_MATRIX.md) for the interaction-to-contract map and `screenshots/` for the refreshed review frames.

The four current screenshots deliberately cover different acceptance states: side-anchored Workspace actions and drag targets at 1440×900 Light, the model selector and completed-response evidence at 1200×850 Dark, state-aware window chrome at 1100×850, and the minimum 850×850 Agent layout.

## Migration gate

This demo is review evidence, not production migration approval. Moving any behavior into the Tauri application requires a separate accepted feature, an approved plan, real Tauri v2 permissions, platform integration tests, and explicit human approval after this UX review.
