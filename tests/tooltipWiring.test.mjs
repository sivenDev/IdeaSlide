import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('CameraList wires action buttons through the shared Tooltip primitives', async () => {
  const source = await readSource('src/components/CameraList.tsx');

  assert.match(source, /from "\.\/ui\/Tooltip"/);
  assert.match(source, /TooltipProvider/);
  assert.match(source, /TooltipTrigger/);
  assert.match(source, /TooltipContent/);
});

test('SlidePreviewPanel wires action buttons through the shared Tooltip primitives', async () => {
  const source = await readSource('src/components/SlidePreviewPanel.tsx');

  assert.match(source, /from "\.\/ui\/Tooltip"/);
  assert.match(source, /TooltipProvider/);
  assert.match(source, /TooltipTrigger/);
  assert.match(source, /TooltipContent/);
  assert.doesNotMatch(source, /<TooltipContent>Add slide<\/TooltipContent>/);
});

test('Toolbar wires icon actions through the shared Tooltip primitives instead of native titles', async () => {
  const source = await readSource('src/components/Toolbar.tsx');

  assert.match(source, /from "\.\/ui\/ToolbarAction"/);
  assert.match(source, /<ToolbarAction/);
  assert.match(source, /from "\.\/ui\/Tooltip"/);
  assert.match(source, /TooltipProvider/);
  assert.doesNotMatch(source, /title="/);
});

test('Toolbar leaves Add slide and Present without hover tips', async () => {
  const source = await readSource('src/components/Toolbar.tsx');

  assert.doesNotMatch(source, /tooltip="Add slide"/);
  assert.doesNotMatch(source, /tooltip="Present"/);
});

test('ToolbarAction owns the shared tooltip wiring and variant styling', async () => {
  const source = await readSource('src/components/ui/ToolbarAction.tsx');

  assert.match(source, /from "\.\/Tooltip"/);
  assert.match(source, /TooltipTrigger/);
  assert.match(source, /TooltipContent/);
  assert.match(source, /variant = "icon"/);
  assert.match(source, /primary/);
  assert.match(source, /secondary/);
});

test('shared DropdownMenu exposes the unified shell, motion, and item state styling', async () => {
  const source = await readSource('src/components/ui/DropdownMenu.tsx');

  assert.match(source, /bg-white\/95/);
  assert.match(source, /backdrop-blur/);
  assert.match(source, /data-\[state=open\]:animate-in/);
  assert.match(source, /data-\[side=top\]:slide-in-from-bottom-1/);
  assert.match(source, /focus:bg-gray-100/);
  assert.match(source, /data-\[highlighted\]:text-gray-950/);
});

test('shared Tooltip exposes the unified shell, motion, and arrow styling', async () => {
  const source = await readSource('src/components/ui/Tooltip.tsx');

  assert.match(source, /TooltipPrimitive\.Arrow/);
  assert.match(source, /delayDuration/);
  assert.match(source, /skipDelayDuration/);
  assert.match(source, /data-\[state=delayed-open\]:animate-in/);
  assert.match(source, /data-\[side=top\]:slide-in-from-bottom-1/);
});

test('shared Tabs trigger exposes consistent hover, focus, and active state classes', async () => {
  const source = await readSource('src/components/ui/Tabs.tsx');

  assert.match(source, /hover:bg-white\/70/);
  assert.match(source, /data-\[state=active\]:shadow-sm/);
  assert.match(source, /data-\[state=active\]:text-gray-900/);
  assert.match(source, /focus-visible:ring-offset-0/);
});
