---
id: "B020"
title: "Reuse Unchanged Page Thumbnails"
type: "bugfix"
status: "complete"
summary: "Reuse a matching stable Page thumbnail when Page activation does not change its preview content."
source: "docs/superplan/human/bugs.md"
created: "2026-08-07"
order: 20
depends_on: ["F019", "F024", "B016"]
parent: ""
---

# Reuse Unchanged Page Thumbnails Plan

**Goal:** Keep Page selection visually immediate by avoiding redundant thumbnail exports when the selected Page's preview content has not changed.
**Scope:** Change the Page-thumbnail cache lookup policy so an active Page first reuses an exact transient draft entry and then falls back to an exact stable entry with the same render key. Show `Generating preview` and schedule a new export only when neither cache tier matches. Preserve the 650 ms active-draft refresh after real edits, visible/overscan-only demand, single-export concurrency, interaction pause/resume, stale-result suppression, bounded LRU ownership, one transient slot, and Blob URL cleanup.
**Non-Goals:** This fix does not persist thumbnails or view mode, keep multiple transient revisions, change Page selection or Canvas lifecycle, alter preview fingerprints or PNG rendering, remove loading/error/empty states for genuine cache misses, change autosave behavior, or modify the hidden preview renderer.
**Architecture:** `PageThumbnailCache` owns one explicit active-lookup policy: a matching transient entry wins, otherwise a matching stable entry is reused without cloning, promoting, or creating another Blob URL. `usePageThumbnails` applies that policy only to the active draft; inactive Pages continue using stable entries. A changed active-draft render key misses both tiers and follows the existing debounced transient export path, so live edits remain accurate while unchanged Page activation becomes a cache hit.
**Baseline:** F019 stores persisted Page previews in a stable LRU and the active draft preview in one replace-in-place transient slot. `usePageThumbnails` clears the old Page's transient entry when `activePageId` changes, then checks only `getTransient` for the new active Page. Even when that Page already has a stable entry with the identical render key, the hook marks it `loading`, displays `Generating preview`, and queues another PNG export.
**Reproduction:** Open an IdeaSketch document in Thumbnail view, allow visible Page previews to finish, then select another visible Page whose Canvas has not changed. Its existing thumbnail is replaced by `Generating preview` until a redundant export completes. Switching among unchanged cached Pages repeats the same loading transition.
**Root Cause:** Cache tier selection is coupled to active/inactive status instead of cache validity. Active Pages consult only the single transient slot, while stable entries with the same content-derived render key are ignored. Because Page activation clears the previous transient slot, every newly active Page is treated as a cache miss regardless of its valid stable preview.
**Exit Criteria:** Selecting an unchanged Page with a matching stable thumbnail keeps the existing image visible, creates no new Blob URL, and schedules no export. A matching transient entry still takes precedence. A real element, file, background, or grid change produces a new render key, waits for the existing active-draft debounce, and generates one transient preview. Genuine uncached Pages still show `Generating preview`; cache bounds, URL revocation, demand priority, pause/resume, stale completion handling, Page deletion, and document cleanup remain unchanged. Focused thumbnail tests, the complete frontend regression, production build, and diff checks pass.

## Task 1: Lock the Active-page Cache Reuse Regression

**Outcome:** Focused tests fail unless unchanged Page activation reuses the stable thumbnail while real draft revisions still require the transient path.
**Files:**
- Modify: `tests/pageThumbnailCache.test.mjs`
- Modify: `tests/pageThumbnails.test.mjs`

**Change Map:**
- `PageThumbnailCache` behavior contract: transient-first active lookup, stable fallback for an identical render key, no duplicate Blob URL creation, and unchanged invalid-key disposal
- `usePageThumbnails` wiring contract: active demand uses the unified active lookup while inactive demand remains stable-only

**Verification:**
- `node --test tests/pageThumbnailCache.test.mjs tests/pageThumbnails.test.mjs`
- Cases: stable-only active hit; transient precedence; changed render key miss; unchanged URL ownership; inactive stable lookup remains unchanged.

- [x] Add the focused failing regression for selecting an unchanged cached Page.
- [x] Preserve coverage for one-slot transient replacement and Blob URL cleanup.

## Task 2: Reuse Valid Stable Previews and Deliver B020

**Outcome:** Page activation becomes a cache hit whenever its live draft fingerprint matches the existing stable preview, without weakening real-edit refresh or scheduler guarantees.
**Files:**
- Modify: `src/lib/pageThumbnailCache.ts`
- Modify: `src/hooks/usePageThumbnails.ts`
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B020-reuse-unchanged-page-thumbnails.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- `PageThumbnailCache`: centralize transient-first, stable-fallback lookup for the active Page without duplicating cache entries or Blob URLs
- `usePageThumbnails`: use the active lookup before creating a loading view or scheduler job; retain the existing transient result ownership for changed drafts
- B020 workflow artifacts: record completion evidence and refresh the generated plan index

**Verification:**
- `node --test tests/pageThumbnailScheduler.test.mjs tests/pageThumbnailCache.test.mjs tests/pageThumbnails.test.mjs tests/pageThumbnailPerformance.test.mjs tests/pageOrganizer.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- UI acceptance: in Thumbnail view, switch repeatedly among already-rendered unchanged Pages and confirm images stay visible with no loading flash; edit the active Page, wait past 650 ms, and confirm its thumbnail refreshes once.

- [x] Implement the smallest cache-policy change and pass the focused regression.
- [x] Verify unchanged scheduler, cleanup, real-edit refresh, and UI behavior.
- [x] Complete B020, refresh progress, and create a separate `fix(B020)` commit containing only this delivery.

## Completion Evidence

- The focused regression failed before implementation because `PageThumbnailCache.getActive` did not exist and the Hook still queried only `getTransient`; after the cache-policy change, `node --test tests/pageThumbnailCache.test.mjs tests/pageThumbnails.test.mjs` passed 8/8.
- The focused thumbnail, scheduler, cache, performance, and organizer suite passed 15/15 while preserving one-export concurrency, visible-range demand, pause/resume, stale-result handling, transient replacement, and Blob URL cleanup.
- The complete frontend regression passed 252/252 with no failures, skips, or cancellations.
- `npm run build` passed strict TypeScript and the production Vite build. Existing informational warnings remain for Excalidraw's mixed static/dynamic import and generated chunks over 500 kB.
- Local UI acceptance created two rendered Pages and confirmed repeated unchanged Page switching retained the same Blob URLs with zero `Generating preview` placeholders. A real active-Page edit kept the cached image during the debounce and then changed only that Page's Blob URL after the refresh window.
- Manual drawing exposed existing Excalidraw duplicate React-key console warnings. B020 does not alter scene elements or React key construction, and the warning was left outside this cache-policy fix.
- `git diff --check` passed before delivery.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F019-add-page-list-view-mode-switch.md`
- `docs/superplan/plans/features/F024-optimize-large-excalidraw-viewport-interactions.md`
- `docs/superplan/plans/bugs/B006-synchronize-page-canvas-draft-identity.md`
- `docs/superplan/plans/bugs/B016-prevent-large-page-switch-freeze.md`
- `src/hooks/usePageThumbnails.ts`
- `src/lib/pageThumbnailCache.ts`
- `tests/pageThumbnailCache.test.mjs`
- `tests/pageThumbnails.test.mjs`
