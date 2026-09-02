import test from 'node:test';
import assert from 'node:assert/strict';

async function loadModule() {
  try {
    return await import('../src/lib/slideCanvasProps.ts');
  } catch {
    return {};
  }
}

test('areSlideCanvasPropsEqual skips rerender when only parent-local state updates', async () => {
  const { areSlideCanvasPropsEqual } = await loadModule();

  assert.equal(typeof areSlideCanvasPropsEqual, 'function');

  const elements = [{ id: 'text-1', version: 1 }];
  const appState = { selectedElementIds: {} };
  const files = {};
  const onChange = () => {};
  const onApiReady = () => {};

  assert.equal(
    areSlideCanvasPropsEqual(
      {
        slideId: 'slide-1',
        elements,
        appState,
        files,
        onChange,
        onApiReady,
        viewMode: false,
      },
      {
        slideId: 'slide-1',
        elements,
        appState,
        files,
        onChange,
        onApiReady,
        viewMode: false,
      },
    ),
    true,
  );
});

test('areSlideCanvasPropsEqual forces rerender when slide scene data changes', async () => {
  const { areSlideCanvasPropsEqual } = await loadModule();

  assert.equal(typeof areSlideCanvasPropsEqual, 'function');

  const onChange = () => {};
  const onApiReady = () => {};

  assert.equal(
    areSlideCanvasPropsEqual(
      {
        slideId: 'slide-1',
        elements: [{ id: 'text-1', version: 1 }],
        appState: { selectedElementIds: {} },
        files: {},
        onChange,
        onApiReady,
        viewMode: false,
      },
      {
        slideId: 'slide-1',
        elements: [{ id: 'text-1', version: 2 }],
        appState: { selectedElementIds: {} },
        files: {},
        onChange,
        onApiReady,
        viewMode: false,
      },
    ),
    false,
  );
});

test('areSlideCanvasPropsEqual forces rerender when callback identity changes', async () => {
  const { areSlideCanvasPropsEqual } = await loadModule();

  assert.equal(typeof areSlideCanvasPropsEqual, 'function');

  const elements = [{ id: 'text-1', version: 1 }];
  const appState = { selectedElementIds: {} };
  const files = {};

  assert.equal(
    areSlideCanvasPropsEqual(
      {
        slideId: 'slide-1',
        elements,
        appState,
        files,
        onChange: () => {},
        onApiReady: () => {},
        viewMode: false,
      },
      {
        slideId: 'slide-1',
        elements,
        appState,
        files,
        onChange: () => {},
        onApiReady: () => {},
        viewMode: false,
      },
    ),
    false,
  );
});

test('areSlideCanvasPropsEqual tracks the selection-presence observer', async () => {
  const { areSlideCanvasPropsEqual } = await loadModule();
  const elements = [];
  const appState = {};
  const files = {};
  const onChange = () => {};
  const onSelectionPresenceChange = () => {};
  const base = {
    slideId: 'slide-1',
    elements,
    appState,
    files,
    onChange,
    onSelectionPresenceChange,
  };

  assert.equal(areSlideCanvasPropsEqual(base, base), true);
  assert.equal(
    areSlideCanvasPropsEqual(base, { ...base, onSelectionPresenceChange: () => {} }),
    false,
  );
});

test('areSlideCanvasPropsEqual forces rerender when editor refresh token changes', async () => {
  const { areSlideCanvasPropsEqual } = await loadModule();

  assert.equal(typeof areSlideCanvasPropsEqual, 'function');

  const elements = [{ id: 'text-1', version: 1 }];
  const appState = { selectedElementIds: {} };
  const files = {};
  const onChange = () => {};
  const onApiReady = () => {};

  assert.equal(
    areSlideCanvasPropsEqual(
      {
        slideId: 'slide-1',
        elements,
        appState,
        files,
        onChange,
        onApiReady,
        viewMode: false,
        editorRefreshToken: 1,
      },
      {
        slideId: 'slide-1',
        elements,
        appState,
        files,
        onChange,
        onApiReady,
        viewMode: false,
        editorRefreshToken: 2,
      },
    ),
    false,
  );
});

test('areSlideCanvasPropsEqual tracks Camera drawing requests without Navigator menu state', async () => {
  const { areSlideCanvasPropsEqual } = await loadModule();
  const elements = [];
  const appState = {};
  const files = {};
  const onChange = () => {};
  const onApiReady = () => {};
  const base = {
    slideId: 'slide-1',
    elements,
    appState,
    files,
    onChange,
    onApiReady,
    viewMode: false,
    cameraDrawingRequestToken: 1,
  };

  assert.equal(areSlideCanvasPropsEqual(base, { ...base, cameraDrawingRequestToken: 2 }), false);
});

test('SlideCanvas comparable props omit obsolete Canvas action and Navigator callbacks', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) =>
    readFile(new URL('../src/lib/slideCanvasProps.ts', import.meta.url), 'utf8'),
  );

  assert.doesNotMatch(source, /onAddCamera/);
  assert.doesNotMatch(source, /isNavigatorOpen/);
  assert.doesNotMatch(source, /onToggleNavigator/);
  assert.doesNotMatch(source, /onHelp|openHelp/);
  assert.match(source, /onConvertSelection/);
});

test('areSlideCanvasPropsEqual tracks the conversion callback', async () => {
  const { areSlideCanvasPropsEqual } = await loadModule();
  const base = {
    slideId: 'slide-1',
    elements: [],
    appState: {},
    files: {},
    onChange: () => {},
    onApiReady: () => {},
    onConvertSelection: () => {},
    viewMode: false,
  };

  assert.equal(areSlideCanvasPropsEqual(base, { ...base }), true);
  assert.equal(
    areSlideCanvasPropsEqual(base, { ...base, onConvertSelection: () => {} }),
    false,
  );
});

test('areSlideCanvasPropsEqual tracks the active Page title used for draw.io naming', async () => {
  const { areSlideCanvasPropsEqual } = await loadModule();
  const base = {
    slideId: 'slide-1',
    pageTitle: 'Page 1',
    elements: [],
    appState: {},
    files: {},
    onChange: () => {},
    onApiReady: () => {},
    viewMode: false,
  };

  assert.equal(areSlideCanvasPropsEqual(base, { ...base }), true);
  assert.equal(areSlideCanvasPropsEqual(base, { ...base, pageTitle: 'Page 2' }), false);
});

test('areSlideCanvasPropsEqual tracks the Canvas interaction callback', async () => {
  const { areSlideCanvasPropsEqual } = await loadModule();
  const base = {
    slideId: 'slide-1',
    elements: [],
    appState: {},
    files: {},
    onChange: () => {},
    onApiReady: () => {},
    onInteractionChange: () => {},
    viewMode: false,
  };

  assert.equal(areSlideCanvasPropsEqual(base, { ...base }), true);
  assert.equal(
    areSlideCanvasPropsEqual(base, { ...base, onInteractionChange: () => {} }),
    false,
  );
});

test('areSlideCanvasPropsEqual tracks the native SDK interaction observer', async () => {
  const { areSlideCanvasPropsEqual } = await loadModule();
  const base = {
    slideId: 'slide-1',
    elements: [],
    appState: {},
    files: {},
    onChange: () => {},
    onNativeInteractionChange: () => {},
  };

  assert.equal(areSlideCanvasPropsEqual(base, { ...base }), true);
  assert.equal(
    areSlideCanvasPropsEqual(base, { ...base, onNativeInteractionChange: () => {} }),
    false,
  );
});

test('areSlideCanvasPropsEqual tracks the active Camera preview identity observer', async () => {
  const { areSlideCanvasPropsEqual } = await loadModule();
  const base = {
    slideId: 'slide-1',
    elements: [],
    appState: {},
    files: {},
    onChange: () => false,
    onCameraPreviewChange: () => {},
  };

  assert.equal(areSlideCanvasPropsEqual(base, { ...base }), true);
  assert.equal(
    areSlideCanvasPropsEqual(base, { ...base, onCameraPreviewChange: () => {} }),
    false,
  );
});

test('SlideCanvas reports pointer, text, IME, history, owned action, and Camera preview epochs', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) =>
    readFile(new URL('../src/components/SlideCanvas.tsx', import.meta.url), 'utf8'),
  );
  for (const reason of ['pointer', 'text', 'ime', 'history', 'native-action', 'camera-preview']) {
    assert.match(source, new RegExp(`"${reason}"`));
  }
  assert.match(source, /onCompositionStartCapture/);
  assert.match(source, /onBeforeInputCapture/);
  assert.match(source, /onCutCapture/);
  assert.match(source, /editingTextElement/);
  assert.match(source, /selectedElementsAreBeingDragged/);
  assert.match(source, /isResizing/);
  assert.match(source, /isRotating/);
  assert.match(source, /onPasteLifecycle=\{viewMode \? undefined : handlePasteLifecycle\}/);
  assert.match(source, /createIdeaSketchNativeActionOwnership/);
  assert.match(source, /settleNativeActionAfterSynchronousEvent\(beginNativeAction\(\)\)/);
  assert.doesNotMatch(source, /onPasteCapture=/);
  assert.doesNotMatch(source, /if \(persisted\) finishNativeAction\(\)/);
  assert.doesNotMatch(source, /pulseNativeInteraction\("native-action"\)/);
});

test('areSlideCanvasPropsEqual tracks the drawer command bridge and layout refresh token', async () => {
  const { areSlideCanvasPropsEqual } = await loadModule();
  const base = {
    slideId: 'slide-1',
    elements: [],
    appState: {},
    files: {},
    onChange: () => {},
    onApiReady: () => {},
    onCommandApiReady: () => {},
    viewMode: false,
    layoutRefreshToken: 1,
  };

  assert.equal(areSlideCanvasPropsEqual(base, { ...base }), true);
  assert.equal(
    areSlideCanvasPropsEqual(base, { ...base, onCommandApiReady: () => {} }),
    false,
  );
  assert.equal(areSlideCanvasPropsEqual(base, { ...base, layoutRefreshToken: 2 }), false);
});
