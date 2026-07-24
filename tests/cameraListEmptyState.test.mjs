import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("CameraList renders a compact directional empty state", async () => {
  const source = await readSource("src/components/CameraList.tsx");

  assert.match(source, /cameras\.length === 0/);
  assert.match(source, /No cameras yet/);
  assert.match(source, /Add a camera frame to turn this Canvas into a focused sequence/);
  assert.match(source, /idea-slide-camera-empty/);
  assert.doesNotMatch(source, /text-center/);
  assert.doesNotMatch(source, /thumbnail/i);
  assert.doesNotMatch(source, /SVGSVGElement/);
});
