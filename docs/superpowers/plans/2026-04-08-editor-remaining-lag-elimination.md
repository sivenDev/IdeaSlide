# Editor Remaining Lag Elimination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining editor typing lag by taking camera-preview and dirty-state work off the per-keystroke hot path while keeping save, slide switching, and preview updates correct.

**Architecture:** Keep Excalidraw editing local and cheap: `EditorLayout` should stop recomputing camera data and camera preview invalidation directly from every live draft mutation, and `useEditorSession` should stop whole-scene fingerprinting on each `onChange`. Introduce lightweight scene metadata helpers that derive camera-specific signatures and persisted-change booleans from incremental state already available in the editor flow, then let camera previews update only from a debounced snapshot pipeline that is active exclusively on the `Cameras` tab.

**Tech Stack:** React 19, TypeScript, Excalidraw 0.18, Tauri v2, Node test runner, Vite 7

---

## File Structure

**Create:**
- `tests/cameraPreviewState.test.mjs` - unit tests for new camera-preview metadata helpers and session dirty-state helpers

**Modify:**
- `src/lib/cameraUtils.ts` - add cheap helpers for camera-only signatures and camera-content relevance checks
- `src/lib/previewKeys.ts` - split full-scene slide keys from cheaper camera-preview keys built from camera-relevant data only
- `src/lib/editorSession.ts` - replace per-keystroke full-scene fingerprint dependency with explicit dirty/content metadata helpers
- `src/hooks/useEditorSession.ts` - compute pending commit lazily, track dirty/content state incrementally during `updateDraft`
- `src/hooks/useCameraThumbnails.ts` - accept a debounced snapshot object instead of raw live draft props and clear stale caches when disabled/empty
- `src/components/EditorLayout.tsx` - gate camera extraction/render snapshot creation to the `Cameras` tab and feed `useCameraThumbnails()` a debounced camera-preview snapshot
- `src/components/SlideCanvas.tsx` - keep badge syncing, but avoid duplicating expensive signature work on the editor `onChange` path
- `tests/editorSession.test.mjs` - extend session tests for lazy pending-commit and dirty tracking semantics
- `tests/slideThumbnails.test.mjs` - keep existing slide-thumbnail behavior green after preview-key refactor

**Existing verification to keep green:**
- `tests/cameraThumbnail.test.mjs`
- `tests/cameraUtils.test.mjs`
- `tests/sceneFingerprint.test.mjs`
- `tests/slideCanvasProps.test.mjs`

---

### Task 1: Add camera-preview metadata helpers with TDD

**Files:**
- Modify: `src/lib/cameraUtils.ts`
- Modify: `src/lib/previewKeys.ts`
- Create: `tests/cameraPreviewState.test.mjs`
- Verify: `tests/cameraUtils.test.mjs`

- [ ] **Step 1: Write the failing metadata tests**

Add `tests/cameraPreviewState.test.mjs` with these cases:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

async function loadModule() {
  const sourcePath = new URL('../src/lib/previewKeys.ts', import.meta.url);
  const source = await fs.readFile(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return import(`data:text/javascript,${encodeURIComponent(transpiled)}`);
}

test('buildCameraPreviewKey ignores non-camera scene changes', async () => {
  const { buildCameraPreviewKey } = await loadModule();

  const cameras = [{ id: 'camera-1', order: 1, bounds: { x: 0, y: 0, width: 100, height: 80 } }];
  const cameraState = {
    cameraSignature: 'camera-1:1:0,0,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#ffffff"}',
  };

  assert.equal(
    buildCameraPreviewKey(cameraState),
    buildCameraPreviewKey({ ...cameraState, sceneFingerprint: 'ignored-change' }),
  );
});

test('buildCameraPreviewKey changes when camera geometry changes', async () => {
  const { buildCameraPreviewKey } = await loadModule();

  assert.notEqual(
    buildCameraPreviewKey({
      cameraSignature: 'camera-1:1:0,0,100,80:#1e90ff',
      background: '{"viewBackgroundColor":"#ffffff"}',
    }),
    buildCameraPreviewKey({
      cameraSignature: 'camera-1:1:10,0,100,80:#1e90ff',
      background: '{"viewBackgroundColor":"#ffffff"}',
    }),
  );
});
```

Run: `node --experimental-strip-types --test tests/cameraPreviewState.test.mjs`
Expected: FAIL because the new camera-preview helper shape does not exist yet.

- [ ] **Step 2: Implement the minimal camera-signature helpers**

In `src/lib/cameraUtils.ts`, add a helper that turns already-extracted cameras into a stable signature without looking at non-camera elements:

```ts
export function buildCameraCollectionSignature(cameras: readonly Camera[]) {
  return cameras
    .map((camera) =>
      `${camera.id}:${camera.order}:${camera.bounds.x},${camera.bounds.y},${camera.bounds.width},${camera.bounds.height}:${camera.strokeColor ?? ""}`,
    )
    .join("|");
}
```

In `src/lib/previewKeys.ts`, keep slide keys as they are, but change camera keys to accept a precomputed camera-preview payload:

```ts
export interface CameraPreviewState {
  cameraSignature: string;
  background: string;
}

export function buildCameraPreviewKey(state: CameraPreviewState) {
  return `camera:${state.cameraSignature}::${state.background}`;
}
```

- [ ] **Step 3: Run the focused metadata tests**

Run: `node --experimental-strip-types --test tests/cameraPreviewState.test.mjs tests/cameraUtils.test.mjs`
Expected: PASS.

- [ ] **Step 4: Commit the helper slice**

```bash
git add tests/cameraPreviewState.test.mjs src/lib/cameraUtils.ts src/lib/previewKeys.ts tests/cameraUtils.test.mjs
git commit -m "perf: split camera preview metadata from full scene"
```

### Task 2: Remove per-keystroke full-scene fingerprinting from editor session

**Files:**
- Modify: `src/lib/editorSession.ts`
- Modify: `src/hooks/useEditorSession.ts`
- Modify: `tests/editorSession.test.mjs`

- [ ] **Step 1: Write the failing editor-session tests**

Extend `tests/editorSession.test.mjs` with these cases:

```js
test('createDraftChangeSummary marks element changes without recomputing persisted appState noise', async () => {
  const { createDraftChangeSummary } = await loadModule();

  const slide = {
    id: 'slide-1',
    elements: [{ id: 'shape-1', version: 1 }],
    appState: { viewBackgroundColor: '#ffffff' },
    files: {},
  };

  assert.deepEqual(
    createDraftChangeSummary(slide, {
      elements: [{ id: 'shape-1', version: 2 }],
      appState: { viewBackgroundColor: '#ffffff', selectedElementIds: { 'shape-1': true } },
      files: {},
    }),
    {
      contentChanged: true,
      appStateChanged: false,
      hasPersistedChange: true,
    },
  );
});

test('buildSlideCommitPayload can use a precomputed change summary', async () => {
  const { buildSlideCommitPayload } = await loadModule();

  const slide = {
    id: 'slide-1',
    elements: [{ id: 'shape-1', version: 1 }],
    appState: {},
    files: {},
  };

  const draft = {
    slideId: 'slide-1',
    elements: [{ id: 'shape-1', version: 2 }],
    appState: {},
    files: {},
    baseSceneFingerprint: 'unused-after-refactor',
  };

  assert.deepEqual(
    buildSlideCommitPayload(slide, draft, {
      contentChanged: true,
      appStateChanged: false,
      hasPersistedChange: true,
    }),
    {
      slide: {
        id: 'slide-1',
        elements: [{ id: 'shape-1', version: 2 }],
        appState: {},
        files: {},
      },
      contentChanged: true,
    },
  );
});
```

Run: `node --experimental-strip-types --test tests/editorSession.test.mjs`
Expected: FAIL because `createDraftChangeSummary()` and the new `buildSlideCommitPayload()` signature do not exist yet.

- [ ] **Step 2: Implement minimal dirty-state helpers**

In `src/lib/editorSession.ts`, add an explicit summary type and helper:

```ts
export interface DraftChangeSummary {
  contentChanged: boolean;
  appStateChanged: boolean;
  hasPersistedChange: boolean;
}

export function createDraftChangeSummary(
  previousSlide: Slide,
  nextDraftLike: Pick<EditorSlideDraft, 'elements' | 'appState' | 'files'>,
): DraftChangeSummary {
  const previousAppState = normalizePersistedAppStateForComparison(
    extractPersistedAppState(previousSlide.appState),
  );
  const nextAppState = normalizePersistedAppStateForComparison(
    extractPersistedAppState(nextDraftLike.appState),
  );

  const contentChanged =
    previousSlide.elements !== nextDraftLike.elements || previousSlide.files !== nextDraftLike.files;
  const appStateChanged =
    JSON.stringify(previousAppState) !== JSON.stringify(nextAppState);

  return {
    contentChanged,
    appStateChanged,
    hasPersistedChange: contentChanged || appStateChanged,
  };
}
```

Then change `buildSlideCommitPayload()` so it can accept an already-computed summary:

```ts
export function buildSlideCommitPayload(
  previousSlide: Slide,
  draft: EditorSlideDraft,
  summary: DraftChangeSummary = createDraftChangeSummary(previousSlide, draft),
): SlideCommitPayload | null {
  if (!summary.hasPersistedChange) {
    return null;
  }

  return {
    slide: {
      id: previousSlide.id,
      elements: draft.elements,
      appState: extractPersistedAppState(draft.appState),
      files: draft.files,
    },
    contentChanged: summary.contentChanged,
  };
}
```

- [ ] **Step 3: Make `useEditorSession()` use incremental summary state**

Change `src/hooks/useEditorSession.ts` so `updateDraft()` stores the summary instead of calling `buildSlideCommitPayload()` on every keystroke:

```ts
const [changeSummary, setChangeSummary] = useState(() =>
  createDraftChangeSummary(slide, buildEditorDraftFromSlide(slide)),
);

const pendingCommit = useMemo(
  () => buildSlideCommitPayload(baseSlide, draft, changeSummary),
  [baseSlide, changeSummary, draft],
);
```

Inside `updateDraft()`:

```ts
const nextDraft = {
  ...previousDraft,
  elements,
  appState,
  files,
};
const nextSummary = createDraftChangeSummary(baseSlide, nextDraft);
setChangeSummary(nextSummary);
if (nextSummary.hasPersistedChange) {
  onDirty();
}
return nextDraft;
```

Reset `changeSummary` whenever the base slide or flushed draft resets.

- [ ] **Step 4: Run the editor-session tests**

Run: `node --experimental-strip-types --test tests/editorSession.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit the editor-session slice**

```bash
git add src/lib/editorSession.ts src/hooks/useEditorSession.ts tests/editorSession.test.mjs
git commit -m "perf: remove per-keystroke session fingerprinting"
```

### Task 3: Decouple camera thumbnails from the live draft hot path

**Files:**
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/hooks/useCameraThumbnails.ts`
- Modify: `tests/cameraPreviewState.test.mjs`

- [ ] **Step 1: Write the failing camera snapshot tests**

Extend `tests/cameraPreviewState.test.mjs` with a focused snapshot test that describes the new UI contract:

```js
test('buildCameraPreviewKey is stable when the snapshot is unchanged', async () => {
  const { buildCameraPreviewKey } = await loadModule();

  const snapshot = {
    cameraSignature: 'camera-1:1:0,0,100,80:#1e90ff',
    background: '{"viewBackgroundColor":"#ffffff"}',
  };

  assert.equal(buildCameraPreviewKey(snapshot), buildCameraPreviewKey({ ...snapshot }));
});
```

Run: `node --experimental-strip-types --test tests/cameraPreviewState.test.mjs`
Expected: FAIL if the hook still requires raw `elements/files/appState/cameras` and no stable snapshot contract exists.

- [ ] **Step 2: Rewire `EditorLayout.tsx` to produce a debounced camera snapshot only for the `Cameras` tab**

Add these memoized values near the existing camera code:

```ts
const cameraPreviewEnabled = showPreview && bottomTab === 'cameras';

const cameras = useMemo(
  () => (cameraPreviewEnabled ? extractCameras(draft.elements) : []),
  [cameraPreviewEnabled, draft.elements],
);

const cameraPreviewSnapshot = useMemo(() => {
  if (!cameraPreviewEnabled) {
    return null;
  }

  return {
    cameras,
    elements: draft.elements,
    files: draft.files,
    appState: { viewBackgroundColor: draft.appState?.viewBackgroundColor ?? '#ffffff' },
    cameraSignature: buildCameraCollectionSignature(cameras),
    background: JSON.stringify({
      viewBackgroundColor: draft.appState?.viewBackgroundColor ?? '#ffffff',
    }),
  };
}, [cameraPreviewEnabled, cameras, draft.appState, draft.elements, draft.files]);
```

Then call the hook with the snapshot instead of raw live props:

```ts
const cameraThumbnails = useCameraThumbnails({
  snapshot: cameraPreviewSnapshot,
  debounceMs: 250,
  enabled: cameraPreviewEnabled,
});
```

- [ ] **Step 3: Refactor `useCameraThumbnails.ts` to consume the snapshot object**

Replace the current signature with:

```ts
interface CameraPreviewSnapshot {
  cameras: Camera[];
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
  cameraSignature: string;
  background: string;
}

export function useCameraThumbnails({
  snapshot,
  debounceMs = 500,
  enabled = true,
}: {
  snapshot: CameraPreviewSnapshot | null;
  debounceMs?: number;
  enabled?: boolean;
}) {
```

Build the render key from the snapshot metadata only:

```ts
const renderKey = snapshot ? buildCameraPreviewKey({
  cameraSignature: snapshot.cameraSignature,
  background: snapshot.background,
}) : null;
```

Inside the effect:
- clear pending timeouts when disabled
- clear `thumbnails` when disabled or when `snapshot` is `null`
- no synchronous `extractPreviewAppState()` or `buildSceneFingerprint()` call in the render body
- use `snapshot` values only inside the debounced async job

- [ ] **Step 4: Run the focused camera tests**

Run: `node --experimental-strip-types --test tests/cameraPreviewState.test.mjs tests/cameraUtils.test.mjs tests/cameraThumbnail.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit the camera hook slice**

```bash
git add src/components/EditorLayout.tsx src/hooks/useCameraThumbnails.ts tests/cameraPreviewState.test.mjs src/lib/previewKeys.ts src/lib/cameraUtils.ts
git commit -m "perf: debounce camera previews from stable snapshots"
```

### Task 4: Trim duplicate badge work from `SlideCanvas`

**Files:**
- Modify: `src/components/SlideCanvas.tsx`
- Verify: `tests/slideCanvasProps.test.mjs`

- [ ] **Step 1: Write the failing regression expectation**

Add or extend `tests/slideCanvasProps.test.mjs` with a case that preserves the memo boundary while allowing badge work to stay off the editor `onChange` fast path. The target assertion is that changing unrelated parent props still keeps `areSlideCanvasPropsEqual()` strict and that badge updates are handled by the Excalidraw API listeners rather than by forcing new canvas props.

Run: `node --experimental-strip-types --test tests/slideCanvasProps.test.mjs`
Expected: FAIL if the new prop flow changes the memo contract unexpectedly.

- [ ] **Step 2: Remove duplicate badge syncing from `stableOnChange`**

In `src/components/SlideCanvas.tsx`, change this block:

```ts
syncCameraBadgesRef.current(els, state);
onChangeRef.current(els, state, sceneFiles || {});
```

To this:

```ts
onChangeRef.current(els, state, sceneFiles || {});
```

Keep badge updates driven by the existing `api.onChange()`, `api.onScrollChange()`, and `ResizeObserver` listeners so the parent callback path does not do the same signature work twice.

- [ ] **Step 3: Run the focused canvas test**

Run: `node --experimental-strip-types --test tests/slideCanvasProps.test.mjs`
Expected: PASS.

- [ ] **Step 4: Commit the canvas slice**

```bash
git add src/components/SlideCanvas.tsx tests/slideCanvasProps.test.mjs
git commit -m "perf: drop duplicate camera badge sync from editor change path"
```

### Task 5: Keep slide preview behavior green after the camera/session refactor

**Files:**
- Modify: `tests/slideThumbnails.test.mjs`
- Verify: `src/hooks/useSlideThumbnails.ts`
- Verify: `tests/editorSession.test.mjs`

- [ ] **Step 1: Add a slide-preview safety test if needed**

If the `previewKeys.ts` camera-key refactor touched shared exports, add a focused regression test to `tests/slideThumbnails.test.mjs` that confirms slide preview keys still change when scene content changes and remain independent from the camera-preview metadata path.

Use this shape:

```js
test('buildEffectiveSlides still uses full slide preview keys', async () => {
  const { buildEffectiveSlides } = await loadModule();

  const slides = [
    {
      id: 'slide-1',
      elements: [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    },
  ];

  assert.match(buildEffectiveSlides(slides)[0].renderKey, /^slide:/);
});
```

Run: `node --experimental-strip-types --test tests/slideThumbnails.test.mjs`
Expected: PASS after any needed fixture update.

- [ ] **Step 2: Run the combined targeted suite**

Run: `node --experimental-strip-types --test tests/editorSession.test.mjs tests/cameraPreviewState.test.mjs tests/slideThumbnails.test.mjs tests/slideCanvasProps.test.mjs tests/cameraUtils.test.mjs tests/cameraThumbnail.test.mjs tests/sceneFingerprint.test.mjs`
Expected: PASS.

- [ ] **Step 3: Commit the verification slice**

```bash
git add tests/slideThumbnails.test.mjs tests/editorSession.test.mjs tests/cameraPreviewState.test.mjs tests/slideCanvasProps.test.mjs
git commit -m "test: cover lag hot-path regressions"
```

### Task 6: Final verification

**Files:**
- Verify only

- [ ] **Step 1: Run the full targeted test suite**

Run: `node --experimental-strip-types --test tests/editorSession.test.mjs tests/cameraPreviewState.test.mjs tests/slideThumbnails.test.mjs tests/slideCanvasProps.test.mjs tests/cameraThumbnail.test.mjs tests/cameraUtils.test.mjs tests/sceneFingerprint.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run the frontend build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Manual editor verification checklist**

Check:
- open the preview area on the `Cameras` tab and type continuously in a text element; typing stays smooth
- zoom to 10%–30% and type continuously; lag is materially reduced versus current `master`
- move, resize, add, and delete a camera; the camera list still refreshes to the latest state after the debounce
- switch to the `Slides` tab; slide preview behavior still matches the previous optimization work
- save immediately after editing and switch slides immediately after editing; the latest draft content is preserved

- [ ] **Step 4: Commit the final verification (only if code changed during verification)**

```bash
git status --short
```

Expected: clean working tree, or only intentional follow-up fixes before the final commit.
