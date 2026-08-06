---
id: "F022"
title: "Export Editor Content as draw.io"
type: "feature"
status: "complete"
summary: "Export the active IdeaSketch Page from Excalidraw's main menu as an editable draw.io diagram through the native desktop save flow."
source: "docs/superplan/human/features.md"
created: "2026-08-06"
order: 22
depends_on: ["F001", "B001", "B005"]
parent: ""
---

# Export Editor Content as draw.io Plan

**Goal:** Let users take the active IdeaSketch Page into diagrams.net/draw.io as editable diagram content without leaving the editor or changing IdeaNote persistence.
**Scope:** Add an English `Export as draw.io` command to the editable canvas's top-left Excalidraw `MainMenu`. Read the live active-Page scene, omit deleted and internal Camera elements, convert common Excalidraw rectangles, ellipses, diamonds, text, lines/arrows, images, and freehand strokes into an uncompressed draw.io `mxfile`/`mxGraphModel`, and preserve practical geometry, colors, opacity, rotation, stroke/fill treatment, arrowheads, waypoints, bound labels, and embedded image data. Open the native desktop save dialog with a sanitized active-Page title and `.drawio` extension, write through the existing format-agnostic `write_file_bytes` command, and report skipped unsupported elements or export failures without mutating the document.
**Non-Goals:** This plan does not import `.drawio`, add a draw.io editor or registered document type, export every Page into one multi-page draw.io file, guarantee pixel-identical rendering, rearrange diagram layout, convert Camera metadata into visible shapes, change `.is v1`, mark the document dirty, trigger autosave/recovery, alter PNG/SVG export, or restore Excalidraw native `.excalidraw` save paths.
**Architecture:** A new pure `excalidrawToDrawio` module owns the clean-room TypeScript mapping from the registry-owned Excalidraw Scene into draw.io XML and remains independent of React, Tauri, and IdeaSketch persistence. A small `drawioExport` coordinator owns filename normalization, native save selection, byte encoding, cancellation, and user-facing failure boundaries while reusing the existing generic `write_file_bytes` IPC command. `SlideCanvas` continues to own Excalidraw menu composition and reads the live API snapshot only when the command is invoked; `IdeaSketchEditor` supplies the active Page title, and `slideCanvasProps` tracks that render input without widening document mutation responsibilities. The referenced repository informs supported behavior only: it contains no license file, so its source is not copied.
**Baseline:** `SlideCanvas` currently renders only Excalidraw's image export, theme, background, clear, and help items in the top-left menu. Its live API already exposes current elements, app state, and files. F001 provides a native persistence pattern and the generic `write_file_bytes` command, but its global Blob bridge intentionally recognizes only PNG/SVG downloads. B001 keeps native `.excalidraw` save paths disabled, B005 defines the current supported Main Menu ownership, and Camera filtering already exists for presentation/thumbnail rendering. No draw.io XML conversion or `.drawio` save path exists.
**Exit Criteria:** In an editable IdeaSketch canvas, the top-left menu contains one `Export as draw.io` command; invoking it exports the latest active Page rather than a stale saved snapshot. The resulting non-empty `.drawio` file opens in diagrams.net with supported shapes, labels, connectors, images, and freehand content editable or represented as embedded draw.io cells; negative coordinates and XML-sensitive text remain valid; deleted and Camera elements are absent; unsupported elements are skipped with an English summary. The native dialog suggests a sanitized Page-based filename, cancellation writes nothing, and failures are visible. Exporting does not change selection, Page content, dirty state, autosave, recovery, or `.is` persistence. PNG/SVG export, presentation, Camera behavior, and B001 native-scene-save suppression remain intact. Focused regressions, the full frontend suite, production build, Tauri interaction smoke check, and final diff checks pass.

## Task 1: Build a Deterministic Excalidraw-to-draw.io Converter

**Outcome:** A pure converter produces valid, testable draw.io XML from the active Page scene without depending on UI or native APIs.
**Files:**
- Create: `src/lib/excalidrawToDrawio.ts`
- Create: `tests/excalidrawToDrawio.test.mjs`

**Change Map:**
- scene projection: ignore deleted, transient preview, and `customData.type === "camera"` elements while retaining stable z-order for supported content
- vertex mapping: rectangles, ellipses, diamonds, standalone/bound text, rotation, opacity, stroke/fill, rounding, and rough/sketch approximation
- edge mapping: line/arrow endpoints, intermediate waypoints, arrowheads, dash styles, bound labels, and shape bindings where both endpoints are exported
- embedded content: image file data URLs and freehand SVG payloads represented through draw.io image cells
- document serialization: deterministic cell IDs, negative-coordinate normalization, XML escaping, injected diagram metadata for stable tests, and an uncompressed diagrams.net-compatible `mxfile`
- conversion summary: exported and skipped counts/types for user-facing feedback without throwing on unsupported elements

**Verification:**
- `node --test tests/excalidrawToDrawio.test.mjs`
- Cases: empty Page; rectangle/ellipse/diamond; standalone and bound multiline text with XML-sensitive characters; straight and multi-point arrows with bindings/labels; rotation, opacity, dashed strokes, and negative coordinates; embedded image; freehand path; deleted/Camera/transient omission; unsupported-element summary; deterministic metadata.

- [x] Add focused behavior-level tests that fail because no converter exists.
- [x] Implement the clean-room converter and make every focused mapping/validity case pass.

## Task 2: Add Native Export and the Excalidraw Main Menu Command

**Outcome:** Users can invoke the converter from the active canvas and save the result through IdeaNote's native desktop file boundary without affecting document state.
**Files:**
- Create: `src/lib/drawioExport.ts`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/lib/slideCanvasProps.ts`
- Create: `tests/drawioExport.test.mjs`
- Modify: `tests/excalidrawMainMenu.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/slideCanvasProps.test.mjs`
- Modify: `tests/cameraBadgeWiring.test.mjs`

**Change Map:**
- `drawioExport`: sanitize the active Page title, request a `.drawio` native path, encode/write XML through `write_file_bytes`, return saved/cancelled outcomes, and surface errors through an injectable boundary
- `SlideCanvas`: render one accessible `Export as draw.io` `MainMenu.Item`, read live `getSceneElements()`/`getFiles()` data at invocation time, run export once, and show saved/skipped feedback without changing the scene
- `IdeaSketchEditor` and prop comparator: pass and track the active Page title as export naming input while preserving Page identity and memoization behavior
- regression boundaries: retain `SaveAsImage`, disabled native scene save actions, contextual-only top-right conversion UI, Camera omission, and absence from read-only/presentation mode

**Verification:**
- `node --test tests/drawioExport.test.mjs tests/excalidrawMainMenu.test.mjs tests/ideaSketchEditor.test.mjs tests/slideCanvasProps.test.mjs tests/cameraBadgeWiring.test.mjs`
- Cases: filename normalization/fallback; selected native path and exact UTF-8 bytes; cancellation with no write; converter failure reporting; one menu item in editable mode; live API snapshot use; no scene update/dirty callback; Page-title wiring; existing PNG/SVG and native-save contracts.
- Tauri smoke check: export a representative active Page, cancel a second attempt, open the saved file in diagrams.net, and confirm Camera frames are absent and the editor remains unchanged.

- [x] Add failing native-export and menu/wiring regressions.
- [x] Implement the save coordinator and menu integration through the existing editor boundaries.
- [x] Verify success, cancellation, failure feedback, active-Page naming, and no document mutation in the desktop app.

## Task 3: Verify and Deliver F022

**Outcome:** The feature ships with focused, regression, build, interaction, progress, and Git evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F022-export-editor-content-as-drawio.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F022 request and plan: completion status, checked outcomes, and current focused/full/Tauri evidence
- generated plan index: refreshed F022 status and dependencies

**Verification:**
- Run the focused Task 1-2 suites while iterating.
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Inspect final status/diff for unrelated changes and compare the delivered behavior with every Exit Criterion.

**Evidence:**
- Focused converter, native-export, menu, Page-title, memoization, and Camera-boundary suites passed 27/27 after the initial expected failures; the converter/export subset passed 7/7.
- The complete frontend regression passed 224/224, `npm run build` passed, and `git diff --check` passed. Build output contained only the existing Excalidraw import-overlap and large-chunk warnings.
- A fresh debug macOS bundle exposed `Export as draw.io` in the editable Excalidraw menu. A recovered live scene containing `Hello draw.io` and an arrow exported through the native save dialog while `Unsaved changes` remained visible; canceling a second export created no file.
- The 1,255-byte exported `.drawio` file passed `xmllint --noout`, contained the live text and editable edge cell, and contained no Camera marker. Direct browser file import automation was unavailable because the connected Chrome extension lacked local-file upload access; compatibility remains covered by the uncompressed `mxfile`/`mxGraphModel` structure, XML validation, and deterministic cell-mapping tests.
- The independently implemented TypeScript converter uses the reference repository only for behavioral guidance; no source was copied, and the reference repository had no license file to authorize reuse.

- [x] Run the stabilized full frontend regression and production build once.
- [x] Complete the native interaction and draw.io compatibility matrix, record evidence, mark F022 done/complete, refresh the index, and create a separate `feat(F022)` commit.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F001-enable-excalidraw-image-export.md`
- `docs/superplan/plans/bugs/B001-disable-excalidraw-native-save.md`
- `docs/superplan/plans/bugs/B005-integrate-navigator-into-excalidraw-toolbar.md`
- `docs/superplan/plans/features/F017-convert-excalidraw-selection-to-clean-diagram-style.md`
- `src/components/SlideCanvas.tsx`
- `src/components/IdeaSketchEditor.tsx`
- `src/lib/slideCanvasProps.ts`
- `src/lib/tauriBlobDownload.ts`
- `src/lib/cameraUtils.ts`
- `tests/excalidrawMainMenu.test.mjs`
- `tests/cameraBadgeWiring.test.mjs`
- `https://github.com/bhagman/excalidraw-to-drawio`
