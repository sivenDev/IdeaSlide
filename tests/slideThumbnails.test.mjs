import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

async function loadModule() {
  const sourcePath = new URL('../src/hooks/useSlideThumbnails.ts', import.meta.url);
  let source = await fs.readFile(sourcePath, 'utf8');

  source = source
    .replace(
      'import { useEffect, useRef, useState } from "react";',
      'const useEffect = () => {}; const useRef = (value) => ({ current: value }); const useState = (value) => [value, () => {}];',
    )
    .replace(
      'import { parseSvgMarkup } from "../lib/cameraThumbnail";',
      'const parseSvgMarkup = (markup) => markup;',
    )
    .replace(
      'import { buildSlidePreviewKey } from "../lib/previewKeys";',
      'const buildSlidePreviewKey = (elements, files, appState = {}) => `slide-preview:v1:${JSON.stringify({ elements, files, appState: appState.viewBackgroundColor ? { viewBackgroundColor: appState.viewBackgroundColor } : {} })}`;',
    )
    .replace(
      'import { previewRendererClient } from "../lib/previewRenderer";',
      'const previewRendererClient = { renderSlides: async () => ({ status: "completed", value: new Map() }) };',
    );

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return import(`data:text/javascript,${encodeURIComponent(transpiled)}`);
}

function createSlide(overrides = {}) {
  return {
    id: 'slide-1',
    elements: [],
    appState: {},
    files: {},
    ...overrides,
  };
}

test('buildEffectiveSlides keeps only slides with renderable elements and attaches render keys', async () => {
  const { buildEffectiveSlides } = await loadModule();

  assert.equal(typeof buildEffectiveSlides, 'function');

  const slides = [
    createSlide({ id: 'empty-slide' }),
    createSlide({
      id: 'renderable-slide',
      elements: [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
      appState: { viewBackgroundColor: '#ffffff' },
    }),
  ];

  assert.deepEqual(buildEffectiveSlides(slides), [
    {
      slideId: 'renderable-slide',
      renderKey: 'slide-preview:v1:{"elements":[{"id":"shape-1","version":1,"x":0,"y":0,"width":10,"height":10}],"files":{},"appState":{"viewBackgroundColor":"#ffffff"}}',
      elements: [{ id: 'shape-1', version: 1, x: 0, y: 0, width: 10, height: 10 }],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    },
  ]);
});

test('collectSlidesNeedingRender returns only slides missing thumbnails or with stale render keys', async () => {
  const { collectSlidesNeedingRender } = await loadModule();

  assert.equal(typeof collectSlidesNeedingRender, 'function');

  const effectiveSlides = [
    { slideId: 'slide-1', renderKey: 'key-1', elements: [], appState: {}, files: {} },
    { slideId: 'slide-2', renderKey: 'key-2', elements: [], appState: {}, files: {} },
    { slideId: 'slide-3', renderKey: 'key-3', elements: [], appState: {}, files: {} },
  ];
  const renderedThumbnails = new Map([
    ['slide-1', { renderKey: 'key-1', svgMarkup: '<svg>cached</svg>' }],
    ['slide-2', { renderKey: 'old-key-2', svgMarkup: '<svg>stale</svg>' }],
  ]);

  assert.deepEqual(collectSlidesNeedingRender(effectiveSlides, renderedThumbnails), [
    { slideId: 'slide-2', renderKey: 'key-2', elements: [], appState: {}, files: {} },
    { slideId: 'slide-3', renderKey: 'key-3', elements: [], appState: {}, files: {} },
  ]);
});

test('collectSlidesNeedingRender limits live editing to the current slide id', async () => {
  const { collectSlidesNeedingRender } = await loadModule();

  assert.equal(typeof collectSlidesNeedingRender, 'function');

  const effectiveSlides = [
    { slideId: 'slide-1', renderKey: 'key-1', elements: [], appState: {}, files: {} },
    { slideId: 'slide-2', renderKey: 'key-2', elements: [], appState: {}, files: {} },
  ];
  const previousRenderKeys = new Map([
    ['slide-1', 'old-key-1'],
    ['slide-2', 'old-key-2'],
  ]);

  assert.deepEqual(
    collectSlidesNeedingRender(effectiveSlides, previousRenderKeys, 'slide-2'),
    [{ slideId: 'slide-2', renderKey: 'key-2', elements: [], appState: {}, files: {} }],
  );
});

test('mergeRenderedThumbnails updates rendered slides, preserves fresh cached slides, and removes inactive slides', async () => {
  const { mergeRenderedThumbnails } = await loadModule();

  assert.equal(typeof mergeRenderedThumbnails, 'function');

  const effectiveSlides = [
    { slideId: 'slide-1', renderKey: 'key-1', elements: [], appState: {}, files: {} },
    { slideId: 'slide-2', renderKey: 'key-2', elements: [], appState: {}, files: {} },
  ];
  const previous = new Map([
    ['slide-1', { renderKey: 'key-1', svgMarkup: '<svg>cached</svg>' }],
    ['slide-3', { renderKey: 'key-3', svgMarkup: '<svg>orphaned</svg>' }],
  ]);
  const renderedSlides = new Map([['slide-2', '<svg>new</svg>']]);

  assert.deepEqual(
    Array.from(mergeRenderedThumbnails(previous, effectiveSlides, renderedSlides).entries()),
    [
      ['slide-1', { renderKey: 'key-1', svgMarkup: '<svg>cached</svg>' }],
      ['slide-2', { renderKey: 'key-2', svgMarkup: '<svg>new</svg>' }],
    ],
  );
});

test('parseRenderedThumbnails reuses parsed SVG nodes when the render key is unchanged', async () => {
  const { parseRenderedThumbnails } = await loadModule();

  assert.equal(typeof parseRenderedThumbnails, 'function');

  const parsedSvg = { nodeName: 'svg' };
  const previous = new Map([
    ['slide-1', { renderKey: 'key-1', svgElement: parsedSvg }],
  ]);
  const rendered = new Map([
    ['slide-1', { renderKey: 'key-1', svgMarkup: '<svg>cached</svg>' }],
  ]);

  const next = parseRenderedThumbnails(rendered, previous);

  assert.equal(next.get('slide-1')?.svgElement, parsedSvg);
});

test('mergeRenderedThumbnails preserves unchanged slides during partial render updates', async () => {
  const { mergeRenderedThumbnails } = await loadModule();

  assert.equal(typeof mergeRenderedThumbnails, 'function');

  const effectiveSlides = [
    { slideId: 'slide-1', renderKey: 'key-1', elements: [], appState: {}, files: {} },
    { slideId: 'slide-2', renderKey: 'key-2', elements: [], appState: {}, files: {} },
  ];
  const previous = new Map([
    ['slide-1', { renderKey: 'key-1', svgMarkup: '<svg>slide-1</svg>' }],
    ['slide-2', { renderKey: 'old-key-2', svgMarkup: '<svg>stale-slide-2</svg>' }],
  ]);
  const renderedSlides = new Map([['slide-2', '<svg>updated-slide-2</svg>']]);

  assert.deepEqual(
    Array.from(mergeRenderedThumbnails(previous, effectiveSlides, renderedSlides).entries()),
    [
      ['slide-1', { renderKey: 'key-1', svgMarkup: '<svg>slide-1</svg>' }],
      ['slide-2', { renderKey: 'key-2', svgMarkup: '<svg>updated-slide-2</svg>' }],
    ],
  );
});
