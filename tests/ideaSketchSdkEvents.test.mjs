import test from 'node:test';
import assert from 'node:assert/strict';

import { createIdeaSketchEventDispatcher, createIdeaSketchEventHub } from '../src/lib/ideasketch-sdk/events.ts';

const documentRef = 'document:doc-1';

function contextEvent(pageRef = 'page:page-1') {
  return { type: 'context-change', activePageRef: pageRef };
}

function documentEvent(version = 2) {
  return {
    type: 'document-committed',
    documentVersion: version,
    operationKinds: ['rename-page'],
    createdPageRefs: [],
    updatedPageRefs: ['page:page-1'],
    deletedPageRefs: [],
  };
}

test('dispatcher assigns monotonic immutable sequence and bounded semantic payloads', () => {
  const dispatcher = createIdeaSketchEventDispatcher({ documentRef });
  const received = [];
  assert.equal(dispatcher.subscribe('context-change', (event) => received.push(event)).status, 'succeeded');
  dispatcher.dispatch(contextEvent());
  assert.equal(received.length, 1);
  assert.equal(received[0].sequence, 1);
  assert.equal(received[0].documentRef, documentRef);
  assert.equal(Object.isFrozen(received[0]), true);
  assert.throws(() => { received[0].activePageRef = 'page:mutated'; }, TypeError);
});

test('subscriber failures are isolated and subscribe/unsubscribe changes affect the next batch', () => {
  const dispatcher = createIdeaSketchEventDispatcher({ documentRef });
  const order = [];
  let late;
  let subscribedLate = false;
  const first = dispatcher.subscribe('context-change', () => {
    order.push('first');
    if (!subscribedLate) {
      subscribedLate = true;
      late = dispatcher.subscribe('context-change', () => order.push('late')).value;
    }
    first.value();
    throw new Error('subscriber failure');
  });
  dispatcher.subscribe('context-change', () => order.push('second'));
  dispatcher.dispatchBatch([contextEvent('page:one'), contextEvent('page:two')]);
  assert.deepEqual(order, ['first', 'second', 'first', 'second']);
  assert.equal(typeof late, 'function');
  dispatcher.dispatch(contextEvent('page:three'));
  assert.deepEqual(order, ['first', 'second', 'first', 'second', 'second', 'late']);
});

test('reentrant events queue behind the complete frozen batch', () => {
  const dispatcher = createIdeaSketchEventDispatcher({ documentRef });
  const order = [];
  dispatcher.subscribe('context-change', (event) => {
    order.push(`a:${event.activePageRef}`);
    if (event.activePageRef === 'page:first') dispatcher.dispatch(contextEvent('page:reentrant'));
  });
  dispatcher.subscribe('context-change', (event) => order.push(`b:${event.activePageRef}`));
  dispatcher.dispatchBatch([contextEvent('page:first'), contextEvent('page:second')]);
  assert.deepEqual(order, [
    'a:page:first', 'b:page:first',
    'a:page:second', 'b:page:second',
    'a:page:reentrant', 'b:page:reentrant',
  ]);
});

test('hub broadcasts canonical document/scene/context records to every facade dispatcher', () => {
  const hub = createIdeaSketchEventHub({ documentRef });
  const first = hub.createDispatcher();
  const second = hub.createDispatcher();
  const received = [[], []];
  first.subscribe('document-committed', (event) => received[0].push(event));
  second.subscribe('document-committed', (event) => received[1].push(event));
  hub.publishBatch([documentEvent(), contextEvent('page:page-2')]);
  assert.equal(received[0].length, 1);
  assert.equal(received[1].length, 1);
  assert.equal(received[0][0].documentRef, documentRef);
  assert.equal(received[1][0].sequence, 1);
  assert.equal(received[0][0].documentVersion, 2);
  hub.dispose();
  assert.equal(first.subscribe('context-change', () => {}).error.code, 'session_closed');
});
