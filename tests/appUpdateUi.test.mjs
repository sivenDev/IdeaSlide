import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [notice, sidebar, editor, styles] = await Promise.all([
  readFile(new URL('../src/components/AppUpdateNotice.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/WorkspaceSidebar.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/EditorLayout.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
]);

test('the lower-left update card exposes version, progress, restart, retry, and dismissal', () => {
  assert.match(notice, /Update available/);
  assert.match(notice, /Download update/);
  assert.match(notice, /Restart to update/);
  assert.match(notice, /Retry/);
  assert.match(notice, /"Dismiss update notice"/);
  assert.match(notice, /aria-label=\{busy \? "Download in progress" : "Dismiss update notice"\}/);
  assert.match(notice, /disabled=\{busy\}/);
  assert.match(notice, /role="status"/);
  assert.match(notice, /downloadedBytes/);
  assert.match(notice, /totalBytes/);
});

test('dismissing the card leaves a compact Update action beside Settings', () => {
  assert.match(sidebar, /<AppUpdateNotice/);
  assert.match(sidebar, /update\.state\.dismissed/);
  assert.match(sidebar, /className="ideanote-workspace-footer__update"/);
  assert.match(sidebar, /compactUpdateLabel/);
  assert.match(sidebar, /return "Downloading"/);
  assert.match(sidebar, /return "Retry"/);
  assert.match(sidebar, /return "Installing"/);
  assert.match(sidebar, /compactUpdateRef\.current\?\.focus\(\)/);
  assert.match(sidebar, /onRestoreNotice/);
  assert.match(sidebar, /onInstall/);
});

test('EditorLayout owns updater installation through the existing session exit gate', () => {
  assert.match(editor, /useAppUpdate/);
  assert.match(editor, /appUpdate\.install\(confirmSessionExit\)/);
  assert.match(editor, /update=\{\{/);
});

test('update presentation has isolated responsive theme and reduced-motion styling', () => {
  assert.match(styles, /\.ideanote-app-update-notice/);
  assert.match(styles, /\.ideanote-workspace-footer__update/);
  const compactUpdateStyle = styles.match(
    /\.ideanote-workspace-footer__update \{([\s\S]*?)\n\}/,
  )?.[1] ?? '';
  assert.match(compactUpdateStyle, /border:\s*1px solid var\(--accent-primary\)/);
  assert.match(compactUpdateStyle, /color:\s*var\(--accent-contrast\)/);
  assert.match(compactUpdateStyle, /background:\s*var\(--accent-primary\)/);
  assert.match(styles, /color: var\(--accent-contrast\)/);
  assert.match(styles, /html\[data-theme="dark"\] \.ideanote-workspace-footer__settings/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?ideanote-app-update/);
});
