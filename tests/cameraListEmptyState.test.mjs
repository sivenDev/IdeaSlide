import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("CameraList renders a centered empty-state stack with icon, title, and helper copy", async () => {
  const source = await readSource("src/components/CameraList.tsx");

  assert.match(source, /cameras\.length === 0/);
  assert.match(source, /flex-col/);
  assert.match(source, /No cameras yet/);
  assert.match(source, /create your first view/);
  assert.match(source, /max-w-\[(?:280|300|320)px\]/);
  assert.match(source, /translate-y-[123]/);
  assert.match(source, /<svg[\s\S]*viewBox="0 0 24 24"/);
});
