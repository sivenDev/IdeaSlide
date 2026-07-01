import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('EditorLayout removes the bottom preview shell from the default editor path', async () => {
  const source = await readSource('src/components/EditorLayout.tsx');

  assert.doesNotMatch(source, /from "\.\/SlidePreviewPanel"/);
  assert.doesNotMatch(source, /from "\.\/CameraList"/);
  assert.doesNotMatch(source, /from "\.\/ResizableDivider"/);
  assert.doesNotMatch(source, /from "\.\/ui\/Tabs"/);
  assert.doesNotMatch(source, /showPreview/);
  assert.doesNotMatch(source, /bottomTab/);
  assert.doesNotMatch(source, /useSlideThumbnails/);
  assert.doesNotMatch(source, /useCameraThumbnails/);
  assert.doesNotMatch(source, /SlidePreviewPanel/);
  assert.doesNotMatch(source, /CameraList/);
  assert.doesNotMatch(source, /ResizableDivider/);
  assert.doesNotMatch(source, /<Tabs/);
});

test('EditorLayout captures all save shortcuts before Excalidraw can export native files', async () => {
  const source = await readSource('src/components/EditorLayout.tsx');

  assert.match(source, /e\.key\.toLowerCase\(\) === "s"/);
  assert.match(source, /window\.addEventListener\("keydown", handleKeyDown, true\)/);
  assert.match(source, /window\.removeEventListener\("keydown", handleKeyDown, true\)/);
  assert.doesNotMatch(source, /e\.key === "s"/);
});

test('Toolbar keeps slide actions inside compact slide rows for the previewless editor shell', async () => {
  const source = await readSource('src/components/Toolbar.tsx');

  assert.match(source, /const slideSummaryLabel =/);
  assert.match(source, /slideSummaryLabel/);
  assert.match(source, /Slide\s*<\/span>/);
  assert.match(source, /Delete slide \$\{index \+ 1\}/);
  assert.match(source, /onClick=\{\(e\) => \{/);
  assert.match(source, /e\.stopPropagation\(\)/);
  assert.match(source, /onDeleteSlide\(index\)/);
  assert.match(source, /Add Slide/);
  assert.doesNotMatch(source, /Previous/);
  assert.doesNotMatch(source, /Next/);
  assert.doesNotMatch(source, /Delete Current Slide/);
});

test('Toolbar keeps a delete control in each slide row even for a single-slide document', async () => {
  const source = await readSource('src/components/Toolbar.tsx');

  assert.match(source, /aria-label=\{`Delete slide \$\{index \+ 1\}`\}/);
  assert.match(source, /className="rounded px-1\.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"/);
  assert.match(source, /disabled=\{!hasMultipleSlides\}/);
  assert.doesNotMatch(source, /\{hasMultipleSlides \? \(/);
});

test('Toolbar keeps slide and camera triggers compact in the previewless editor shell', async () => {
  const source = await readSource('src/components/Toolbar.tsx');

  assert.match(source, /aria-label="Slide"[\s\S]*?className="gap-1\.5 px-2"/);
  assert.match(source, /aria-label="Slide"[\s\S]*?<span className="text-xs font-medium">Slide<\/span>/);
  assert.match(source, /aria-label="Slide"[\s\S]*?className="rounded-full bg-white\/80 px-1\.5 py-0\.5 text-\[11px\] font-semibold text-blue-700"/);
  assert.match(source, /aria-label="Cameras"[\s\S]*?className="gap-1\.5 px-2"/);
  assert.match(source, /aria-label="Cameras"[\s\S]*?<span className="text-xs font-medium">Cameras<\/span>/);
  assert.match(source, /aria-label="Cameras"[\s\S]*?className="rounded-full bg-white\/80 px-1\.5 py-0\.5 text-\[11px\] font-semibold text-blue-700"/);
  assert.doesNotMatch(source, /aria-label="Slide"[\s\S]*?className="gap-2"/);
  assert.doesNotMatch(source, /aria-label="Cameras"[\s\S]*?className="gap-2"/);
  assert.doesNotMatch(source, /aria-label="Slide"[\s\S]*?px-2 py-0\.5 text-xs/);
  assert.doesNotMatch(source, /aria-label="Cameras"[\s\S]*?px-2 py-0\.5 text-xs/);
});

test('Toolbar keeps slide trigger badge compact without repeating the Slide label', async () => {
  const source = await readSource('src/components/Toolbar.tsx');

  assert.match(source, /const slideSummaryLabel = hasMultipleSlides[\s\S]*?\? `\$\{currentSlideIndex \+ 1\} \/ \$\{slideCount\}`[\s\S]*?: String\(currentSlideIndex \+ 1\)/);
  assert.doesNotMatch(source, /const slideSummaryLabel = hasMultipleSlides[\s\S]*?\? `\$\{currentSlideLabel\} \/ \$\{slideCount\}`/);
});

test('Toolbar keeps camera trigger width stable across slides with different camera counts', async () => {
  const source = await readSource('src/components/Toolbar.tsx');

  assert.match(source, /const cameraCountLabel = String\(cameras\.length\)/);
  assert.match(source, /aria-label="Cameras"[\s\S]*?<span className="rounded-full bg-white\/80 px-1\.5 py-0\.5 text-\[11px\] font-semibold text-blue-700">[\s\S]*?\{cameraCountLabel\}[\s\S]*?<\/span>/);
  assert.doesNotMatch(source, /\{cameras\.length > 0 \? \(/);
});
