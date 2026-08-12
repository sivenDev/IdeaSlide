import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('production shell owns the exact reviewed light and dark token contract', async () => {
  const css = await source('src/index.css');
  for (const token of [
    '--paper: #ffffff',
    '--workspace: #e9eae7',
    '--agent: #f4f4f2',
    '--frost: #f1f2f4',
    '--graphite: #252930',
    '--steel: #69727e',
    '--muted: #8b929b',
    '--line: #d5d8dc',
    '--line-strong: #c4c8ce',
    '--selection: #d9e2f7',
    '--cobalt: #2f5dcc',
    '--danger: #b4433c',
  ]) assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const token of [
    '--paper: #17191d',
    '--workspace: #202329',
    '--agent: #1c1f24',
    '--frost: #191c21',
    '--graphite: #e5e7eb',
    '--steel: #a7aeb8',
    '--muted: #7f8792',
    '--line: #30343b',
    '--line-strong: #3c424b',
    '--selection: #253a62',
    '--cobalt: #7396ec',
    '--focus: #83a6fb',
    '--danger: #ea7d75',
  ]) assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('reviewed workbench geometry and document identity are executable contracts', async () => {
  const [css, crown, welcome] = await Promise.all([
    source('src/index.css'),
    source('src/components/WorkbenchCrown.tsx'),
    source('src/components/WorkbenchWelcome.tsx'),
  ]);
  assert.match(css, /\.ideanote-workbench-crown\s*\{[^}]*flex:\s*0 0 45px/s);
  assert.match(css, /\.ideanote-agent-thread-header\s*\{[^}]*min-height:\s*45px[^}]*flex:\s*0 0 45px/s);
  assert.match(css, /\.idea-slide-resize-rail\s*\{[^}]*width:\s*7px/s);
  assert.match(css, /\.idea-slide-resize-rail\s*\{[^}]*margin:\s*0 -3px/s);
  assert.match(css, /\.idea-slide-resize-rail__line\s*\{[^}]*width:\s*1px/s);
  assert.match(crown, /documentPath/);
  assert.match(crown, /ideanote-document-identity__copy/);
  assert.match(crown, /ideanote-document-identity is-welcome/);
  assert.doesNotMatch(welcome, /Open Workspace|Settings/);
  assert.match(welcome, /Open most recent/);
  assert.match(welcome, /Open File/);
  assert.match(welcome, /New File/);
});

test('Settings uses the reviewed compact dialog and explicit draft save lifecycle', async () => {
  const [css, center, general, settingsHook, skills] = await Promise.all([
    source('src/index.css'),
    source('src/components/SettingsCenter.tsx'),
    source('src/components/settings/GeneralSettings.tsx'),
    source('src/hooks/useSettings.tsx'),
    source('src/components/settings/AgentSkillManager.tsx'),
  ]);
  assert.match(css, /\.ideanote-settings-dialog\s*\{[^}]*width:\s*min\(760px,[^}]*height:\s*min\(560px,[^}]*border-radius:\s*8px/s);
  assert.match(css, /\.ideanote-settings-header\s*\{[^}]*flex:\s*0 0 54px/s);
  assert.match(css, /\.ideanote-settings-nav\s*\{[^}]*flex:\s*0 0 170px/s);
  assert.match(css, /\.ideanote-settings-field\s*\{[^}]*min-height:\s*52px/s);
  assert.match(css, /\.ideanote-settings-toggle\s*\{[^}]*width:\s*32px[^}]*height:\s*18px/s);
  assert.match(center, /Save changes/);
  assert.match(center, /SettingsDraftProvider/);
  assert.match(center, /<Dialog\.Description className="sr-only">Application settings<\/Dialog\.Description>/);
  assert.doesNotMatch(center, /aria-describedby="settings-description"|id="settings-description"/);
  assert.match(settingsHook, /discardDraft/);
  assert.match(settingsHook, /saveDraft/);
  assert.match(settingsHook, /\}, \[open, persisted\.hydrated\]\);/);
  assert.match(settingsHook, /const current = draftRef\.current;[\s\S]*persisted\.previewTheme\(next\.general\.theme\)/);
  assert.doesNotMatch(settingsHook, /setDraft\(\(current\) => \{[\s\S]*persisted\.previewTheme/);
  assert.match(general, /ideanote-theme-options/);
  assert.match(css, /\.ideanote-skills-list\s*\{[^}]*border-top:\s*1px solid var\(--line\)/s);
  assert.match(css, /\.ideanote-skill-row\s*\{[^}]*min-height:\s*52px[^}]*grid-template-columns:\s*48px minmax\(0,\s*1fr\) 93px 64px 27px/s);
  assert.match(skills, /skill\.origin === "custom"[\s\S]*?<SettingsSwitch/);
  assert.match(skills, /skill-always-on[\s\S]*?Always on/);
  assert.doesNotMatch(center, /sectionIcons|Review Scenarios/);
});

test('Agent crown, history overlays, and composer match the concise reviewed contract', async () => {
  const [header, selector, css] = await Promise.all([
    source('src/components/agent/AgentThreadHeader.tsx'),
    source('src/components/agent/AgentConversationSelector.tsx'),
    source('src/index.css'),
  ]);
  assert.match(header, /aria-label="New conversation"/);
  assert.match(header, /aria-label="Runtime Inspector"/);
  assert.match(header, /aria-label="Hide Agent"/);
  assert.doesNotMatch(header, /settings|Settings2/i);
  assert.doesNotMatch(selector, /statusLabel/);
  assert.match(selector, /side="right"/);
  assert.match(selector, /align="start"/);
  assert.match(selector, /collisionPadding=\{8\}/);
  assert.match(selector, /<Dialog\.Description className="sr-only">Enter a new name for this conversation\.<\/Dialog\.Description>/);
  assert.doesNotMatch(selector, /aria-describedby="delete-conversation-description"|id="delete-conversation-description"/);
  assert.match(css, /\.ideanote-agent-conversation-menu\s*\{[^}]*z-index:\s*3600/s);
  assert.match(css, /\.ideanote-agent-conversation-trigger > svg:first-child\s*\{\s*color:\s*var\(--graphite\)/);
  assert.match(css, /\.ideanote-agent-composer\s*\{[^}]*margin:\s*10px[^}]*border-radius:\s*6px/s);
});
