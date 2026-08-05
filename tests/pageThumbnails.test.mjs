import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('Page thumbnail exporter stays in the main WebView and emits bounded PNG blobs', async () => {
  const source = await readSource('src/lib/pageThumbnailExport.ts');
  assert.match(source, /exportToBlob/);
  assert.match(source, /PAGE_THUMBNAIL_MAX_DIMENSION = 440/);
  assert.match(source, /mimeType: "image\/png"/);
  assert.match(source, /maxWidthOrHeight: PAGE_THUMBNAIL_MAX_DIMENSION/);
  assert.doesNotMatch(source, /previewRenderer|emit\(|listen\(|WebviewWindow/);
});

test('Page thumbnail hook only schedules visible demand and debounces the active draft', async () => {
  const source = await readSource('src/hooks/usePageThumbnails.ts');
  assert.match(source, /ACTIVE_PAGE_THUMBNAIL_DEBOUNCE_MS = 650/);
  assert.match(source, /buildSlidePreviewKey/);
  assert.match(source, /demands/);
  assert.match(source, /setTransient/);
  assert.match(source, /scheduler\.replace/);
  assert.doesNotMatch(source, /useSlideThumbnails|previewRendererClient|renderSlides/);
});

test('Page organizer defaults to Name view and virtualizes both presentations', async () => {
  const source = await readSource('src/components/PageOrganizer.tsx');
  assert.match(source, /type PageViewMode = "name" \| "thumbnail"/);
  assert.match(source, /useState<PageViewMode>\("name"\)/);
  assert.match(source, /useVirtualizer/);
  assert.match(source, /overscan: 4/);
  assert.match(source, /aria-label="Name view"/);
  assert.match(source, /aria-label="Thumbnail view"/);
  assert.match(source, /aria-pressed=/);
  assert.match(source, /loading="lazy"/);
  assert.match(source, /decoding="async"/);
  assert.match(source, /viewMode === "thumbnail"/);
  assert.match(source, /buildPageThumbnailDemands/);
});

test('active editor draft is forwarded without changing Page persistence ownership', async () => {
  const navigator = await readSource('src/components/IdeaSketchNavigator.tsx');
  const editor = await readSource('src/components/IdeaSketchEditor.tsx');
  assert.match(navigator, /activePageDraft/);
  assert.match(navigator, /activeDraft=\{activePageDraft\}/);
  assert.match(editor, /activePageDraft=\{draft\}/);
  assert.match(editor, /applyAction\(\{ type: "SELECT_PAGE", pageId \}, false\)/);
});
