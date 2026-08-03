import test from 'node:test';
import assert from 'node:assert/strict';

const { createIdeaSketchEditorState, ideaSketchReducer } = await import('../src/lib/ideaSketchReducer.ts');

function page(id, title = id) {
  return { id, title, elements: [], appState: {}, files: {} };
}

function document(pages) {
  return { type: 'ideasketch', formatVersion: '1.0', created: '', modified: '', pages };
}

test('Page selection, title, order, and deterministic delete fallback are document-local', () => {
  let state = createIdeaSketchEditorState(document([page('same', 'One'), page('two', 'Two')]), 'same');
  state = ideaSketchReducer(state, { type: 'RENAME_PAGE', pageId: 'same', title: 'Overview' });
  state = ideaSketchReducer(state, { type: 'REORDER_PAGE', pageId: 'two', toIndex: 0 });
  state = ideaSketchReducer(state, { type: 'DELETE_PAGE', pageId: 'same' });
  assert.deepEqual(state.document.pages.map((item) => [item.id, item.title]), [['two', 'Two']]);
  assert.equal(state.activePageId, 'two');

  const other = createIdeaSketchEditorState(document([page('same', 'Other document')]), 'same');
  assert.equal(other.document.pages[0].title, 'Other document');
});

test('the last Page cannot be removed', () => {
  const state = createIdeaSketchEditorState(document([page('only')]));
  assert.equal(ideaSketchReducer(state, { type: 'DELETE_PAGE', pageId: 'only' }), state);
});

test('scene commits require matching Page identity and preserve the Page title', () => {
  const state = createIdeaSketchEditorState(document([page('page-a', 'Named')]));
  const ignored = ideaSketchReducer(state, { type: 'UPDATE_PAGE_SCENE', pageId: 'page-a', page: { ...page('wrong'), elements: [{ id: 'x' }] } });
  assert.equal(ignored, state);
  const next = ideaSketchReducer(state, { type: 'UPDATE_PAGE_SCENE', pageId: 'page-a', page: { ...page('page-a'), elements: [{ id: 'x' }] } });
  assert.equal(next.document.pages[0].title, 'Named');
  assert.equal(next.document.pages[0].elements[0].id, 'x');

  const flushedPage = { ...page('page-a', 'Named'), elements: [{ id: 'saved' }] };
  const identity = ideaSketchReducer(state, { type: 'UPDATE_PAGE_SCENE', pageId: 'page-a', page: flushedPage });
  assert.equal(identity.document.pages[0], flushedPage);
});
