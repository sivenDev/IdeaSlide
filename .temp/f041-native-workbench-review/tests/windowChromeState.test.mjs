import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MockWindowApi, windowChromeInsets } from "../src/mock/mockWindowApi.js";

test("window chrome insets reserve native controls only when the platform needs them", () => {
  assert.deepEqual(windowChromeInsets({ platform: "macos", fullscreen: false }), { left: 72, right: 0, trafficLights: true });
  assert.deepEqual(windowChromeInsets({ platform: "macos", fullscreen: true }), { left: 0, right: 0, trafficLights: false });
  assert.deepEqual(windowChromeInsets({ platform: "windows", fullscreen: false }), { left: 0, right: 138, trafficLights: false });
  assert.deepEqual(windowChromeInsets({ platform: "windows", fullscreen: true }), { left: 0, right: 0, trafficLights: false });
  assert.deepEqual(windowChromeInsets({ platform: "browser", fullscreen: false }), { left: 0, right: 0, trafficLights: false });
});

test("mock window boundary emits repeatable fullscreen transitions", () => {
  const api = new MockWindowApi({ platform: "macos", fullscreen: false });
  const states = [];
  const unsubscribe = api.subscribe((state) => states.push(state));
  api.setFullscreen(true);
  api.setFullscreen(false);
  unsubscribe();
  assert.deepEqual(states.map((state) => state.fullscreen), [true, false]);
  assert.equal(api.getState().platform, "macos");
});

test("shell delegates native-control geometry to WindowChrome and safe-area tokens", async () => {
  const [app, chrome, css] = await Promise.all([
    readFile(new URL("../src/app/DemoApp.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/layout/WindowChrome.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /WindowChrome/);
  assert.match(chrome, /data-tauri-drag-region/);
  assert.match(chrome, /trafficLights/);
  assert.match(css, /--native-left-safe/);
  assert.match(css, /--native-right-safe/);
  assert.equal(css.includes(".window-controls { position: absolute; z-index: 25; top: 7px; left: 12px"), false);
});
