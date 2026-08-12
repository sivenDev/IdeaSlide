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
