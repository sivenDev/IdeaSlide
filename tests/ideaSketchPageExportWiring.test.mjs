import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Page interchange lives below navigation with read-only-safe exports and a disabled import', async () => {
  const commands = await readSource('src/components/IdeaSketchDrawerCommands.tsx');

  // Commands are split into labeled Page and Canvas groups (no truncating 2-column grid).
  assert.match(commands, /role="group"\s*\n?\s*aria-label="Page"/);
  assert.match(commands, /role="group"\s*\n?\s*aria-label="Canvas"/);
  assert.doesNotMatch(commands, /__grid/);

  // All three interchange controls are present with full, untruncated labels.
  assert.match(commands, /label="Import Excalidraw"/);
  assert.match(commands, /label="Export Excalidraw"/);
  assert.match(commands, /label="Export \.is"/);

  // Import is a Canvas mutation (disabled read-only); both exports only require Canvas readiness.
  assert.match(commands, /label="Import Excalidraw"[\s\S]*?disabled=\{readOnly\}[\s\S]*?onClick=\{onImportExcalidraw\}/);
  assert.match(commands, /label="Export Excalidraw"[\s\S]*?disabled=\{!ready\}[\s\S]*?onClick=\{onExportExcalidraw\}/);
  assert.match(commands, /label="Export \.is"[\s\S]*?disabled=\{!ready\}[\s\S]*?onClick=\{onExportIdeaSketch\}/);

  // The existing image/draw.io/background/clear ownership and gating is preserved.
  assert.match(commands, /label="Export image"[\s\S]*?disabled=\{!ready\}[\s\S]*?onClick=\{onExportImage\}/);
  assert.match(commands, /label="Export draw\.io"[\s\S]*?disabled=\{!ready\}[\s\S]*?onClick=\{onExportDrawio\}/);
  assert.match(commands, /const backgroundDisabled = readOnly \|\| !ready/);
  assert.match(commands, /Canvas background[\s\S]*?disabled=\{backgroundDisabled\}/);
  assert.match(commands, /label="Clear canvas"[\s\S]*?disabled=\{readOnly \|\| !ready\}[\s\S]*?onClick=\{onClearCanvas\}/);

  // Every control carries a full hover/focus tooltip describing what it does.
  assert.match(commands, /import \{[\s\S]*?TooltipProvider[\s\S]*?\} from "\.\/ui\/Tooltip"/);
  assert.match(commands, /<TooltipProvider>/);
  assert.match(commands, /<TooltipTrigger asChild>/);
  assert.match(commands, /<TooltipContent side="right">/);
  assert.match(commands, /description="Export the current Page as a standalone \.is document\."/);
});

test('the Pages toolbar no longer owns any import affordance', async () => {
  const organizer = await readSource('src/components/PageOrganizer.tsx');
  const navigator = await readSource('src/components/IdeaSketchNavigator.tsx');

  assert.doesNotMatch(organizer, /ImportMenu|Import Page|onImport/);
  assert.doesNotMatch(navigator, /onPageImport|onImport=/);
});

test('the editor routes the relocated import and both live-Page export coordinators', async () => {
  const editor = await readSource('src/components/IdeaSketchEditor.tsx');

  assert.match(editor, /import \{ exportPageAsExcalidraw, exportPageAsIdeaSketch \} from "\.\.\/lib\/ideaSketchPageExport"/);
  assert.match(editor, /onImportExcalidraw=\{importPage\}/);
  assert.match(editor, /onExportExcalidraw=\{exportActivePageAsExcalidraw\}/);
  assert.match(editor, /onExportIdeaSketch=\{exportActivePageAsIdeaSketch\}/);
  assert.doesNotMatch(editor, /onPageImport/);
});

test('current-Page exports flush the live draft, resolve the active Page, and never dirty the document', async () => {
  const editor = await readSource('src/components/IdeaSketchEditor.tsx');

  // A shared resolver flushes the live draft, then reads the active Page from editor state.
  assert.match(editor, /const resolveActivePageForExport = useCallback\(\(\) => \{[\s\S]*?flushAndGetDocument\(\)/);
  assert.match(editor, /const resolveActivePageForExport = useCallback\(\(\) => \{[\s\S]*?editorStateRef\.current\.activePageId/);

  // Cancellation is silent; genuine failures surface through the shared error reporter.
  assert.match(editor, /const reportExportError = useCallback\(async \(error: unknown\) => \{[\s\S]*?isDesktopOperationCancelled\(error\)/);
  assert.match(editor, /exportActivePageAsExcalidraw = useCallback\(async \(\) => \{[\s\S]*?await exportPageAsExcalidraw\(page\)/);
  assert.match(editor, /exportActivePageAsIdeaSketch = useCallback\(async \(\) => \{[\s\S]*?await exportPageAsIdeaSketch\(page\)/);
  assert.match(editor, /if \(result\.status === "cancelled"\) return;/);

  // The export callback region projects through the read path and dispatches no model mutation.
  const exportRegion = editor.slice(
    editor.indexOf('const resolveActivePageForExport'),
    editor.indexOf('const handleApiReady'),
  );
  assert.ok(exportRegion.length > 0);
  assert.doesNotMatch(exportRegion, /applyAction|MARK_DIRTY|markDirty|onModelChange/);
});
