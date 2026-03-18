# Excalidraw Camera Playground Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone frontend-only Excalidraw playground in `.temp/excalidraw-camera-test` that validates camera viewport target calculation and animated pan/zoom behavior.

**Architecture:** Use a small `Vite + React + TypeScript` app with one Excalidraw canvas and one debug control panel. Keep viewport math pure and tested, keep animation cancellation isolated in a small helper, and wire both hardcoded and element-derived camera sources into a lightweight UI for rapid browser verification.

**Tech Stack:** Vite 7, React 19, TypeScript, Vitest, Excalidraw

---

## File Structure

**Create:**
- `.temp/excalidraw-camera-test/index.html` - Vite entry HTML
- `.temp/excalidraw-camera-test/src/main.tsx` - React bootstrap
- `.temp/excalidraw-camera-test/src/App.tsx` - top-level state and layout
- `.temp/excalidraw-camera-test/src/index.css` - minimal app layout and controls styling
- `.temp/excalidraw-camera-test/src/components/CameraPlayground.tsx` - Excalidraw host and viewport sync
- `.temp/excalidraw-camera-test/src/components/ControlPanel.tsx` - camera list, source mode, runtime controls, debug values
- `.temp/excalidraw-camera-test/src/data/demoScene.ts` - initial Excalidraw scene with visible camera targets
- `.temp/excalidraw-camera-test/src/data/demoCameras.ts` - hardcoded camera list matching demo regions
- `.temp/excalidraw-camera-test/src/lib/cameraUtils.ts` - extract/filter camera helpers
- `.temp/excalidraw-camera-test/src/lib/viewport.ts` - pure viewport target calculation
- `.temp/excalidraw-camera-test/src/lib/animateViewport.ts` - animation runner with cancellation
- `.temp/excalidraw-camera-test/src/lib/types.ts` - shared playground types
- `.temp/excalidraw-camera-test/src/tests/cameraUtils.test.ts` - extraction tests
- `.temp/excalidraw-camera-test/src/tests/viewport.test.ts` - viewport calculation tests
- `.temp/excalidraw-camera-test/src/tests/animateViewport.test.ts` - cancellation tests
- `.temp/excalidraw-camera-test/vite.config.ts` - Vite/Vitest config
- `.temp/excalidraw-camera-test/tsconfig.json` - TypeScript config
- `.temp/excalidraw-camera-test/tsconfig.node.json` - Vite TS config

**Modify:**
- `.temp/excalidraw-camera-test/package.json` - replace placeholder package metadata/scripts with real app setup

**Notes:**
- Reuse logic ideas from `src/lib/cameraUtils.ts` in the main app, but keep the playground implementation isolated under `.temp/excalidraw-camera-test`.
- Do not touch Tauri files or the main app unless the playground reveals a concrete bug that the user later asks to port back.
- Do not create git commits unless the user explicitly asks for them.

---

### Task 1: Scaffold the Standalone Playground

**Files:**
- Modify: `.temp/excalidraw-camera-test/package.json`
- Create: `.temp/excalidraw-camera-test/index.html`
- Create: `.temp/excalidraw-camera-test/vite.config.ts`
- Create: `.temp/excalidraw-camera-test/tsconfig.json`
- Create: `.temp/excalidraw-camera-test/tsconfig.node.json`
- Create: `.temp/excalidraw-camera-test/src/main.tsx`
- Create: `.temp/excalidraw-camera-test/src/App.tsx`
- Create: `.temp/excalidraw-camera-test/src/index.css`

- [ ] **Step 1: Replace the placeholder package manifest with a Vite React app manifest**

Include:

```json
{
  "name": "excalidraw-camera-test",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  }
}
```

Add the latest package-manager-selected dependencies for React, React DOM, Vite, TypeScript, Vitest, and Excalidraw.

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: install completes successfully and creates a lockfile.

- [ ] **Step 3: Create the Vite entry files**

Add:

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

And an `index.html` containing a `div#root`.

- [ ] **Step 4: Add minimal TypeScript and Vite config**

Include Vitest support in `vite.config.ts` so tests under `src/tests/*.test.ts` run in a browser-like environment.

- [ ] **Step 5: Add an initial placeholder `App.tsx` and `index.css`**

Create a simple split layout with:
- a canvas area placeholder
- a control panel placeholder

This step is just enough to let the app boot before feature wiring.

- [ ] **Step 6: Run the test command before feature code exists**

Run: `npm test -- --passWithNoTests`

Expected: test runner starts successfully and reports no test files or no tests yet, without TypeScript/config errors.

- [ ] **Step 7: Run the build command**

Run: `npm run build`

Expected: build succeeds for the scaffolded app.

---

### Task 2: Add Pure Camera and Viewport Utilities with TDD

**Files:**
- Create: `.temp/excalidraw-camera-test/src/lib/types.ts`
- Create: `.temp/excalidraw-camera-test/src/lib/cameraUtils.ts`
- Create: `.temp/excalidraw-camera-test/src/lib/viewport.ts`
- Create: `.temp/excalidraw-camera-test/src/tests/cameraUtils.test.ts`
- Create: `.temp/excalidraw-camera-test/src/tests/viewport.test.ts`

- [ ] **Step 1: Write the failing camera extraction tests**

Cover:
- camera rectangles are detected via `customData.type === "camera"`
- deleted elements are ignored
- negative width/height are normalized
- ordered cameras sort by `customData.order`
- unordered cameras fall back after ordered cameras and preserve element order
- `filterCameraElements(elements)` removes camera rectangles while preserving non-camera elements

Run: `npm test -- src/tests/cameraUtils.test.ts`

Expected: FAIL because the utility does not exist yet.

- [ ] **Step 2: Write the failing viewport calculation tests**

Cover:
- contain-fit math with padding
- wide camera bounds
- tall camera bounds
- different viewport sizes
- exact target shape `{ scrollX, scrollY, zoom }`

Run: `npm test -- src/tests/viewport.test.ts`

Expected: FAIL because the utility does not exist yet.

- [ ] **Step 3: Implement shared types and `cameraUtils.ts` minimally**

Implement:
- `Camera`
- `CameraSourceMode`
- `ViewportTarget`
- `extractCameras(elements)`
- `filterCameraElements(elements)`

Keep the API small and deterministic.

- [ ] **Step 4: Run the camera extraction tests**

Run: `npm test -- src/tests/cameraUtils.test.ts`

Expected: PASS.

- [ ] **Step 5: Implement `calculateViewportTarget()` minimally in `viewport.ts`**

Suggested signature:

```ts
calculateViewportTarget({
  cameraBounds,
  viewportWidth,
  viewportHeight,
  paddingFactor,
}): ViewportTarget
```

Use the explicit `contain` fit rule from the spec and return a plain object.

- [ ] **Step 6: Run the viewport tests**

Run: `npm test -- src/tests/viewport.test.ts`

Expected: PASS.

- [ ] **Step 7: Run the focused utility suite**

Run: `npm test -- src/tests/cameraUtils.test.ts src/tests/viewport.test.ts`

Expected: both test files pass together.

---

### Task 3: Add Animation Cancellation with TDD

**Files:**
- Create: `.temp/excalidraw-camera-test/src/lib/animateViewport.ts`
- Create: `.temp/excalidraw-camera-test/src/tests/animateViewport.test.ts`

- [ ] **Step 1: Write the failing animation tests**

Cover:
- starting a second animation cancels the first
- only the latest animation keeps updating state
- cancellation prevents stale frames from mutating the final viewport

Use a small injected scheduler or frame-driver interface so the tests do not depend on real `requestAnimationFrame`.

Run: `npm test -- src/tests/animateViewport.test.ts`

Expected: FAIL because the animation helper does not exist yet.

- [ ] **Step 2: Implement the minimal animation helper**

Suggested behavior:
- accept current state getter
- accept target viewport
- accept duration and easing
- accept a callback that applies viewport updates
- return a cancel function or controller object

- [ ] **Step 3: Run the animation tests**

Run: `npm test -- src/tests/animateViewport.test.ts`

Expected: PASS.

- [ ] **Step 4: Run the full logic suite**

Run: `npm test`

Expected: all utility and animation tests pass.

---

### Task 4: Add Demo Scene and Hardcoded Camera Source

**Files:**
- Create: `.temp/excalidraw-camera-test/src/data/demoScene.ts`
- Create: `.temp/excalidraw-camera-test/src/data/demoCameras.ts`
- Modify: `.temp/excalidraw-camera-test/src/App.tsx`

- [ ] **Step 1: Create a demo Excalidraw scene**

Include several clusters of visible content spread across a large canvas, plus a few rectangle elements marked with:

```ts
customData: { type: "camera", order: N }
```

The regions should be far enough apart that pan and zoom changes are easy to judge visually.

- [ ] **Step 2: Create matching hardcoded camera data**

Point the hardcoded camera list at the same visual regions as the scene's camera rectangles so the two modes can be compared directly.

- [ ] **Step 3: Replace the placeholder app shell with real top-level state**

Manage:
- current camera source mode
- current selected camera index
- duration
- padding factor
- easing mode
- camera visibility toggle

- [ ] **Step 4: Run the build**

Run: `npm run build`

Expected: the app still builds after adding real scene data and top-level state.

---

### Task 5: Wire Excalidraw Playback and Debug UI

**Files:**
- Create: `.temp/excalidraw-camera-test/src/components/CameraPlayground.tsx`
- Create: `.temp/excalidraw-camera-test/src/components/ControlPanel.tsx`
- Modify: `.temp/excalidraw-camera-test/src/App.tsx`
- Modify: `.temp/excalidraw-camera-test/src/index.css`

- [ ] **Step 1: Build the failing interaction slice mentally from the desired UI**

The app should support:
- switching source mode
- previous / next / replay
- selecting a specific camera
- changing duration / padding / easing
- showing target viewport, actual viewport, and deltas

Do not add slide logic, persistence, or thumbnails.

- [ ] **Step 2: Implement `CameraPlayground.tsx`**

Responsibilities:
- render Excalidraw with the demo scene
- expose or retain `excalidrawAPI`
- derive cameras from the selected source mode
- animate to the selected camera
- optionally hide camera rectangles from the rendered elements
- read back actual viewport values after animation settles

- [ ] **Step 3: Implement `ControlPanel.tsx`**

Responsibilities:
- camera source picker
- camera list with click-to-jump
- previous / next / replay buttons
- duration / padding / easing inputs
- camera visibility toggle
- debug block showing target, actual, and delta values

- [ ] **Step 4: Wire the components together in `App.tsx`**

Ensure:
- selected camera index stays valid when source mode changes
- replay re-runs animation for the current camera
- rapid navigation cancels in-flight animation

- [ ] **Step 5: Run the automated tests again**

Run: `npm test`

Expected: all existing tests stay green.

- [ ] **Step 6: Run the app locally for manual verification**

Run: `npm run dev`

Verify:
1. Demo content appears immediately
2. Hardcoded mode animates to each target region
3. Element-derived mode lands on equivalent targets
4. Padding and duration visibly change behavior
5. Actual viewport deltas stay within `scrollX <= 1`, `scrollY <= 1`, and `zoom <= 0.01`
6. Rapid next/previous interactions do not queue stale animations

Stop once the app reaches a healthy steady state and the manual checks are complete.

---

## Verification

After all tasks complete:

1. Run `npm test`
2. Run `npm run build`
3. Run `npm run dev`
4. Verify both camera source modes work
5. Verify the debug panel reports target, actual, and delta values
6. Verify final viewport deltas stay within `scrollX <= 1`, `scrollY <= 1`, and `zoom <= 0.01` for the demo cases

Expected:
- tests pass
- build passes
- dev server starts successfully
- the playground is usable as a browser-only camera animation validation harness
