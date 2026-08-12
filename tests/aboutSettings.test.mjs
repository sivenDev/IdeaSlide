import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  APP_DESTINATIONS,
  getRuntimeAppVersion,
  openOfficialAppDestination,
} from '../src/lib/appInfo.ts';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('About follows General as the final Application section', async () => {
  const registry = await source('src/lib/settingsSectionRegistry.ts');
  const general = registry.indexOf('id: "general"');
  const about = registry.indexOf('id: "about"');
  const ai = registry.indexOf('id: "ai-provider"');

  assert.ok(general >= 0 && about > general && ai > about);
  assert.match(registry, /id: "about"[\s\S]*icon: "info"[\s\S]*group: "Application"/);
});

test('runtime version uses the native application API without inventing a browser version', async () => {
  let reads = 0;
  assert.deepEqual(await getRuntimeAppVersion({
    isNative: false,
    getVersion: async () => { reads += 1; return '9.9.9'; },
    openUrl: async () => undefined,
  }), { kind: 'development' });
  assert.equal(reads, 0);

  assert.deepEqual(await getRuntimeAppVersion({
    isNative: true,
    getVersion: async () => '0.2.7',
    openUrl: async () => undefined,
  }), { kind: 'version', value: '0.2.7' });

  assert.deepEqual(await getRuntimeAppVersion({
    isNative: true,
    getVersion: async () => { throw new Error('not available'); },
    openUrl: async () => undefined,
  }), { kind: 'unavailable' });
});

test('About opens only the two official HTTPS GitHub destinations', async () => {
  assert.deepEqual(APP_DESTINATIONS, {
    repository: 'https://github.com/sivenDev/IdeaSlide',
    releases: 'https://github.com/sivenDev/IdeaSlide/releases',
  });

  const opened = [];
  const platform = {
    isNative: true,
    getVersion: async () => '0.2.7',
    openUrl: async (url) => { opened.push(url); },
  };
  await openOfficialAppDestination('repository', platform);
  await openOfficialAppDestination('releases', platform);
  assert.deepEqual(opened, [APP_DESTINATIONS.repository, APP_DESTINATIONS.releases]);

  await assert.rejects(
    openOfficialAppDestination('untrusted', platform),
    /not an approved IdeaNote destination/,
  );
});

test('About is read-only, accessible, and reports link failures inline', async () => {
  const component = await source('src/components/settings/AboutSettings.tsx');
  const css = await source('src/index.css');

  assert.match(component, /IdeaNote/);
  assert.match(component, /Version/);
  assert.match(component, /GitHub repository/);
  assert.match(component, /Release downloads/);
  assert.match(component, /role="alert"/);
  assert.match(component, /aria-label="Open IdeaNote GitHub repository"/);
  assert.match(component, /aria-label="Open IdeaNote release downloads"/);
  assert.doesNotMatch(component, /<input|<select|<textarea|Update|release notes/i);

  for (const selector of [
    '.ideanote-about',
    '.ideanote-about__identity',
    '.ideanote-about__version',
    '.ideanote-about__link',
    '.ideanote-about__link:focus-visible',
  ]) assert.match(css, new RegExp(selector.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&')));
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.ideanote-about/);
  assert.doesNotMatch(css.match(/\/\* F057:[\s\S]*?(?=\/\*|$)/)?.[0] ?? '', /#[0-9a-f]{3,8}\b/i);
});
