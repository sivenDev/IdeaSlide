# Slide Organizer and Laser Pointer Design Specification

**Date**: 2026-04-21
**Status**: Draft
**Author**: Codex

## Overview

Upgrade slide management into a single high-utility organizer anchored to the existing `Slide` toolbar button, and add a presentation-only laser pointer toggled by `k`. The organizer must keep slide selection fast while also supporting inline rename and drag reorder in the same surface. The laser pointer must not modify slide content or interfere with existing presentation navigation.

## Problem

The current slide workflow is too shallow for deck management and the presentation mode lacks a presenter pointer:

- `src/components/Toolbar.tsx` exposes slide selection and deletion in a compact dropdown, but there is no place to rename slides or reorder them
- `src/hooks/useSlideStore.tsx` stores slide arrays only by order and content; it does not model slide titles or explicit reorder actions
- `src/lib/tauriCommands.ts` currently rebuilds manifest titles as `Slide {n}` on save, so any future rename would be lost on round-trip
- `src/components/PresentationMode.tsx` handles navigation keys but has no presenter pointer mode, so the user cannot highlight parts of the canvas while presenting

This creates three user-facing gaps:

- decks cannot be reorganized after creation without delete/recreate work
- slides cannot be named, which makes deck navigation scale poorly
- presentation mode cannot visually direct attention during live walkthroughs

## Goals

- Keep slide selection, rename, reorder, add, and delete in one place
- Preserve the current `Slide` toolbar entry point so quick slide switching remains efficient
- Persist slide titles in `.is` files without introducing a format-version break
- Keep reorder behavior stable for the currently selected slide
- Add a presentation-only laser pointer toggled by `k`
- Preserve all existing presentation navigation shortcuts

## Non-Goals

- Reintroduce the removed bottom slide preview panel
- Add slide thumbnails to the organizer
- Add batch slide actions or multi-select
- Change the underlying `.is` archive structure or manifest version
- Add laser pointer behavior to the editor canvas outside presentation mode

## Current Constraints

### Existing toolbar behavior

`src/components/Toolbar.tsx` uses a Radix dropdown for slide management. That surface is appropriate for quick selection, but it is too constrained for inline text editing and drag sorting.

### Existing file format support

`src-tauri/src/file_format.rs` already defines slide manifest entries with `{ id, title }`, so the archive schema already supports renamed slides. The missing piece is frontend round-trip preservation.

### Existing presentation model

`src/components/PresentationMode.tsx` renders the current slide in Excalidraw view mode and captures keyboard events in the capture phase. Any laser pointer behavior should fit inside that architecture and avoid switching the canvas into edit behavior.

## Proposed Architecture

### 1. Replace the slide dropdown with a large anchored popover

Keep the `Slide` trigger in the toolbar, but replace the current dropdown content with a larger organizer popover.

The organizer layout should be a dense vertical list with one row per slide:

- drag handle
- slide number
- slide title
- delete button

The popover footer should contain `Add Slide`.

Behavior:

- click row: select slide and close popover
- click title: enter inline edit mode and keep popover open
- drag from handle: reorder without triggering selection or edit
- click delete: delete slide without triggering row selection

This keeps the user’s slide workflow unified without moving slide management into a separate panel or secondary entry point.

### 2. Extend the slide model with persistent titles

Add `title: string` to the frontend `Slide` type in `src/types.ts`.

Loading behavior:

- when reading `.is`, pair manifest slide entries with slide content by slide id
- if a manifest title is missing or blank, fall back to `Slide {index + 1}`

Saving behavior:

- preserve each slide’s current title instead of regenerating manifest titles from index
- keep slide ids stable
- reorder changes array order only; it must not rewrite titles

New slides should receive a default title derived from position, for example `Slide {N}`. Once renamed, that title should remain stable through save, load, and reorder.

### 3. Add explicit rename and reorder actions to the store

Introduce store actions in `src/hooks/useSlideStore.tsx`:

- `RENAME_SLIDE`
- `REORDER_SLIDES`

`RENAME_SLIDE` updates one slide title and marks the presentation dirty.

`REORDER_SLIDES` should accept the new slide order, preserve slide ids and titles, and recompute `currentSlideIndex` from the currently selected slide id rather than trusting the previous numeric index. This is the safest way to keep the active slide stable when it is moved.

### 4. Keep organizer UI state local

The organizer should own only transient UI state, for example:

- whether the popover is open
- which slide id is currently being edited
- the draft title for the editing row
- the active dragged slide id

Committed deck state remains in `useSlideStore`, so autosave, editor rendering, and presentation mode all continue to use one source of truth.

### 5. Add a presentation-scoped laser pointer mode

Add local state in `src/components/PresentationMode.tsx` for laser mode:

- `laserEnabled`
- current presenter pointer position or trail state

Keyboard behavior:

- pressing `k` toggles laser mode on
- pressing `k` again toggles laser mode off

Pointer behavior:

- when laser mode is off, pointer movement behaves exactly as today
- when laser mode is on, pointer movement updates a presentation-only laser pointer state
- exiting presentation, changing slides, or toggling laser mode off clears the laser trail

Implementation should prefer Excalidraw’s existing collaborator-pointer/laser concepts rather than inventing a second drawing system that behaves differently from the canvas renderer.

## Detailed Behavior

### Organizer row interaction

- Row click selects the slide and closes the popover
- Title click enters edit mode and stops the row click from firing
- Delete click stops propagation and does not change the current slide unless deletion logic requires it
- Drag starts only from the handle, avoiding conflicts with row click and inline input focus

### Inline rename behavior

- only one row may be in edit mode at a time
- `Enter` commits
- `Escape` cancels
- blur commits if the title is non-empty
- blank or whitespace-only submissions fall back to the previous title or the default `Slide {n}` label

### Reorder behavior

- reorder is vertical only
- the current slide remains current after reorder, even if its list position changes
- reordering another slide must not reset the editor draft for the current slide
- deleted-slide behavior remains consistent with today: at least one slide must always remain

### Long deck behavior

- the popover owns internal scrolling
- the current slide row stays visually highlighted
- the trigger badge continues to show current index and slide count

### Presentation laser behavior

- laser mode is available only in presentation mode
- laser mode does not change slide data, Excalidraw scene content, or editor state
- existing navigation keys still work while laser mode is enabled
- the presentation chrome should surface a lightweight `Laser` status indicator near the page indicator so the presenter can see whether the mode is active

## UI Component Strategy

The implementation should not hand-roll new floating-surface behavior. Use shared UI primitives and keep new behavior aligned with the existing component style:

- add a shared `Popover` wrapper under `src/components/ui/` using the existing Radix pattern already used by `DropdownMenu`
- add a shared text input component under `src/components/ui/` if no suitable one exists yet
- extract organizer rendering into a dedicated component, for example `src/components/SlideOrganizer.tsx`, instead of embedding the full interaction stack directly into `Toolbar.tsx`

For reorder mechanics, use a mature sortable solution rather than custom pointer math. The organizer should own the sortable integration while the store owns the committed order.

## Files to Modify

### Modified

- `src/types.ts` - add `title` to `Slide`
- `src/hooks/useSlideStore.tsx` - add rename and reorder actions plus current-slide index recalculation
- `src/lib/tauriCommands.ts` - preserve manifest titles on load/save and set default titles for new slides
- `src/components/Toolbar.tsx` - replace slide dropdown behavior with organizer popover trigger
- `src/components/PresentationMode.tsx` - add `k` toggle handling, laser state, pointer updates, and cleanup

### Added

- `src/components/SlideOrganizer.tsx` - popover content component for select/rename/reorder/delete/add
- `src/components/ui/Popover.tsx` - shared popover wrapper aligned with existing UI primitives
- `src/components/ui/Input.tsx` - shared text input primitive if needed by organizer editing

### Potentially touched

- tests covering toolbar source wiring, store behavior, persistence behavior, and presentation key handling

## Testing Strategy

### Automated

- add store tests for `RENAME_SLIDE` and `REORDER_SLIDES`
- add persistence tests verifying title round-trip and fallback behavior when a title is missing
- update toolbar-oriented source tests so they assert the new organizer entry points instead of the current dropdown-only structure
- add presentation tests verifying `k` toggles laser mode and existing navigation keys still map correctly

### Manual

- rename a slide, save, reopen, and confirm the title persists
- reorder several slides, save, reopen, and confirm order and active selection behavior remain correct
- rename then reorder, ensuring titles do not reset to generated names
- present a deck, toggle `k`, move the pointer, navigate between slides, and confirm the laser clears on exit or toggle-off
- verify that normal presentation navigation still works with laser mode both on and off

## Risks and Mitigations

- **Popover interaction conflicts between click, drag, and edit**: isolate drag start to a handle and stop propagation from title/delete controls
- **Active slide index drifting after reorder**: recompute from active slide id instead of numeric index
- **Title persistence regressions on save**: cover load/save round-trip with focused tests before wiring UI
- **Laser mode interfering with Excalidraw view mode**: keep laser state presentation-local and avoid switching the scene into general edit tools
- **Long titles causing row layout instability**: clamp display text outside edit mode and keep the input constrained to the row

## Open Questions

- The exact sortable library choice can be finalized during implementation, as long as it is a mature off-the-shelf solution and not a custom drag system
- The final laser color and whether it should be configurable can remain implementation defaults for this task
