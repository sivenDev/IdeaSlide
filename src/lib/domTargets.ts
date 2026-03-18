interface NodeLike {
  parentNode: NodeLike | null;
}

export function isTargetWithinNode(
  root: NodeLike | null,
  target: EventTarget | NodeLike | null,
) {
  if (!root || !target || typeof target !== "object") {
    return false;
  }

  let current: NodeLike | null = target as NodeLike;

  while (current) {
    if (current === root) {
      return true;
    }
    current = current.parentNode;
  }

  return false;
}
