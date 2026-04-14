# Editor Preview Performance Design Specification

**Date**: 2026-04-08
**Status**: Draft
**Author**: Claude Code

## Overview

Protect Excalidraw editing from preview work by separating live editor draft state from preview refresh state. When the preview panel is closed, the editor must not build slide-preview inputs at all. When the preview panel is open, slide previews should update only from a debounced current-slide snapshot while unchanged slides continue using cached markup.

## Problem

The current editor path still ties preview preparation to every Excalidraw change:

- `src/components/EditorLayout.tsx` rebuilds `slidePreviewSlides` from the full `slides` array and current draft on each edit, even when the preview panel is hidden
- `src/hooks/useSlideThumbnails.ts` receives the whole slide list as one reactive input, rebuilds the full preview request payload, and replaces the thumbnail map after refresh
- when preview thumbnails refresh, the editor pays both the preview-render scheduling cost and the React update cost close to the same interaction window as Excalidraw pointer and zoom work

This produces two user-visible regressions:

- with preview closed, editing at small zoom levels still stutters because preview-derived parent recomputation remains on the hot path
- with preview open, each thumbnail refresh can interrupt Excalidraw interaction because current-slide edits propagate into whole-preview work too aggressively

## Goals

- Remove slide preview preparation from the editor hot path while preview is hidden
- Keep Excalidraw interaction smooth even with the preview panel open
- Refresh only the current slide thumbnail during active editing, with debounce
- Reuse cached thumbnails for unchanged slides without rebuilding the entire thumbnail map
- Preserve existing preview UI behavior and existing renderer-window architecture

## Non-Goals

- Rebuild the hidden preview renderer transport
- Change camera thumbnail behavior in this task
- Add persistent thumbnail storage
- Redesign the slide preview UI

## Root Cause Summary

### Editor-level coupling

`src/components/EditorLayout.tsx` currently derives a full `slidePreviewSlides` array from `state.slides` plus the current draft. That means every draft mutation creates a new preview input object graph, even if previews are not visible.

### Hook-level over-invalidation

`src/hooks/useSlideThumbnails.ts` treats the slide list as one coarse dependency. A current-slide draft change causes the hook to regenerate preview scenes for all slides and later replace the entire thumbnail map, even though only one slide actually changed.

### Refresh cost lands near interaction

Although `src/lib/previewRenderer.ts` already caches rendered markup and uses a latest-only executor, the editor still pays for preparing batch inputs, diffing slides coarsely, parsing returned SVG, and publishing a whole new thumbnail map at moments that overlap with Excalidraw interaction.

## Proposed Architecture

### 1. Split preview source data from editor draft data

In `src/components/EditorLayout.tsx`, remove the always-on `slidePreviewSlides` derived array.

Instead, introduce two modes:

- **preview hidden**: do not derive any slide preview input from the live draft
- **preview visible on Slides tab**: pass stable base slides from `state.slides` plus a separate current-slide override built from the latest draft

This keeps draft mutations local to the editor unless the slide preview panel is actually active.

### 2. Change slide thumbnail hook input shape

Refactor `src/hooks/useSlideThumbnails.ts` to accept structured inputs rather than a single reactive slide array, for example:

- `slides`: stable persisted slides from store
- `currentSlideIndex`
- `draftOverride`: optional current-slide snapshot only when previews are visible
- `enabled`

The hook should internally compose the effective scene set lazily instead of requiring the parent to rebuild the full slide list on every draft change.

### 3. Incremental invalidation by render key

Inside `src/hooks/useSlideThumbnails.ts`, track per-slide render keys and only schedule rendering for slides whose render key changed.

Behavior:

- unchanged slides keep their existing thumbnail DOM node or cached markup-derived node
- changed current slide is the only slide re-rendered during active editing
- other slides are refreshed only when they actually change because of slide switch, add/delete, or persisted content update

### 4. Debounced current-slide refresh only

When the preview panel is visible and the Slides tab is active:

- debounce current-slide thumbnail regeneration more aggressively than today
- drop intermediate draft states if newer ones arrive before the renderer responds
- do not trigger background refreshes for unrelated slides during active editing

This intentionally favors edit smoothness over preview immediacy.

### 5. Incremental thumbnail state updates

Replace the current full-map replacement behavior in `src/hooks/useSlideThumbnails.ts` with keyed updates:

- keep previous thumbnail entries for unchanged slides
- update only slide ids returned by the latest successful render
- remove entries only when a slide is deleted or becomes intentionally empty

This reduces React churn in `src/components/SlidePreviewPanel.tsx` and avoids needless thumbnail subtree updates.

## Detailed Behavior

### Preview hidden

- `EditorLayout` does not build any preview scenes from the draft
- `useSlideThumbnails` remains disabled and receives no hot-path draft-driven invalidation
- Excalidraw edits affect only editor-local draft/session state

### Preview visible on Cameras tab

- slide thumbnail generation remains disabled
- no current-slide thumbnail work occurs just because the bottom area is open

### Preview visible on Slides tab

- only the current slide can invalidate during live editing
- current slide refresh waits for debounce
- other slide thumbnails are reused from existing state/cache
- switching slides flushes the draft first, then moves the current-slide override to the newly active slide

## Files to Modify

### Modified

- `src/components/EditorLayout.tsx` - remove always-on preview array derivation and pass structured thumbnail inputs
- `src/hooks/useSlideThumbnails.ts` - add structured inputs, per-slide invalidation, debounce, and incremental state updates
- `src/components/SlidePreviewPanel.tsx` - keep interface aligned if thumbnail map semantics change

### Likely unchanged

- `src/lib/previewRenderer.ts` - existing renderer client and cache should remain usable as-is

## Testing Strategy

### Automated

- frontend build passes with the refactored hook API
- add or update focused tests for slide-thumbnail invalidation logic if a local test pattern exists for hooks or pure helpers

### Manual

- preview closed: zoom to 10%, pan, and edit continuously without the previous stutter
- preview open on Slides tab: current slide thumbnail updates after idle pause, while drawing/typing remains smooth
- preview open on Cameras tab: no slide thumbnail work is triggered by editing
- switch slides, add slide, delete slide: thumbnails stay correct and removed slides clear cleanly
- reopen Slides tab without content changes: existing thumbnails appear immediately from retained state/cache

## Risks and Mitigations

- **Current slide thumbnail becomes too stale while editing**: acceptable by design for this task; debounce duration should favor interaction smoothness
- **Thumbnail map retains stale entries after slide deletion**: explicitly prune removed slide ids during hook reconciliation
- **Hook complexity increases**: keep render-key diffing localized to the hook and avoid introducing a separate preview store in this iteration

## Open Questions

- Exact debounce duration should be chosen during implementation after trying the current interaction path locally
- If keyed DOM node retention proves awkward, the hook may store SVG markup strings internally and parse only updated slides, as long as unchanged slides remain stable
