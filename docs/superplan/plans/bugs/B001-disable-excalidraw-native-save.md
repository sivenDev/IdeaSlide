---
id: "B001"
title: "Disable Excalidraw Native Save Paths"
type: "bugfix"
status: "complete"
summary: "Prevent embedded Excalidraw from handling save shortcuts or exporting native .excalidraw files."
source: "docs/superplan/human/bugs.md"
created: "2026-07-01"
order: 1
depends_on: []
parent: ""
---

# Disable Excalidraw Native Save Paths Plan

**Goal:** Ensure every save trigger in the editor uses IdeaNote's `.is` persistence path instead of Excalidraw's native `.excalidraw` export path.
**Scope:** Disable Excalidraw's embedded `saveToActiveFile` and `saveFileToDisk` canvas actions in `SlideCanvas`, capture save shortcuts in `EditorLayout`, and add source-level regression tests for both boundaries.
**Non-Goals:** This plan does not change IdeaNote's `.is` file format, autosave timing, toolbar layout, image export behavior, or presentation mode.
**Architecture:** IdeaNote already owns save behavior in `EditorLayout` through `saveFile(...)` and Tauri `save_file`. The fix stays at the Excalidraw integration boundary by configuring `UIOptions.canvasActions` so Excalidraw cannot register its own save actions or `Cmd+Shift+S` save-as behavior.
**Baseline:** `SlideCanvas` disables Excalidraw `loadScene`, `export`, and `saveAsImage`, but leaves the default `saveToActiveFile` action enabled and relies on `export: false` without explicitly locking `export.saveFileToDisk` to false. Excalidraw's defaults include `saveToActiveFile: true` and `export: { saveFileToDisk: true }`.
**Reproduction:** Trigger Excalidraw save-as from the embedded canvas, such as `Cmd+Shift+S`, then observe `Untitled-*.excalidraw` files in `~/Downloads`.
**Root Cause:** The embedded Excalidraw instance inherits native save actions because `SlideCanvas` does not explicitly disable `saveToActiveFile` and the native save-to-disk export option.
**Exit Criteria:** Excalidraw native save actions are disabled in `SlideCanvas`, `Cmd/Ctrl+S` and `Cmd/Ctrl+Shift+S` are routed through IdeaNote's editor save handler before Excalidraw can consume them, regression tests cover both save boundaries, and the production build succeeds.

## Task 1: Lock Excalidraw Save Actions Behind IdeaNote Save

**Outcome:** The embedded canvas cannot create `.excalidraw` downloads through Excalidraw native save actions, while IdeaNote save behavior remains unchanged.
**Files:**
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Test: `tests/cameraBadgeWiring.test.mjs`
- Test: `tests/editorChromeNavigation.test.mjs`

**Verification:**
- `node --test tests/cameraBadgeWiring.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`

- [x] Add a failing source-level test requiring `saveToActiveFile: false` and `export: { saveFileToDisk: false }` in `SlideCanvas` `UIOptions.canvasActions`.
- [x] Add a failing source-level test requiring the editor save shortcut listener to normalize `S` and use capture phase.
- [x] Run `node --test tests/cameraBadgeWiring.test.mjs tests/editorChromeNavigation.test.mjs` and confirm the new tests fail before production code changes.
- [x] Update `SlideCanvas` so Excalidraw native save actions are explicitly disabled.
- [x] Update `EditorLayout` so IdeaNote captures save shortcuts before Excalidraw and routes them through `handleSaveCallback`.
- [x] Re-run `node --test tests/cameraBadgeWiring.test.mjs tests/editorChromeNavigation.test.mjs` and confirm it passes.
- [x] Run the full source-level test suite and production build.
- [x] Mark this plan and B001 complete after verification.

## References
- `src/components/SlideCanvas.tsx`
- `src/components/EditorLayout.tsx`
- `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/types.d.ts`
