---
id: "F023"
title: "Normalize draw.io Export Style"
type: "feature"
status: "complete"
summary: "Export IdeaSketch content with a clean, formal draw.io visual style instead of preserving Excalidraw's hand-drawn treatment."
source: "docs/superplan/human/features.md"
created: "2026-08-06"
order: 23
depends_on: ["F018", "F022"]
parent: ""
---

# Normalize draw.io Export Style Plan

**Goal:** Make exported draw.io diagrams look native, clean, and presentation-ready without requiring users to convert the source Page first.
**Scope:** During `Export as draw.io`, normalize supported rectangles, ellipses, diamonds, text, lines, and arrows to the project's established formal style: solid 2 px strokes, solid fills, full opacity, sharp rectangles/connectors, and Helvetica text. Preserve element colors, geometry, rotation, labels, arrowheads, waypoints, bindings, ordering, embedded images, and freehand payloads. Apply the normalization only to generated draw.io cells; the live Page and persisted `.is` content remain unchanged.
**Non-Goals:** This plan does not add a style selector or preference, recolor content into a fixed theme, rearrange geometry, straighten connector routes, change arrowhead meaning, vectorize freehand drawings, alter image pixels, modify the existing `Convert style` workflow, change the native save flow, or add draw.io import.
**Architecture:** `excalidrawToDrawio` remains the pure export boundary and applies a deterministic draw.io-style projection while constructing cell styles. The projection matches F018's formal visual contract but remains export-specific so it cannot mutate Excalidraw elements or invoke editor/reducer behavior. Vector and text cells are normalized; images and embedded freehand cells retain their content-specific representation. `drawioExport` and `SlideCanvas` remain unchanged because naming, native persistence, live-scene capture, feedback, and dirty-state boundaries are already correct.
**Baseline:** F022 exports valid editable draw.io XML and currently mirrors Excalidraw roughness, dashed/dotted strokes, opacity, rounded rectangles, and source font choices through `sketch`, `jiggle`, `dashed`, `opacity`, `rounded`, and font style fields. F018 already defines the product's formal non-hand-drawn style as solid 2 px strokes/fills, 100% opacity, sharp geometry, and Helvetica typography while preserving colors and geometry.
**Exit Criteria:** A rough, rounded, dashed, semi-transparent Excalidraw diagram exports with no `sketch`, `jiggle`, dash, opacity, or rounded-connector styling; supported vector cells use `strokeWidth=2`, text uses Helvetica, and colors, dimensions, rotation, labels, bindings, arrowheads, and waypoints remain intact. Images and freehand content still export, Camera/deleted filtering and unsupported summaries remain unchanged, the source Page stays byte-for-byte unaffected, and the native menu/save/cancel behavior continues to pass focused and full regression checks.

## Task 1: Normalize Generated draw.io Cell Styles

**Outcome:** The pure converter consistently emits clean draw.io styles for supported vector and text elements while preserving semantic and geometric data.
**Files:**
- Modify: `src/lib/excalidrawToDrawio.ts`
- Modify: `tests/excalidrawToDrawio.test.mjs`

**Change Map:**
- vector style policy: force solid 2 px strokes, solid color fills, full opacity, and sharp rectangles/connectors without `sketch`, `jiggle`, dash, or rounded style flags
- text policy: force Helvetica and full opacity for standalone and bound labels while preserving font size, alignment, content, and geometry
- retained content: keep rotation, colors, arrowheads, edge points/bindings, images, and freehand image payloads unchanged
- regression boundaries: retain negative-coordinate normalization, XML escaping, deterministic metadata, Camera/deleted omission, and unsupported-element summaries

**Verification:**
- `node --test tests/excalidrawToDrawio.test.mjs tests/drawioExport.test.mjs`
- Cases: rough rounded dashed translucent shape; dotted curved arrow with arrowheads and waypoints; standalone and bound non-Helvetica text; colors/rotation/geometry preservation; image/freehand retention; Camera/deleted/unsupported behavior.

- [x] Add focused expectations that fail against F022's Excalidraw-style-preserving output.
- [x] Implement the export-only clean draw.io style projection and pass every focused case.

## Task 2: Verify and Deliver F023

**Outcome:** The style normalization ships without regressions to export persistence, editor state, or existing presentation-style conversion.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F023-normalize-drawio-export-style.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F023 request and plan: completion state, checked outcomes, and focused/full/native evidence
- generated plan index: F023 status and dependencies on F018/F022

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Generate a representative `.drawio` fixture, validate it with `xmllint --noout`, and inspect style fields for normalization and preserved content.
- Desktop smoke check: export a deliberately rough Page, confirm the saved XML uses the normalized style, cancel a second export, and confirm the editor remains unchanged.

**Evidence:**
- The focused converter/export suite first failed 6/7 against the F022 output, proving that roughness, dash, opacity, roundness, stroke-width, and font preservation contradicted F023; it passed 7/7 after implementation.
- The complete frontend regression passed 224/224, `npm run build` passed, and `git diff --check` passed. Build output contained only the existing Excalidraw import-overlap and large-chunk warnings.
- A deterministic 1,281-byte fixture passed `xmllint --noout` and preserved colors, geometry, labels, bindings, arrowheads, and waypoints while emitting `strokeWidth=2`, `fontFamily=Helvetica`, and `rounded=0` with no `sketch`, `jiggle`, dash, or opacity fields.
- A fresh debug macOS bundle exported an 893-byte live Page containing a rough, dashed, hachure-filled, rounded rectangle and bound hand-drawn text. The saved XML used a solid color fill, 2 px stroke, and Helvetica with no rough/dash/opacity/rounding fields, while the editor continued to show `Unsaved changes` and the source selection remained Dashed, Artist, and Round.
- Canceling a second native export created no file, and converter input immutability is covered by a direct deep-equality regression.

- [x] Run the stabilized focused, full-regression, build, XML, and desktop checks once.
- [x] Mark F023 complete, refresh Superplan progress, and create a separate `feat(F023)` commit.

## References
- `docs/superplan/plans/features/F018-optimize-conversion-for-formal-presentation-style.md`
- `docs/superplan/plans/features/F022-export-editor-content-as-drawio.md`
- `src/lib/excalidrawToDrawio.ts`
- `src/lib/drawioExport.ts`
- `tests/excalidrawToDrawio.test.mjs`
- `tests/drawioExport.test.mjs`
