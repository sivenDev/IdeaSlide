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
