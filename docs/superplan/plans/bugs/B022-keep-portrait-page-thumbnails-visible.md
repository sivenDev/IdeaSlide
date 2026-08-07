---
id: "B022"
title: "Keep Portrait Page Thumbnails Visible"
type: "bugfix"
status: "complete"
summary: "Keep landscape, near-square, and portrait Page thumbnails fully visible in Tauri WebKit without changing preview work or cache behavior."
source: "docs/superplan/human/bugs.md"
created: "2026-08-07"
order: 22
depends_on: ["F019", "F024", "B020"]
parent: ""
---

# Keep Portrait Page Thumbnails Visible Plan

**Goal:** Display every valid Page thumbnail fully inside its navigator preview regardless of the exported PNG aspect ratio.
**Scope:** Add a focused WebKit layout regression for landscape, near-square, and portrait thumbnail images, then isolate ready thumbnail images from CSS Grid intrinsic-size calculation while retaining the existing preview frame, centered fallback states, lazy image loading, asynchronous decoding, virtualization, scheduler, cache, and Blob URL lifecycle.
**Non-Goals:** This fix does not change thumbnail export dimensions or quality, regenerate existing thumbnails, alter fingerprints or cache keys, add image measurement or resize observers, change virtual-list sizing or overscan, modify Page selection and editing behavior, persist thumbnails, or add JavaScript work to rendering or scrolling.
**Architecture:** Keep the preview container as the positioned Grid owner for fallback-state centering. A ready `<img>` becomes an absolutely positioned replaced element constrained by the preview content box, with `object-fit: contain`; removing it from Grid track sizing prevents WebKit from using the image's intrinsic aspect ratio to enlarge and center an implicit track. The change is static CSS only and leaves the performance-bounded F019/F024/B020 thumbnail pipeline untouched.
**Baseline:** The exported thumbnail PNGs contain the expected canvas content and the ready image remains `192×106` with `object-fit: contain`. In Tauri WebKit, Grid intrinsic sizing offsets a `440×381` image by about 31 px and a `281×440` image by about 98 px inside the fixed-height preview; `overflow: hidden` then clips part or nearly all of the image. A landscape `440×182` image is offset by only about 1 px and appears correct.
**Reproduction:** Open `grocery.is`, switch Pages to Thumbnail view, and compare Pages 1–3. Page 3 has visible portrait-oriented Canvas content and a valid `281×440` exported PNG, but its thumbnail appears blank because the ready image is laid out below most of the preview frame and clipped. Page 2 is partially clipped, while Page 1 is visible.
**Root Cause:** The ready thumbnail is a CSS Grid item whose replaced-element intrinsic width/height contribution is retained by WebKit even though both dimensions are set to `100%`. Grid centers the resulting oversized implicit track, shifting the image downward; the preview's intentional clipping then hides the displaced pixels. Thumbnail generation, caching, image decoding, and Blob URL state are correct.
**Exit Criteria:** In Playwright WebKit and the Tauri app, valid landscape (`440×182`), near-square (`440×381`), and portrait (`281×440`) thumbnails are fully contained and centered within the same preview frame with no content-dependent vertical displacement. Loading, empty, and error states remain centered. The fix adds no JavaScript, layout observers, image measurements, exports, cache entries, Blob URLs, scheduler jobs, or component rerenders. The focused WebKit regression, complete frontend tests, production build, and diff checks pass.

## Task 1: Lock the WebKit Aspect-ratio Regression

**Outcome:** A focused browser regression fails when WebKit lets a thumbnail's intrinsic aspect ratio displace it outside the preview and passes only when all supported orientations remain contained.
**Files:**
- Create: `tests/pageThumbnailLayoutRuntime.test.mjs`

**Change Map:**
- WebKit layout fixture: load the production preview CSS, mount fixed-size preview frames with landscape, near-square, and portrait raster images, wait for image decode, and compare each image border box with its preview content box
- Performance boundary: assert the layout requires no script-driven image measurement, observers, or application thumbnail pipeline work

**Verification:**
- `node --test tests/pageThumbnailLayoutRuntime.test.mjs`
- The pre-fix portrait case must demonstrate displacement/clipping; the fixed cases must keep every image edge inside the preview within a one-pixel rendering tolerance.

- [x] Add the focused failing Playwright WebKit regression for the three observed PNG aspect ratios.
- [x] Confirm the regression measures rendered containment rather than thumbnail generation or cache behavior.

## Task 2: Remove Ready Images from Grid Intrinsic Sizing

**Outcome:** Ready thumbnails fill the preview's containing block and use `object-fit: contain` without participating in Grid track sizing, while non-ready states retain their existing centered layout.
**Files:**
- Modify: `src/index.css`

**Change Map:**
- `.ideanote-page-organizer__preview img`: use absolute inset constraints plus zero minimum sizes on the existing positioned preview, retaining block display, full dimensions, containment, pointer behavior, drag prevention, and background
- `.ideanote-page-organizer__preview`: remain the fixed, clipped, Grid-centered frame so loading, empty, and error states are unchanged

**Verification:**
- `node --test tests/pageThumbnailLayoutRuntime.test.mjs tests/pageOrganizer.test.mjs tests/pageThumbnailPerformance.test.mjs`
- Inspect the final diff to confirm no TypeScript/JavaScript, scheduler, cache, virtualizer, export, or component lifecycle path changed.

- [x] Apply the smallest CSS-only root-cause fix and pass the WebKit layout regression.
- [x] Verify loading, empty, error, landscape, near-square, and portrait preview states.

## Task 3: Verify Performance Boundaries and Deliver B022

**Outcome:** The visual fix ships with current WebKit, regression, build, performance-boundary, and workflow evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B022-keep-portrait-page-thumbnails-visible.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- B022 request and plan: completion status plus focused layout, regression, build, and Tauri visual evidence
- generated plan index: B022 status and summary

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Tauri/WebKit acceptance with `grocery.is`: Pages 1–3 remain fully visible and centered; repeated selection and scrolling reuse the existing thumbnails without new loading flashes or exports.

- [x] Run the complete frontend regression and production build after the CSS fix stabilizes.
- [x] Confirm the final task diff contains no new runtime work and complete B022 with a separate `fix(B022)` commit.

## Completion Evidence

- The focused Playwright WebKit layout regression failed before the fix because an intrinsic-ratio image extended beyond the preview content box; after the CSS change, landscape `440×182`, near-square `440×381`, and portrait `281×440` raster fixtures all remained within the same frame.
- Focused layout, organizer, and performance verification passed 3/3, including the existing contract that a 100-Page document schedules only the visible plus overscan working set.
- The complete frontend regression passed 254/254 with no failures, skips, or cancellations.
- `npm run build` passed strict TypeScript and the production Vite build. Existing informational warnings remain for Excalidraw mixed static/dynamic imports and generated chunks over 500 kB.
- `npm run tauri build -- --debug` rebuilt the native macOS application and DMG successfully from the fixed production assets.
- Native WKWebView acceptance opened `grocery.is` in the rebuilt debug `.app`: Page 1 landscape, Page 2 near-square, and Page 3 portrait thumbnails were fully visible. Selecting Page 3 showed the matching complete Canvas and retained all three cached images without a `Generating preview` transition.
- The runtime diff is CSS-only: ready images are absolutely inset within the existing positioned preview and have zero minimum sizes. No TypeScript/JavaScript, export, cache, scheduler, virtualizer, observer, Blob URL, or component lifecycle path changed.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F019-add-page-list-view-mode-switch.md`
- `docs/superplan/plans/features/F024-optimize-large-excalidraw-viewport-interactions.md`
- `docs/superplan/plans/bugs/B016-prevent-large-page-switch-freeze.md`
- `docs/superplan/plans/bugs/B020-reuse-unchanged-page-thumbnails.md`
- `src/components/PageOrganizer.tsx`
- `src/index.css`
- `tests/pageOrganizer.test.mjs`
- `tests/pageThumbnailPerformance.test.mjs`
- `tests/f012DragRuntime.test.mjs`
