# Camera Empty State Design Specification

**Date**: 2026-03-19
**Status**: Approved
**Author**: Codex

## Overview

Polish the empty state in the `Cameras` bottom panel so it reads as an intentional placeholder instead of a loose sentence floating in a wide area. Keep the behavior unchanged: when there are no cameras, the panel still shows a passive hint that points the user toward creating one.

## Goal

- Improve visual hierarchy for the camera empty state.
- Keep the change isolated to presentation and copy layout.
- Avoid any impact on the populated camera list, reordering controls, or editor layout.

## Selected Direction

Use the approved centered-stack layout:

- Keep the empty state centered within the existing camera panel.
- Add a small, low-emphasis camera icon above the copy.
- Split the current sentence into two lines:
  - Title: `No cameras yet`
  - Helper text: `Click "Add Camera" to create your first view.`
- Widen the text block enough that the helper text stays on a single line in normal window widths.
- Do not force `nowrap`; on genuinely narrow widths, wrapping is still acceptable as long as the block remains centered.
- Apply a slight downward visual offset to the empty-state stack so it reads as optically centered within the panel rather than mathematically centered too high.

This keeps the panel calm and balanced while making the message easier to scan.

## UI Structure

### Empty State Container

- Continue rendering the empty state from the `cameras.length === 0` branch in `src/components/CameraList.tsx`.
- Keep the wrapper full width and full height so it occupies the existing camera tab area.
- Use flexbox to center the empty state both horizontally and vertically.
- Keep the panel height and tab shell unchanged; the adjustment should happen inside the empty-state stack rather than by changing parent layout.

### Empty State Content

Render a compact vertical stack with three layers:

1. A lightweight camera icon
2. A short title
3. A helper line with the existing action guidance

The stack should use small, even vertical spacing so the content feels grouped rather than scattered.

### Visual Styling

- Title uses a darker neutral than the helper text.
- Helper text stays subdued to preserve empty-state semantics.
- Icon is small and visually soft so it supports the copy without competing with it.
- Text remains center-aligned.
- The text block should be wide enough to produce a stable two-line layout in the common editor width: title on the first line, helper text on the second.
- The entire stack should sit slightly lower than strict geometric center so the icon-plus-copy combination feels visually centered in the available white space.

## Behavior and Scope

### In Scope

- Markup changes for the camera empty state
- Tailwind class updates for spacing, alignment, and color hierarchy
- A small vertical offset on the empty-state stack to improve optical centering
- Optional inline SVG or existing icon markup embedded directly in the empty-state branch

### Out of Scope

- Any changes to the populated camera thumbnail list
- Changes to `EditorLayout` sizing, tabs, or panel height
- New interaction patterns, buttons, or onboarding flows
- Copy changes beyond splitting the current guidance into title plus helper text

## Data Flow and Logic Impact

- No new props, state, hooks, or component boundaries are required.
- No business logic changes are needed.
- The `CameraList` empty branch remains a pure render-only path.
- The populated camera branch must remain byte-for-byte behaviorally identical aside from untouched formatting.

## Error Handling and Edge Cases

- Zero cameras: show the new centered empty state.
- One or more cameras: render the existing thumbnail list exactly as before.
- Narrower panel widths: helper text may wrap if needed, but the stack should remain centered and visually grouped without overflow.

## Testing Strategy

### Manual Verification

- Open the editor with zero cameras and confirm the icon, title, and helper text are centered in the camera panel.
- Confirm that in a normal editor window the copy resolves to exactly two lines overall: the title line and a single-line helper sentence.
- Confirm the icon-plus-copy block no longer feels too high and instead sits closer to the visual center of the panel.
- Confirm the copy hierarchy is readable and no longer appears as a single drifting sentence.
- Add a camera and confirm the empty state disappears and the existing thumbnail list layout still renders normally.
- Verify the `Slides` tab still behaves as before.

### Automated Verification

Because this is a presentational change in an existing branch with no current empty-state UI tests, implementation can rely on targeted verification rather than introducing new snapshot coverage unless the coding phase reveals an easy existing pattern to extend.

## Implementation Notes

- Prefer keeping the change inside `src/components/CameraList.tsx`.
- Reuse the project's current neutral palette so the empty state still matches the rest of the bottom panel.
- Keep the final DOM structure small and easy to scan during future UI tweaks.
- Prefer a small offset on the inner stack (for example a light translate or margin adjustment) over changing the parent panel height or tab spacing.
