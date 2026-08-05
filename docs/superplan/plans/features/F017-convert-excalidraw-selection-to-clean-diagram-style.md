---
id: "F017"
title: "Convert Excalidraw Selection to Clean Diagram Style"
type: "feature"
status: "complete"
summary: "Convert an editable Excalidraw selection into a deterministic clean diagram style on the current Page or a new Page."
source: "docs/superplan/human/features.md"
created: "2026-08-05"
order: 17
depends_on: ["04", "F014", "B006", "B014"]
parent: ""
---

# Convert Excalidraw Selection to Clean Diagram Style Plan

**Goal:** Let users turn a rough Excalidraw selection into a clean, draw.io-like diagram without leaving IdeaSketch or changing the `.is v1` format.
**Scope:** Add a contextual `Convert style` action for a writable, eligible Excalidraw selection. Offer `New Page` first as the recommended safe target, copying the converted selection into a newly created and selected Page while leaving the source Page unchanged; offer `Current Page` to replace eligible selected elements in place as one undoable Excalidraw update. Deterministically normalize basic shapes, text, lines, and arrows to zero roughness, solid line/fill treatment, and clean typography while preserving geometry, colors, opacity, z-order, grouping, links, labels, and internal bindings. Copy images and freehand elements unchanged with a result summary. Leave Camera elements and unsupported embedded or magic elements untouched on the current Page and omit them from a new Page while reporting them. Preserve selected image files, Page draft isolation, Workspace autosave, Standalone save, recovery, and read-only behavior.
**Non-Goals:** This plan does not generate `.drawio` or mxGraph XML, add a draw.io editor or file type, use AI redrawing, rearrange diagram layout, alter `.is v1` Page content, convert Cameras, inject controls into Excalidraw's private DOM, restore Navigator or Camera Canvas actions, add a persistent detached toolbar, or change Page/Camera presentation behavior.
**Architecture:** A pure `excalidrawStyleConversion` module owns selection closure, element classification, clean-style normalization, ID/binding remapping for copied output, relevant-file projection, and conversion summaries. `IdeaSketchEditor` remains the document/Page mutation boundary: it reads the live Excalidraw API snapshot, commits the source draft before Page changes, applies current-Page conversion through one immediately captured Excalidraw scene update, or dispatches the existing `ADD_PAGE` action with a complete converted Page. `SlideCanvas` owns only selection observation and a contextual public-API UI entry. Because F014 deliberately removed persistent Canvas navigation controls, the conversion affordance uses Excalidraw's supported `renderTopRightUI` boundary only while an eligible selection exists, with the existing Radix dropdown primitive presenting the two target actions; it never adds Navigator or Camera controls and never touches private toolbar DOM. Existing `useEditorSession` and autosave/recovery paths receive the resulting ordinary scene or Page mutation rather than a parallel persistence path.
**Baseline:** `IdeaSketchEditor` already retains the Excalidraw API, flushes drafts before every Page mutation, creates and selects Pages through `ADD_PAGE`, and persists scene changes through the canonical editor-session path. `SlideCanvas` already observes API scene changes for Camera badges, uses a stable `onChange`, exposes a customized Main Menu, and can call `updateScene`; F014 currently rejects all custom top-right UI after removing a persistent Navigator/Camera island. Excalidraw 0.18 exposes public element transformation/mutation APIs, `CaptureUpdateAction.IMMEDIATELY`, `setToast`, selection state, files, and `renderTopRightUI`. Every `.is v1` Page still serializes only an Excalidraw Scene.
**Exit Criteria:** In a writable IdeaSketch Page, selecting at least one eligible non-Camera element reveals an accessible English `Convert style` action with `New Page` and `Current Page` choices; no selection, Camera-only selection, read-only mode, and presentation view expose no mutating action. Current-Page conversion changes only eligible selected elements in place, preserves IDs/selection/bindings, enters Undo as one operation, marks one real document edit, and reports converted/retained/skipped counts. New-Page conversion leaves the source Page byte-for-byte unchanged after its pending draft is committed, creates and selects one titled Page containing copied converted/retained elements with remapped internal identities and required image files, excludes unsupported/Camera elements with a visible summary, and cannot contaminate either Page during subsequent edits. Saved and reopened Workspace and Standalone documents preserve both targets; Camera counts/order, Present, Navigator, image export, native-save suppression, autosave settlement, recovery, and Page draft identity continue to pass focused and full verification.

## Task 1: Define Deterministic Selection Conversion

**Outcome:** A pure, testable converter produces stable current-Page replacements and isolated new-Page copies without losing supported relationships or files.
**Files:**
- Create: `src/lib/excalidrawStyleConversion.ts`
- Test: `tests/excalidrawStyleConversion.test.mjs`

**Change Map:**
- selection closure: selected IDs plus bound labels and selected-group members, with deleted elements ignored and Camera classification based on existing custom data
- style policy: clean geometry-preserving normalization for basic shapes, text, lines, and arrows; unchanged image/freehand retention; explicit unsupported/Camera classification
- current-Page projection: retain element IDs, ordering, groups, links, bindings, and selection while changing only eligible style fields
- new-Page projection: regenerate element/group identities, remap bindings wholly inside the copied selection, detach references to unselected elements, project required binary files, and return converted/retained/skipped counts
- text safety: preserve bound-text layout and recalculate or validate dimensions after typography normalization rather than clipping labels

**Verification:**
- `node --test tests/excalidrawStyleConversion.test.mjs`
- Cases: rectangle/ellipse/diamond/text/line/arrow normalization; mixed colors and opacity; bound text; grouped elements; internal and cross-selection arrows; image file projection; freehand retention; deleted elements; Camera-only and embedded/magic selections; deterministic summary and no source mutation.

- [x] Add focused failing conversion contracts for style, relationship, classification, and file behavior.
- [x] Implement the smallest pure conversion boundary using supported Excalidraw element APIs.

## Task 2: Add the Contextual Conversion Action

**Outcome:** Eligible selections expose one accessible conversion control and target chooser without restoring the persistent Canvas control island removed by F014.
**Files:**
- Create: `src/components/CanvasSelectionActions.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/lib/slideCanvasProps.ts`
- Modify: `src/index.css`
- Create: `tests/canvasSelectionActions.test.mjs`
- Modify: `tests/excalidrawMainMenu.test.mjs`
- Modify: `tests/slideCanvasProps.test.mjs`
- Modify: `tests/tooltipWiring.test.mjs`

**Change Map:**
- `SlideCanvas`: derive a stable eligible-selection signature from the existing API change subscription, render conversion UI only in editable mode, and emit a target request without owning Page mutations
- `CanvasSelectionActions`: compact English `Convert style` button, accessible tooltip/labels, Radix target menu with `New Page` presented first and `Current Page` explicit, disabled-safe behavior, and no Canvas pointer interception
- control ownership contracts: allow only this contextual selection action in `renderTopRightUI`; continue rejecting Navigator, Camera creation, persistent custom islands, private-DOM injection, and custom Main Menu rows
- prop comparator/style: track the stable conversion callback without rerender loops and keep the contextual control clear of native Excalidraw tools at supported editor widths

**Verification:**
- `node --test tests/canvasSelectionActions.test.mjs tests/excalidrawMainMenu.test.mjs tests/slideCanvasProps.test.mjs tests/tooltipWiring.test.mjs tests/cameraBadgeWiring.test.mjs`
- Interaction cases: selection appears/disappears; Camera-only and read-only states; menu keyboard navigation and dismissal; target callback fires once; native drawing toolbar, Main Menu defaults, Camera badges, pointer coordinates, and image export remain intact.

- [x] Replace the obsolete blanket no-custom-UI regression with a contextual-only conversion contract.
- [x] Implement the selection-aware action through Excalidraw's public UI boundary and existing Radix controls.

## Task 3: Apply Conversion through the Page Draft Boundary

**Outcome:** Current- and new-Page targets use the existing IdeaSketch model, undo, dirty, autosave, recovery, and Page-isolation paths safely.
**Files:**
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/editorSession.test.mjs`
- Modify: `tests/ideaSketchReducer.test.mjs`
- Modify: `tests/ideaSketchDocument.test.mjs`

**Change Map:**
- live selection snapshot: read elements, app state, and files from the active API only after validating document/Page identity and writable state
- current Page: merge converted elements back at their original z-order, preserve selected IDs, use an immediately captured scene update for one-step Undo, and surface the result summary through the public Excalidraw toast API
- new Page: flush the source draft, build a complete titled Page from the copied conversion result, dispatch existing `ADD_PAGE`, wait for the matching `draft.slideId` mount, select/fit the converted content, and show the pending summary on the destination Canvas
- persistence safety: one real mutation advances the existing dirty/edit version; selection observation and summary UI do not schedule saves; source/destination Pages remain independent through save, autosave, recovery, and reopen

**Verification:**
- `node --test tests/ideaSketchEditor.test.mjs tests/editorSession.test.mjs tests/ideaSketchReducer.test.mjs tests/ideaSketchDocument.test.mjs tests/excalidrawStyleConversion.test.mjs tests/canvasSelectionActions.test.mjs`
- Cases: current conversion and Undo; new Page is selected and source unchanged; pending source edit is committed first; new Page title/order; mixed selection summary; relevant images reopen; subsequent edits stay Page-local; Workspace autosave reaches Saved once; Standalone remains explicit-save; read-only and stale API/Page requests are ignored.

- [x] Wire both targets through `IdeaSketchEditor` without bypassing the canonical draft and reducer boundaries.
- [x] Lock Page identity, dirty/autosave, recovery, and serialization regressions around the new mutation paths.

## Task 4: Verify and Deliver F017

**Outcome:** Selection conversion ships with focused, full-regression, build, persistence, visual, and progress evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F017-convert-excalidraw-selection-to-clean-diagram-style.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F017 request and plan: completion state, checked outcomes, and current focused/full/native evidence
- generated plan index: refreshed F017 state and source/dependency relationship

**Verification:**
- Run the focused Task 1–3 suites.
- `node --test tests/*.test.mjs`
- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `git diff --check`
- Browser/Tauri acceptance: exercise supported, retained, skipped, and Camera selections; convert to the current Page and Undo; convert to a new Page and compare with the source; save/reopen in Workspace and Standalone modes; verify image files, Page identity, autosave settlement, recovery cleanup, Navigator/Camera/Present continuity, responsive control placement, keyboard access, and absence of console errors.

**Evidence:**
- Focused conversion, selection-action, Page-boundary, persistence, and regression suites: 43 passed.
- Full frontend regression: 200 passed; Rust regression: 85 passed.
- `npm run build` passed with only the existing Excalidraw import-overlap and large-chunk warnings; `git diff --check` passed.
- Browser acceptance verified contextual visibility, Current Page conversion and one-step Undo, New Page source preservation and destination title/selection, Camera-only and presentation-mode absence, 1024×768 placement, and a clean post-fix console.
- A representative `.is v1` serialization/reopen smoke check preserved two Page titles, source roughness `2`, and destination roughness `0` with solid stroke/fill treatment.
- Excalidraw `restoreElements` refreshes converted text dimensions and repairs bindings after Helvetica normalization; deterministic pure tests cover identity, grouping, internal/external bindings, retained images/freehand policy, skipped Camera/unsupported policy, and file projection.

- [x] Run focused checks while implementing and the complete regression/build/native matrix once behavior stabilizes.
- [x] Inspect representative saved `.is` archives, complete F017, refresh progress, and create the separate `feat(F017)` commit.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/features/F009-tabbed-ideasketch-navigator.md`
- `docs/superplan/plans/features/F012-drag-sort-workspace-pages-and-cameras.md`
- `docs/superplan/plans/features/F014-simplify-file-and-navigator-controls.md`
- `docs/superplan/plans/bugs/B005-integrate-navigator-into-excalidraw-toolbar.md`
- `docs/superplan/plans/bugs/B006-synchronize-page-canvas-draft-identity.md`
- `docs/superplan/plans/bugs/B007-prevent-false-conflicts-after-autosave.md`
- `docs/superplan/plans/bugs/B014-fix-workspace-autosave-completion-loop.md`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/SlideCanvas.tsx`
- `src/hooks/useEditorSession.ts`
- `src/lib/editorSession.ts`
- `src/lib/ideaSketchReducer.ts`
- `src/lib/slideCanvasProps.ts`
- `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/types.d.ts`
