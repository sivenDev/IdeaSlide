import type { RecentFile } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RecentTimelineGroup {
  id: "today" | "yesterday" | "week" | "older";
  label: string;
  items: RecentFile[];
}

const definitions: Array<Pick<RecentTimelineGroup, "id" | "label">> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "Previous 7 Days" },
  { id: "older", label: "Older" },
];

function localDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function groupId(openedAt: number, referenceDay: number): RecentTimelineGroup["id"] {
  if (!Number.isFinite(openedAt)) return "older";
  const distance = Math.max(0, Math.floor((referenceDay - localDay(openedAt)) / DAY_MS));
  if (distance === 0) return "today";
  if (distance === 1) return "yesterday";
  if (distance <= 7) return "week";
  return "older";
}

export function groupRecentFiles(
  recentFiles: RecentFile[],
  referenceTime = Date.now(),
): RecentTimelineGroup[] {
  const sorted = [...recentFiles].sort((left, right) => {
    const leftTime = Date.parse(left.opened_at);
    const rightTime = Date.parse(right.opened_at);
    return (Number.isFinite(rightTime) ? rightTime : Number.NEGATIVE_INFINITY)
      - (Number.isFinite(leftTime) ? leftTime : Number.NEGATIVE_INFINITY);
  });
  const referenceDay = localDay(referenceTime);
  const byGroup = new Map(definitions.map(({ id }) => [id, [] as RecentFile[]]));
  for (const item of sorted) {
    byGroup.get(groupId(Date.parse(item.opened_at), referenceDay))?.push(item);
  }
  return definitions
    .map((definition) => ({ ...definition, items: byGroup.get(definition.id) ?? [] }))
    .filter((group) => group.items.length > 0);
}

export function fileNameFromPath(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() || path;
}
