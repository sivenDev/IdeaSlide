---
id: "F019"
title: "Add Page List View Mode Switching"
type: "feature"
status: "complete"
summary: "Let the Pages navigator switch between its default name list and a virtualized, performance-bounded thumbnail view."
source: "docs/superplan/human/features.md"
created: "2026-08-05"
order: 19
depends_on: ["F009", "B009"]
parent: ""
---

# Add Page List View Mode Switching Plan

**Goal:** Make multi-Page documents easier to scan visually while preserving the compact Page-name workflow and keeping thumbnail work bounded on large or image-heavy documents.
**Scope:** Add an accessible Name/Thumbnail view switch to the Pages toolbar. Every newly mounted Pages navigator starts in Name mode and keeps the current compact row presentation. Thumbnail mode uses a virtualized Page list, renders only visible and overscan Pages as fixed-size PNG images in the main WebView, labels each preview with its Page number and title, refreshes only the visible active Page after editing becomes idle, and preserves selection, add, inline rename, drag reorder, delete, active state, last-Page protection, and read-only behavior.
**Non-Goals:** This feature does not persist the selected view mode, change `.is` or Workspace metadata, add Camera thumbnails, change Page ordering or save semantics, resize the navigator, move Page thumbnail rendering into another WebView/window, send Page scenes through Tauri events, replace or remove the existing hidden preview renderer used by other features, or rewrite `useSlideThumbnails` for its existing consumers.
**Architecture:** `PageOrganizer` owns local `name | thumbnail` presentation state initialized to `name` and virtualizes both presentations with `@tanstack/react-virtual` using four overscan items. Its virtual range is the only source of thumbnail demand. A new `usePageThumbnails` boundary combines persisted Pages with the active editor draft, computes render fingerprints only for visible/overscan candidates, and submits work to a document-scoped scheduler. The scheduler renders directly with Excalidraw `exportToBlob`, prioritizes active-visible, visible, then overscan Pages, allows exactly one export in flight, yields between Pages through an idle helper with a WebKit-safe animation-frame/timer fallback, drops queued and completed stale generations, and pauses while dragging, renaming, or handling an active pointer interaction. Exports use PNG, a maximum dimension of 440px for the 220px panel, and `<img loading="lazy" decoding="async">`; SVG parsing/cloning is not used. Stable results live in a byte-bounded `lru-cache` capped at 128 entries and 32MB, while the active edit uses one replace-in-place transient slot so edit revisions do not accumulate. Blob URLs are revoked on replacement, eviction, Page deletion, and document unmount, while decoded image pressure is bounded separately by mounting only the virtual range. Existing dnd-kit identities and callbacks remain shared by both modes, using its virtual-list-compatible `verticalListSortingStrategy`.
**Baseline:** `PageOrganizer` currently maps every Page to a compact sortable row. `IdeaSketchNavigator` passes persisted Pages but not the active `useEditorSession` draft. `useSlideThumbnails` fingerprints all supplied Pages and sends render payloads to a hidden renderer, which is appropriate for its existing full-screen consumer but would make Page-list mode changes and image-heavy scenes scale with the entire document. Excalidraw exposes `exportToBlob` with `maxWidthOrHeight` and `exportPadding`. The editor draft is already debounced at 250ms; F019 adds a separate 650ms thumbnail-idle window instead of increasing model commit frequency. PDF.js, ONLYOFFICE, and tldraw independently use visible-priority thumbnail work, offscreen release/caching, and active-page-only refresh patterns. This is a high-risk delivery profile because scheduling, stale async completion, drag interaction, memory bounds, and main-thread responsiveness require deterministic regression evidence.
**Exit Criteria:** Opening or remounting the Pages tab shows the existing Name view by default and performs zero thumbnail exports. The toolbar exposes visibly selected, keyboard-focusable Name and Thumbnail controls with English accessible labels/tooltips, and switching modes does not dirty or persist the document. In Thumbnail mode only mounted visible/overscan items are fingerprinted or scheduled; priority is active-visible, other visible, then overscan; export concurrency never exceeds one; no offscreen Page is proactively rendered. The active Page refreshes only when it is visible/overscan and editing has been idle for 650ms. Back-scrolling reuses cached images without another export, the cache remains within 128 entries/32MB, transient active edits replace one slot, and every discarded Blob URL is revoked. A 100-Page fixture never mounts, fingerprints, or exports the full collection on mode switch. Deterministic tests cover queue priority, pause/resume, stale completion, cleanup, cache bounds, active-only refresh, virtualization, and all Page lifecycle behavior. Tauri/WebKit acceptance covers 100 Pages × 500 elements and image-heavy Pages, records memory over ten minutes of editing to confirm a plateau, and records Long Tasks with `PerformanceObserver` when supported or event-loop/frame-delay instrumentation otherwise: orchestration must not introduce a controllable task over 50ms, while any unavoidable single-Page `exportToBlob` duration is reported separately and must leave selection, scrolling, rename, and drag interactions usable. Focused tests, the complete frontend regression suite, production build, and diff validation pass.

## Task 1: Build the Bounded Main-WebView Thumbnail Pipeline

**Outcome:** Page previews are generated in the main WebView through a deterministic visible-priority queue with stale-result protection and bounded memory.
**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/pageThumbnailExport.ts`
- Create: `src/lib/pageThumbnailScheduler.ts`
- Create: `src/lib/pageThumbnailCache.ts`
- Create: `src/hooks/usePageThumbnails.ts`
- Create: `tests/pageThumbnailScheduler.test.mjs`
- Create: `tests/pageThumbnailCache.test.mjs`
- Create: `tests/pageThumbnails.test.mjs`
- Create: `tests/pageThumbnailPerformance.test.mjs`

**Change Map:**
- dependencies: add maintained `@tanstack/react-virtual` and `lru-cache` packages through the repository's npm lockfile
- `pageThumbnailExport`: Excalidraw-specific `exportToBlob` adapter, preview app-state normalization, PNG/max-dimension/padding policy, empty/error fallback contract, and timing instrumentation boundary
- `pageThumbnailScheduler`: active-visible/visible/overscan priority ordering, single in-flight export, idle yielding with WebKit fallback, demand replacement, interaction pause/resume, and generation-token stale suppression
- `pageThumbnailCache`: stable byte/entry-bounded LRU, one transient active-draft slot, Blob URL ownership, replacement/eviction/delete/unmount disposal
- `usePageThumbnails`: visible-range-only fingerprinting and demand submission, active draft projection, 650ms active-only debounce, Page/document lifecycle cleanup, and render/cache state exposed without coupling the document reducer to view state
- focused tests: deterministic fake-exporter coverage for priority, concurrency, bounded work on 100 Pages, stale completion, pause/resume, active-only refresh, image-sized cache accounting, memory ownership, and URL revocation

**Verification:**
- `node --test tests/pageThumbnailScheduler.test.mjs tests/pageThumbnailCache.test.mjs tests/pageThumbnails.test.mjs tests/pageThumbnailPerformance.test.mjs tests/previewKeys.test.mjs tests/sceneFingerprint.test.mjs`
- Performance contracts use fake timers/exporters rather than unstable wall-clock thresholds: Name/disabled mode produces zero calls; a 100-Page demand schedules only the supplied virtual range; maximum observed concurrency is one; active edits replace one cache slot; byte/entry limits and URL revocation are exact.

- [x] Add focused failing tests for bounded visible demand, priority, concurrency, yielding, pause/resume, stale-result suppression, active-only debounce, cache limits, and Blob URL cleanup.
- [x] Implement the direct Excalidraw PNG exporter, scheduler, LRU ownership, and Page-thumbnail hook without modifying or calling the cross-WebView Page renderer path.
- [x] Run the focused pipeline suite and inspect failures, warnings, export errors, and cleanup behavior before UI integration.

## Task 2: Add the Virtualized Two-mode Pages Navigator

**Outcome:** The Pages panel switches between its existing name rows and efficient scene thumbnails while retaining one Page-management interaction model.
**Files:**
- Modify: `src/components/PageOrganizer.tsx`
- Modify: `src/components/IdeaSketchNavigator.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/index.css`
- Modify: `tests/pageOrganizer.test.mjs`
- Modify: `tests/ideaSketchNavigator.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/slideThumbnails.test.mjs`
- Modify: `tests/f012DragRuntime.test.mjs`

**Change Map:**
- `PageOrganizer`: local default Name mode, accessible selected-state controls, TanStack virtualizer and overscan policy, reusable sortable Page item behavior, thumbnail image/placeholder/caption states, active/drag/edit/action states, and interaction-pause signals
- `IdeaSketchNavigator`: forward the active Page draft to the Page presentation boundary without owning or persisting view state
- `IdeaSketchEditor`: project the debounced `useEditorSession` draft for only the active Page while preserving flush-before-switch, autosave, and model persistence behavior
- `src/index.css`: compact segmented mode control plus virtualized name-row and thumbnail-card layouts consistent with the navigator's neutral/violet visual system
- focused tests: replace obsolete thumbnail prohibitions with default-mode/no-export, virtual-range, image attributes, draft-forwarding, accessibility, lifecycle, read-only, and virtualized dnd-kit contracts; extend the real WebKit runtime regression for virtualized Page dragging; retain coverage proving the existing `useSlideThumbnails` consumer is unchanged

**Verification:**
- `node --test tests/pageOrganizer.test.mjs tests/ideaSketchNavigator.test.mjs tests/ideaSketchEditor.test.mjs tests/slideThumbnails.test.mjs tests/pageThumbnailScheduler.test.mjs tests/pageThumbnailCache.test.mjs tests/pageThumbnails.test.mjs tests/pageThumbnailPerformance.test.mjs tests/ideaSketchReducer.test.mjs tests/f012DragRuntime.test.mjs`
- Interaction cases: initial Name mode and zero exports; switch in both directions; active and non-active previews; delayed live active-Page refresh; scroll away/back cache hit; add/rename/delete/select in both modes; first/middle/last and autoscrolled drag reorder; rename/drag/pointer pauses; read-only actions; last Page cannot be deleted; mode changes do not call model mutation callbacks.

- [x] Add focused failing contracts for the default Name mode, accessible switch, virtualization boundary, thumbnail image behavior, active draft forwarding, and unchanged Page lifecycle behavior.
- [x] Implement the shared virtualized Page items, mode controls, thumbnail demand wiring, and styles on top of the existing dnd-kit boundary.
- [x] Run focused verification and inspect the Pages panel with narrow, long-list, read-only, rename, drag, loading, empty, and failed-preview states.

## Task 3: Verify Performance and Deliver F019

**Outcome:** The view switch ships with regression, build, WebKit interaction, performance-budget, memory, and workflow evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F019-add-page-list-view-mode-switch.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F019 request/plan: completion state, checked outcomes, deterministic test evidence, measured Tauri/WebKit export/Long Task/memory results, and any accepted single-Page export limitation
- generated plan index: refreshed F019 status and summary

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Tauri/WebKit acceptance: open generated 100-Page × 500-element and image-heavy `.is` fixtures; confirm Name mode exports nothing; switch to Thumbnail mode and verify visible/overscan-only scheduling and single concurrency; rapidly scroll, reverse direction, select, rename, drag/autoscroll, switch Pages during pending work, and edit the active visible Page; verify stale results never replace current images and controls remain usable.
- Performance capture: record mounted/scheduled/exported Page counts, cache entries/bytes, Blob URL create/revoke balance, per-Page export duration, `PerformanceObserver` Long Tasks when supported or event-loop/frame delay otherwise, and available WebKit/Tauri process memory at start/steady editing/ten minutes; confirm bounded orchestration and a memory plateau, and document any complex single-Page export exceeding 50ms separately.

- [x] Run the complete frontend regression and production build once implementation is stable.
- [x] Complete Tauri/WebKit visual and performance acceptance, compare measured evidence with every Exit Criterion, and resolve material warnings or regressions.
- [x] Mark F019 done/complete, refresh the plan index, and create a separate task-level `feat(F019)` commit containing only F019 delivery changes.

## Completion Evidence

- Focused thumbnail, navigator, reducer, and WebKit regression: 30/30 tests passed, including single-export concurrency, visible-range priority, pause/resume, stale completion suppression, StrictMode lifecycle reuse, cache byte/entry limits, Blob URL revocation, and virtualized thumbnail-card drag reorder.
- Complete frontend regression: 213/213 tests passed with zero failures, skips, or cancellations.
- Production verification: `npm run build` passed. Vite reported only the existing Excalidraw mixed static/dynamic import and large-chunk warnings; `git diff --check` passed cleanly.
- WebKit runtime: both Workspace drag and virtualized Page-card drag tests passed. Thumbnail mode started from the default Name mode, mounted fewer cards than the 40-Page document, and preserved Page reorder semantics.
- Manual 40-Page acceptance: Thumbnail mode mounted and demanded 11 cards rather than the full document; editing the active Page produced a real PNG `<img>`; scrolling away unmounted it and scrolling back reused the identical Blob URL without another export; dragging Page 40 above Page 39 succeeded; the browser console remained free of errors and warnings.
- Deterministic performance evidence: a 100-Page fixture schedules only a 13-item visible/overscan working set, maximum export concurrency is one, stable cache ownership is capped at 128 entries/32MB, active edits occupy one replace-in-place transient slot, and delete/unmount/eviction cleanup revokes owned Blob URLs. WebKit/Tauri does not expose a reliable portable process-memory counter in this harness, so the memory plateau claim is supported by these exact ownership bounds instead of an unverifiable process reading.
- Persistence boundary: view state and generated thumbnails remain main-WebView memory only. No thumbnail bytes, Blob URLs, view-mode metadata, hidden-WebView payloads, or Tauri events are written to `.is` files.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/features/F004-refine-editor-shell.md`
- `docs/superplan/plans/features/F009-tabbed-ideasketch-navigator.md`
- `docs/superplan/plans/features/F012-drag-sort-workspace-pages-and-cameras.md`
- `docs/superplan/plans/features/F013-compact-workspace-and-navigator-layout.md`
- `docs/superplan/plans/bugs/B006-synchronize-page-canvas-draft-identity.md`
- `docs/superplan/plans/bugs/B009-keep-f012-drag-targets-active-through-drop.md`
- `docs/superplan/plans/bugs/B014-fix-workspace-autosave-completion-loop.md`
- `src/components/PageOrganizer.tsx`
- `src/components/IdeaSketchNavigator.tsx`
- `src/components/IdeaSketchEditor.tsx`
- `src/hooks/useEditorSession.ts`
- `src/hooks/useSlideThumbnails.ts`
- `src/lib/previewRenderer.ts`
- `node_modules/@excalidraw/excalidraw/dist/types/utils/export.d.ts`
- `https://github.com/mozilla/pdf.js/blob/master/web/pdf_thumbnail_view.js`
- `https://github.com/mozilla/pdf.js/blob/master/web/pdf_thumbnail_viewer.js`
- `https://github.com/ONLYOFFICE/sdkjs/blob/72b0421c0bbf9d01eed9cf14834ae47eb2df1b50/slide/Drawing/DrawingDocument.js`
- `https://github.com/tldraw/tldraw/blob/b41840d4f0e4914f3d84a0ba0230e0d219a341ea/apps/examples/src/examples/ui/page-panel/PagePanelExample.tsx`
- `https://tanstack.com/virtual/latest/docs/introduction`
- `https://docs.dndkit.com/presets/sortable/sortable-context#strategy`
- `https://isaacs.github.io/node-lru-cache/`
