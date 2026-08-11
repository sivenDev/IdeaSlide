import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('CameraList exposes accessible labels for compact sidebar actions', async () => {
  const source = await readSource('src/components/CameraList.tsx');

  assert.match(source, /aria-label=\{"Move up camera " \+ camera\.order\}/);
  assert.match(source, /aria-label=\{"Move down camera " \+ camera\.order\}/);
  assert.match(source, /aria-label=\{"Delete camera " \+ camera\.order\}/);
  assert.doesNotMatch(source, /title=/);
});

test('SlidePreviewPanel wires action buttons through the shared Tooltip primitives', async () => {
  const source = await readSource('src/components/SlidePreviewPanel.tsx');

  assert.match(source, /from "\.\/ui\/Tooltip"/);
  assert.match(source, /TooltipProvider/);
  assert.match(source, /TooltipTrigger/);
  assert.match(source, /TooltipContent/);
  assert.doesNotMatch(source, /<TooltipContent>Add slide<\/TooltipContent>/);
});

test('workbench crown exposes direct accessible labels for panel and document actions', async () => {
  const source = await readSource('src/components/WorkbenchCrown.tsx');

  assert.match(source, /aria-label="Show Workspaces"/);
  assert.match(source, /aria-label="Show Agent"/);
  assert.match(source, /Close \$\{document\.displayName\}/);
  assert.doesNotMatch(source, /ToolbarAction|DropdownMenu/);
});

test('ResizableDivider uses the shared Tooltip for dynamic panel guidance', async () => {
  const source = await readSource('src/components/ResizableDivider.tsx');

  assert.match(source, /from "\.\/ui\/Tooltip"/);
  assert.match(source, /TooltipProvider/);
  assert.match(source, /TooltipTrigger asChild/);
  assert.match(source, /<TooltipContent[^>]*>\{tooltipLabel\}<\/TooltipContent>/);
  assert.match(source, /panelLabel\?: string/);
  assert.match(source, /panelLabel \?\? \(isLeft \? "workspace" : "navigator"\)/);
  assert.match(source, /`\$\{isVisible \? "Hide" : "Show"\} \$\{panelName\}`/);
  assert.match(source, /aria-label=\{tooltipLabel\}/);
  assert.doesNotMatch(source, /title=/);
});

test('workbench crown does not expose presentation or save actions', async () => {
  const source = await readSource('src/components/WorkbenchCrown.tsx');

  assert.doesNotMatch(source, /Present/);
  assert.doesNotMatch(source, /onStartPreview/);
  assert.doesNotMatch(source, /aria-label="Save"|Save As/);
});

test('CameraList keeps the Add camera tooltip on its header action', async () => {
  const source = await readSource('src/components/CameraList.tsx');

  assert.match(source, /from "\.\/ui\/Tooltip"/);
  assert.match(source, /TooltipProvider/);
  assert.match(source, /TooltipTrigger/);
  assert.match(source, /TooltipContent/);
  assert.match(source, /<TooltipContent>Add camera<\/TooltipContent>/);
  assert.doesNotMatch(source, /title=/);
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

test('shared DropdownMenu disables modal focus trapping so sibling triggers can switch menus in one click', async () => {
  const source = await readSource('src/components/ui/DropdownMenu.tsx');

  assert.match(source, /DropdownMenuPrimitive\.Root/);
  assert.match(source, /modal=\{false\}/);
  assert.doesNotMatch(source, /export const DropdownMenu = DropdownMenuPrimitive\.Root/);
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
