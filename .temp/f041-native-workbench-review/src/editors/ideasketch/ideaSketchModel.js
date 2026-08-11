export function ensureIdeaSketchModel(content) {
  const pages = content?.pages?.length ? content.pages : [{ id: crypto.randomUUID(), name: "Page 1", elements: [] }];
  return { pages, cameras: content?.cameras ?? [], activePageId: content?.activePageId && pages.some((page) => page.id === content.activePageId) ? content.activePageId : pages[0].id };
}

export function moveItem(items, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function describeSketch(model) {
  return {
    pages: model.pages.map((page) => ({ id: page.id, name: page.name, elements: page.elements.length })),
    cameras: model.cameras.map((camera) => ({ id: camera.id, name: camera.name, pageId: camera.pageId })),
    activePageId: model.activePageId,
  };
}
