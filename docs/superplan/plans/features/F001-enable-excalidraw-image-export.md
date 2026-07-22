---
id: "F001"
title: "Enable Excalidraw Image Export"
type: "feature"
status: "draft"
summary: "Expose Excalidraw's image export dialog from the canvas menu without restoring native scene save paths."
source: "docs/superplan/human/features.md"
created: "2026-07-22"
order: 1
depends_on: []
parent: ""
---

# Enable Excalidraw Image Export Plan

**Goal:** Let users export the current canvas as an image from the top-left Excalidraw menu while IdeaSlide remains the sole owner of presentation-file persistence.
**Scope:** Add Excalidraw's native `SaveAsImage` item to the editor canvas menu, enable the corresponding canvas action, and update the integration regression contract so image export is allowed while native `.excalidraw` scene save paths remain disabled.
**Non-Goals:** This plan does not add a custom image exporter, change PNG/SVG export settings or filenames, expose Excalidraw's scene export/load actions, alter IdeaSlide `.is` saving or autosave, or add image export to read-only presentation mode.
**Architecture:** `SlideCanvas` owns the Excalidraw integration boundary. Its custom `MainMenu` must explicitly render `MainMenu.DefaultItems.SaveAsImage`, and `UIOptions.canvasActions.saveAsImage` must permit the dialog. The separate native-scene controls (`saveToActiveFile`, `saveFileToDisk`, and `export.saveFileToDisk`) remain disabled so F001 does not regress B001.
**Baseline:** `src/components/SlideCanvas.tsx` renders a custom menu containing theme, background, clear, and help items only. The shared `excalidrawCanvasActions` configuration sets `saveAsImage: false`; existing regression coverage asserts that native scene save actions are disabled but does not distinguish image export from `.excalidraw` persistence.
**Exit Criteria:** In editor mode, the top-left canvas menu contains Excalidraw's image export item; selecting it opens the standard image export dialog with the installed Excalidraw capabilities; presentation/view mode remains unchanged; native `.excalidraw` save paths stay disabled; focused regressions, the full source-level test suite, and the production build pass.

## Task 1: Expose Image Export Without Reopening Scene Save

**Outcome:** Users can open Excalidraw's image export dialog from the canvas menu, while IdeaSlide continues to exclusively handle presentation-file saves.
**Files:**
- Modify: `src/components/SlideCanvas.tsx`
- Test: `tests/cameraBadgeWiring.test.mjs`

**Change Map:**
- `src/components/SlideCanvas.tsx`: `excalidrawCanvasActions` image-export permission and the custom `mainMenu` item list
- `tests/cameraBadgeWiring.test.mjs`: source-level contract separating enabled image export from disabled native scene persistence

**Verification:**
- `node --test tests/cameraBadgeWiring.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- Manual editor smoke check: open the top-left canvas menu, choose image export, confirm the standard Excalidraw image export dialog opens, and confirm no native scene-save item is exposed

- [ ] Add a failing regression assertion requiring `MainMenu.DefaultItems.SaveAsImage` and an enabled `saveAsImage` canvas action while retaining the B001 native-save assertions.
- [ ] Run the focused test and confirm the new image-export contract fails against the current menu configuration.
- [ ] Enable `saveAsImage` and add `SaveAsImage` to the editor-only custom menu without changing native scene export/save controls.
- [ ] Re-run the focused test and confirm both image-export and native-save boundaries pass.
- [ ] Run the full source-level test suite, production build, and manual editor smoke check.
- [ ] Mark F001 and this plan complete after verification.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/bugs/B001-disable-excalidraw-native-save.md`
- `src/components/SlideCanvas.tsx`
- `tests/cameraBadgeWiring.test.mjs`
- `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/components/main-menu/DefaultItems.d.ts`
- `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/types.d.ts`
