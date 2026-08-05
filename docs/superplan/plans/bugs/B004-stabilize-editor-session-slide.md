---
id: "B004"
title: "Stabilize Editor Session Canvas Input"
type: "bugfix"
status: "complete"
summary: "Prevent the workspace editor from entering an infinite React update loop when a Canvas is opened."
source: "docs/superplan/human/bugs.md"
created: "2026-07-22"
order: 4
depends_on: []
parent: ""
---

# Stabilize Editor Session Canvas Input Plan

**Goal:** Opening a workspace enters the three-pane editor normally without triggering React's maximum update depth protection.
**Scope:** Stabilize the Canvas-to-slide value passed from `EditorLayout` into `useEditorSession`, and add a focused regression contract that prevents the active Canvas session input from being recreated on every render.
**Non-Goals:** This plan does not redesign Tooltip components, change workspace persistence, alter Canvas switching behavior, change autosave timing, or modify the three-pane layout.
**Architecture:** `canvasContentToSlide(...)` remains a pure projection that may return a new object. `EditorLayout` owns React-level memoization of that projection because it knows the stable workspace and active Canvas dependencies. `useEditorSession` can then continue using slide identity to distinguish a real Canvas/content transition from an unrelated parent render.
**Baseline:** `EditorLayout` calls `canvasContentToSlide(workspace, sessionCanvasResource)` directly during every render. `useEditorSession` stores the previous slide object and has an effect that rebuilds the draft and calls three state setters whenever the incoming slide object identity changes.
**Reproduction:** Start IdeaNote, open a workspace, and enter the editor. The editor repeatedly re-renders until the ErrorBoundary reports `Maximum update depth exceeded`; the visible stack terminates in Radix Tooltip's composed ref because Toolbar refs are being repeatedly detached and attached during the loop.
**Root Cause:** `currentSlide` is a newly allocated projection on every `EditorLayout` render. The session synchronization effect interprets each allocation as a new slide, calls `setDraft`, `setHasPendingCommit`, and `setAutoSaveVersion`, and immediately schedules another render. Tooltip ref state updates expose the loop but do not initiate it.
**Exit Criteria:** `currentSlide` keeps stable identity across unrelated editor renders and changes when its workspace content or selected Canvas changes; the focused regression fails before and passes after the fix; the full Node suite and production build pass; opening the editor no longer reaches the ErrorBoundary.

## Task 1: Keep the Active Canvas Session Projection Stable

**Outcome:** Unrelated editor renders no longer reset the editor session, while real Canvas selection or content changes still produce a new session input.
**Files:**
- Modify: `src/components/EditorLayout.tsx`
- Test: `tests/editorSessionRenderStability.test.mjs`

**Change Map:**
- `src/components/EditorLayout.tsx`: memoize the active Canvas-to-slide projection using stable workspace and resource dependencies
- `tests/editorSessionRenderStability.test.mjs`: source-level render-stability regression for the `currentSlide` projection boundary

**Verification:**
- `node --test tests/editorSessionRenderStability.test.mjs`
- `node --test tests/*.test.mjs`
- `npm run build`
- Editor smoke: open a workspace and confirm the three-pane editor renders without the ErrorBoundary

- [x] Add a focused failing regression requiring `currentSlide` to be memoized from the workspace and selected Canvas resource.
- [x] Run the focused regression and confirm it fails against the direct per-render projection.
- [x] Memoize the `canvasContentToSlide` projection at the `EditorLayout` session boundary.
- [x] Re-run the focused regression and confirm it passes.
- [x] Run the full Node suite, production build, and editor smoke verification.
- [x] Mark B004 and this plan complete after recording evidence.

## Delivery Evidence

- `node --test tests/editorSessionRenderStability.test.mjs` failed before the fix because `currentSlide` was constructed directly on every render, then passed after memoizing the projection.
- `node --test tests/*.test.mjs` — 111 tests passed.
- `npm run build` — TypeScript and Vite production build passed; existing Excalidraw dynamic-import and chunk-size warnings remain informational.
- Manual editor verification — the user confirmed that opening the workspace now renders normally without the maximum update depth ErrorBoundary.

## References
- `src/components/EditorLayout.tsx`
- `src/hooks/useEditorSession.ts`
- `src/lib/workspaceResources.ts`
- `src/components/ui/Tooltip.tsx`
- `tests/editorSession.test.mjs`
