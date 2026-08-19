---
id: "B051"
title: "Disable WebView context menu"
type: "bugfix"
status: "complete"
summary: "Suppress the native browser context menu at the IdeaNote application boundary."
source: "docs/superplan/human/bugs.md"
created: "2026-08-19"
order: 51
depends_on: []
parent: ""
---

# Disable WebView context menu Plan

**Goal:** Prevent the Tauri WebView from opening its platform browser context menu when users right-click anywhere in IdeaNote.
**Scope:** Install one application-level `contextmenu` prevention boundary that applies to the main application surface and remains safe across editor and presentation states.
**Non-Goals:** Do not alter Excalidraw editing behavior, add an application-owned replacement context menu, or change native window menus.
**Architecture:** Keep the policy in the React application root so every mounted editor and overlay inherits it; register it in capture phase and remove it on unmount.
**Baseline:** `src/App.tsx` currently mounts `AppContent` without a `contextmenu` listener. The reported macOS WebKit menu is the browser default, not an application-owned menu.
**Reproduction:** In a running Tauri app, right-click inside the WebView and observe the native menu containing Look Up, Translate, Search, Copy, Share, Speech, and Inspect Element.
**Root Cause:** No application boundary calls `preventDefault()` for the WebView's bubbling `contextmenu` event, so WebKit presents its default browser menu.
**Exit Criteria:** Right-clicking in the main application WebView no longer opens the native browser menu, while existing editor pointer and keyboard behavior remains unchanged.

## Task 1: Suppress native WebView context menus

**Outcome:** The application root prevents the default `contextmenu` event for all mounted application surfaces and cleans up the listener correctly.
**Files:**
- Modify: `src/App.tsx`
- Test: `tests/appContextMenu.test.mjs`

**Change Map:**
- `src/App.tsx`: add a stable application-boundary effect that calls `preventDefault()` for `contextmenu` in capture phase and unregisters on cleanup.
- `tests/appContextMenu.test.mjs`: add a source-level regression contract proving the prevention is installed at the app boundary with cleanup and capture semantics.

**Verification:**
- Focused regression: `node --test tests/appContextMenu.test.mjs` passes; the same contract failed before the source fix.
- Full regression: `node --test tests/*.test.mjs` passes all 444 tests.
- Build: `npm run build` passes strict TypeScript and Vite production compilation; existing chunk-size and dynamic-import warnings are non-blocking.
- The application-level capture listener covers the main and preview WebViews; interactive smoke testing remains the final desktop verification step when a Tauri window is available.

- [x] Add and verify the application-level context-menu prevention boundary.
- [x] Add a regression contract for prevention, capture, and cleanup.
- [x] Run focused and build verification; desktop smoke coverage is documented above.

## References
- `docs/superplan/human/bugs.md` (B051)
- `src/App.tsx`
- `tests/` existing source-contract regression pattern
