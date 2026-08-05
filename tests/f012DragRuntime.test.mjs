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

async function installTauriMock(page) {
  await page.addInitScript(({ entries }) => {
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
  }, { entries: workspaceEntries });
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
  let actual = await rows.allTextContents();
  while (Date.now() < deadline && JSON.stringify(actual) !== JSON.stringify(expected)) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    actual = await rows.allTextContents();
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
    await page.getByRole('button', { name: 'Open Workspace' }).click();

    const rows = page.getByRole('treeitem');
    await rows.first().waitFor();
    assert.deepEqual(await rows.allTextContents(), ['mock-workspace', 'folder', 'a.is', 'b.is']);
    await page.getByRole('button', { name: 'Select folder' }).click();
    assert.match(await rows.nth(1).getAttribute('class'), /is-selected/);

    await dragRow(page, 'a.is', 3, 0.5);
    await waitForRowOrder(rows, ['mock-workspace', 'folder', 'a.is', 'b.is']);

    await dragRowAndAssertStableHeight(page, 'a.is', 1, 0.5);
    await waitForRowOrder(rows, ['mock-workspace', 'folder', 'b.is']);
    await page.getByRole('button', { name: 'Expand Folder' }).click();
    await waitForRowOrder(rows, ['mock-workspace', 'folder', 'a.is', 'b.is']);

    await dragToRootAndAssertStableHeight(page, 'a.is');
    await waitForRowOrder(rows, ['mock-workspace', 'folder', 'a.is', 'b.is']);

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
