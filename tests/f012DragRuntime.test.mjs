import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { webkit } from 'playwright';
import { createServer } from 'vite';

const workspaceEntries = [
  { path: 'folder', name: 'folder', kind: 'directory', readOnly: false, children: [] },
  { path: 'a.is', name: 'a.is', kind: 'file', readOnly: false, fileType: 'ideasketch', children: [] },
  { path: 'b.is', name: 'b.is', kind: 'file', readOnly: false, fileType: 'ideasketch', children: [] },
];

function createIdeaSketchMockDocument(pageCount = 40) {
  const pages = Array.from({ length: pageCount }, (_, index) => ({
    id: `page-${index + 1}`,
    title: `Page ${index + 1}`,
  }));
  return {
    manifest: {
      version: '1.0',
      created: '2026-08-05T00:00:00.000Z',
      modified: '2026-08-05T00:00:00.000Z',
      slides: pages,
    },
    slides: pages.map(({ id }) => ({
      id,
      content: { elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} },
    })),
    media: [],
  };
}

async function installTauriMock(page) {
  await page.addInitScript(({ entries, ideaSketchDocument }) => {
    const callbacks = new Map();
    let callbackId = 1;
    let currentEntries = structuredClone(entries);
    const detachEntry = (items, path) => {
      const index = items.findIndex((entry) => entry.path === path);
      if (index >= 0) return items.splice(index, 1)[0];
      for (const entry of items) {
        const nested = detachEntry(entry.children, path);
        if (nested) return nested;
      }
      return undefined;
    };
    const findEntry = (items, path) => {
      for (const entry of items) {
        if (entry.path === path) return entry;
        const nested = findEntry(entry.children, path);
        if (nested) return nested;
      }
      return undefined;
    };
    const remapEntry = (entry, fromPath, toPath) => {
      entry.path = entry.path === fromPath
        ? toPath
        : `${toPath}${entry.path.slice(fromPath.length)}`;
      entry.children.forEach((child) => remapEntry(child, fromPath, toPath));
    };
    const sortEntries = (items) => items
      .map((entry) => ({ ...entry, children: sortEntries(entry.children) }))
      .sort((left, right) => {
        if (left.kind === 'directory' && right.kind !== 'directory') return -1;
        if (left.kind !== 'directory' && right.kind === 'directory') return 1;
        return left.name.localeCompare(right.name);
      });
    window.__b009Invokes = [];
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
    window.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: 'main' },
        currentWebview: { label: 'main', windowLabel: 'main' },
      },
      transformCallback(callback, once = false) {
        const id = callbackId++;
        callbacks.set(id, { callback, once });
        return id;
      },
      unregisterCallback(id) {
        callbacks.delete(id);
      },
      runCallback(id, data) {
        const item = callbacks.get(id);
        item?.callback(data);
        if (item?.once) callbacks.delete(id);
      },
      convertFileSrc(path) {
        return path;
      },
      async invoke(cmd, args = {}) {
        window.__b009Invokes.push({ cmd, args });
        if (cmd === 'get_recent_files' || cmd === 'get_recent_workspaces') return [];
        if (cmd === 'list_agent_threads') {
          return { threads: [], nextCursor: null, recoveredCorruptEntries: 0 };
        }
        if (cmd === 'save_agent_thread') return args.record;
        if (cmd === 'get_agent_thread') return null;
        if (cmd === 'rename_agent_thread' || cmd === 'archive_agent_thread') return null;
        if (cmd === 'delete_agent_thread') return true;
        if (cmd === 'plugin:dialog|open') return '/mock-workspace';
        if (cmd === 'open_workspace') {
          return {
            root: '/mock-workspace',
            name: 'mock-workspace',
            readOnly: false,
            entries: structuredClone(sortEntries(currentEntries)),
            metadata: { exists: false, workspace: null, state: null, diagnostics: [] },
          };
        }
        if (cmd === 'refresh_workspace') return structuredClone(sortEntries(currentEntries));
        if (cmd === 'open_workspace_document') {
          return {
            status: 'editable',
            document: { type: 'ideasketch', data: structuredClone(ideaSketchDocument) },
          };
        }
        if (cmd === 'inspect_file') {
          return { exists: true, modified: '2026-08-05T00:00:00.000Z', readOnly: false, size: 1024 };
        }
        if (cmd === 'move_workspace_entry') {
          const entry = detachEntry(currentEntries, args.path);
          if (!entry) throw new Error(`Missing mock entry: ${args.path}`);
          const movedPath = args.destinationParentPath
            ? `${args.destinationParentPath}/${entry.name}`
            : entry.name;
          remapEntry(entry, args.path, movedPath);
          if (args.destinationParentPath) {
            const parent = findEntry(currentEntries, args.destinationParentPath);
            if (!parent) throw new Error(`Missing mock parent: ${args.destinationParentPath}`);
            parent.children.push(entry);
          } else {
            currentEntries.push(entry);
          }
          return structuredClone(entry);
        }
        if (cmd === 'save_workspace_state') return null;
        if (cmd === 'start_workspace_watcher' || cmd === 'stop_workspace_watcher') return null;
        if (cmd.includes('listen') || cmd.includes('register_listener')) return 1;
        return null;
      },
    };
  }, { entries: workspaceEntries, ideaSketchDocument: createIdeaSketchMockDocument() });
}

async function dragRow(page, sourceName, targetIndex, targetRatio) {
  const rows = page.getByRole('treeitem');
  const source = await page.getByRole('button', { name: `Open ${sourceName}` }).boundingBox();
  const target = await rows.nth(targetIndex).boundingBox();
  await dragBetweenBoxes(page, source, target, targetRatio);
}

async function dragRowAndAssertStableHeight(page, sourceName, targetIndex, targetRatio) {
  const rows = page.getByRole('treeitem');
  const row = rows.filter({ hasText: sourceName }).first();
  const before = await row.boundingBox();
  const source = await page.getByRole('button', { name: `Open ${sourceName}` }).boundingBox();
  const target = await rows.nth(targetIndex).boundingBox();
  assert.ok(before);
  assert.ok(source);
  assert.ok(target);
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height * targetRatio,
    { steps: 16 },
  );
  const during = await row.boundingBox();
  assert.ok(during);
  assert.ok(Math.abs(during.height - before.height) <= 1, `dragged row height changed from ${before.height} to ${during.height}`);
  await page.mouse.up();
}

async function dragToRoot(page, sourceName) {
  const source = await page.getByRole('button', { name: `Open ${sourceName}` }).boundingBox();
  const target = await page.locator('[data-workspace-root="true"]').boundingBox();
  await dragBetweenBoxes(page, source, target, 0.5);
}

async function dragToRootAndAssertStableHeight(page, sourceName) {
  const row = page.getByRole('treeitem').filter({ hasText: sourceName }).first();
  const before = await row.boundingBox();
  const source = await page.getByRole('button', { name: `Open ${sourceName}` }).boundingBox();
  const target = await page.locator('[data-workspace-root="true"]').boundingBox();
  assert.ok(before);
  assert.ok(source);
  assert.ok(target);
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 16 });
  await assert.doesNotReject(async () => {
    await page.locator('[data-workspace-root="true"].is-drop-inside').waitFor({ timeout: 1_000 });
  }, 'Workspace root did not become the active drop target');
  const during = await row.boundingBox();
  assert.ok(during);
  assert.ok(Math.abs(during.height - before.height) <= 1, `dragged row height changed from ${before.height} to ${during.height}`);
  await page.mouse.up();
}

async function dragBetweenBoxes(page, source, target, targetRatio) {
  assert.ok(source);
  assert.ok(target);
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height * targetRatio,
    { steps: 16 },
  );
  await page.mouse.up();
}

async function waitForRowOrder(rows, expected, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  let actual = await rows.locator('.idea-slide-resource-name').allTextContents();
  while (Date.now() < deadline && JSON.stringify(actual) !== JSON.stringify(expected)) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    actual = await rows.locator('.idea-slide-resource-name').allTextContents();
  }
  assert.deepEqual(actual, expected);
}

test('Workspace drag completes in WebKit after React drop feedback updates', async (context) => {
  if (!existsSync(webkit.executablePath())) {
    context.skip('Playwright WebKit is not installed');
    return;
  }

  const server = await createServer({
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  let browser;
  try {
    await server.listen();
    const address = server.httpServer?.address();
    assert.ok(address && typeof address === 'object');
    browser = await webkit.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await installTauriMock(page);
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' });
    await page.getByLabel('Workspaces and recent files').getByRole('button', { name: 'Open Workspace' }).click();

    const rows = page.getByRole('treeitem');
    await rows.first().waitFor();
    assert.deepEqual(await rows.locator('.idea-slide-resource-name').allTextContents(), ['folder', 'a.is', 'b.is']);
    const explorer = page.getByRole('complementary', { name: 'Workspace Explorer' });
    assert.equal(await explorer.getByText('mock-workspace', { exact: true }).count(), 0);
    const folderMain = rows.first().locator('.idea-slide-resource-main');
    await folderMain.click();
    assert.match(await rows.nth(0).getAttribute('class'), /is-selected/);
    assert.equal(await rows.nth(0).getAttribute('aria-expanded'), 'true');

    await dragRow(page, 'a.is', 2, 0.5);
    await waitForRowOrder(rows, ['folder', 'a.is', 'b.is']);

    await dragRowAndAssertStableHeight(page, 'a.is', 0, 0.5);
    await waitForRowOrder(rows, ['folder', 'a.is', 'b.is']);
    await folderMain.click();
    await waitForRowOrder(rows, ['folder', 'b.is']);
    await folderMain.click();
    await waitForRowOrder(rows, ['folder', 'a.is', 'b.is']);

    await dragToRootAndAssertStableHeight(page, 'a.is');
    await waitForRowOrder(rows, ['folder', 'a.is', 'b.is']);

    const refreshCalls = await page.evaluate(() =>
      window.__b009Invokes.filter(({ cmd }) => cmd === 'refresh_workspace').length,
    );
    assert.equal(refreshCalls, 2);
    const moveCalls = await page.evaluate(() =>
      window.__b009Invokes
        .filter(({ cmd }) => cmd === 'move_workspace_entry')
        .map(({ args }) => args.destinationParentPath),
    );
    assert.deepEqual(moveCalls, ['folder', '']);
    const openCalls = await page.evaluate(() =>
      window.__b009Invokes.filter(({ cmd }) => cmd === 'open_workspace_document').length,
    );
    assert.equal(openCalls, 0);
  } finally {
    await browser?.close();
    await server.close();
  }
});

test('virtualized Page cards remain sortable in WebKit thumbnail mode', async (context) => {
  if (!existsSync(webkit.executablePath())) {
    context.skip('Playwright WebKit is not installed');
    return;
  }

  const server = await createServer({
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  let browser;
  try {
    await server.listen();
    const address = server.httpServer?.address();
    assert.ok(address && typeof address === 'object');
    browser = await webkit.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await installTauriMock(page);
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' });
    await page.getByLabel('Workspaces and recent files').getByRole('button', { name: 'Open Workspace' }).click();
    await page.getByRole('button', { name: 'Open a.is' }).click();

    await page.locator('.excalidraw .App-toolbar.Island').waitFor({ timeout: 60_000 });
    const topAlignment = await page.evaluate(() => {
      const trigger = document.querySelector('.ideanote-ideasketch-drawer-trigger');
      const toolbar = document.querySelector('.excalidraw .App-toolbar.Island');
      if (!(trigger instanceof HTMLElement) || !(toolbar instanceof HTMLElement)) return null;
      const triggerRect = trigger.getBoundingClientRect();
      const toolbarRect = toolbar.getBoundingClientRect();
      return {
        triggerTop: triggerRect.top,
        triggerBottom: triggerRect.bottom,
        toolbarTop: toolbarRect.top,
        toolbarBottom: toolbarRect.bottom,
      };
    });
    assert.ok(topAlignment);
    assert.ok(
      Math.abs(topAlignment.triggerTop - topAlignment.toolbarTop) <= 1,
      `navigator/toolbar top edges differed by ${Math.abs(topAlignment.triggerTop - topAlignment.toolbarTop)}px`,
    );
    assert.ok(
      Math.abs(topAlignment.triggerBottom - topAlignment.toolbarBottom) <= 1,
      `navigator/toolbar bottom edges differed by ${Math.abs(topAlignment.triggerBottom - topAlignment.toolbarBottom)}px`,
    );

    await page.getByRole('button', { name: 'Open IdeaSketch menu' }).click();
    const openTrigger = page.getByRole('button', { name: 'Close IdeaSketch menu' });
    assert.equal(await openTrigger.locator('svg').getAttribute('class'), 'lucide lucide-panel-left-close');
    await page.waitForFunction(() => {
      const drawer = document.querySelector('.ideanote-ideasketch-drawer-shell');
      const width = drawer instanceof HTMLElement ? drawer.getBoundingClientRect().width : 0;
      return width >= 243 && width <= 245;
    }, undefined, { timeout: 60_000 });

    const dividerLayers = await page.evaluate(() => {
      const drawer = document.querySelector('.ideanote-ideasketch-drawer');
      const line = document.querySelector('.ideanote-ideasketch-workspace > .idea-slide-resize-rail .idea-slide-resize-rail__line');
      if (!(drawer instanceof HTMLElement) || !(line instanceof HTMLElement)) return null;
      const drawerStyle = getComputedStyle(drawer);
      const lineStyle = getComputedStyle(line);
      return {
        drawerBorderRightWidth: drawerStyle.borderRightWidth,
        drawerBoxShadow: drawerStyle.boxShadow,
        lineWidth: line.getBoundingClientRect().width,
        lineBackground: lineStyle.backgroundColor,
      };
    });
    assert.ok(dividerLayers);
    assert.equal(dividerLayers.drawerBorderRightWidth, '0px');
    assert.equal(dividerLayers.drawerBoxShadow, 'none');
    assert.ok(dividerLayers.lineWidth >= 0.9 && dividerLayers.lineWidth <= 1.1);
    assert.notEqual(dividerLayers.lineBackground, 'rgba(0, 0, 0, 0)');

    const drawerDivider = page.getByRole('separator', { name: 'Resize IdeaSketch menu panel' });
    await drawerDivider.press('End');
    await page.waitForFunction(() => {
      const drawer = document.querySelector('.ideanote-ideasketch-drawer-shell');
      return drawer instanceof HTMLElement && drawer.getBoundingClientRect().width >= 419;
    });
    const dividerBox = await drawerDivider.boundingBox();
    assert.ok(dividerBox);
    await page.mouse.move(dividerBox.x + dividerBox.width / 2, dividerBox.y + 80);
    await page.mouse.down();
    await page.mouse.move(dividerBox.x - 220, dividerBox.y + 80);
    const resizingGeometry = await page.evaluate(() => {
      const shell = document.querySelector('.ideanote-ideasketch-drawer-shell');
      const drawer = document.querySelector('.ideanote-ideasketch-drawer');
      if (!(shell instanceof HTMLElement) || !(drawer instanceof HTMLElement)) return null;
      return {
        shellWidth: shell.getBoundingClientRect().width,
        drawerWidth: drawer.getBoundingClientRect().width,
        resizing: shell.classList.contains('is-resizing'),
        transitionDuration: getComputedStyle(shell).transitionDuration,
      };
    });
    assert.ok(resizingGeometry);
    assert.equal(resizingGeometry.resizing, true);
    assert.equal(resizingGeometry.transitionDuration, '0s');
    assert.ok(
      Math.abs(resizingGeometry.shellWidth - resizingGeometry.drawerWidth) <= 1,
      `drawer shell/content width gap was ${Math.abs(resizingGeometry.shellWidth - resizingGeometry.drawerWidth)}px`,
    );
    await page.mouse.up();

    const nameView = page.getByRole('button', { name: 'Name view' });
    await nameView.waitFor();
    assert.equal(await nameView.getAttribute('aria-pressed'), 'true');
    const thumbnailView = page.getByRole('button', { name: 'Thumbnail view' });
    await thumbnailView.click();
    await page.locator('[data-page-id="page-1"].is-thumbnail').waitFor({ timeout: 60_000 });
    assert.equal(await thumbnailView.getAttribute('aria-pressed'), 'true');

    const mountedCards = page.locator('[data-page-id]');
    const mountedCardCount = await mountedCards.count();
    assert.ok(mountedCardCount > 0);
    assert.ok(mountedCardCount < 40);

    const source = await page.getByRole('button', { name: 'Drag Page 2' }).boundingBox();
    const target = await page.locator('[data-page-id="page-1"]').boundingBox();
    await dragBetweenBoxes(page, source, target, 0.5);

    const pageTwoIndex = page.locator('[data-page-id="page-2"] .ideanote-page-organizer__index');
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline && await pageTwoIndex.textContent() !== '1') {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(await pageTwoIndex.textContent(), '1');
    assert.equal(
      await page.locator('[data-page-id="page-1"] .ideanote-page-organizer__index').textContent(),
      '2',
    );
  } finally {
    await browser?.close();
    await server.close();
  }
});
