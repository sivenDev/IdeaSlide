# Camera Thumbnail Renderer Design Specification

**Date**: 2026-03-18
**Status**: Approved
**Author**: GPT-5 Codex

## Overview

Move camera thumbnail rendering out of the main editor webview into a hidden dedicated Tauri renderer window. The editor should only collect scene state, submit render jobs, and display returned thumbnails. Heavy `Excalidraw` export work must no longer run on the same UI path as typing and canvas editing.

## Problem

The current `useCameraThumbnails()` hook exports SVG directly inside the editor window. That causes three recurring issues:

- thumbnail rendering competes with Excalidraw editing on the same thread
- repeated content changes can flood thumbnail regeneration and make typing feel sticky
- initial thumbnail generation is fragile because it depends on editor-side timing and hook lifecycle

## Goals

- Keep camera thumbnail generation off the editor webview
- Render the first available thumbnail set automatically after file open
- Drop stale intermediate renders while keeping the latest scene snapshot
- Reuse the existing Tauri hidden-renderer pattern already used by MCP preview rendering
- Preserve the existing camera list and camera navigator UI contract

## Non-Goals

- Rebuild slide thumbnail rendering
- Replace Excalidraw export internals
- Add disk-backed thumbnail persistence
- Change the camera data model or file format

## Architecture

### Hidden renderer window

Add a hidden `camera-renderer` Tauri webview that loads the same frontend bundle but boots into a renderer-only mode. It registers a listener for camera thumbnail render requests and signals readiness back to the app via Tauri command/state.

### Request/response flow

The main editor sends one render request containing:

- a request id
- a render key derived from scene fingerprint + camera signature
- the current scene content (`elements`, `appState`, `files`)
- extracted camera bounds

The hidden renderer:

1. filters out camera rectangles from the scene
2. exports the scene once with `exportToSvg()`
3. crops that shared SVG per camera
4. returns `{ camera_id, svg_markup }[]`

The editor stores the result in memory and converts the returned SVG markup back into DOM nodes for the existing UI.

### Readiness and initial render

Rust owns a `camera_renderer_ready` flag and exposes:

- `camera_renderer_ready` command for the hidden renderer to mark itself ready
- `is_camera_renderer_ready` command for the editor to query current readiness

The editor-side client waits for readiness before emitting a render request, so the first open does not depend on content edits or race-prone timers.

### Backpressure strategy

Use a latest-only async queue on the editor side:

- at most one render request is in flight
- if more scene changes arrive while rendering, only the newest pending snapshot is kept
- stale pending requests resolve as replaced and are ignored by the hook

This keeps thumbnail work bounded even during fast typing.

### Cache

Store successful results in memory by `renderKey = sceneFingerprint + cameraSignature`. Reopening the cameras tab or camera navigator with unchanged scene data should reuse cached thumbnails immediately.

## Files

### New

- `src/lib/cameraThumbnailRenderer.ts` - renderer init + editor-side client
- `src/lib/latestOnlyExecutor.ts` - latest-only async queue utility
- `tests/latestOnlyExecutor.test.mjs` - queue behavior tests
- `docs/superpowers/plans/2026-03-18-camera-thumbnail-renderer.md` - implementation plan

### Modified

- `src/App.tsx` - renderer window bootstrap / early renderer-only return
- `src/hooks/useCameraThumbnails.ts` - switch from local export to renderer client
- `src/lib/cameraThumbnail.ts` - render-key and SVG parsing helpers
- `src-tauri/src/lib.rs` - hidden window creation + readiness state + commands
- `src-tauri/capabilities/default.json` - allow `camera-renderer` window

## Testing Strategy

### Automated

- unit tests for the latest-only queue: only the latest pending job runs, replaced jobs are dropped cleanly
- existing camera thumbnail helper tests remain green
- full frontend build must pass

### Manual in Tauri app

- open a file with existing cameras: thumbnails appear without editing
- type continuously on the canvas: camera list no longer stalls editor input
- switch between cameras/slides tabs: camera thumbnails reuse cached result when unchanged
- add, move, resize, or delete a camera: list refreshes to the newest state without blank thumbnails

## Risks and mitigations

- **Renderer window ready race**: solved with Rust readiness state + frontend wait
- **Too many render requests**: solved with latest-only queue and render-key cache
- **Main-window DOM assumptions**: return SVG markup strings and parse locally, rather than transferring DOM nodes across windows
