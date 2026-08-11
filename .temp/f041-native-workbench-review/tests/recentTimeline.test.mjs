import assert from "node:assert/strict";
import test from "node:test";
import { groupRecentsByTimeline } from "../src/lib/recentTimeline.js";

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const reference = Date.parse("2026-08-11T12:00:00Z");

test("Recents form an ordered timeline without changing file order", () => {
  const groups = groupRecentsByTimeline([
    { id: "older", openedAt: reference - 12 * day },
    { id: "today-later", openedAt: reference - hour },
    { id: "week", openedAt: reference - 4 * day },
    { id: "yesterday", openedAt: reference - day },
    { id: "today-latest", openedAt: reference },
  ]);

  assert.deepEqual(groups.map((group) => group.label), ["Today", "Yesterday", "Previous 7 Days", "Older"]);
  assert.deepEqual(groups.flatMap((group) => group.items.map((item) => item.id)), [
    "today-latest",
    "today-later",
    "yesterday",
    "week",
    "older",
  ]);
});

test("Recents with missing timestamps remain in the final timeline group", () => {
  const groups = groupRecentsByTimeline([
    { id: "known", openedAt: reference },
    { id: "unknown" },
  ]);

  assert.equal(groups.at(-1).label, "Older");
  assert.equal(groups.at(-1).items.at(-1).id, "unknown");
});
