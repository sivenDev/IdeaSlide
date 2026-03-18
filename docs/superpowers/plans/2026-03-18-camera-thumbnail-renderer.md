# Camera Thumbnail Renderer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move camera thumbnail export work into a hidden Tauri renderer window so camera previews appear on first open and no longer block Excalidraw editing.

**Architecture:** Add a hidden `camera-renderer` webview, a readiness handshake in Rust, and an editor-side renderer client with a latest-only queue and render-key cache. Keep the current camera UI components but change `useCameraThumbnails()` to fetch SVG markup from the dedicated renderer instead of exporting locally.

**Tech Stack:** Tauri v2, React 19, TypeScript, Excalidraw 0.18, Rust, Node test runner

---

## File Structure

**Create:**
- `src/lib/latestOnlyExecutor.ts` - latest-only async queue helper
- `src/lib/cameraThumbnailRenderer.ts` - hidden renderer listener and editor-side client
- `tests/latestOnlyExecutor.test.mjs` - queue unit tests

**Modify:**
- `src/App.tsx` - renderer-only bootstrap path
- `src/hooks/useCameraThumbnails.ts` - call renderer client instead of local export
- `src/lib/cameraThumbnail.ts` - render-key and SVG parsing helpers
- `src-tauri/src/lib.rs` - camera renderer state, commands, and hidden window setup
- `src-tauri/capabilities/default.json` - include `camera-renderer`

**Verify:**
- `tests/cameraThumbnail.test.mjs`
- `tests/cameraUtils.test.mjs`
- `tests/sceneFingerprint.test.mjs`

---

### Task 1: Add the latest-only queue with TDD

**Files:**
- Create: `src/lib/latestOnlyExecutor.ts`
- Test: `tests/latestOnlyExecutor.test.mjs`

- [ ] **Step 1: Write the failing queue tests**

Cover:
- first scheduled job runs immediately
- while a job is in flight, only the newest pending job is retained
- replaced pending jobs resolve with `{ status: "replaced" }`

Run: `node --experimental-strip-types --test tests/latestOnlyExecutor.test.mjs`
Expected: FAIL because the queue helper does not exist yet.

- [ ] **Step 2: Implement the minimal queue helper**

API target:

```ts
const executor = new LatestOnlyExecutor(async (input) => {
  return doWork(input);
});

const result = await executor.schedule(input);
```

Return shape:

```ts
{ status: "completed", value }
{ status: "replaced" }
```

- [ ] **Step 3: Run the queue tests**

Run: `node --experimental-strip-types --test tests/latestOnlyExecutor.test.mjs`
Expected: PASS.

### Task 2: Add the dedicated camera thumbnail renderer client

**Files:**
- Create: `src/lib/cameraThumbnailRenderer.ts`
- Modify: `src/lib/cameraThumbnail.ts`
- Verify: `tests/cameraThumbnail.test.mjs`

- [ ] **Step 1: Write the failing helper test additions**

Add tests for:
- `buildCameraThumbnailRenderKey(sceneFingerprint, cameraSignature)`
- SVG markup parsing helper returns an `SVGSVGElement` for valid markup and `null` otherwise

Run: `node --experimental-strip-types --test tests/cameraThumbnail.test.mjs`
Expected: FAIL because the new helpers do not exist yet.

- [ ] **Step 2: Implement the new camera thumbnail helpers minimally**

Add:
- render-key helper
- safe SVG markup parser

- [ ] **Step 3: Implement `cameraThumbnailRenderer.ts`**

Include:
- hidden-renderer init function for the `camera-renderer` window
- editor-side client singleton
- readiness wait using Tauri command + event
- request/response correlation by `request_id`
- in-memory cache by render key
- latest-only queue around outbound render jobs

- [ ] **Step 4: Run the helper tests**

Run: `node --experimental-strip-types --test tests/cameraThumbnail.test.mjs tests/latestOnlyExecutor.test.mjs`
Expected: PASS.

### Task 3: Switch the editor hook to the renderer client

**Files:**
- Modify: `src/hooks/useCameraThumbnails.ts`

- [ ] **Step 1: Replace local SVG export logic with renderer requests**

Behavior:
- keep `cameraSignature` + `sceneFingerprint`
- build one render key from them
- debounce the request lightly
- wait for renderer result
- ignore stale responses
- convert returned SVG markup into DOM nodes before storing state

- [ ] **Step 2: Preserve camera cleanup behavior**

Ensure removed cameras are deleted from the map and empty scenes clear camera thumbnails.

- [ ] **Step 3: Run the focused tests**

Run: `node --experimental-strip-types --test tests/cameraThumbnail.test.mjs tests/cameraUtils.test.mjs tests/sceneFingerprint.test.mjs tests/latestOnlyExecutor.test.mjs`
Expected: PASS.

### Task 4: Add the hidden Tauri renderer window and readiness bridge

**Files:**
- Modify: `src/App.tsx`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Add Rust readiness state and commands**

Add:
- `camera_renderer_ready`
- `is_camera_renderer_ready`
- hidden `camera-renderer` window creation during app setup

Emit a ready event when the hidden renderer signals readiness.

- [ ] **Step 2: Add frontend renderer bootstrap handling**

In `src/App.tsx`:
- if window label is `camera-renderer`, initialize the camera renderer and return `null`
- preserve existing `mcp-renderer` behavior
- keep the main app path unchanged for `main`

- [ ] **Step 3: Run the frontend build**

Run: `npm run build`
Expected: PASS.

### Task 5: Final verification

**Files:**
- Verify only

- [ ] **Step 1: Run the full targeted test suite**

Run: `node --experimental-strip-types --test tests/latestOnlyExecutor.test.mjs tests/cameraThumbnail.test.mjs tests/cameraUtils.test.mjs tests/sceneFingerprint.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Manual Tauri verification checklist**

Check:
- open an existing `.is` file with cameras and wait for first thumbnails
- edit text continuously and confirm camera list no longer causes typing hitching
- add/move/resize/delete a camera and confirm thumbnails update to the latest state
