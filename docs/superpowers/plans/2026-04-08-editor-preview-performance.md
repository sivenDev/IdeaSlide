# Editor Preview Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove preview-related work from Excalidraw's hot editing path so editing stays smooth with the preview hidden and preview refreshes only touch the current slide when the Slides tab is visible.

**Architecture:** Keep the existing hidden preview renderer and cache, but stop rebuilding preview input from the full slide list on every editor change. `EditorLayout` will pass stable store slides plus an optional current-slide draft override into a refactored `useSlideThumbnails()` hook that performs per-slide render-key diffing, debounced current-slide refresh, and incremental thumbnail map updates.

**Tech Stack:** React 19, TypeScript, Excalidraw 0.18, Node test runner, Vite 7

---

## File Structure

**Create:**
- `tests/slideThumbnails.test.mjs` - regression tests for slide thumbnail diffing and incremental reconciliation behavior

**Modify:**
- `src/components/EditorLayout.tsx` - remove always-on `slidePreviewSlides` derivation and pass structured preview inputs
- `src/hooks/useSlideThumbnails.ts` - accept structured inputs, diff render keys per slide, debounce current-slide refresh, and update thumbnail state incrementally
- `src/components/SlidePreviewPanel.tsx` - keep panel contract aligned if thumbnail map behavior changes during incremental updates

**Verify:**
- `tests/previewKeys.test.mjs`
- `tests/editorSession.test.mjs`
- `npm run build`

---

### Task 1: Lock in thumbnail diffing behavior with failing tests

**Files:**
- Create: `tests/slideThumbnails.test.mjs`
- Modify: `src/hooks/useSlideThumbnails.ts`
- Verify: `tests/previewKeys.test.mjs`

- [ ] **Step 1: Write the failing regression tests**

Add `tests/slideThumbnails.test.mjs` with focused tests for the pure thumbnail planning helpers that will be exported from `src/hooks/useSlideThumbnails.ts`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/hooks/useSlideThumbnails.ts');
  } catch {
    return {};
  }
}

test('buildEffectiveSlides only overrides the current slide when draft preview data exists', async () => {
  const { buildEffectiveSlides } = await loadModule();

  assert.equal(typeof buildEffectiveSlides, 'function');

  const slides = [
    { id: 'slide-1', elements: [{ id: 'a' }], appState: { zoom: 1 }, files: {} },
    { id: 'slide-2', elements: [{ id: 'b' }], appState: { zoom: 1 }, files: {} },
  ];
  const override = {
    slideId: 'slide-2',
    elements: [{ id: 'draft' }],
    appState: { zoom: 2 },
    files: { f: { id: 'f' } },
  };

  const effective = buildEffectiveSlides(slides, 1, override);

  assert.deepEqual(effective.map((slide) => slide.id), ['slide-1', 'slide-2']);
  assert.deepEqual(effective[0].elements, [{ id: 'a' }]);
  assert.deepEqual(effective[1].elements, [{ id: 'draft' }]);
});

test('collectSlidesNeedingRender returns only slides whose render key changed', async () => {
  const { collectSlidesNeedingRender } = await loadModule();

  assert.equal(typeof collectSlidesNeedingRender, 'function');

  const slides = [
    { id: 'slide-1', elements: [{ id: 'a' }], appState: {}, files: {} },
    { id: 'slide-2', elements: [{ id: 'b' }], appState: {}, files: {} },
  ];
  const previousKeys = new Map([
    ['slide-1', 'key:a'],
    ['slide-2', 'key:b'],
  ]);

  const result = collectSlidesNeedingRender(slides, previousKeys, new Set(['slide-2']));

  assert.deepEqual(result.changedSlideIds, ['slide-2']);
  assert.equal(result.renderScenes.length, 1);
  assert.equal(result.renderScenes[0].slideId, 'slide-2');
});

test('mergeRenderedThumbnails preserves unchanged entries and prunes deleted slides', async () => {
  const { mergeRenderedThumbnails } = await loadModule();

  assert.equal(typeof mergeRenderedThumbnails, 'function');

  const previous = new Map([
    ['slide-1', { id: 'thumb-1' }],
    ['slide-2', { id: 'thumb-2' }],
  ]);
  const rendered = new Map([
    ['slide-2', { id: 'thumb-2-next' }],
  ]);

  const next = mergeRenderedThumbnails(previous, rendered, ['slide-2'], ['slide-2', 'slide-3']);

  assert.equal(next.get('slide-1'), undefined);
  assert.deepEqual(next.get('slide-2'), { id: 'thumb-2-next' });
  assert.equal(next.has('slide-3'), false);
});
```

- [ ] **Step 2: Run the new tests to verify RED**

Run: `node --experimental-strip-types --test tests/slideThumbnails.test.mjs`
Expected: FAIL because `buildEffectiveSlides`, `collectSlidesNeedingRender`, and `mergeRenderedThumbnails` do not exist yet.

- [ ] **Step 3: Add the minimal pure helpers**

In `src/hooks/useSlideThumbnails.ts`, export minimal helper implementations shaped like this:

```ts
export interface SlideThumbnailOverride {
  slideId: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
}

export function buildEffectiveSlides(
  slides: Slide[],
  currentSlideIndex: number,
  draftOverride?: SlideThumbnailOverride,
): Slide[] {
  if (!draftOverride || currentSlideIndex < 0 || currentSlideIndex >= slides.length) {
    return slides;
  }

  return slides.map((slide, index) => {
    if (index !== currentSlideIndex || slide.id !== draftOverride.slideId) {
      return slide;
    }

    return {
      id: draftOverride.slideId,
      elements: draftOverride.elements,
      appState: draftOverride.appState,
      files: draftOverride.files,
    };
  });
}
```

Also add minimal `collectSlidesNeedingRender()` and `mergeRenderedThumbnails()` implementations that operate on slide ids and render keys only.

- [ ] **Step 4: Run the helper tests to verify GREEN**

Run: `node --experimental-strip-types --test tests/slideThumbnails.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/slideThumbnails.test.mjs src/hooks/useSlideThumbnails.ts
git commit -m "test: lock preview thumbnail diffing behavior"
```

### Task 2: Remove always-on preview array rebuilding from EditorLayout

**Files:**
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/hooks/useSlideThumbnails.ts`
- Verify: `tests/editorSession.test.mjs`

- [ ] **Step 1: Write the failing EditorLayout regression test**

Add one regression test to `tests/editorSession.test.mjs` that verifies preview input construction only happens when the Slides tab is visible. The target behavior is:

```js
test('slide preview override is only created when slide previews are enabled', async () => {
  const { shouldEnableSlidePreviewDraft } = await import('../src/components/EditorLayout.tsx');

  assert.equal(shouldEnableSlidePreviewDraft({ showPreview: false, bottomTab: 'slides' }), false);
  assert.equal(shouldEnableSlidePreviewDraft({ showPreview: true, bottomTab: 'cameras' }), false);
  assert.equal(shouldEnableSlidePreviewDraft({ showPreview: true, bottomTab: 'slides' }), true);
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `node --experimental-strip-types --test tests/editorSession.test.mjs`
Expected: FAIL because `shouldEnableSlidePreviewDraft` is not exported yet.

- [ ] **Step 3: Implement the minimal EditorLayout gate**

In `src/components/EditorLayout.tsx`:

```ts
export function shouldEnableSlidePreviewDraft({
  showPreview,
  bottomTab,
}: {
  showPreview: boolean;
  bottomTab: BottomTab;
}) {
  return showPreview && bottomTab === 'slides';
}
```

Then replace the current always-on `slidePreviewSlides` memo with a lighter current-slide override memo:

```ts
const slidePreviewEnabled = shouldEnableSlidePreviewDraft({ showPreview, bottomTab });

const currentSlidePreviewOverride = useMemo(
  () =>
    slidePreviewEnabled
      ? {
          slideId: draft.slideId,
          elements: draft.elements,
          appState: draft.appState,
          files: draft.files,
        }
      : undefined,
  [slidePreviewEnabled, draft.slideId, draft.elements, draft.appState, draft.files],
);

const thumbnails = useSlideThumbnails({
  slides: state.slides,
  currentSlideIndex: state.currentSlideIndex,
  draftOverride: currentSlidePreviewOverride,
  enabled: slidePreviewEnabled,
});
```

- [ ] **Step 4: Run the focused test to verify GREEN**

Run: `node --experimental-strip-types --test tests/editorSession.test.mjs tests/slideThumbnails.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/EditorLayout.tsx src/hooks/useSlideThumbnails.ts tests/editorSession.test.mjs tests/slideThumbnails.test.mjs
git commit -m "refactor: gate slide preview work behind visible slides tab"
```

### Task 3: Refactor useSlideThumbnails to do per-slide invalidation

**Files:**
- Modify: `src/hooks/useSlideThumbnails.ts`
- Verify: `tests/previewKeys.test.mjs`
- Verify: `tests/slideThumbnails.test.mjs`

- [ ] **Step 1: Write the failing render-planning test**

Extend `tests/slideThumbnails.test.mjs` with a case proving that only the current slide is scheduled during live editing:

```js
test('collectSlidesNeedingRender limits live editing refresh to the current slide', async () => {
  const { collectSlidesNeedingRender } = await loadModule();

  const slides = [
    { id: 'slide-1', elements: [{ id: 'a' }], appState: {}, files: {} },
    { id: 'slide-2', elements: [{ id: 'draft' }], appState: {}, files: {} },
  ];
  const previousKeys = new Map([
    ['slide-1', 'stable:a'],
    ['slide-2', 'stable:b'],
  ]);

  const result = collectSlidesNeedingRender(slides, previousKeys, new Set(['slide-2']));

  assert.deepEqual(result.changedSlideIds, ['slide-2']);
  assert.equal(result.renderScenes.length, 1);
  assert.equal(result.renderScenes[0].slideId, 'slide-2');
});
```

- [ ] **Step 2: Run the tests to verify RED**

Run: `node --experimental-strip-types --test tests/slideThumbnails.test.mjs tests/previewKeys.test.mjs`
Expected: FAIL because the helper still schedules too broadly or does not report `changedSlideIds` correctly.

- [ ] **Step 3: Implement the minimal hook refactor**

Change `useSlideThumbnails()` to this shape:

```ts
export function useSlideThumbnails({
  slides,
  currentSlideIndex,
  draftOverride,
  enabled,
  debounceMs = 500,
}: {
  slides: Slide[];
  currentSlideIndex: number;
  draftOverride?: SlideThumbnailOverride;
  enabled?: boolean;
  debounceMs?: number;
}) {
  // build effective slides lazily
  // compute per-slide render keys
  // only schedule changed slides
  // keep previous thumbnail entries for unchanged slides
}
```

Implementation requirements:
- maintain `renderKeysRef` keyed by slide id
- build `changedSlideIds` from render-key comparisons
- when a draft override exists, treat only its slide id as live-edit eligible
- if no slide changed, skip renderer calls entirely
- keep previous thumbnails for unchanged slide ids
- explicitly prune deleted slide ids from thumbnail state

- [ ] **Step 4: Run the tests to verify GREEN**

Run: `node --experimental-strip-types --test tests/slideThumbnails.test.mjs tests/previewKeys.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSlideThumbnails.ts tests/slideThumbnails.test.mjs tests/previewKeys.test.mjs
git commit -m "refactor: invalidate slide previews per slide"
```

### Task 4: Update thumbnail state incrementally instead of replacing the full map

**Files:**
- Modify: `src/hooks/useSlideThumbnails.ts`
- Modify: `src/components/SlidePreviewPanel.tsx`
- Verify: `tests/slideThumbnails.test.mjs`

- [ ] **Step 1: Write the failing reconciliation test**

Extend `tests/slideThumbnails.test.mjs` with a case proving that unchanged thumbnails survive a partial render update:

```js
test('mergeRenderedThumbnails keeps unchanged slides when only one slide is rerendered', async () => {
  const { mergeRenderedThumbnails } = await loadModule();

  const previous = new Map([
    ['slide-1', { id: 'thumb-1' }],
    ['slide-2', { id: 'thumb-2' }],
  ]);
  const rendered = new Map([
    ['slide-2', { id: 'thumb-2-next' }],
  ]);

  const next = mergeRenderedThumbnails(previous, rendered, ['slide-2'], ['slide-1', 'slide-2']);

  assert.deepEqual(next.get('slide-1'), { id: 'thumb-1' });
  assert.deepEqual(next.get('slide-2'), { id: 'thumb-2-next' });
});
```

- [ ] **Step 2: Run the reconciliation test to verify RED**

Run: `node --experimental-strip-types --test tests/slideThumbnails.test.mjs`
Expected: FAIL because the existing hook logic rebuilds the full thumbnail map.

- [ ] **Step 3: Implement the minimal incremental update path**

In `src/hooks/useSlideThumbnails.ts`, update the async success branch to merge only changed slides:

```ts
setThumbnails((previous) => {
  const rendered = new Map<string, SVGSVGElement>();

  for (const slideId of changedSlideIds) {
    const svgMarkup = result.value.get(slideId);
    const svgElement = svgMarkup ? parseSvgMarkup(svgMarkup) : null;
    if (svgElement instanceof SVGSVGElement) {
      rendered.set(slideId, svgElement);
    }
  }

  return mergeRenderedThumbnails(previous, rendered, changedSlideIds, effectiveSlides.map((slide) => slide.id));
});
```

In `src/components/SlidePreviewPanel.tsx`, keep `thumbnails.get(slide.id)` access unchanged unless TypeScript requires a narrower guard.

- [ ] **Step 4: Run the reconciliation test to verify GREEN**

Run: `node --experimental-strip-types --test tests/slideThumbnails.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSlideThumbnails.ts src/components/SlidePreviewPanel.tsx tests/slideThumbnails.test.mjs
git commit -m "perf: update slide thumbnails incrementally"
```

### Task 5: Verify the end-to-end preview performance behavior

**Files:**
- Verify only

- [ ] **Step 1: Run the targeted automated tests**

Run: `node --experimental-strip-types --test tests/slideThumbnails.test.mjs tests/previewKeys.test.mjs tests/editorSession.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Run the manual regression checklist**

Check:
- preview closed: zoom to 10% and edit continuously without the previous stutter
- preview open on `Slides`: draw or type continuously and confirm the thumbnail updates only after a short idle pause
- preview open on `Cameras`: edit continuously and confirm slide thumbnail work does not trigger
- switch slides, add slides, and delete slides to confirm thumbnails stay aligned and deleted entries disappear

- [ ] **Step 4: Commit**

```bash
git add src/components/EditorLayout.tsx src/hooks/useSlideThumbnails.ts src/components/SlidePreviewPanel.tsx tests/slideThumbnails.test.mjs tests/editorSession.test.mjs
git commit -m "perf: decouple slide preview refresh from editor interactions"
```
