import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { applyResolvedTheme, observeTheme, resolveTheme } = await import('../src/lib/theme.ts');

function mediaQuery(matches = false) {
  const listeners = new Set();
  return {
    matches,
    addEventListener(type, listener) { if (type === 'change') listeners.add(listener); },
    removeEventListener(type, listener) { if (type === 'change') listeners.delete(listener); },
    emit(next) { this.matches = next; for (const listener of listeners) listener({ matches: next }); },
    listenerCount() { return listeners.size; },
  };
}

test('theme resolution honors explicit preferences and resolves System from the OS', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('system', true), 'dark');
});

test('System observes live changes while explicit themes do not subscribe', () => {
  const media = mediaQuery(false);
  const themes = [];
  const dispose = observeTheme('system', (theme) => themes.push(theme), media);
  assert.deepEqual(themes, ['light']);
  assert.equal(media.listenerCount(), 1);
  media.emit(true);
  assert.deepEqual(themes, ['light', 'dark']);
  dispose();
  assert.equal(media.listenerCount(), 0);

  const explicit = mediaQuery(true);
  const explicitThemes = [];
  observeTheme('light', (theme) => explicitThemes.push(theme), explicit);
  explicit.emit(false);
  assert.deepEqual(explicitThemes, ['light']);
  assert.equal(explicit.listenerCount(), 0);
});

test('resolved theme is published through root data and color-scheme contracts', () => {
  const root = { dataset: {}, style: {} };
  applyResolvedTheme('dark', root);
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(root.style.colorScheme, 'dark');
});

test('Settings, Markdown, and Excalidraw consume the resolved application theme', async () => {
  const settings = await readFile(new URL('../src/hooks/useSettings.tsx', import.meta.url), 'utf8');
  const markdown = await readFile(new URL('../src/components/MarkdownEditor.tsx', import.meta.url), 'utf8');
  const canvas = await readFile(new URL('../src/components/SlideCanvas.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(settings, /observeTheme\(settings\.general\.theme/);
  assert.match(settings, /applyResolvedTheme\(theme\)/);
  assert.match(markdown, /theme: resolvedTheme/);
  assert.match(canvas, /theme=\{resolvedTheme\}/);
  assert.doesNotMatch(canvas, /ToggleTheme/);
  assert.doesNotMatch(canvas, /viewBackgroundColor:\s*"#ffffff"/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /color-scheme:\s*dark/);
});
