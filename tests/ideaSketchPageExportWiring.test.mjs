import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Page interchange lives below navigation with read-only-safe exports and a disabled import', async () => {
  const commands = await readSource('src/components/IdeaSketchDrawerCommands.tsx');

  // All three interchange controls are clearly labeled inside the lower command grid.
  assert.match(commands, /Import Excalidraw/);
  assert.match(commands, /Export Excalidraw/);
  assert.match(commands, /Export \.is/);

  // Import is a Canvas mutation (disabled read-only); both exports only require Canvas readiness.
  assert.match(commands, /disabled=\{readOnly\} onClick=\{onImportExcalidraw\}/);
  assert.match(commands, /disabled=\{!ready\} onClick=\{onExportExcalidraw\}/);
  assert.match(commands, /disabled=\{!ready\} onClick=\{onExportIdeaSketch\}/);

  // The existing image/draw.io/background/clear ownership is preserved.
  assert.match(commands, /disabled=\{!ready\} onClick=\{onExportImage\}/);
  assert.match(commands, /disabled=\{!ready\} onClick=\{onExportDrawio\}/);
  assert.match(commands, /disabled=\{readOnly \|\| !ready\} onClick=\{onClearCanvas\}/);
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
