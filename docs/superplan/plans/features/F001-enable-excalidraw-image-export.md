---
id: "F001"
title: "Enable Excalidraw Image Export"
type: "feature"
status: "draft"
summary: "Expose Excalidraw's image export dialog and make its PNG/SVG downloads persist through Tauri without restoring native scene save paths."
source: "docs/superplan/human/features.md"
created: "2026-07-22"
order: 1
depends_on: []
parent: ""
---

# Enable Excalidraw Image Export Plan

**Goal:** Let users export the current canvas as an image from the top-left Excalidraw menu while IdeaSlide remains the sole owner of presentation-file persistence.
**Scope:** Keep Excalidraw's native `SaveAsImage` item and dialog in the editor canvas menu, bridge its generated PNG/SVG blob downloads to Tauri's save dialog and `write_file_bytes` command, and preserve the regression contract that native `.excalidraw` scene save paths remain disabled.
**Non-Goals:** This plan does not replace Excalidraw's image renderer or export settings UI, change PNG/SVG content or filenames, expose Excalidraw's scene export/load actions, alter IdeaSlide `.is` saving or autosave, or add image export to read-only presentation mode.
**Architecture:** `SlideCanvas` continues to own menu visibility, while a Tauri-only startup bridge handles the detached blob-download anchors created by Excalidraw's bundled `browser-fs-access` fallback. The bridge intercepts only `.png` and `.svg` blob downloads, opens the native Tauri save dialog, writes the resolved bytes through the existing `write_file_bytes` IPC command, and delegates every other anchor click unchanged. The separate native-scene controls (`saveToActiveFile`, `saveFileToDisk`, and `export.saveFileToDisk`) remain disabled so F001 does not regress B001.
**Baseline:** Task 1 exposes the image export dialog successfully, but user verification shows that clicking PNG or SVG produces no file. The dialog's editable filename proves `browser-fs-access` selected its legacy path because the macOS Tauri webview lacks `showSaveFilePicker`; that path creates a detached `<a download>` with a blob URL, which WKWebView does not persist. IdeaSlide already registers a generic `write_file_bytes` Tauri command but has no frontend bridge using it for Excalidraw downloads.
**Observed Failure:** Open the canvas menu, choose image export, and click PNG or SVG. The button renders and receives the click, but no save dialog or output file appears.
**Root Cause:** Excalidraw's image export calls `browser-fs-access.fileSave`. In this WKWebView it falls back to a programmatic detached anchor download, while IdeaSlide does not intercept that browser-only download mechanism or route the blob through Tauri file I/O.
**Exit Criteria:** In editor mode, the top-left canvas menu opens Excalidraw's standard image export dialog; PNG and SVG each open a native save dialog and write a non-empty file at the selected path; canceling the dialog writes nothing; normal browser anchor behavior and presentation mode remain unchanged; native `.excalidraw` save paths stay disabled; focused regressions, the full source-level test suite, and the production build pass.

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
- UI behavior evidence: perform the editor click-through smoke check when a browser is available; otherwise verify the rendered menu item against Excalidraw's installed `SaveAsImage` handler and retain the automated native-save boundary assertions

- [x] Add a failing regression assertion requiring `MainMenu.DefaultItems.SaveAsImage` and an enabled `saveAsImage` canvas action while retaining the B001 native-save assertions.
- [x] Run the focused test and confirm the new image-export contract fails against the current menu configuration.
- [x] Enable `saveAsImage` and add `SaveAsImage` to the editor-only custom menu without changing native scene export/save controls.
- [x] Re-run the focused test and confirm both image-export and native-save boundaries pass.
- [x] Run the full source-level test suite and production build; verify the UI action against Excalidraw's installed `SaveAsImage` handler because no browser instance was available for click-through smoke testing.
- [x] Record the initial menu/dialog delivery and its verification evidence.

## Task 2: Persist Excalidraw Blob Downloads Through Tauri

**Outcome:** PNG and SVG buttons in Excalidraw's native export dialog save real files through IdeaSlide's native file boundary instead of relying on unsupported WKWebView downloads.
**Files:**
- Create: `src/lib/tauriBlobDownload.ts`
- Modify: `src/main.tsx`
- Test: `tests/tauriBlobDownload.test.mjs`
- Test: `tests/cameraBadgeWiring.test.mjs`

**Change Map:**
- `src/lib/tauriBlobDownload.ts`: Tauri runtime detection, scoped blob-download matching, native save-dialog persistence, original-click delegation, and error handling
- `src/main.tsx`: install the bridge once before React mounts
- `tests/tauriBlobDownload.test.mjs`: behavior-level contract for PNG/SVG interception, cancellation, byte writes, and delegation of unrelated anchors
- `tests/cameraBadgeWiring.test.mjs`: retain the image-export menu and B001 native-scene-save boundaries

**Verification:**
- `node --test tests/tauriBlobDownload.test.mjs tests/cameraBadgeWiring.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- Tauri smoke check: export one PNG and one SVG, confirm each native save dialog appears and each selected file is non-empty; cancel one export and confirm no file is created

- [ ] Add a failing bridge regression covering matching PNG/SVG blob anchors, save cancellation, byte persistence, and delegation of unrelated clicks.
- [ ] Run the focused regression and confirm the missing Tauri bridge is the failure.
- [ ] Implement the smallest Tauri-only blob download bridge and install it once at application startup.
- [ ] Re-run the focused regression and confirm the export/download boundary passes without weakening B001 assertions.
- [ ] Run the full source-level suite, production build, and Tauri PNG/SVG/cancel smoke check.
- [ ] Mark F001 and this revised plan complete after verification.

## Task 1 Verification Evidence

- Red: `node --test tests/cameraBadgeWiring.test.mjs` failed on the missing `saveAsImage: true` contract before the production edit.
- Green: the focused suite passed 5/5 after the implementation.
- Regression: `node --test tests/*.test.mjs` passed 90/90.
- Build: `npm run build` completed successfully with the existing Vite dynamic-import and chunk-size warnings.
- UI contract: the installed Excalidraw `SaveAsImage` menu item sets `openDialog` to `{ name: "imageExport" }`; F001 renders that item and enables its canvas action. The local browser runtime reported no available browser, so click-through smoke evidence was unavailable.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/bugs/B001-disable-excalidraw-native-save.md`
- `src/components/SlideCanvas.tsx`
- `src/main.tsx`
- `src-tauri/src/commands.rs`
- `tests/cameraBadgeWiring.test.mjs`
- `node_modules/browser-fs-access/dist/file-save-3189631c.js`
- `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/components/main-menu/DefaultItems.d.ts`
- `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/types.d.ts`
