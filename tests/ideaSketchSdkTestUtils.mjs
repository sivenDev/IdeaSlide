import assert from 'node:assert/strict';

import { buildIdeaSketchOperation } from '../src/lib/ideasketch-sdk/operationSchemas.ts';
import { applyIdeaSketchScenePlan } from '../src/lib/ideasketch-sdk/excalidrawSceneAdapter.ts';

export function op(kind, input) {
  const result = buildIdeaSketchOperation(kind, input);
  assert.equal(result.status, 'succeeded', result.status === 'rejected' ? result.error.message : 'operation failed');
  return result.value;
}

export function apply(operations, scene = {}) {
  let nextId = 0;
  let nextNonce = 0;
  let nextTime = 100;
  const result = applyIdeaSketchScenePlan({
    scene: {
      elements: scene.elements ?? [],
      appState: scene.appState ?? {},
      files: scene.files ?? {},
    },
    operations,
    runtime: {
      createId: () => `generated-${++nextId}`,
      createNonce: () => ++nextNonce,
      now: () => ++nextTime,
    },
    maxCameraCount: 200,
    cameraMinWidth: 16,
    cameraMinHeight: 16,
  });
  assert.equal(result.status, 'succeeded', result.status === 'rejected' ? result.error.message : 'scene plan failed');
  return result.value;
}

export function element(id, type, overrides = {}) {
  return {
    id,
    type,
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    angle: 0,
    version: 1,
    versionNonce: 1,
    updated: 1,
    isDeleted: false,
    locked: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    ...overrides,
  };
}

export function rejectedApply(operations, scene = {}) {
  return applyIdeaSketchScenePlan({
    scene: { elements: scene.elements ?? [], appState: scene.appState ?? {}, files: scene.files ?? {} },
    operations,
    runtime: { createId: () => 'generated', createNonce: () => 1, now: () => 1 },
    maxCameraCount: 200,
    cameraMinWidth: 16,
    cameraMinHeight: 16,
  });
}
