---
id: "F018"
title: "Optimize Conversion for Formal Presentation Style"
type: "feature"
status: "complete"
summary: "Make converted Excalidraw selections precise, sharp, and visually consistent for formal presentations."
source: "docs/superplan/human/features.md"
created: "2026-08-05"
order: 18
depends_on: ["F017"]
parent: ""
---

# Optimize Conversion for Formal Presentation Style Plan

**Goal:** Ensure every supported element reported as converted has a precise, non-hand-drawn visual treatment suitable for formal presentations.
**Scope:** Strengthen F017's deterministic conversion policy for rectangles, ellipses, diamonds, text, lines, and arrows. Converted vector elements use zero roughness, solid strokes and fills, consistent 2 px strokes, full opacity, sharp non-rounded corners or connectors where the element type permits, and Helvetica typography while preserving geometry, colors, z-order, grouping, links, labels, and bindings. Images remain unchanged. Freehand drawings are no longer described or copied as formalized content: Current Page leaves them untouched and reports them as skipped, while New Page omits them and reports them as skipped. Keep the existing `Convert style`, Current Page, and New Page workflow.
**Non-Goals:** This plan does not recolor diagrams into a fixed corporate theme, change font sizes, rearrange layout, straighten user-authored connector geometry, replace images, vectorize or AI-redraw freehand strokes, generate `.drawio`/mxGraph files, or change Camera, Navigator, presentation, persistence, and Page behaviors.
**Architecture:** `excalidrawStyleConversion` remains the single pure policy boundary. Its style-delta calculation and conversion projections will share one formal-style update map so action availability, current-Page replacement, new-Page copying, and summaries cannot disagree. Freehand moves from retained to skipped classification because retaining it in a new formal Page contradicts the user-visible promise. `IdeaSketchEditor` continues to apply the result through the existing one-step Undo and Page draft boundaries, including Excalidraw text-dimension repair; no new persistence or UI path is introduced.
**Baseline:** F017 currently applies zero roughness and solid stroke/fill treatment but preserves original roundness, stroke width, and opacity, and it copies freehand elements unchanged into a New Page. Browser acceptance showed that a converted rounded rectangle can therefore still read visually as Excalidraw-like. The converter already preserves identities and relationships, remaps copied bindings and groups, projects image files, and reports converted/retained/skipped counts.
**Exit Criteria:** Converted supported elements have no Excalidraw hand-drawn roughness or rounded connector treatment and use the exact formal policy in both targets. A rounded, semi-transparent, dashed, hachure-filled selection becomes sharp, fully opaque, solid, and consistently stroked without changing its bounds, rotation, colors, ordering, grouping, labels, links, or bindings. Images remain unchanged. Freehand is reported as not formalized, remains untouched on Current Page, and is absent from New Page. Existing selection visibility, one-step Undo, source-Page preservation, Page identity, save/reopen, Camera, Navigator, Present, and read-only behavior remain intact.

## Task 1: Define the Formal Presentation Style Contract

**Outcome:** Tests specify the exact non-hand-drawn output policy and distinguish retained images from unformalizable freehand content.
**Files:**
- Modify: `tests/excalidrawStyleConversion.test.mjs`
- Modify: `src/lib/excalidrawStyleConversion.ts`

**Change Map:**
- formal style map: zero roughness, solid line/fill, 2 px stroke, 100% opacity, sharp `roundness`, Helvetica text
- type policy: preserve colors and geometry; retain images; classify freehand, Camera, embedded, magic, and other unsupported elements as skipped
- availability: show conversion when any supported selected element differs in any formal-style field, including only roundness, width, or opacity
- projections: keep Current Page skipped elements byte-for-byte unchanged; omit skipped elements from New Page while retaining deterministic summaries and identity/binding remapping

**Verification:**
- `node --test tests/excalidrawStyleConversion.test.mjs`
- Cases: rounded rectangle and diamond; ellipse; dashed/rounded line and arrow; semi-transparent text; already-formal selection; mixed image/freehand/Camera/unsupported selection; Current Page preservation; New Page omission; colors, geometry, grouping, bindings, and source immutability.

- [x] Replace the loose clean-style expectations with an exact formal-presentation contract.
- [x] Implement one shared formal policy and strict freehand classification without changing relationship or file behavior.

## Task 2: Preserve the Existing Editor Workflow and Explain Skips Clearly

**Outcome:** Users receive an accurate result summary while Current Page, New Page, Undo, text layout, and Page isolation continue to behave exactly as before.
**Files:**
- Modify: `src/lib/excalidrawStyleConversion.ts`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/canvasSelectionActions.test.mjs`

**Change Map:**
- result summary: describe skipped elements as content that could not be formalized rather than implying freehand was converted or retained
- `IdeaSketchEditor`: continue using `restoreElements` dimension and binding repair, immediate capture for Current Page, and matching-Page feedback for New Page
- UI contract: retain the contextual English `Convert style` control and the existing target order; do not add style presets or persistent controls

**Verification:**
- `node --test tests/excalidrawStyleConversion.test.mjs tests/ideaSketchEditor.test.mjs tests/canvasSelectionActions.test.mjs tests/excalidrawMainMenu.test.mjs tests/slideCanvasProps.test.mjs`
- Browser cases: convert a deliberately rough rounded diagram on Current Page and Undo; create a New Page from mixed shapes, text, image, and freehand; compare source/destination; verify freehand reporting, sharp corners, consistent stroke/opacity, text layout, and no console errors.

- [x] Update summary and editor contracts to match the stricter classification.
- [x] Verify both targets visually against a formal-presentation reference selection.

## Task 3: Verify and Deliver F018

**Outcome:** The formal style enhancement ships with focused, full-regression, build, native, serialization, visual, and progress evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F018-optimize-conversion-for-formal-presentation-style.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F018 request and plan: completion state, checked outcomes, and current evidence
- generated plan index: F018 status and dependency on F017

**Verification:**
- Run the focused Task 1–2 suites.
- `node --test tests/*.test.mjs`
- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- Representative `.is v1` serialize/reopen check for formal fields and source preservation.
- Browser acceptance at normal and 1024×768 editor widths, including Current Page Undo, New Page isolation, mixed freehand reporting, presentation preview, and console logs.
- `git diff --check`

**Evidence:**
- Focused conversion and editor workflow suites passed 21/21; the complete frontend regression passed 200/200 and the Rust regression passed 85/85.
- `npm run build` passed with only the existing Excalidraw import-overlap and large-chunk warnings.
- Browser acceptance verified Current Page formalization and one-step Undo, New Page source isolation, omission of selected freehand content, exact Architect/Sharp/Solid/Bold/100% controls, visible `Convert style` placement at 1024×768, and formal output in presentation Preview. A fresh application tab reported no console errors.
- A representative `.is v1` serialization/reopen smoke check preserved source roughness and roundness, kept source freehand, and reopened the destination with roughness `0`, solid fill/stroke, 2 px stroke, 100% opacity, null roundness, and no freehand element.
- `git diff --check` passed, and converted colors, geometry, ordering, grouping, links, bindings, image files, Page identity, and source immutability remain covered by deterministic tests and the unchanged F017 workflow boundary.

- [x] Complete the focused and full verification matrix with no new warnings or regressions.
- [x] Mark F018 complete, refresh Superplan progress, and create a separate `feat(F018)` commit.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F017-convert-excalidraw-selection-to-clean-diagram-style.md`
- `src/lib/excalidrawStyleConversion.ts`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/CanvasSelectionActions.tsx`
- `tests/excalidrawStyleConversion.test.mjs`
