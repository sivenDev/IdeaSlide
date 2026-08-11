import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { demoReducer, initialState } from "../src/app/demoStore.js";

test("Workspace tree uses dnd-kit pointer and keyboard sensors with typed drop targets", async () => {
  const [source, pkg] = await Promise.all([
    readFile(new URL("../src/components/workspace/WorkspacePanel.jsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(pkg, /@dnd-kit\/core/);
  assert.match(source, /DndContext/);
  assert.match(source, /PointerSensor/);
  assert.match(source, /KeyboardSensor/);
  assert.match(source, /useDraggable/);
  assert.match(source, /useDroppable/);
  assert.match(source, /onMoveEntry/);
  assert.equal(source.includes("draggable="), false);
});

test("successful subtree move remaps selected paths, expanded keys, and open dirty sessions", () => {
  const sessionId = "workspace:ws-product:Planning/Launch/brief.md";
  const state = {
    ...initialState,
    selectedPath: "ws-product:Planning/Launch/brief.md",
    activeSessionId: sessionId,
    expandedDirectories: new Set(["ws-product:Planning", "ws-product:Planning/Launch"]),
    sessions: {
      [sessionId]: {
        sessionId,
        mode: "workspace",
        workspaceId: "ws-product",
        path: "Planning/Launch/brief.md",
        name: "brief.md",
        dirty: true,
        content: "unsaved",
      },
    },
  };

  const next = demoReducer(state, {
    type: "remap-workspace-path",
    workspaceId: "ws-product",
    previousPath: "Planning/Launch",
    nextPath: "Archive/Launch",
  });

  const nextSessionId = "workspace:ws-product:Archive/Launch/brief.md";
  assert.equal(next.activeSessionId, nextSessionId);
  assert.equal(next.selectedPath, "ws-product:Archive/Launch/brief.md");
  assert.equal(next.sessions[nextSessionId].dirty, true);
  assert.equal(next.sessions[nextSessionId].content, "unsaved");
  assert.equal(next.sessions[nextSessionId].path, "Archive/Launch/brief.md");
  assert.equal(next.expandedDirectories.has("ws-product:Archive/Launch"), true);
  assert.equal(next.expandedDirectories.has("ws-product:Planning/Launch"), false);
});
