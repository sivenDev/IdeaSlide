import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/editorSession.ts');
  } catch {
    return {};
  }
}

test('extractPersistedAppState keeps persistent fields and strips transient editing state', async () => {
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

test('buildSlideCommitPayload returns null when only transient appState changed', async () => {
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
    scrollX: 40,
    scrollY: 80,
  };

  assert.equal(buildSlideCommitPayload(slide, draft), null);
});

test('buildSlideCommitPayload ignores Excalidraw default white background when previous slide omitted it', async () => {
  const { buildEditorDraftFromSlide, buildSlideCommitPayload } = await loadModule();

  assert.equal(typeof buildEditorDraftFromSlide, 'function');
  assert.equal(typeof buildSlideCommitPayload, 'function');

  const slide = {
    id: 'slide-1',
    elements: [{ id: 'camera-1', version: 1 }],
    appState: {},
    files: {},
  };

  const draft = buildEditorDraftFromSlide(slide);
  draft.appState = {
    viewBackgroundColor: '#ffffff',
    selectedElementIds: { 'camera-1': true },
    scrollX: 40,
    scrollY: 80,
  };

  assert.equal(buildSlideCommitPayload(slide, draft), null);
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
  };

  assert.deepEqual(buildSlideCommitPayload(slide, draft), {
    slide: {
      id: 'slide-1',
      elements: [{ id: 'text-1', version: 2 }],
      appState: { viewBackgroundColor: '#f5f5f5' },
      files: {},
    },
    contentChanged: true,
  });
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
      appState: { viewBackgroundColor: '#ffffff' },
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
