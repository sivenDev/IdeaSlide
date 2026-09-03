import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import {
  captureIdeaSketchHostScene,
  commitIdeaSketchHostScene,
  createIdeaSketchNativeActionOwnership,
  createIdeaSketchSceneCommitSettlements,
  deriveLiveNativeInteractionReasons,
  mergeActiveSceneIntoDocument,
  mergeIdeaSketchNativeNormalizedElements,
} from '../src/lib/ideasketch-sdk/editorHostAdapter.ts';
import { createIdeaSketchSdkHostRegistrationLifecycle } from '../src/lib/ideasketch-sdk/host.ts';

const source = await readFile(new URL('../src/components/IdeaSketchEditor.tsx', import.meta.url), 'utf8');
const registrySource = await readFile(new URL('../src/lib/editorRegistry.tsx', import.meta.url), 'utf8');
const canvasSource = await readFile(new URL('../src/components/SlideCanvas.tsx', import.meta.url), 'utf8');
const excalidrawPatchSource = await readFile(
  new URL('../scripts/patch-excalidraw-paste-lifecycle.mjs', import.meta.url),
  'utf8',
);
const excalidrawDevelopmentSource = await readFile(
  new URL('../node_modules/@excalidraw/excalidraw/dist/dev/index.js', import.meta.url),
  'utf8',
);
const excalidrawProductionSource = await readFile(
  new URL('../node_modules/@excalidraw/excalidraw/dist/prod/index.js', import.meta.url),
  'utf8',
);

test('IdeaSketch editor binds Excalidraw drafts to document and Page identity', () => {
  const canvas = source.match(/<SlideCanvas\n[\s\S]*?\/>/)?.[0] ?? '';

  assert.match(source, /documentSessionId: document\.id/);
  assert.match(source, /page: activePage/);
  assert.match(source, /sessionId !== document\.id/);
  assert.match(source, /payload\.slide\.id !== pageId/);
  assert.match(source, /onRegisterSnapshot/);
  assert.match(canvas, /key=\{draft\.slideId\}/);
  assert.match(canvas, /slideId=\{draft\.slideId\}/);
  assert.match(canvas, /elements=\{draft\.elements\}/);
  assert.match(canvas, /appState=\{draft\.appState\}/);
  assert.match(canvas, /files=\{draft\.files\}/);
  assert.match(canvas, /pageTitle=\{activePage\.title\}/);
  assert.doesNotMatch(canvas, /slideId=\{activePage\.id\}/);
  assert.match(canvas, /onInteractionChange=\{handleCanvasInteractionChange\}/);
  assert.match(canvas, /onNativeInteractionChange=\{handleNativeInteractionChange\}/);
  assert.match(source, /const \[canvasInteractionActive, setCanvasInteractionActive\] = useState\(false\);/);
  assert.match(source, /setCanvasInteractionActive\(\(current\) => current === active \? current : active\)/);
  assert.match(source, /createIdeaSketchSdkHostRegistrationLifecycle/);
  assert.match(source, /sdkHostRegistration\.mount\(createSdkHostTarget\)/);
  assert.match(registrySource, /<IdeaSketchEditor\s+key=\{document\.id\}/);
  assert.doesNotMatch(source, /sdkHostTargetProviderRef\.current\s*=/);
  assert.match(source, /sdkNativeInteractionRef/);
  assert.match(source, /epoch: current\.epoch \+ 1/);
  assert.match(source, /const previousEditVersion = getEditVersion\(\);[\s\S]*?updateDraft\(elements, appState, files\);[\s\S]*?getEditVersion\(\) === previousEditVersion/);
});

test('native action ownership keeps the SDK busy until every exact owner settles', () => {
  const ownership = createIdeaSketchNativeActionOwnership();
  const first = ownership.begin();
  const second = ownership.begin();

  assert.equal(ownership.isActive(), true);
  assert.equal(ownership.settle(first), false);
  assert.equal(ownership.isActive(), true);
  assert.equal(ownership.settle(first), false);
  assert.equal(ownership.settle(second), true);
  assert.equal(ownership.isActive(), false);
});

test('native action cleanup invalidates stale completions across host replacement', () => {
  const ownership = createIdeaSketchNativeActionOwnership();
  const stale = ownership.begin();

  assert.equal(ownership.clear(), true);
  assert.equal(ownership.clear(), false);
  assert.equal(ownership.settle(stale), false);
  assert.equal(ownership.isActive(), false);

  const current = ownership.begin();
  assert.equal(ownership.settle(stale), false);
  assert.equal(ownership.isActive(), true);
  assert.equal(ownership.settle(current), true);
});

test('scene commit settlements acknowledge exact commits and reject host replacement', async () => {
  const settlements = createIdeaSketchSceneCommitSettlements();
  const first = settlements.begin();
  const second = settlements.begin();
  let firstSettled = false;
  let secondSettled = false;
  void first.promise.then(() => { firstSettled = true; });
  void second.promise.then(() => { secondSettled = true; }, () => { secondSettled = true; });

  assert.equal(first.acknowledge(), true);
  await first.promise;
  assert.equal(firstSettled, true);
  assert.equal(secondSettled, false);
  assert.equal(first.acknowledge(), false);

  const rejected = assert.rejects(second.promise, /Canvas replaced/);
  assert.equal(settlements.clear(new Error('Canvas replaced')), true);
  await rejected;
  assert.equal(secondSettled, true);
  assert.equal(second.acknowledge(), false);
  assert.equal(settlements.clear(), false);
});

test('native Paste lifecycle is owned by the patched Excalidraw handler, not arbitrary onChange', () => {
  assert.match(canvasSource, /onPasteLifecycle=\{viewMode \? undefined : handlePasteLifecycle\}/);
  assert.match(canvasSource, /if \(payload\.phase === "start"\) return beginNativeAction\(\)/);
  assert.match(canvasSource, /finishNativeAction\(payload\.token as IdeaSketchNativeActionToken\)/);
  assert.doesNotMatch(canvasSource, /onPasteCapture=/);
  assert.doesNotMatch(canvasSource, /if \(persisted\) finishNativeAction/);

  assert.match(excalidrawPatchSource, /this\.state\.viewModeEnabled/);
  assert.match(excalidrawPatchSource, /phase: "start"/);
  assert.match(excalidrawPatchSource, /phase: "end"/);
  assert.match(excalidrawPatchSource, /finally/);
  assert.match(excalidrawPatchSource, /await this\.insertImageElement/);
  assert.match(excalidrawPatchSource, /return await this\.addElementsFromMixedContentPaste/);
  assert.match(excalidrawPatchSource, /await this\.addElementsFromPasteOrLibrary/);
  assert.match(excalidrawPatchSource, /await imageCacheReady/);
  assert.match(excalidrawPatchSource, /await this\.waitForPasteCommit/);
  assert.match(excalidrawPatchSource, /await app\.pasteFromClipboard/);
  assert.match(excalidrawPatchSource, /await app\.endPasteLifecycle/);
  assert.match(excalidrawPatchSource, /unstable_batchedUpdates2\(\(\) => func\(event, \.\.\.args\)\)/);
  assert.match(excalidrawPatchSource, /await rm\(viteDependencyCache/);
  const developmentPasteHandler = excalidrawDevelopmentSource.slice(
    excalidrawDevelopmentSource.indexOf('__publicField(this, "pasteFromClipboard"'),
    excalidrawDevelopmentSource.indexOf('__publicField(this, "addElementsFromPasteOrLibrary"'),
  );
  assert.ok(
    developmentPasteHandler.indexOf('this.state.viewModeEnabled')
      < developmentPasteHandler.indexOf('this.beginPasteLifecycle'),
  );
  assert.ok(
    developmentPasteHandler.indexOf('return await this.addElementsFromMixedContentPaste')
      < developmentPasteHandler.lastIndexOf('await this.endPasteLifecycle'),
  );
  assert.match(excalidrawDevelopmentSource, /await app\.pasteFromClipboard\(createPasteEvent\(\{ types \}\), \{/);
  assert.match(excalidrawDevelopmentSource, /const pasteLifecycleToken = app\.beginPasteLifecycle\(null\)/);
  assert.match(excalidrawDevelopmentSource, /await app\.endPasteLifecycle\(null, pasteLifecycleToken\)/);
  for (const bundledSource of [excalidrawDevelopmentSource, excalidrawProductionSource]) {
    assert.match(bundledSource, /onPasteLifecycle/);
    assert.match(bundledSource, /phase:\s*"start"/);
    assert.match(bundledSource, /phase:\s*"end"/);
    assert.match(bundledSource, /await this\.insertImageElement/);
    assert.match(bundledSource, /return await this\.addElementsFromMixedContentPaste/);
    assert.match(bundledSource, /await (?:imageCacheReady|pasteImageCacheReady)/);
    assert.match(bundledSource, /onCommit/);
  }
});

test('Vite runtime keeps Paste busy through onChange and context-menu clipboard reads', async (context) => {
  if (!existsSync(chromium.executablePath())) {
    context.skip('Playwright Chromium is not installed');
    return;
  }

  const server = await createServer({
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
    plugins: [{
      name: 'f073-paste-lifecycle-harness',
      configureServer(viteServer) {
        viteServer.middlewares.use(async (request, response, next) => {
          if (request.url !== '/__f073-paste-lifecycle') {
            next();
            return;
          }
          const html = await viteServer.transformIndexHtml(request.url, `
            <!doctype html>
            <html>
              <head><meta charset="UTF-8"></head>
              <body style="margin:0"><div id="root" style="width:100vw;height:100vh"></div></body>
              <script type="module" src="/tests/fixtures/ideaSketchPasteLifecycleHarness.jsx"></script>
            </html>
          `);
          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/html');
          response.end(html);
        });
      },
    }],
  });
  let browser;
  try {
    await server.listen();
    const address = server.httpServer?.address();
    assert.ok(address && typeof address === 'object');
    const origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true });
    const browserContext = await browser.newContext({ viewport: { width: 1000, height: 700 } });
    await browserContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    const page = await browserContext.newPage();
    page.setDefaultTimeout(90_000);
    await page.goto(`${origin}/__f073-paste-lifecycle`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__pasteHarnessReady === true);
    const canvas = page.locator('.excalidraw__canvas.interactive');
    const box = await canvas.boundingBox();
    assert.ok(box);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    await page.evaluate(async () => {
      window.__pasteLifecycleEvents.length = 0;
      const app = window.h.app;
      const interactiveCanvas = document.querySelector('.excalidraw__canvas.interactive');
      app.excalidrawContainerRef.current.focus();
      const elementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => interactiveCanvas;
      try {
        const clipboard = new DataTransfer();
        clipboard.setData('text/plain', 'Lifecycle text');
        await app.pasteFromClipboard(new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: clipboard,
        }));
      } finally {
        document.elementFromPoint = elementFromPoint;
      }
    });
    const pasteEvents = await page.evaluate(() => window.__pasteLifecycleEvents);
    const startIndex = pasteEvents.findIndex((event) => event.phase === 'start');
    const persistedChangeIndex = pasteEvents.findIndex(
      (event) => event.phase === 'change' && event.text.includes('Lifecycle text'),
    );
    const endIndex = pasteEvents.findIndex((event) => event.phase === 'end');
    assert.ok(startIndex >= 0);
    assert.ok(persistedChangeIndex > startIndex);
    assert.ok(endIndex > persistedChangeIndex);
    assert.equal(pasteEvents[endIndex].tokenMatches, true);

    await page.evaluate(() => {
      window.__pasteLifecycleEvents.length = 0;
      const app = window.h.app;
      const nextElements = app.scene.getElementsIncludingDeleted().map((element, index) => (
        index === 0
          ? { ...element, x: element.x + 20, version: element.version + 1, versionNonce: element.versionNonce + 1 }
          : element
      ));
      app.updateScene({
        elements: nextElements,
        onCommit: () => window.__pasteLifecycleEvents.push({ phase: 'sdk-commit' }),
      });
    });
    await page.waitForFunction(() => window.__pasteLifecycleEvents.some((event) => event.phase === 'sdk-commit'));
    const sdkCommitEvents = await page.evaluate(() => window.__pasteLifecycleEvents);
    assert.ok(sdkCommitEvents.findIndex((event) => event.phase === 'change') >= 0);
    assert.ok(
      sdkCommitEvents.findIndex((event) => event.phase === 'sdk-commit')
        > sdkCommitEvents.findIndex((event) => event.phase === 'change'),
    );

    await page.evaluate(() => {
      window.__pasteLifecycleEvents.length = 0;
      let rejectRead;
      const blockedRead = new Promise((_resolve, reject) => {
        rejectRead = reject;
      });
      window.__rejectClipboardRead = () => rejectRead(new DOMException('cancelled', 'AbortError'));
      const pendingRead = () => blockedRead;
      Object.defineProperty(navigator.clipboard, 'read', { configurable: true, value: pendingRead });
      Object.defineProperty(navigator.clipboard, 'readText', { configurable: true, value: pendingRead });
    });
    await page.evaluate(() => {
      const { actionManager } = window.h.app;
      actionManager.executeAction(actionManager.actions.paste, 'contextMenu');
    });
    await page.waitForFunction(() => window.__pasteLifecycleEvents.some((event) => event.phase === 'start'));
    assert.equal(
      await page.evaluate(() => window.__pasteLifecycleEvents.some((event) => event.phase === 'end')),
      false,
    );
    await page.evaluate(() => window.__rejectClipboardRead());
    await page.waitForFunction(() => window.__pasteLifecycleEvents.some((event) => event.phase === 'end'));
    const contextMenuEvents = await page.evaluate(() => window.__pasteLifecycleEvents);
    assert.deepEqual(contextMenuEvents.map((event) => event.phase), ['start', 'change', 'end']);
    assert.equal(contextMenuEvents.at(-1).tokenMatches, true);

    await page.evaluate(async () => {
      window.__pasteLifecycleEvents.length = 0;
      const clipboardItem = {
        types: ['text/plain'],
        getType: async () => new Blob(['Context menu lifecycle text'], { type: 'text/plain' }),
      };
      Object.defineProperty(navigator.clipboard, 'read', {
        configurable: true,
        value: async () => [clipboardItem],
      });
      Object.defineProperty(navigator.clipboard, 'readText', {
        configurable: true,
        value: async () => 'Context menu lifecycle text',
      });
      const app = window.h.app;
      const interactiveCanvas = document.querySelector('.excalidraw__canvas.interactive');
      const elementFromPoint = document.elementFromPoint;
      app.excalidrawContainerRef.current.focus();
      document.elementFromPoint = () => interactiveCanvas;
      window.__restoreElementFromPoint = () => {
        document.elementFromPoint = elementFromPoint;
      };
      app.actionManager.executeAction(app.actionManager.actions.paste, 'contextMenu');
    });
    await page.waitForFunction(() => window.__pasteLifecycleEvents.some(
      (event) => event.phase === 'change' && event.text.includes('Context menu lifecycle text'),
    ));
    await page.waitForFunction(() => window.__pasteLifecycleEvents.some((event) => event.phase === 'end'));
    const successfulContextMenuEvents = await page.evaluate(() => window.__pasteLifecycleEvents);
    assert.deepEqual(
      successfulContextMenuEvents.map((event) => event.phase),
      ['start', 'change', 'end'],
    );
    assert.equal(successfulContextMenuEvents.filter((event) => event.phase === 'start').length, 1);
    assert.equal(successfulContextMenuEvents.filter((event) => event.phase === 'end').length, 1);
    assert.equal(successfulContextMenuEvents.at(-1).tokenMatches, true);
    await page.evaluate(() => window.__restoreElementFromPoint?.());
  } finally {
    await browser?.close();
    await server.close();
  }
});

test('the editor host adapter excludes Camera preview from scene and document capture', () => {
  const activeCameraPreviewId = 'camera-preview:opaque-host-token';
  const page = {
    id: 'page-1',
    title: 'Page 1',
    elements: [{ id: 'persisted' }],
    appState: { viewBackgroundColor: '#fff' },
    files: {},
  };
  const api = {
    getSceneElementsIncludingDeleted: () => [
      { id: 'shape-1' },
      { id: activeCameraPreviewId },
      { id: 'camera-preview' },
    ],
    getAppState: () => ({ viewBackgroundColor: '#fff', zoom: { value: 2 } }),
    getFiles: () => ({}),
    updateScene: () => {},
  };
  const scene = captureIdeaSketchHostScene({ api, page, activeCameraPreviewId });
  assert.deepEqual(scene.elements, [{ id: 'shape-1' }, { id: 'camera-preview' }]);

  const document = {
    type: 'ideasketch',
    formatVersion: '1.0',
    created: '2026-09-02T00:00:00.000Z',
    modified: '2026-09-02T00:00:00.000Z',
    pages: [page],
  };
  const liveDocument = mergeActiveSceneIntoDocument({
    document,
    activePageId: 'page-1',
    scene,
    mounted: true,
  });
  assert.deepEqual(liveDocument.pages[0].elements, [{ id: 'shape-1' }, { id: 'camera-preview' }]);
});

test('the editor host adapter commits one files-preserving write and preserves ephemeral AppState', () => {
  const updates = [];
  const onCommit = () => {};
  const api = {
    getSceneElementsIncludingDeleted: () => [],
    getAppState: () => ({}),
    getFiles: () => ({}),
    updateScene: (input) => updates.push(input),
  };
  const files = { asset: { id: 'asset', dataURL: 'data:image/png;base64,AAAA' } };
  commitIdeaSketchHostScene({
    api,
    currentScene: {
      elements: [{ id: 'shape-1', x: 0 }],
      appState: {
        viewBackgroundColor: '#ffffff',
        gridSize: null,
        zoom: { value: 2 },
        selectedElementIds: { 'shape-1': true },
        activeTool: { type: 'selection' },
      },
      files,
    },
    nextScene: {
      elements: [
        { id: 'shape-1', x: 20 },
        { id: 'camera-preview' },
        { id: 'camera-preview:opaque-host-token' },
      ],
      appState: {
        viewBackgroundColor: '#000000',
        gridSize: 20,
        zoom: { value: 0.25 },
        selectedElementIds: {},
        activeTool: { type: 'text' },
        openDialog: { name: 'imageExport' },
      },
      files: structuredClone(files),
    },
    captureUpdate: 'IMMEDIATELY',
    activeCameraPreviewId: 'camera-preview:opaque-host-token',
    onCommit,
  });

  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0], {
    elements: [{ id: 'shape-1', x: 20 }, { id: 'camera-preview' }],
    appState: {
      viewBackgroundColor: '#000000',
      gridSize: 20,
      selectedElementIds: {},
    },
    captureUpdate: 'IMMEDIATELY',
    onCommit,
  });
  assert.equal('zoom' in updates[0].appState, false);
  assert.deepEqual(updates[0].appState.selectedElementIds, {});
  assert.equal('activeTool' in updates[0].appState, false);
  assert.equal('openDialog' in updates[0].appState, false);

  assert.throws(() => commitIdeaSketchHostScene({
    api,
    currentScene: { elements: [], appState: {}, files: {} },
    nextScene: { elements: [], appState: {}, files: { unexpected: { id: 'unexpected' } } },
    captureUpdate: 'IMMEDIATELY',
  }), /cannot modify files/);
  assert.equal(updates.length, 1);
});

test('native scene normalization preserves unrelated elements and persistent tombstones', () => {
  const unrelated = {
    id: 'unrelated-empty-text',
    type: 'text',
    text: '',
    originalText: '',
    x: 10,
    y: 10,
    width: 0,
    height: 0,
  };
  const tombstone = {
    id: 'deleted-zero-size',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    isDeleted: true,
  };
  const changed = { id: 'changed', type: 'rectangle', x: 20, y: 0, width: 40, height: 30 };
  const normalizedChanged = { ...changed, version: 2, versionNonce: 9, updated: 10 };
  const merged = mergeIdeaSketchNativeNormalizedElements({
    currentElements: [unrelated, tombstone, { ...changed, version: 1, versionNonce: 1, updated: 1 }],
    nextElements: [unrelated, tombstone, changed],
    normalizedElements: [normalizedChanged],
  });
  assert.deepEqual(merged[0], unrelated);
  assert.deepEqual(merged[1], tombstone);
  assert.deepEqual(merged[2], normalizedChanged);
});

test('native scene normalization fails closed when a changed live element is omitted', () => {
  assert.throws(() => mergeIdeaSketchNativeNormalizedElements({
    currentElements: [{ id: 'shape', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 }],
    nextElements: [{ id: 'shape', type: 'rectangle', x: 1, y: 0, width: 10, height: 10 }],
    normalizedElements: [],
  }), /omitted live element/);
});

test('live Excalidraw edit fields contribute to host busy state', () => {
  assert.deepEqual(
    deriveLiveNativeInteractionReasons([], { editingTextElement: { id: 'text-1' } }),
    ['text'],
  );
  assert.deepEqual(
    deriveLiveNativeInteractionReasons(['ime'], {
      selectedElementsAreBeingDragged: true,
      isResizing: true,
      isRotating: true,
    }),
    ['ime', 'pointer'],
  );
});

test('host registration lifecycle survives StrictMode replay and document switches', () => {
  let active;
  const lifecycle = createIdeaSketchSdkHostRegistrationLifecycle((getTarget) => {
    const token = Symbol('registration');
    active = { token, getTarget };
    return () => {
      if (active?.token === token) active = undefined;
    };
  });

  const firstStrictMountCleanup = lifecycle.mount(() => ({
    documentId: 'document-1',
    activePageId: 'page-1',
  }));
  assert.deepEqual(active.getTarget(), { documentId: 'document-1', activePageId: 'page-1' });
  firstStrictMountCleanup();
  assert.equal(active, undefined);

  const secondStrictMountCleanup = lifecycle.mount(() => ({
    documentId: 'document-1',
    activePageId: 'page-1',
  }));
  const staleCleanup = secondStrictMountCleanup;
  const switchedCleanup = lifecycle.mount(() => ({
    documentId: 'document-2',
    activePageId: 'page-2',
  }));
  assert.deepEqual(active.getTarget(), { documentId: 'document-2', activePageId: 'page-2' });
  staleCleanup();
  assert.deepEqual(active.getTarget(), { documentId: 'document-2', activePageId: 'page-2' });
  switchedCleanup();
  assert.equal(active, undefined);
});

test('saved editable documents autosave in both modes while Page-scoped Cameras remain inside IdeaSketch', () => {
  assert.match(source, /enabled: Boolean\(document\.filePath\) && !readOnly && document\.status === "editable"/);
  assert.doesNotMatch(source, /enabled: document\.mode === "workspace"/);
  assert.match(source, /<SlideCanvas/);
  assert.match(source, /<IdeaSketchNavigator/);
  assert.match(source, /<ResizableDivider[\s\S]*?side="left"/);
  assert.match(source, /const IDEASKETCH_DRAWER_STORAGE_KEY = "ideanote:ideasketch-drawer:v2"/);
  assert.match(source, /const DEFAULT_DRAWER_WIDTH = 244/);
  assert.match(source, /const MIN_DRAWER_WIDTH = 220/);
  assert.match(source, /const MAX_DRAWER_WIDTH = 420/);
  assert.match(source, /const \[drawerWidth, setDrawerWidth\]/);
  assert.match(source, /const \{ hydrated, settings \} = useSettings\(\)/);
  assert.match(source, /const \[drawerOpen, setDrawerOpen\] = useState\(settings\.ideaSketch\.openSidebarByDefault\)/);
  assert.match(source, /drawerDefaultApplied/);
  assert.match(source, /if \(!hydrated \|\| drawerDefaultApplied\.current\) return/);
  assert.match(source, /navigatorTab/);
  assert.match(source, /model\.pages\.find/);
  assert.match(source, /activePageDraft=\{draft\}/);
  assert.match(source, /initialPageViewMode=\{settings\.ideaSketch\.pageViewMode\}/);
  assert.match(source, /pageViewPreferenceReady=\{hydrated\}/);
  assert.match(source, /canvasInteractionActive=\{canvasInteractionActive\}/);
  assert.doesNotMatch(source, /ideanote-ideasketch-editor__chrome/);
  assert.doesNotMatch(source, /Show Pages\. Current Page/);
});

test('Page selection records editor state without persisting a model mutation', () => {
  assert.match(source, /if \(next\.activePageId !== previous\.activePageId\) \{[\s\S]*?onEditorStateChange\(document\.id, next\.activePageId\);/);
  assert.match(source, /const selectPage = useCallback\(async \(pageId: string\) => \{/);
  assert.match(source, /sdk\?\.pages\.select\(\{ pageRef: `page:\$\{pageId\}` \}\)/);
  assert.doesNotMatch(source, /const selectPage = useCallback\(\(pageId: string\) => \{[\s\S]*?applyAction\(\{ type: "SELECT_PAGE", pageId \}, false\);/);
});

test('selection conversion stays inside the active Page draft boundary', () => {
  const canvas = source.match(/<SlideCanvas\n[\s\S]*?\/>/)?.[0] ?? '';

  assert.match(source, /handleConvertSelection/);
  assert.match(source, /sdk\.transforms\.convertSelectionStyle\(/);
  assert.match(source, /selectedRefs/);
  assert.match(source, /snapshotId: sceneRead\.value\.snapshotId/);
  assert.match(source, /requestAnimationFrame/);
  assert.doesNotMatch(source, /buildCurrentPageStyleConversion|buildNewPageStyleConversion/);
  assert.match(canvas, /onConvertSelection=\{handleConvertSelection\}/);
});
