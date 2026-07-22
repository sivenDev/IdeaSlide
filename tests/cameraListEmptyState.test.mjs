import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("CameraList renders a centered text-only empty state", async () => {
  const source = await readSource("src/components/CameraList.tsx");

  assert.match(source, /cameras\.length === 0/);
  assert.match(source, /No cameras yet/);
  assert.match(source, /Add camera frames on this Canvas/);
  assert.match(source, /text-center/);
  assert.doesNotMatch(source, /thumbnail/i);
  assert.doesNotMatch(source, /SVGSVGElement/);
});
