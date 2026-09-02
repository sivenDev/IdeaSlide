import test from 'node:test';
import assert from 'node:assert/strict';

import { buildIdeaSketchOperation, IDEA_SKETCH_OPERATION_SCHEMAS, validateOperationPlan } from '../src/lib/ideasketch-sdk/operationSchemas.ts';

test('operation builders are versioned, frozen, and reject ambiguous or unknown fields', () => {
  const result = buildIdeaSketchOperation('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'hello' });
  assert.equal(result.status, 'succeeded');
  assert.equal(result.value.version, 1);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(buildIdeaSketchOperation('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'x', extra: true }).error.code, 'invalid_request');
  assert.equal(buildIdeaSketchOperation('create-text', { ref: 'temp:t', bounds: { x: 0, y: 0, width: 10, height: 10 }, x: 0, y: 0, text: 'x' }).error.code, 'invalid_request');
  assert.equal(buildIdeaSketchOperation('create-arrow', { ref: 'temp:a', points: [[0, 0], [10, 10]], start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }).error.code, 'invalid_request');
  assert.equal(buildIdeaSketchOperation('bind-arrow', { arrowRef: 'element:a', startElementRef: 'element:s' }).error.code, 'invalid_request');
  assert.equal(buildIdeaSketchOperation('bind-arrow', { arrowRef: 'element:a', start: { targetRef: 'element:s' } }).error.code, 'invalid_request');
  assert.equal(buildIdeaSketchOperation('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'x', layout: { autoResize: true, width: 100 } }).error.code, 'invalid_request');
  assert.equal(buildIdeaSketchOperation('set-text-layout', { textRef: 'element:t', width: 100 }).status, 'succeeded');
  assert.equal(buildIdeaSketchOperation('set-text-layout', { textRef: 'element:t', layout: { width: 100 } }).status, 'succeeded');
  const canonicalText = buildIdeaSketchOperation('create-text', { ref: 'temp:text', x: 0, y: 0, text: 'hello' });
  assert.equal(canonicalText.status, 'succeeded');
  assert.equal(canonicalText.value.originalText, 'hello');
  assert.equal('text' in canonicalText.value, false);
  const canonicalStyle = buildIdeaSketchOperation('set-text-style', { textRef: 'element:text', fontSize: 24 });
  assert.deepEqual(canonicalStyle.value.style, { fontSize: 24 });
  assert.equal('fontSize' in canonicalStyle.value, false);
  const canonicalLayout = buildIdeaSketchOperation('set-text-layout', { textRef: 'element:text', width: 100 });
  assert.deepEqual(canonicalLayout.value.layout, { width: 100, autoResize: false });
  assert.equal('width' in canonicalLayout.value, false);
  assert.equal(buildIdeaSketchOperation('create-text', { ref: 'temp:t', x: 0, y: 0, text: 'x', originalText: 'y' }).error.code, 'invalid_request');
  assert.equal(buildIdeaSketchOperation('create-shape', {
    ref: 'temp:s',
    shape: 'rectangle',
    bounds: { x: 0, y: 0, width: 20, height: 20 },
    boundText: { ref: 'temp:t', text: 'x', layout: { width: 10 } },
  }).error.code, 'invalid_request');
  assert.equal(buildIdeaSketchOperation('upsert-bound-text', {
    shapeRef: 'element:s',
    text: 'x',
    layout: { autoResize: false, width: 10 },
  }).error.code, 'invalid_request');
  assert.equal(buildIdeaSketchOperation('unbind-arrow', { arrowRef: 'element:a', endpoint: 'both', start: true }).error.code, 'invalid_request');
  const symbolInput = { ref: 'temp:s', shape: 'rectangle', bounds: { x: 0, y: 0, width: 10, height: 10 } };
  symbolInput[Symbol('unknown')] = true;
  assert.equal(buildIdeaSketchOperation('create-shape', symbolInput).error.code, 'invalid_request');
  const hiddenUnknown = { kind: 'create-shape', version: 1, ref: 'temp:s', shape: 'rectangle', bounds: { x: 0, y: 0, width: 10, height: 10 } };
  Object.defineProperty(hiddenUnknown, 'extra', { value: true, enumerable: false });
  assert.equal((validateOperationPlan([hiddenUnknown])).error.code, 'invalid_request');
  const hiddenContent = { ref: 'temp:t', x: 0, y: 0 };
  Object.defineProperty(hiddenContent, 'text', { value: 'hidden', enumerable: false });
  assert.equal(buildIdeaSketchOperation('create-text', hiddenContent).error.code, 'invalid_request');
  const undefinedContent = { ref: 'temp:t', x: 0, y: 0, text: undefined };
  assert.equal(buildIdeaSketchOperation('create-text', undefinedContent).error.code, 'invalid_request');
  const sparsePoints = { ref: 'temp:a', points: [] };
  sparsePoints.points.length = 2;
  sparsePoints.points[1] = [10, 10];
  assert.equal(buildIdeaSketchOperation('create-arrow', sparsePoints).error.code, 'invalid_request');
  assert.equal(Object.isFrozen(IDEA_SKETCH_OPERATION_SCHEMAS['create-text']), true);
});

test('operation plans enforce TempRef ordering and initialScene restrictions', () => {
  const badOrder = validateOperationPlan([
    { kind: 'bind-text', version: 1, textRef: 'temp:t', containerRef: 'temp:s' },
    { kind: 'create-shape', version: 1, ref: 'temp:s', shape: 'rectangle', bounds: { x: 0, y: 0, width: 10, height: 10 } },
  ]);
  assert.equal(badOrder.error.code, 'invalid_request');
  const pageForwardRef = validateOperationPlan([
    { kind: 'rename-page', version: 1, pageRef: 'temp:later', title: 'Forward ref' },
    { kind: 'add-page', version: 1, ref: 'temp:later' },
  ]);
  assert.equal(pageForwardRef.error.code, 'invalid_request');
  assert.equal(buildIdeaSketchOperation('add-page', { ref: 'temp:p', initialScene: { operations: [{ kind: 'create-camera', version: 1, ref: 'temp:c', bounds: { x: 0, y: 0, width: 20, height: 20 }, atIndex: 0 }] } }).error.code, 'invalid_request');
  const textThatLooksLikeARef = buildIdeaSketchOperation('add-page', { ref: 'temp:p',
    initialScene: {
      operations: [{ kind: 'create-text', version: 1, ref: 'temp:t', x: 0, y: 0, text: 'page:not-a-reference' }],
    },
  });
  assert.equal(textThatLooksLikeARef.status, 'succeeded');
  assert.equal(buildIdeaSketchOperation('add-page', { ref: 'temp:p', initialScene: { operations: [{ kind: 'create-shape', version: 1, ref: 'temp:s', shape: 'rectangle', bounds: { x: 0, y: 0, width: 10, height: 10 } }, { kind: 'set-shape-style', version: 1, shapeRef: 'element:old', style: {} }] } }).error.code, 'invalid_request');
  const selfReference = validateOperationPlan([
    { kind: 'upsert-bound-text', version: 1, shapeRef: 'temp:s', createRef: 'temp:s', text: 'self' },
  ]);
  assert.equal(selfReference.error.code, 'invalid_request');
  const duplicateInlineRefs = validateOperationPlan([
    { kind: 'create-shape', version: 1, ref: 'temp:s', shape: 'rectangle', bounds: { x: 0, y: 0, width: 10, height: 10 }, boundText: { ref: 'temp:s', text: 'label' } },
  ]);
  assert.equal(duplicateInlineRefs.error.code, 'invalid_request');
  const duplicateSeedRefs = validateOperationPlan([
    { kind: 'add-page', version: 1, ref: 'temp:page', initialScene: { operations: [
      { kind: 'create-shape', version: 1, ref: 'temp:shape', shape: 'rectangle', bounds: { x: 0, y: 0, width: 10, height: 10 } },
    ] } },
    { kind: 'create-text', version: 1, ref: 'temp:shape', x: 0, y: 0, text: 'duplicate' },
  ]);
  assert.equal(duplicateSeedRefs.error.code, 'invalid_request');
  const pageSeedCollision = validateOperationPlan([
    { kind: 'add-page', version: 1, ref: 'temp:shared', initialScene: { operations: [
      { kind: 'create-text', version: 1, ref: 'temp:shared', x: 0, y: 0, text: 'duplicate' },
    ] } },
  ]);
  assert.equal(pageSeedCollision.error.code, 'invalid_request');
  const seedRefLeak = validateOperationPlan([
    { kind: 'add-page', version: 1, ref: 'temp:page', initialScene: { operations: [
      { kind: 'create-shape', version: 1, ref: 'temp:seed-shape', shape: 'rectangle', bounds: { x: 0, y: 0, width: 10, height: 10 } },
    ] } },
    { kind: 'set-shape-style', version: 1, shapeRef: 'temp:seed-shape', style: { strokeColor: '#fff' } },
  ]);
  assert.equal(seedRefLeak.error.code, 'invalid_request');
});

test('builder getters and malformed clones fail through SdkResult', () => {
  const input = { ref: 'temp:s', shape: 'rectangle', bounds: { x: 0, y: 0, width: 10, height: 10 } };
  Object.defineProperty(input, 'style', { get() { throw new Error('getter'); } });
  assert.doesNotThrow(() => buildIdeaSketchOperation('create-shape', input));
  assert.equal(buildIdeaSketchOperation('create-shape', input).status, 'rejected');
});

test('plan byte limits cover the serialized operation array envelope', () => {
  const first = buildIdeaSketchOperation('create-text', { ref: 'temp:a', x: 0, y: 0, text: 'a' });
  const second = buildIdeaSketchOperation('create-text', { ref: 'temp:b', x: 0, y: 0, text: 'b' });
  assert.equal(first.status, 'succeeded');
  assert.equal(second.status, 'succeeded');
  const operations = [first.value, second.value];
  const bytes = new TextEncoder().encode(JSON.stringify(operations)).byteLength;
  assert.equal(validateOperationPlan(operations, { maxPlanBytes: bytes - 1 }).error.code, 'invalid_request');
  assert.equal(validateOperationPlan(operations, { maxPlanBytes: bytes }).status, 'succeeded');
});

test('operation limits reject non-finite and invalid capability values', () => {
  const input = { ref: 'temp:t', x: 0, y: 0, text: 'x' };
  assert.equal(buildIdeaSketchOperation('create-text', input, { maxCoordinate: Number.NaN }).error.code, 'invalid_request');
  assert.equal(buildIdeaSketchOperation('create-text', input, { maxPlanBytes: Number.POSITIVE_INFINITY }).error.code, 'invalid_request');
  assert.equal(validateOperationPlan([{ kind: 'create-text', version: 1, ...input }], { maxOperations: 0 }).error.code, 'invalid_request');
});

test('Page builders use the RFC-owned TempRef/source fields and trim bounded titles', () => {
  const added = buildIdeaSketchOperation('add-page', { ref: 'temp:page', title: '  Demo  ' });
  assert.equal(added.status, 'succeeded');
  assert.equal(added.value.ref, 'temp:page');
  assert.equal(added.value.title, 'Demo');
  assert.equal(buildIdeaSketchOperation('add-page', { title: 'Demo' }).error.code, 'invalid_request');
  assert.equal(buildIdeaSketchOperation('import-page', { ref: 'temp:page', parsedPageDraftRef: 'import:draft' }).status, 'succeeded');
  assert.equal(buildIdeaSketchOperation('import-page', { ref: 'temp:page', parsedPageDraftRef: 'import:bad token' }).error.code, 'invalid_request');
  assert.equal(buildIdeaSketchOperation('duplicate-page', { ref: 'temp:page', sourcePageRef: 'page:source' }).status, 'succeeded');
  assert.equal(buildIdeaSketchOperation('create-page-from-selection', { ref: 'temp:page', sourcePageRef: 'page:source', selectedRefs: ['element:a'], preset: 'formal' }).status, 'succeeded');
  assert.equal(buildIdeaSketchOperation('rename-page', { pageRef: 'page:source', title: '   ' }).error.code, 'invalid_request');
});

test('formal style preset preserves v1 preserved-only line elements', async () => {
  const { apply } = await import('./ideaSketchSdkTestUtils.mjs');
  const line = {
    id: 'line-1',
    type: 'line',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    angle: 0,
    version: 1,
    versionNonce: 1,
    updated: 1,
    isDeleted: false,
    locked: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    strokeWidth: 1,
    strokeStyle: 'dashed',
  };
  const result = apply([
    {
      kind: 'apply-style-preset',
      version: 1,
      selectedRefs: ['element:line-1'],
      preset: 'formal',
    },
  ], { elements: [line] });
  assert.equal(result.operations[0].outcome, 'noop');
  assert.deepEqual(result.scene.elements[0], line);
});
