const DAY_MS = 24 * 60 * 60 * 1000;

const timelineDefinitions = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "Previous 7 Days" },
  { id: "older", label: "Older" },
];

function utcDay(timestamp) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function timelineId(openedAt, referenceDay) {
  if (!Number.isFinite(openedAt) || referenceDay === null) return "older";
  const distance = Math.max(0, Math.round((referenceDay - utcDay(openedAt)) / DAY_MS));
  if (distance === 0) return "today";
  if (distance === 1) return "yesterday";
  if (distance <= 7) return "week";
  return "older";
}

export function groupRecentsByTimeline(recents) {
  const sorted = [...recents].sort((left, right) => {
    const leftTime = Number.isFinite(left.openedAt) ? left.openedAt : Number.NEGATIVE_INFINITY;
    const rightTime = Number.isFinite(right.openedAt) ? right.openedAt : Number.NEGATIVE_INFINITY;
    return rightTime - leftTime;
  });
  const newest = sorted.find((recent) => Number.isFinite(recent.openedAt));
  const referenceDay = newest ? utcDay(newest.openedAt) : null;
  const itemsByGroup = new Map(timelineDefinitions.map(({ id }) => [id, []]));

  sorted.forEach((recent) => itemsByGroup.get(timelineId(recent.openedAt, referenceDay)).push(recent));

  return timelineDefinitions
    .map((definition) => ({ ...definition, items: itemsByGroup.get(definition.id) }))
    .filter((group) => group.items.length > 0);
}
