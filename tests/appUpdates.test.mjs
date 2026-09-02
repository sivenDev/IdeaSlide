import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AppUpdateController,
  shouldEnableAppUpdates,
} from '../src/lib/appUpdates.ts';

class FakeUpdate {
  constructor(version = '0.3.0', source) {
    this.currentVersion = '0.2.6';
    this.version = version;
    this.date = '2026-08-12T00:00:00Z';
    this.body = 'A safer updater.';
    this.source = source;
    this.calls = [];
    this.downloadError = undefined;
    this.installError = undefined;
  }

  async download(onEvent) {
    this.calls.push('download');
    if (this.downloadError) throw this.downloadError;
    onEvent?.({ event: 'Started', data: { contentLength: 100 } });
    onEvent?.({ event: 'Progress', data: { chunkLength: 40 } });
    onEvent?.({ event: 'Progress', data: { chunkLength: 60 } });
    onEvent?.({ event: 'Finished' });
  }

  async install() {
    this.calls.push('install');
    if (this.installError) throw this.installError;
  }

  async close() {
    this.calls.push('close');
  }
}

class PendingDownloadUpdate extends FakeUpdate {
  constructor(version = '0.3.0', source) {
    super(version, source);
    this.resolveDownload = undefined;
  }

  async download(onEvent) {
    this.calls.push('download');
    onEvent?.({ event: 'Started', data: { contentLength: 100 } });
    await new Promise((resolve) => {
      this.resolveDownload = resolve;
    });
    onEvent?.({ event: 'Finished' });
  }
}

function createClient(updates) {
  const queue = [...updates];
  return {
    checks: 0,
    relaunched: 0,
    async check() {
      this.checks += 1;
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return next ?? null;
    },
    async relaunch() {
      this.relaunched += 1;
    },
  };
}

test('a failed proxy package download switches to the matching official resource', async () => {
  const proxy = new FakeUpdate('0.3.0', 'proxy');
  proxy.downloadError = new Error('proxy unavailable');
  const official = new FakeUpdate('0.3.0', 'official');
  const client = createClient([proxy]);
  client.checkOfficial = async (version) => {
    assert.equal(version, '0.3.0');
    return official;
  };
  const controller = new AppUpdateController(client);

  await controller.check({ force: true });
  await controller.download();

  assert.equal(controller.getState().phase, 'ready');
  assert.deepEqual(proxy.calls, ['download', 'close']);
  assert.deepEqual(official.calls, ['download']);
  assert.equal(await controller.install(async () => true), true);
  assert.deepEqual(official.calls, ['download', 'install']);
});

test('proxy and official package failures retain the update and remain retryable', async () => {
  const proxy = new FakeUpdate('0.3.0', 'proxy');
  proxy.downloadError = new Error('proxy unavailable');
  const official = new FakeUpdate('0.3.0', 'official');
  official.downloadError = new Error('github unavailable');
  const client = createClient([proxy]);
  client.checkOfficial = async () => official;
  const controller = new AppUpdateController(client);

  await controller.check({ force: true });
  await controller.download();

  assert.equal(controller.getState().phase, 'error');
  assert.equal(controller.getState().retryAction, 'download');
  assert.equal(controller.getState().availableVersion, '0.3.0');
  assert.match(controller.getState().error, /official GitHub fallback also failed/);
  assert.deepEqual(proxy.calls, ['download', 'close']);
  assert.deepEqual(official.calls, ['download', 'close']);
});

test('an official fallback download failure closes the fallback resource', async () => {
  const proxy = new FakeUpdate('0.3.0', 'proxy');
  proxy.downloadError = new Error('proxy unavailable');
  const official = new FakeUpdate('0.3.0', 'official');
  official.downloadError = new Error('github unavailable');
  const client = createClient([proxy]);
  client.checkOfficial = async () => official;
  const controller = new AppUpdateController(client);

  await controller.check({ force: true });
  await controller.download();

  assert.deepEqual(official.calls, ['download', 'close']);
});

test('updates run only in the native main window', () => {
  assert.equal(shouldEnableAppUpdates({ isTauri: true, windowLabel: 'main' }), true);
  assert.equal(shouldEnableAppUpdates({ isTauri: false, windowLabel: 'main' }), false);
  assert.equal(shouldEnableAppUpdates({ isTauri: true, windowLabel: 'preview-renderer' }), false);
});

test('checking is throttled and exposes a newer version without auto-downloading it', async () => {
  let now = 1_000;
  const update = new FakeUpdate();
  const client = createClient([update, null]);
  const controller = new AppUpdateController(client, { now: () => now, checkIntervalMs: 3_600_000 });

  await controller.check();
  assert.equal(controller.getState().phase, 'available');
  assert.equal(controller.getState().availableVersion, '0.3.0');
  assert.deepEqual(update.calls, []);

  await controller.check();
  assert.equal(client.checks, 1);
  now += 3_600_001;
  await controller.check();
  assert.equal(client.checks, 2);
  assert.equal(controller.getState().phase, 'idle');
  assert.deepEqual(update.calls, ['close']);
});

test('download progress reaches ready and install waits for the shared exit decision', async () => {
  const update = new FakeUpdate();
  const client = createClient([update]);
  const controller = new AppUpdateController(client);
  await controller.check({ force: true });

  await controller.download();
  assert.equal(controller.getState().phase, 'ready');
  assert.equal(controller.getState().downloadedBytes, 100);
  assert.equal(controller.getState().totalBytes, 100);

  const cancelled = await controller.install(async () => false);
  assert.equal(cancelled, false);
  assert.equal(controller.getState().phase, 'ready');
  assert.deepEqual(update.calls, ['download']);

  const installed = await controller.install(async () => true);
  assert.equal(installed, true);
  assert.deepEqual(update.calls, ['download', 'install']);
  assert.equal(client.relaunched, 1);
});

test('native relaunch is requested only after installation resolves', async () => {
  const events = [];
  const update = new FakeUpdate();
  update.install = async () => {
    events.push('install:start');
    await Promise.resolve();
    events.push('install:complete');
  };
  const client = createClient([update]);
  client.relaunch = async () => {
    events.push('relaunch');
    client.relaunched += 1;
  };
  const controller = new AppUpdateController(client);
  await controller.check({ force: true });
  await controller.download();

  assert.equal(await controller.install(async () => true), true);
  assert.deepEqual(events, ['install:start', 'install:complete', 'relaunch']);
});

test('a failed native handoff retries relaunch without reinstalling the update', async () => {
  const update = new FakeUpdate();
  const client = createClient([update]);
  client.relaunch = async () => {
    client.relaunched += 1;
    if (client.relaunched === 1) throw new Error('LaunchServices rejected the request');
  };
  const controller = new AppUpdateController(client);
  await controller.check({ force: true });
  await controller.download();

  assert.equal(await controller.install(async () => true), true);
  assert.equal(controller.getState().phase, 'error');
  assert.equal(controller.getState().retryAction, 'install');
  assert.deepEqual(update.calls, ['download', 'install']);

  assert.equal(await controller.install(async () => true), true);
  assert.deepEqual(update.calls, ['download', 'install']);
  assert.equal(client.relaunched, 2);
});

test('a deferred downloaded update survives foreground checks', async () => {
  let now = 1_000;
  const update = new FakeUpdate();
  const client = createClient([update, null]);
  const controller = new AppUpdateController(client, { now: () => now, checkIntervalMs: 3_600_000 });

  await controller.check();
  await controller.download();
  now += 3_600_001;
  await controller.check();

  assert.equal(client.checks, 1);
  assert.equal(controller.getState().phase, 'ready');
  assert.deepEqual(update.calls, ['download']);
});

test('refreshing a known update keeps it visible and actionable until the check resolves', async () => {
  let resolveCheck;
  const update = new FakeUpdate();
  const client = createClient([update]);
  const controller = new AppUpdateController(client);
  await controller.check({ force: true });
  client.check = () => new Promise((resolve) => { resolveCheck = resolve; });

  const refresh = controller.check({ force: true });
  assert.equal(controller.getState().phase, 'available');
  assert.equal(controller.getState().availableVersion, '0.3.0');
  resolveCheck(update);
  await refresh;
});

test('duplicate restart clicks share one exit decision and one installation', async () => {
  const update = new FakeUpdate();
  const client = createClient([update]);
  const controller = new AppUpdateController(client);
  await controller.check({ force: true });
  await controller.download();

  let releaseExitDecision;
  let confirmationCalls = 0;
  const confirmExit = () => {
    confirmationCalls += 1;
    return new Promise((resolve) => { releaseExitDecision = resolve; });
  };
  const first = controller.install(confirmExit);
  const second = controller.install(confirmExit);
  releaseExitDecision(true);

  assert.equal(await first, true);
  assert.equal(await second, false);
  assert.equal(confirmationCalls, 1);
  assert.deepEqual(update.calls, ['download', 'install']);
  assert.equal(client.relaunched, 1);
});

test('version-scoped dismissal returns the full notice for a newer update', async () => {
  let dismissedVersion = null;
  const first = new FakeUpdate('0.3.0');
  const second = new FakeUpdate('0.4.0');
  const controller = new AppUpdateController(createClient([first, second]), {
    getDismissedVersion: () => dismissedVersion,
    setDismissedVersion: (version) => { dismissedVersion = version; },
  });

  await controller.check({ force: true });
  controller.dismiss();
  assert.equal(controller.getState().dismissed, true);
  await controller.check({ force: true });
  assert.equal(controller.getState().availableVersion, '0.4.0');
  assert.equal(controller.getState().dismissed, false);
  assert.deepEqual(first.calls, ['close']);
});

test('known update failures remain retryable and retain their version', async () => {
  const update = new FakeUpdate();
  update.downloadError = new Error('offline');
  const client = createClient([update]);
  const controller = new AppUpdateController(client);
  await controller.check({ force: true });
  await controller.download();

  assert.equal(controller.getState().phase, 'error');
  assert.equal(controller.getState().retryAction, 'download');
  assert.equal(controller.getState().availableVersion, '0.3.0');

  update.downloadError = undefined;
  await controller.retry();
  assert.equal(controller.getState().phase, 'ready');
});

test('dismissing during an active download does not persist the update as ignored', async () => {
  let dismissedVersion = null;
  const update = new PendingDownloadUpdate('0.3.8');
  const controller = new AppUpdateController(createClient([update]), {
    getDismissedVersion: () => dismissedVersion,
    setDismissedVersion: (version) => { dismissedVersion = version; },
  });

  await controller.check({ force: true });
  const download = controller.download();
  assert.equal(controller.getState().phase, 'downloading');

  controller.dismiss();
  assert.equal(dismissedVersion, null);
  assert.equal(controller.getState().dismissed, false);

  update.resolveDownload();
  await download;
  assert.equal(controller.getState().phase, 'ready');

  const nextUpdate = new FakeUpdate('0.3.8');
  const nextController = new AppUpdateController(createClient([nextUpdate]), {
    getDismissedVersion: () => dismissedVersion,
    setDismissedVersion: (version) => { dismissedVersion = version; },
  });
  await nextController.check({ force: true });
  assert.equal(nextController.getState().availableVersion, '0.3.8');
  assert.equal(nextController.getState().dismissed, false);
});
