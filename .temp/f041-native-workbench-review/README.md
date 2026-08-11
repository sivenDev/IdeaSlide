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
2. Open `launch-plan.is` for the Excalidraw-based IdeaSketch editor. Review Pages, Cameras, reordering, presentation, laser pointer, clean-diagram conversion, and PNG/SVG/draw.io browser exports.
3. Open `product-brief.md` for CodeMirror 6 Markdown. Review Edit/Split/Preview, GFM, Outline, formatting, search, line-ending choice, and native Undo/Redo.
4. Edit a document and observe the leading status/close lens move through Unsaved, Saving, Saved, warning, and error states. Hover or focus it to reveal Close, then close while dirty to exercise Save, Discard, and Cancel. Manual save remains available through `Command/Ctrl+S` and the Command Palette.
5. Use each Workspace root or directory `+` to create IdeaSketch, Markdown, or Folder entries at that exact location. Use row overflow to rename, move to Archive, simulate Show in Finder, move entries to Trash, or remove a Workspace from the sidebar without claiming to delete disk content. Files intentionally have overflow only.
6. Confirm Recents contains only standalone files opened outside a Workspace. Workspace roots and Workspace-owned files never enter the list; Open Workspace remains available through the Command Palette and the empty-Workspaces action.
7. Collapse Workspaces on Welcome and with an active editor. The Editor Host remains visible, interactive, and expands into the released width. Resize Workspaces, IdeaSketch Navigator, Markdown split, and Agent with a pointer or keyboard.
8. Open Agent after selecting a document. Its compact title-only crown right-aligns New Thread, History, Runtime Inspector, and Hide Agent. Review local Threads, Skills, incremental/burst/atomic delivery, steering, cancellation, Retry, public activity, Tool chronology, bounded editor mutations, and native Undo.
9. Open Settings to review General, AI Provider, Agent, Skills, IdeaSketch, and prototype-only Review Scenarios. Light, Dark, and System apply immediately.
10. Open the Command Palette for recent files, Open Workspace, Settings, new documents, Save, Save As, panel toggles, reset, and simulated application exit.

## Reliability scenario walkthrough

Open **Settings → Review Scenarios**. Each choice resets platform fixtures before applying one deterministic contract, so scenarios do not accumulate.

- **Filesystem:** read-only Workspace, document-save failure with Recovery, and document success with a Workspace-state warning.
- **External changes:** clean reload, dirty conflict with Save As / Reload / Cancel, rename, file deletion, and missing Workspace root.
- **Recovery:** restorable draft and corrupt recovery while the source remains preserved.
- **Documents:** unsupported file fallback, mixed Markdown line endings, and missing Recent target.
- **Agent:** AI disabled, Provider configuration required, Compatibility fallback, terminal failure and Retry, context pressure, invalid custom Skill, and protected editor Tool rejection.

No dirty conflict silently overwrites or discards content. Recovery requires Restore or Discard. Missing files preserve the editor session until Close or Save As. Simulated exit uses Save, Discard, and Cancel when the active document is dirty.

## Mock boundary

The frontend interactions, editor transactions, state machines, keyboard routing, accessibility semantics, responsive shell, and browser exports are real. The following platform results are deterministic mocks:

- filesystem paths, dialogs, watchers, atomic persistence, Recovery, Trash, and Workspace metadata;
- OS window close/fullscreen and application exit;
- credential storage/status, network providers, Codex process health, context counts, and runtime diagnostics;
- Agent responses, streaming timing, Tool results, and Skill import/validation.

All displayed file paths are under `/Mock`. No credential value is returned after save. No model request, local filesystem access, process launch, or Tauri command occurs.

See [CAPABILITY_MATRIX.md](./CAPABILITY_MATRIX.md) for the interaction-to-contract map and `screenshots/` for the refreshed review frames.

The four current screenshots deliberately cover different acceptance states: object-scoped Workspace overflow at 1440×900 Light, the open Agent crown at 1200×850 Dark, an active editor with Workspaces collapsed at 1100×850, and a directory-scoped create menu on Welcome at the 850×850 minimum.

## Migration gate

This demo is review evidence, not production migration approval. Moving any behavior into the Tauri application requires a separate accepted feature, an approved plan, real Tauri v2 permissions, platform integration tests, and explicit human approval after this UX review.
