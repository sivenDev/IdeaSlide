import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editorSource = readFileSync(
  new URL("../src/editors/ideasketch/IdeaSketchEditor.jsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("IdeaSketch opens one left tool drawer from the canvas menu button", () => {
  assert.match(editorSource, /className="ideasketch-drawer-trigger"/);
  assert.match(editorSource, /aria-label="Open IdeaSketch menu"/);
  assert.match(editorSource, /useState\(false\)/);
  assert.match(editorSource, /<IdeaSketchDrawer[\s\S]*?<ResizableDivider[\s\S]*?<main className="ideasketch-canvas"/);
  assert.doesNotMatch(editorSource, /className="editor-native-toolbar"/);
  assert.doesNotMatch(editorSource, />Navigator</);
});

test("the drawer combines counted Pages and Cameras with canvas commands", () => {
  assert.match(editorSource, /className="drawer-tab-count">\{model\.pages\.length\}/);
  assert.match(editorSource, /className="drawer-tab-count">\{activeCameras\.length\}/);
  assert.match(editorSource, />Canvas & export</);
  assert.match(editorSource, />Clean diagram</);
  assert.match(editorSource, />Present</);
  assert.match(editorSource, />Canvas background</);
  assert.match(editorSource, />PNG</);
  assert.match(editorSource, />SVG</);
  assert.match(editorSource, />draw\.io</);
});

test("drawer state is demo-local, keyboard dismissible, and production-isolated", () => {
  assert.match(editorSource, /ideanote-review-ideasketch-drawer-width/);
  assert.match(editorSource, /ideanote-review-ideasketch-drawer-tab/);
  assert.match(editorSource, /event\.key === "Escape"[\s\S]*setDrawerOpen\(false\)/);
  assert.doesNotMatch(editorSource, /from\s+["']\.\.\/\.\.\/\.\.\/src\//);
  assert.match(styles, /\.ideasketch-tool-drawer\s*\{/);
  assert.match(styles, /\.ideasketch-drawer-trigger\s*\{/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.ideasketch-tool-drawer/);
});
