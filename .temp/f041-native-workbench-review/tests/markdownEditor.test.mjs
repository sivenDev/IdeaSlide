import assert from "node:assert/strict";
import test from "node:test";
import { buildOutline, normalizeLineEndings } from "../src/editors/markdown/markdownModel.js";

test("Markdown outline keeps heading levels and source lines", () => {
  assert.deepEqual(buildOutline("# One\ntext\n## Two"), [
    { level: 1, text: "One", line: 1 },
    { level: 2, text: "Two", line: 3 },
  ]);
});

test("Markdown line-ending normalization is explicit", () => {
  assert.equal(normalizeLineEndings("one\r\ntwo\n", "lf"), "one\ntwo\n");
  assert.equal(normalizeLineEndings("one\r\ntwo\n", "crlf"), "one\r\ntwo\r\n");
});
