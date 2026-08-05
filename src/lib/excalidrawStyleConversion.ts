export type StyleConversionTarget = "current-page" | "new-page";

export interface StyleConversionSummary {
  converted: number;
  retained: number;
  skipped: number;
}

export interface StyleConversionRuntime {
  createId: () => string;
  createNonce: () => number;
  now: () => number;
}

interface StyleConversionResult {
  elements: any[];
  selectedElementIds: Record<string, boolean>;
  convertedElementIds: Record<string, boolean>;
  summary: StyleConversionSummary;
}

export interface NewPageStyleConversionResult extends StyleConversionResult {
  files: Record<string, any>;
}

const CONVERTIBLE_TYPES = new Set(["rectangle", "ellipse", "diamond", "text", "line", "arrow"]);
const RETAINED_TYPES = new Set(["image", "freedraw"]);
const HELVETICA_FONT_FAMILY = 2;

function defaultRuntime(): StyleConversionRuntime {
  return {
    createId: () => crypto.randomUUID(),
    createNonce: () => Math.floor(Math.random() * 2147483647),
    now: () => Date.now(),
  };
}

function getRuntime(runtime?: Partial<StyleConversionRuntime>): StyleConversionRuntime {
  return { ...defaultRuntime(), ...runtime };
}

function isCameraElement(element: any) {
  return element?.customData?.type === "camera";
}

function getSelectedIds(selectedElementIds?: Record<string, boolean>) {
  return new Set(
    Object.entries(selectedElementIds ?? {})
      .filter(([, selected]) => Boolean(selected))
      .map(([id]) => id),
  );
}

function collectSelectionClosure(
  elements: readonly any[],
  selectedElementIds?: Record<string, boolean>,
) {
  const liveElements = elements.filter((element) => !element?.isDeleted);
  const elementById = new Map(liveElements.map((element) => [element.id, element]));
  const selectedIds = getSelectedIds(selectedElementIds);
  const closure = new Set([...selectedIds].filter((id) => elementById.has(id)));

  let changed = true;
  while (changed) {
    changed = false;
    const groupIds = new Set<string>();

    for (const id of closure) {
      const element = elementById.get(id);
      for (const groupId of element?.groupIds ?? []) groupIds.add(groupId);

      if (element?.type === "text" && element.containerId && elementById.has(element.containerId)) {
        if (!closure.has(element.containerId)) {
          closure.add(element.containerId);
          changed = true;
        }
      }

      for (const binding of element?.boundElements ?? []) {
        if (binding?.type !== "text" || !elementById.has(binding.id) || closure.has(binding.id)) continue;
        closure.add(binding.id);
        changed = true;
      }
    }

    if (groupIds.size > 0) {
      for (const element of liveElements) {
        if (closure.has(element.id)) continue;
        if ((element.groupIds ?? []).some((groupId: string) => groupIds.has(groupId))) {
          closure.add(element.id);
          changed = true;
        }
      }
    }
  }

  return closure;
}

function getCleanStyleUpdates(element: any) {
  switch (element?.type) {
    case "rectangle":
    case "ellipse":
    case "diamond":
      return { roughness: 0, strokeStyle: "solid", fillStyle: "solid" };
    case "line":
    case "arrow":
      return { roughness: 0, strokeStyle: "solid" };
    case "text":
      return { roughness: 0, fontFamily: HELVETICA_FONT_FAMILY };
    default:
      return {};
  }
}

function hasStyleDelta(element: any) {
  if (!CONVERTIBLE_TYPES.has(element?.type) || isCameraElement(element)) return false;
  return Object.entries(getCleanStyleUpdates(element)).some(([key, value]) => element[key] !== value);
}

function getClassification(element: any) {
  if (isCameraElement(element)) return "skipped" as const;
  if (CONVERTIBLE_TYPES.has(element?.type)) {
    return hasStyleDelta(element) ? "converted" as const : "retained" as const;
  }
  if (RETAINED_TYPES.has(element?.type)) return "retained" as const;
  return "skipped" as const;
}

function summarize(elements: readonly any[], closure: ReadonlySet<string>): StyleConversionSummary {
  const summary: StyleConversionSummary = { converted: 0, retained: 0, skipped: 0 };
  for (const element of elements) {
    if (!closure.has(element.id) || element.isDeleted) continue;
    summary[getClassification(element)] += 1;
  }
  return summary;
}

function versionElement(
  element: any,
  updates: Record<string, unknown>,
  runtime: StyleConversionRuntime,
) {
  return {
    ...element,
    ...updates,
    version: (element.version ?? 0) + 1,
    versionNonce: runtime.createNonce(),
    updated: runtime.now(),
  };
}

function remapBinding(binding: any, idMap: ReadonlyMap<string, string>) {
  if (!binding?.elementId) return binding ?? null;
  const mappedId = idMap.get(binding.elementId);
  return mappedId ? { ...binding, elementId: mappedId } : null;
}

function remapBoundElements(boundElements: any, idMap: ReadonlyMap<string, string>) {
  if (!Array.isArray(boundElements)) return boundElements ?? null;
  return boundElements
    .filter((binding) => idMap.has(binding.id))
    .map((binding) => ({ ...binding, id: idMap.get(binding.id) }));
}

export function getStyleConversionAvailability(
  elements: readonly any[],
  selectedElementIds?: Record<string, boolean>,
  readOnly = false,
) {
  if (readOnly) return false;
  const closure = collectSelectionClosure(elements, selectedElementIds);
  return elements.some((element) => closure.has(element.id) && hasStyleDelta(element));
}

export function buildCurrentPageStyleConversion(
  elements: readonly any[],
  selectedElementIds?: Record<string, boolean>,
  runtimeOptions?: Partial<StyleConversionRuntime>,
): StyleConversionResult {
  const runtime = getRuntime(runtimeOptions);
  const closure = collectSelectionClosure(elements, selectedElementIds);
  const summary = summarize(elements, closure);

  return {
    elements: elements.map((element) => {
      if (!closure.has(element.id) || !hasStyleDelta(element)) return element;
      return versionElement(element, getCleanStyleUpdates(element), runtime);
    }),
    selectedElementIds: { ...(selectedElementIds ?? {}) },
    convertedElementIds: Object.fromEntries(
      elements
        .filter((element) => closure.has(element.id) && hasStyleDelta(element))
        .map((element) => [element.id, true]),
    ),
    summary,
  };
}

export function buildNewPageStyleConversion(
  elements: readonly any[],
  selectedElementIds: Record<string, boolean> | undefined,
  files: Record<string, any>,
  runtimeOptions?: Partial<StyleConversionRuntime>,
): NewPageStyleConversionResult {
  const runtime = getRuntime(runtimeOptions);
  const closure = collectSelectionClosure(elements, selectedElementIds);
  const summary = summarize(elements, closure);
  const included = elements.filter(
    (element) => closure.has(element.id) && !element.isDeleted && getClassification(element) !== "skipped",
  );
  const idMap = new Map(included.map((element) => [element.id, runtime.createId()]));
  const groupMap = new Map<string, string>();

  for (const element of included) {
    for (const groupId of element.groupIds ?? []) {
      if (!groupMap.has(groupId)) groupMap.set(groupId, runtime.createId());
    }
  }

  const nextElements = included.map((element) => {
    const copied = structuredClone(element);
    const updates = CONVERTIBLE_TYPES.has(element.type) ? getCleanStyleUpdates(element) : {};
    const next = {
      ...copied,
      ...updates,
      id: idMap.get(element.id),
      groupIds: (element.groupIds ?? []).map((groupId: string) => groupMap.get(groupId)),
      frameId: element.frameId ? idMap.get(element.frameId) ?? null : null,
      boundElements: remapBoundElements(element.boundElements, idMap),
      version: 1,
      versionNonce: runtime.createNonce(),
      seed: runtime.createNonce(),
      updated: runtime.now(),
    };

    if (element.type === "text") {
      next.containerId = element.containerId ? idMap.get(element.containerId) ?? null : null;
    }
    if (element.type === "line" || element.type === "arrow") {
      next.startBinding = remapBinding(element.startBinding, idMap);
      next.endBinding = remapBinding(element.endBinding, idMap);
    }

    return next;
  });

  const nextFiles: Record<string, any> = {};
  for (const element of nextElements) {
    if (element.type !== "image" || !element.fileId || !files[element.fileId]) continue;
    nextFiles[element.fileId] = structuredClone(files[element.fileId]);
  }

  return {
    elements: nextElements,
    files: nextFiles,
    selectedElementIds: Object.fromEntries(nextElements.map((element) => [element.id, true])),
    convertedElementIds: Object.fromEntries(
      included
        .filter((element) => hasStyleDelta(element))
        .map((element) => [idMap.get(element.id), true]),
    ),
    summary,
  };
}

function elementLabel(count: number) {
  return count === 1 ? "element" : "elements";
}

export function formatStyleConversionSummary(summary: StyleConversionSummary) {
  return [
    `Converted ${summary.converted} ${elementLabel(summary.converted)}.`,
    `Kept ${summary.retained} unchanged.`,
    `Skipped ${summary.skipped} unsupported ${elementLabel(summary.skipped)}.`,
  ].join(" ");
}
