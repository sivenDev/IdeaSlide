export type ListDropPosition = "before" | "after";

export function resolveListDropIndex(
  length: number,
  fromIndex: number,
  targetIndex: number,
  position: ListDropPosition,
): number {
  if (length <= 0 || fromIndex < 0 || fromIndex >= length || targetIndex < 0 || targetIndex >= length) {
    return fromIndex;
  }
  let insertionIndex = targetIndex + (position === "after" ? 1 : 0);
  if (fromIndex < insertionIndex) insertionIndex -= 1;
  return Math.max(0, Math.min(insertionIndex, length - 1));
}

export function moveItemToIndex<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0
    || fromIndex >= items.length
    || toIndex < 0
    || toIndex >= items.length
    || fromIndex === toIndex
  ) {
    return items as T[];
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return items as T[];
  next.splice(toIndex, 0, moved);
  return next;
}
