import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

async function loadModule() {
  try {
    return await import('../src/lib/editorSession.ts');
  } catch {
    return {};
  }
}

test('extractPersistedAppState keeps Page viewport fields and strips transient editing state', async () => {
  const { extractPersistedAppState } = await loadModule();

  assert.equal(typeof extractPersistedAppState, 'function');

  const persisted = extractPersistedAppState({
    viewBackgroundColor: '#ffffff',
    gridSize: 16,
    selectedElementIds: { a: true },
    editingElement: { id: 'text-1' },
    scrollX: 120,
    scrollY: 80,
    zoom: { value: 2 },
    collaborators: new Map([['u1', {}]]),
  });

  assert.deepEqual(persisted, {
    viewBackgroundColor: '#ffffff',
    gridSize: 16,
    scrollX: 120,
    scrollY: 80,
    zoom: { value: 2 },
  });
});

test('buildEditorDraftFromSlide preserves scene data and tags the draft with the slide id', async () => {
  const { buildEditorDraftFromSlide } = await loadModule();

  assert.equal(typeof buildEditorDraftFromSlide, 'function');

  const slide = {
    id: 'slide-2',
    elements: [{ id: 'text-1', version: 1 }],
    appState: { viewBackgroundColor: '#fff' },
    files: { file1: { id: 'file1', mimeType: 'image/png', size: 1 } },
  };

  const draft = buildEditorDraftFromSlide(slide);

  assert.equal(draft.slideId, 'slide-2');
  assert.equal(draft.elements, slide.elements);
  assert.equal(draft.files, slide.files);
  assert.equal(draft.appState, slide.appState);
});

test('useEditorSession keeps live edits in refs and debounces preview sync before React state catches up', async () => {
  const sourcePath = new URL('../src/hooks/useEditorSession.ts', import.meta.url);
  const source = await fs.readFile(sourcePath, 'utf8');

  assert.match(source, /const PREVIEW_SYNC_DEBOUNCE_MS = 250;/);
  assert.match(source, /const draftRef = useRef\(initialSession\.draft\);/);
  assert.match(source, /draftRef\.current = nextDraft;/);
  assert.match(source, /previewSyncTimeoutRef\.current = window\.setTimeout\(\(\) => \{/s);
  assert.match(source, /syncPreviewDraft\(\);/);
  assert.doesNotMatch(source, /setDraft\(\(previousDraft\) => \{/);
});

test('useEditorSession computes the initial scene projection only once per mount', async () => {
  const sourcePath = new URL('../src/hooks/useEditorSession.ts', import.meta.url);
  const source = await fs.readFile(sourcePath, 'utf8');
  const initialization = source.match(
    /const initialSessionRef = useRef<[\s\S]*?const \[draft, setDraft\]/,
  )?.[0] ?? '';

  assert.match(initialization, /if \(initialSessionRef\.current === null\) \{/);
  assert.match(initialization, /createPersistedDraftProjection\(initialDraft\)/);
  assert.match(initialization, /const initialSession = initialSessionRef\.current;/);
  assert.doesNotMatch(source, /const initialProjection = createPersistedDraftProjection\(initialDraft\);\s*const \[draft/s);
});

test('useEditorSession advances autosave versions only for persisted consecutive-draft changes', async () => {
  const sourcePath = new URL('../src/hooks/useEditorSession.ts', import.meta.url);
  const source = await fs.readFile(sourcePath, 'utf8');
  const updateDraft = source.match(/const updateDraft = useCallback\([\s\S]*?\n  \);/)?.[0] ?? '';

  assert.match(updateDraft, /const previousDraft = draftRef\.current;/);
  assert.match(updateDraft, /updatePersistedDraftProjection\([\s\S]*?liveProjectionRef\.current,[\s\S]*?nextDraft/);
  assert.match(updateDraft, /const persistedDraftChanged = projectionUpdate\.summary\.hasPersistedChange;/);
  assert.match(updateDraft, /if \(persistedDraftChanged\) \{[\s\S]*?editVersionRef\.current \+= 1;[\s\S]*?previewSyncTimeoutRef\.current = window\.setTimeout/);
});

test('cached persisted projections skip scene fingerprints for viewport noise and hash changed identities once', async () => {
  const {
    comparePersistedDraftProjections,
    createPersistedDraftProjection,
    updatePersistedDraftProjection,
  } = await loadModule();

  assert.equal(typeof createPersistedDraftProjection, 'function');
  assert.equal(typeof updatePersistedDraftProjection, 'function');
  assert.equal(typeof comparePersistedDraftProjections, 'function');

  const elements = [{ id: 'shape-1', version: 1, versionNonce: 11 }];
  const files = {};
  const baseDraft = {
    elements,
    files,
    appState: { viewBackgroundColor: '#ffffff', scrollX: 0, zoom: { value: 1 } },
  };
  const baseProjection = createPersistedDraftProjection(baseDraft);
  const viewportUpdate = updatePersistedDraftProjection(baseProjection, {
    elements,
    files,
    appState: { ...baseDraft.appState, scrollX: 240, zoom: { value: 1.5 } },
  });

  assert.equal(viewportUpdate.sceneFingerprintComputed, false);
  assert.equal(viewportUpdate.summary.hasPersistedChange, false);
  assert.equal(
    comparePersistedDraftProjections(baseProjection, viewportUpdate.projection).hasPersistedChange,
    false,
  );

  const backgroundUpdate = updatePersistedDraftProjection(viewportUpdate.projection, {
    elements,
    files,
    appState: { ...baseDraft.appState, viewBackgroundColor: '#f5f5f5' },
  });
  assert.equal(backgroundUpdate.sceneFingerprintComputed, false);
  assert.equal(backgroundUpdate.summary.appStateChanged, true);

  const clonedEquivalent = updatePersistedDraftProjection(viewportUpdate.projection, {
    elements: elements.map((element) => ({ ...element })),
    files: { ...files },
    appState: baseDraft.appState,
  });
  assert.equal(clonedEquivalent.sceneFingerprintComputed, true);
  assert.equal(clonedEquivalent.summary.hasPersistedChange, false);

  const edited = updatePersistedDraftProjection(clonedEquivalent.projection, {
    elements: [{ ...elements[0], version: 2, versionNonce: 12 }],
    files,
    appState: baseDraft.appState,
  });
  assert.equal(edited.sceneFingerprintComputed, true);
  assert.equal(edited.summary.contentChanged, true);

  const reverted = updatePersistedDraftProjection(edited.projection, baseDraft);
  assert.equal(reverted.sceneFingerprintComputed, true);
  assert.equal(reverted.summary.contentChanged, true);
});

test('consecutive draft comparison ignores persisted-equivalent noise but detects edits and reverts', async () => {
  const { createDraftChangeSummary } = await loadModule();

  assert.equal(typeof createDraftChangeSummary, 'function');

  const saved = {
    id: 'slide-1',
    elements: [{ id: 'shape-1', version: 1 }],
    appState: { viewBackgroundColor: '#ffffff', scrollX: 0, scrollY: 0, zoom: { value: 1 } },
    files: {},
  };
  const equivalent = {
    slideId: 'slide-1',
    elements: saved.elements,
    appState: {
      ...saved.appState,
      selectedElementIds: { 'shape-1': true },
      scrollX: 120,
      zoom: { value: 1.5 },
    },
    files: saved.files,
  };
  const edited = {
    ...equivalent,
    elements: [{ id: 'shape-1', version: 2 }],
  };

  assert.equal(createDraftChangeSummary(saved, equivalent).hasPersistedChange, false);
  assert.equal(createDraftChangeSummary(equivalent, edited).hasPersistedChange, true);
  assert.equal(createDraftChangeSummary(edited, equivalent).hasPersistedChange, true);
});

test('buildSlidesForPersistence applies the latest live draft snapshot to the current slide', async () => {
  const { buildSlidesForPersistence } = await loadModule();

  assert.equal(typeof buildSlidesForPersistence, 'function');

  const slides = [
    { id: 'slide-1', elements: [{ id: 'a', version: 1 }], appState: {}, files: {} },
    { id: 'slide-2', elements: [{ id: 'b', version: 1 }], appState: {}, files: {} },
  ];
  const liveDraft = {
    slideId: 'slide-2',
    elements: [{ id: 'b', version: 3 }],
    appState: { viewBackgroundColor: '#f5f5f5', selectedElementIds: { b: true } },
    files: {},
  };

  assert.deepEqual(
    buildSlidesForPersistence(slides, 1, slides[1], liveDraft, {
      contentChanged: true,
      appStateChanged: true,
      hasPersistedChange: true,
    }),
    [
      slides[0],
      {
        id: 'slide-2',
        elements: [{ id: 'b', version: 3 }],
        appState: { viewBackgroundColor: '#f5f5f5' },
        files: {},
      },
    ],
  );
});

test('buildSlideCommitPayload returns null when only selection state changed', async () => {
  const { buildEditorDraftFromSlide, buildSlideCommitPayload } = await loadModule();

  assert.equal(typeof buildEditorDraftFromSlide, 'function');
  assert.equal(typeof buildSlideCommitPayload, 'function');

  const slide = {
    id: 'slide-1',
    elements: [{ id: 'text-1', version: 1 }],
    appState: { viewBackgroundColor: '#ffffff' },
    files: {},
  };

  const draft = buildEditorDraftFromSlide(slide);
  draft.appState = {
    ...draft.appState,
    selectedElementIds: { 'text-1': true },
  };

  assert.equal(buildSlideCommitPayload(slide, draft), null);
});

test('viewport-only changes do not mark the Page dirty or create a commit', async () => {
  const { buildEditorDraftFromSlide, buildSlideCommitPayload, createDraftChangeSummary } = await loadModule();

  assert.equal(typeof buildEditorDraftFromSlide, 'function');
  assert.equal(typeof buildSlideCommitPayload, 'function');
  assert.equal(typeof createDraftChangeSummary, 'function');

  const slide = {
    id: 'slide-1',
    elements: [{ id: 'camera-1', version: 1 }],
    appState: {
      viewBackgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
    },
    files: {},
  };

  const draft = buildEditorDraftFromSlide(slide);
  draft.appState = {
    viewBackgroundColor: '#ffffff',
    selectedElementIds: { 'camera-1': true },
    scrollX: 40,
    scrollY: 80,
    zoom: { value: 1.5 },
  };

  assert.deepEqual(createDraftChangeSummary(slide, draft), {
    contentChanged: false,
    appStateChanged: false,
    hasPersistedChange: false,
  });
  assert.equal(buildSlideCommitPayload(slide, draft), null);
});

test('meaningful appState changes still create a commit', async () => {
  const { buildEditorDraftFromSlide, buildSlideCommitPayload } = await loadModule();

  const slide = {
    id: 'slide-1',
    elements: [],
    appState: { viewBackgroundColor: '#ffffff', gridSize: null },
    files: {},
  };
  const draft = buildEditorDraftFromSlide(slide);
  draft.appState = {
    ...draft.appState,
    viewBackgroundColor: '#f5f5f5',
    gridSize: 16,
    scrollX: 40,
    scrollY: 80,
    zoom: { value: 1.5 },
  };

  assert.deepEqual(buildSlideCommitPayload(slide, draft), {
    slide: {
      id: 'slide-1',
      elements: [],
      appState: {
        viewBackgroundColor: '#f5f5f5',
        gridSize: 16,
        scrollX: 40,
        scrollY: 80,
        zoom: { value: 1.5 },
      },
      files: {},
    },
    contentChanged: false,
  });
});

test('buildSlideCommitPayload returns persisted slide data when scene content changed', async () => {
  const { buildEditorDraftFromSlide, buildSlideCommitPayload } = await loadModule();

  assert.equal(typeof buildEditorDraftFromSlide, 'function');
  assert.equal(typeof buildSlideCommitPayload, 'function');

  const slide = {
    id: 'slide-1',
    elements: [{ id: 'text-1', version: 1 }],
    appState: { viewBackgroundColor: '#ffffff' },
    files: {},
  };

  const draft = buildEditorDraftFromSlide(slide);
  draft.elements = [{ id: 'text-1', version: 2 }];
  draft.appState = {
    viewBackgroundColor: '#f5f5f5',
    selectedElementIds: { 'text-1': true },
    scrollX: 120,
    scrollY: 80,
    zoom: { value: 1.25 },
  };

  assert.deepEqual(buildSlideCommitPayload(slide, draft), {
    slide: {
      id: 'slide-1',
      elements: [{ id: 'text-1', version: 2 }],
      appState: {
        viewBackgroundColor: '#f5f5f5',
        scrollX: 120,
        scrollY: 80,
        zoom: { value: 1.25 },
      },
      files: {},
    },
    contentChanged: true,
  });
});

test('createDraftChangeSummary marks element changes without recomputing persisted appState noise', async () => {
  const { createDraftChangeSummary } = await loadModule();

  assert.equal(typeof createDraftChangeSummary, 'function');

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

  assert.equal(typeof buildSlideCommitPayload, 'function');

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

test('applySlideCommitToSlides replaces only the current persisted slide snapshot', async () => {
  const { applySlideCommitToSlides } = await loadModule();

  assert.equal(typeof applySlideCommitToSlides, 'function');

  const slides = [
    { id: 'slide-1', elements: [{ id: 'a', version: 1 }], appState: {}, files: {} },
    { id: 'slide-2', elements: [{ id: 'b', version: 1 }], appState: {}, files: {} },
  ];

  const nextSlides = applySlideCommitToSlides(slides, 1, {
    slide: {
      id: 'slide-2',
      elements: [{ id: 'b', version: 2 }],
      appState: { viewBackgroundColor: '#fff' },
      files: {},
    },
    contentChanged: true,
  });

  assert.deepEqual(nextSlides, [
    slides[0],
    {
      id: 'slide-2',
      elements: [{ id: 'b', version: 2 }],
      appState: { viewBackgroundColor: '#fff' },
      files: {},
    },
  ]);
});

test('applyCanvasCommitToContents preserves compatible canvas payload extensions', async () => {
  const { applyCanvasCommitToContents } = await loadModule();
  assert.equal(typeof applyCanvasCommitToContents, 'function');

  const contents = {
    'canvas-1': {
      type: 'excalidraw', version: 2, elements: [], appState: {}, files: {},
      pluginState: { mode: 'future-compatible' },
    },
  };
  const next = applyCanvasCommitToContents(contents, 'canvas-1', {
    slide: { id: 'canvas-1', elements: [{ id: 'updated' }], appState: {}, files: {} },
    contentChanged: true,
  });
  assert.deepEqual(next['canvas-1'].pluginState, { mode: 'future-compatible' });
  assert.equal(next['canvas-1'].elements[0].id, 'updated');
});

test('flushEditorDraft resets the draft baseline after committing so save state can clear', async () => {
  const {
    buildEditorDraftFromSlide,
    buildSlideCommitPayload,
    flushEditorDraft,
  } = await loadModule();

  assert.equal(typeof buildEditorDraftFromSlide, 'function');
  assert.equal(typeof buildSlideCommitPayload, 'function');
  assert.equal(typeof flushEditorDraft, 'function');

  const slide = {
    id: 'slide-1',
    elements: [{ id: 'text-1', version: 1 }],
    appState: { viewBackgroundColor: '#ffffff' },
    files: {},
  };

  const draft = buildEditorDraftFromSlide(slide);
  draft.elements = [{ id: 'text-1', version: 2 }];
  draft.appState = {
    viewBackgroundColor: '#ffffff',
    selectedElementIds: { 'camera-1': true },
    scrollX: 120,
    scrollY: 80,
  };

  const flushed = flushEditorDraft(slide, draft);

  assert.deepEqual(flushed.commitPayload, {
    slide: {
      id: 'slide-1',
      elements: [{ id: 'text-1', version: 2 }],
      appState: {
        viewBackgroundColor: '#ffffff',
        scrollX: 120,
        scrollY: 80,
      },
      files: {},
    },
    contentChanged: true,
  });

  assert.equal(buildSlideCommitPayload(flushed.baseSlide, flushed.draft), null);
  assert.deepEqual(flushed.draft.appState, {
    viewBackgroundColor: '#ffffff',
    selectedElementIds: { 'camera-1': true },
    scrollX: 120,
    scrollY: 80,
  });
});
