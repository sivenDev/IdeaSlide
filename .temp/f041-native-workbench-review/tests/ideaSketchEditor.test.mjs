import assert from "node:assert/strict";
import test from "node:test";
import { describeSketch, ensureIdeaSketchModel, moveItem } from "../src/editors/ideasketch/ideaSketchModel.js";

test("IdeaSketch always has an active Page", () => {
  const model = ensureIdeaSketchModel({ pages: [], cameras: [] });
  assert.equal(model.pages.length, 1);
  assert.equal(model.activePageId, model.pages[0].id);
});

test("Page and Camera projections remain ordered", () => {
  assert.deepEqual(moveItem(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
  const summary = describeSketch({ pages: [{ id: "p", name: "Page", elements: [{ id: "e" }] }], cameras: [{ id: "c", name: "Camera", pageId: "p" }], activePageId: "p" });
  assert.equal(summary.pages[0].elements, 1);
  assert.equal(summary.cameras[0].pageId, "p");
});
