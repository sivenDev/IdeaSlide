import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function themeBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
  assert.ok(match, `missing ${selector} theme block`);
  return match[1];
}

function variables(block) {
  return new Map([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
}

function rgb(hex) {
  const value = hex.replace('#', '');
  assert.match(value, /^[0-9a-f]{6}$/i, `expected six-digit hex color, received ${hex}`);
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex) {
  const channels = rgb(hex).map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

const semanticRoles = [
  'canvas',
  'surface-primary',
  'surface-secondary',
  'surface-tertiary',
  'surface-elevated',
  'surface-inset',
  'text-primary',
  'text-secondary',
  'text-tertiary',
  'text-inverse',
  'border-subtle',
  'border-default',
  'border-strong',
  'interaction-hover',
  'interaction-pressed',
  'selection-bg',
  'selection-text',
  'accent-primary',
  'accent-primary-hover',
  'accent-contrast',
  'accent-document',
  'focus-ring',
  'disabled-bg',
  'disabled-text',
  'status-danger',
  'status-warning',
  'status-success',
  'overlay-scrim',
];

test('Light and Dark expose one complete semantic theme contract', async () => {
  const css = await source('src/index.css');
  const light = variables(themeBlock(css, ':root'));
  const dark = variables(themeBlock(css, ':root[data-theme="dark"]'));

  for (const role of semanticRoles) {
    assert.ok(light.has(role), `Light is missing --${role}`);
    assert.ok(dark.has(role), `Dark is missing --${role}`);
  }

  for (const legacy of ['paper', 'workspace', 'agent', 'graphite', 'steel', 'muted', 'line', 'line-strong', 'hover', 'selection', 'cobalt', 'danger', 'warning', 'success', 'focus']) {
    assert.match(light.get(legacy) ?? '', /^var\(--[\w-]+\)$/, `--${legacy} must be a semantic alias`);
    assert.match(dark.get(legacy) ?? '', /^var\(--[\w-]+\)$/, `Dark --${legacy} must be a semantic alias`);
  }
});

test('B036 exposes the exact Ink Violet Atelier palettes without legacy accent islands', async () => {
  const css = await source('src/index.css');
  const light = variables(themeBlock(css, ':root'));
  const dark = variables(themeBlock(css, ':root[data-theme="dark"]'));

  const expected = {
    light: {
      canvas: '#f6f5f8',
      'surface-primary': '#fcfcfd',
      'surface-secondary': '#f0eff4',
      'surface-tertiary': '#f4f3f7',
      'text-primary': '#25232a',
      'selection-bg': '#e9e5f5',
      'selection-text': '#493d7a',
      'accent-primary': '#6557b8',
      'accent-document': '#315fc9',
      'status-success': '#247a55',
    },
    dark: {
      canvas: '#121116',
      'surface-primary': '#1c1a20',
      'surface-secondary': '#17161b',
      'surface-tertiary': '#211f26',
      'text-primary': '#f2eff6',
      'selection-bg': '#342e4b',
      'selection-text': '#eee9ff',
      'accent-primary': '#a99af2',
      'accent-document': '#8aadff',
      'status-success': '#6ed5a5',
    },
  };

  for (const [role, value] of Object.entries(expected.light)) assert.equal(light.get(role), value, `Light --${role}`);
  for (const [role, value] of Object.entries(expected.dark)) assert.equal(dark.get(role), value, `Dark --${role}`);

  for (const legacy of ['#6965db', '#625dd6', '#5b57cf', '#7772dd', '#ecebff', '#eeedff', '#37338e']) {
    assert.doesNotMatch(css, new RegExp(legacy, 'i'), `legacy application accent ${legacy} must be removed`);
  }

  for (const alias of [
    '--idea-slide-accent: var(--accent-primary)',
    '--idea-slide-accent-hover: var(--accent-primary-hover)',
    '--idea-slide-accent-soft: var(--selection-bg)',
    '--idea-slide-surface: var(--surface-primary)',
    '--idea-slide-surface-hover: var(--interaction-hover)',
  ]) assert.match(css, new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('theme text, selection, status, and primary actions meet contrast targets', async () => {
  const css = await source('src/index.css');
  for (const selector of [':root', ':root[data-theme="dark"]']) {
    const theme = variables(themeBlock(css, selector));
    const pairs = [
      ['text-primary', 'surface-primary', 7],
      ['text-secondary', 'surface-primary', 4.5],
      ['text-tertiary', 'surface-primary', 4.5],
      ['selection-text', 'selection-bg', 4.5],
      ['accent-contrast', 'accent-primary', 4.5],
      ['status-danger', 'surface-primary', 4.5],
      ['status-warning', 'surface-primary', 4.5],
      ['status-success', 'surface-primary', 4.5],
    ];
    for (const [foreground, background, minimum] of pairs) {
      const actual = contrast(theme.get(foreground), theme.get(background));
      assert.ok(actual >= minimum, `${selector} --${foreground} on --${background} contrast ${actual.toFixed(2)} is below ${minimum}`);
    }
  }
});

test('theme polish is semantic, reduced-motion safe, and removes Markdown color literals', async () => {
  const [css, markdown, settings, settingsHook, slideCanvas] = await Promise.all([
    source('src/index.css'),
    source('src/components/MarkdownEditor.tsx'),
    source('src/components/settings/GeneralSettings.tsx'),
    source('src/hooks/useSettings.tsx'),
    source('src/components/SlideCanvas.tsx'),
  ]);

  assert.match(css, /\/\* F047: ChatGPT-inspired semantic Light and Dark themes\. \*\//);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*--theme-paint-duration:\s*0ms/);
  assert.match(css, /\.ideanote-theme-preview/);
  assert.match(settings, /data-theme-option=\{value\}/);
  assert.match(settings, /ideanote-theme-preview/);
  assert.doesNotMatch(markdown, /bg-white|bg-\[#|text-\[#|border-gray-|bg-gray-|text-gray-/);
  assert.match(settingsHook, /theme === "system"[\s\S]*media\.matches \? "dark" : "light"/);
  assert.doesNotMatch(settingsHook, /dataset\.theme\s*=\s*"system"/);
  assert.match(settingsHook, /resolvedTheme/);
  assert.match(slideCanvas, /const \{ resolvedTheme \} = useSettings\(\)/);
  assert.match(slideCanvas, /<Excalidraw[\s\S]*?theme=\{resolvedTheme\}/);
  assert.doesNotMatch(slideCanvas, /DefaultItems\.ToggleTheme/);
  assert.match(slideCanvas, /viewBackgroundColor:\s*"#ffffff"/);
});

test('danger menu items retain danger semantics while highlighted', async () => {
  const [css, workspace] = await Promise.all([
    source('src/index.css'),
    source('src/components/WorkspaceSidebar.tsx'),
  ]);

  assert.match(workspace, /className="is-danger"[\s\S]*?Remove from Workspaces/);
  assert.match(workspace, /className="is-danger"[\s\S]*?onRemoveRecent[\s\S]*?Remove/);
  assert.doesNotMatch(workspace, /text-red-700 focus:text-red-800/);
  assert.match(css, /\.ideanote-compact-menu \[role="menuitem"\]\.is-danger:focus[\s\S]*color:\s*var\(--status-danger\) !important;[\s\S]*background:\s*color-mix\(in srgb, var\(--status-danger\) 11%, var\(--surface-elevated\)\) !important;/);
});
