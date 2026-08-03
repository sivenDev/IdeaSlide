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

test('areSlideCanvasPropsEqual tracks navigator and Camera tool callbacks', async () => {
  const { areSlideCanvasPropsEqual } = await loadModule();
  const elements = [];
  const appState = {};
  const files = {};
  const onChange = () => {};
  const onApiReady = () => {};
  const onToggleNavigator = () => {};
  const onAddCamera = () => {};
  const base = {
    slideId: 'slide-1',
    elements,
    appState,
    files,
    onChange,
    onApiReady,
    viewMode: false,
    isNavigatorOpen: false,
    onToggleNavigator,
    onAddCamera,
  };

  assert.equal(areSlideCanvasPropsEqual(base, { ...base, isNavigatorOpen: true }), false);
  assert.equal(areSlideCanvasPropsEqual(base, { ...base, onToggleNavigator: () => {} }), false);
  assert.equal(areSlideCanvasPropsEqual(base, { ...base, onAddCamera: () => {} }), false);
});
