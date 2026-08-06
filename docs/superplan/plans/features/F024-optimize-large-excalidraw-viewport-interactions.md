---
id: "F024"
title: "Optimize Large Excalidraw Viewport Interactions"
type: "feature"
status: "complete"
summary: "Keep zoom and pan responsive on large Excalidraw Pages by removing application-owned scene scans, rerenders, and preview contention from the viewport hot path."
source: "docs/superplan/human/features.md"
created: "2026-08-06"
order: 24
depends_on: ["F017", "F019", "B014"]
parent: ""
---

# Optimize Large Excalidraw Viewport Interactions Plan

**Goal:** Make large IdeaSketch Pages zoom and pan smoothly in the desktop client without weakening editor, save, Camera, conversion, or preview behavior.
**Scope:** Optimize the application-owned work triggered by Excalidraw viewport updates. Add an identity-aware editor-session fast path that always retains the latest viewport while avoiding scene fingerprints and autosave work for viewport-only emissions; cache persisted scene fingerprints for real comparisons; replace the Camera-drawing preview element scan with explicit preview activity tracking; recompute selection-style availability only when scene, selected IDs, or read-only state changes; cache Camera extraction and project only cached Cameras during scroll/zoom; isolate Camera badge rendering from the Excalidraw component; stabilize custom Excalidraw UI callbacks; and pause queued Page-thumbnail export work during active Canvas interaction before resuming after an idle window. Validate the result with deterministic call-count regressions, large-scene benchmarks, and a production Tauri build.
**Non-Goals:** This plan does not change `.is v1` serialization, autosave debounce or conflict policy, remove opportunistic viewport persistence during real saves, alter Page/Camera identity or ordering, change conversion eligibility or output, reduce Excalidraw rendering quality, disable previews, replace WKWebView, add Chromium command-line flags, or introduce an unsupported global hardware-acceleration switch. It does not make hidden renderers run unthrottled while the main Canvas is active.
**Architecture:** `useEditorSession` keeps one cached persisted projection for the base and live draft, using stable element/file identity plus the save-trigger app-state projection to classify common transient emissions before hashing. Identity is only a safe fast path under Excalidraw's immutable scene contract: any changed element/file reference falls back to one fingerprint comparison, so cloned-equivalent emissions and real edits cannot be silently accepted. A real scene change computes one new fingerprint and advances the existing semantic edit version; viewport-only and selection-only emissions still replace the live draft but cannot dirty, autosave, or invalidate an in-flight save. `SlideCanvas` tracks whether its own Camera preview element is active instead of searching every scene emission, and remains the Excalidraw ownership boundary. A dedicated Camera badge overlay owns cached `Camera[]`, container geometry, animation-frame-coalesced viewport projection, and badge React state so its updates do not rerender Excalidraw. Selection conversion observation is keyed by element identity, selected-ID signature, and read-only state rather than every app-state emission. The editor exposes an edge-triggered Canvas-interaction signal to the existing Page-thumbnail scheduler, which pauses queued exports during continuous zoom/pan/pointer work and resumes after idle without changing demand, cache, priority, or output semantics; one already-running, non-cancellable `exportToBlob` may finish and retain its valid result, but no next job starts while paused. The hidden preview WebView is normally idle during Canvas navigation, and F024 deliberately leaves Tauri/WKWebView builder and background-throttling configuration unchanged; any measured engine-level or hidden-renderer issue becomes a separate follow-up rather than speculative scope expansion.
**Baseline:** A single Excalidraw viewport update currently reaches `useEditorSession.updateDraft`, which calls `createDraftChangeSummary` twice; each summary builds two full scene fingerprints, so a 20,000-element synthetic viewport-only emission spends roughly 12–13 ms in client comparison work before Excalidraw rendering, React, layout, and WKWebView overhead. `SlideCanvas.stableOnChange` additionally scans the full element array for `CAMERA_PREVIEW_ID`; its API `onChange` scans the scene for Camera extraction and selection closure; `onScrollChange` scans Cameras again and reads container layout; and badge state lives in the same component that renders Excalidraw. Page thumbnails are bounded by F019 but their main-WebView exporter is paused only for Page-list interactions, not active Canvas navigation. The separate hidden preview WebView is created eagerly but performs no render work without a request. macOS WKWebView already uses accelerated compositing and Tauri exposes no Chrome-equivalent universal hardware-acceleration flag that would remove this application work.
**Exit Criteria:** Zooming and panning retain the latest live viewport, leave dirty/edit/autosave state unchanged, and invoke zero scene fingerprints when element/file identity and save-trigger app state are unchanged. A real element/file change or revert still advances the semantic edit version, invalidates stale in-flight save completion, and computes no more than one new scene fingerprint after the previous fingerprint is cached; cloned-equivalent scene references are compared safely, and background/grid changes remain real edits. Viewport-only API notifications do not scan for the Camera preview element, recompute selection closure, rescan the full scene for Cameras, or rerender the Excalidraw component because of badge movement. Camera add/delete/reorder/style changes refresh the cache, badge positions stay exact across zoom/pan/resize/layout offsets, and conversion availability remains correct for groups, bound text, Camera-only selections, and read-only mode. Queued Page-thumbnail work pauses during active Canvas interaction, at most one already-started export may finish, work resumes after idle, and F019 priority, concurrency, cache, stale-result, and Blob URL behavior remain intact. A 20,000-element benchmark records the client-controlled viewport callback at a reference p95 target below 2 ms without Cameras, deterministic tests prove the zero-scan fast paths independent of machine speed, and production Tauri profiling shows no application-controlled task over 50 ms during sustained zoom/pan; all focused, frontend, build, Rust, and diff checks pass.

## Task 1: Make Editor Draft Classification Constant-time for Viewport-only Emissions

**Outcome:** Common zoom, pan, selection, and persisted-equivalent notifications update the live draft without rescanning a large scene or entering the save pipeline, while real edits preserve B007/B014 safety.
**Files:**
- Modify: `src/hooks/useEditorSession.ts`
- Modify: `src/lib/editorSession.ts`
- Modify: `src/lib/sceneFingerprint.ts`
- Modify: `tests/editorSession.test.mjs`
- Modify: `tests/sceneFingerprint.test.mjs`
- Create: `tests/excalidrawViewportPerformance.test.mjs`

**Change Map:**
- persisted projection: cache the base/live scene fingerprint and normalized save-trigger app-state identity instead of rebuilding both sides for every comparison
- transient fast path: use stable element/file identity and unchanged background/grid projection to classify viewport-only and selection-only emissions without hashing
- real-change path: compute one next scene fingerprint, retain it with the live draft, and reuse it for dirty, flush, preview/autosave version, and subsequent comparisons
- save safety: preserve real edit/revert invalidation during in-flight autosave, Page/document resynchronization, latest-viewport inclusion in a real commit, and null commits for viewport-only drafts
- performance contract: instrument fingerprint calls and benchmark warmed 5k/10k/20k-element viewport and real-edit cases without relying only on wall-clock assertions

**Verification:**
- `node --test tests/editorSession.test.mjs tests/sceneFingerprint.test.mjs tests/excalidrawViewportPerformance.test.mjs`
- Cases: zoom/pan/selection with stable scene identity; same-content repeated emission; element edit; file add/remove; background/grid edit; edit then revert before and during save; Page/document switch; flush with latest viewport; exact fingerprint call counts and reported large-scene timings.

- [x] Add failing call-count and semantic regressions for transient, real-change, revert, flush, and resynchronization paths.
- [x] Implement the cached persisted projection and constant-time transient classification without changing document semantics.

## Task 2: Isolate Camera and Selection Observers from Excalidraw Rendering

**Outcome:** Viewport updates project cached Camera badges and leave selection conversion observation idle, without causing the Excalidraw React subtree to rerender.
**Files:**
- Create: `src/components/CameraBadgeOverlay.tsx`
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/lib/cameraBadges.ts`
- Modify: `src/lib/excalidrawStyleConversion.ts`
- Modify: `src/lib/slideCanvasProps.ts`
- Modify: `tests/cameraBadgeWiring.test.mjs`
- Modify: `tests/excalidrawStyleConversion.test.mjs`
- Modify: `tests/slideCanvasProps.test.mjs`
- Create: `tests/excalidrawViewportObservers.test.mjs`

**Change Map:**
- Camera scene cache: extract and signature Cameras only when scene elements change, then project cached Camera bounds for viewport changes in O(Camera count)
- Camera preview guard: replace the unconditional `CAMERA_PREVIEW_ID` element scan with explicit drawing-preview activity while preserving the rule that temporary feedback never reaches the document draft
- viewport projection: consume `onScrollChange` viewport arguments where available, cache the container rect until resize, coalesce badge state through `requestAnimationFrame`, and skip unchanged results
- render isolation: move Camera subscription/state/rendering into a sibling overlay component so badge movement cannot rerender `Excalidraw`
- selection observation: compare element identity, a stable selected-ID signature, and read-only state before calculating group/bound-text closure; keep the exact F017 eligibility policy
- UI stability: memoize the Main Menu tree and top-right conversion renderer/callback identities while preserving draw.io export, native Excalidraw controls, and current selection action behavior

**Verification:**
- `node --test tests/cameraBadgeWiring.test.mjs tests/excalidrawStyleConversion.test.mjs tests/slideCanvasProps.test.mjs tests/excalidrawViewportObservers.test.mjs tests/canvasSelectionActions.test.mjs tests/excalidrawMainMenu.test.mjs`
- Cases: 20k non-Camera elements plus zero/few Cameras; inactive and active Camera drawing previews; sustained zoom/pan; container resize/layout-offset change; Camera add/delete/reorder/color/bounds changes; Page remount; grouped and bound-text selection changes; Camera-only/read-only selection; stable Excalidraw render and callback counts.

- [x] Add focused observer and render-count regressions that expose full-scene Camera/selection work on viewport updates.
- [x] Implement the isolated cached overlay and keyed selection observer while preserving all Camera and conversion results.

## Task 3: Defer Preview Work While the Canvas Is Active

**Outcome:** Thumbnail export work yields to zoom, pan, and pointer interaction, then resumes from the existing bounded queue after the Canvas becomes idle.
**Files:**
- Modify: `src/components/SlideCanvas.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/IdeaSketchNavigator.tsx`
- Modify: `src/components/PageOrganizer.tsx`
- Modify: `src/hooks/usePageThumbnails.ts`
- Modify: `src/lib/pageThumbnailScheduler.ts`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/ideaSketchNavigator.test.mjs`
- Modify: `tests/pageOrganizer.test.mjs`
- Modify: `tests/pageThumbnailScheduler.test.mjs`
- Modify: `tests/pageThumbnails.test.mjs`
- Modify: `tests/pageThumbnailPerformance.test.mjs`

**Change Map:**
- interaction signal: mark the Canvas active for pointer, wheel, and scroll/zoom bursts and clear it after a bounded idle interval without persisting UI state
- scheduler gate: combine Canvas activity with F019's rename/drag/pointer pause state, hold queued work safely, allow only the single already-started non-cancellable export to finish, and resume the latest demand without increasing concurrency
- invariant preservation: keep visible/overscan-only demand, active-visible priority, one export in flight, stale generation suppression, active-draft debounce, cache ownership, and Blob URL cleanup unchanged
- WebView policy: leave `src-tauri/src/lib.rs`, hidden preview renderer creation, and background-throttling behavior unchanged in F024; report any measured engine/renderer limitation as a follow-up instead of enabling speculative or unthrottled hidden rendering

**Verification:**
- `node --test tests/pageThumbnailScheduler.test.mjs tests/pageThumbnails.test.mjs tests/pageThumbnailPerformance.test.mjs tests/pageOrganizer.test.mjs tests/ideaSketchNavigator.test.mjs tests/ideaSketchEditor.test.mjs`
- Cases: continuous wheel/pan postpones queued exports; idle resumes latest visible demand once; one in-flight export may complete but no second begins before idle; stale generations are still discarded; rapid Page/mode changes; rename/drag plus Canvas pause composition; disabled/Name mode; cache and URL cleanup remain exact.

- [x] Add failing interaction-priority regressions across the Canvas-to-thumbnail scheduling boundary.
- [x] Implement the idle gate and verify that preview behavior resumes unchanged after interaction.

## Task 4: Verify Production Tauri Performance and Deliver F024

**Outcome:** The optimization ships with regression, build, native WebKit performance, behavioral, and workflow evidence rather than development-mode impressions.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F024-optimize-large-excalidraw-viewport-interactions.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F024 request/plan: completion state, checked outcomes, benchmark results, production Tauri measurements, and any platform limitation
- generated plan index: F024 status and dependencies

**Verification:**
- Run the focused Task 1–3 suites.
- `node --test tests/*.test.mjs`
- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- `git diff --check`
- Production Tauri acceptance: build a release/production bundle, open representative 5k/10k/20k-element `.is` fixtures with zero/few Cameras, compare sustained wheel zoom and Hand-tool pan before/after using callback timing plus frame/event-loop delay instrumentation, and confirm no application-controlled task over 50 ms.
- Behavioral acceptance: edit/revert/save/reopen, background/grid changes, Page switching, Camera add/delete/reorder/select/presentation, style conversion, Name/Thumbnail mode switching, thumbnail pause/resume, and long idle after interaction.

- [x] Run the complete regression/build/native matrix once the implementation is stable and inspect meaningful warnings or frame-delay outliers.
- [x] Compare every Exit Criterion with current evidence, complete F024, refresh progress, and create a separate `feat(F024)` commit containing only this delivery.

## Completion Evidence

- `node --test tests/*.test.mjs`: 235 tests passed, including viewport fingerprint call-count, Camera/selection observer, Canvas-interaction, and thumbnail scheduler regressions.
- `tests/excalidrawViewportPerformance.test.mjs`: viewport-only projection p95 was 0.000 ms at 5k elements, 0.001 ms at 10k, and 0.000 ms at 20k; every measured update skipped scene fingerprint construction.
- `npm run build`: strict TypeScript and the production Vite build passed. Existing informational warnings remain for Excalidraw's mixed static/dynamic import and large generated chunks.
- `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`: 85 Rust tests passed.
- `npm run tauri build`: the current code produced `IdeaNote.app` and `IdeaNote_0.1.0_aarch64.dmg` successfully.
- Production UI smoke used a 6.6 MB, 15-Page IdeaSketch document: Page switching, repeated Canvas zoom, Name/Thumbnail mode switching, and thumbnail resume all remained operational; viewport-only zoom kept the document in `Saved` state. The test restored Page 1 and Name view before closing.
- The final review also removed a remaining one-time interaction hitch by making `useEditorSession` scene-projection initialization truly lazy per mount. No Tauri/WKWebView acceleration, hidden-renderer, file-format, save-policy, Camera, conversion, presentation, or persistence contract was changed.
- WKWebView automation does not expose a programmable native long-task trace in the release bundle, so F024 does not claim Chrome parity or a measured engine-level guarantee. The deterministic 20k callback benchmark proves the application-owned viewport path, while any remaining compositor/engine limitation remains follow-up scope.

## References
- `docs/superplan/human/features.md`
- `docs/superplan/plans/04-ideasketch-editor-integration.md`
- `docs/superplan/plans/features/F017-convert-excalidraw-selection-to-clean-diagram-style.md`
- `docs/superplan/plans/features/F019-add-page-list-view-mode-switch.md`
- `docs/superplan/plans/bugs/B006-synchronize-page-canvas-draft-identity.md`
- `docs/superplan/plans/bugs/B007-prevent-false-conflicts-after-autosave.md`
- `docs/superplan/plans/bugs/B014-fix-workspace-autosave-completion-loop.md`
- `src/components/SlideCanvas.tsx`
- `src/hooks/useEditorSession.ts`
- `src/lib/editorSession.ts`
- `src/lib/cameraBadges.ts`
- `src/lib/excalidrawStyleConversion.ts`
- `src/hooks/usePageThumbnails.ts`
- `src-tauri/src/lib.rs`
