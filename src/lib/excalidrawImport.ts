import type { IdeaSketchDocument, IdeaSketchPage } from "../types";

const IDEA_SKETCH_FORMAT_VERSION = "1.0" as const;

const FALLBACK_TITLE = "Imported Page";

export interface ImportedExcalidrawScene {
  title: string;
  sourceName?: string;
  elements: any[];
  appState: Record<string, any>;
  files: Record<string, any>;
}

export interface ImportProjectionOptions {
  pageId?: string;
  now?: string;
  title?: string;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, any>;
}

function normalizeCollection(value: unknown, label: string): Record<string, any> {
  if (value === undefined) return {};
  const record = asRecord(value, label);
  for (const [key, item] of Object.entries(record)) {
    asRecord(item, `${label} entry ${key}`);
  }
  return clone(record);
}

export function sanitizeImportTitle(value: string | undefined): string {
  const sanitized = (value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 120)
    .trim();
  return sanitized || FALLBACK_TITLE;
}

export function deriveImportBaseName(sourceName: string | undefined): string {
  const name = sourceName?.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  return name
    .replace(/\.excalidraw\.json$/i, "")
    .replace(/\.excalidraw$/i, "")
    .replace(/\.json$/i, "")
    .trim();
}

function createPageId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function titleForImport(root: Record<string, any>, sourceName?: string): string {
  const appState = root.appState && typeof root.appState === "object" && !Array.isArray(root.appState)
    ? root.appState as Record<string, any>
    : undefined;
  const preferred = typeof appState?.name === "string" && appState.name.trim()
    ? appState.name
    : typeof root.name === "string" && root.name.trim()
      ? root.name
      : deriveImportBaseName(sourceName);
  return sanitizeImportTitle(preferred || undefined);
}

export function parseExcalidrawImport(input: unknown, sourceName?: string): ImportedExcalidrawScene {
  const root = asRecord(input, "Excalidraw file");
  if (root.type !== undefined && root.type !== "excalidraw") {
    throw new Error("Selected file is not an Excalidraw scene");
  }
  if (root.version !== undefined && (typeof root.version !== "number" || !Number.isFinite(root.version))) {
    throw new Error("Excalidraw version must be a number");
  }

  const rawElements = root.elements === undefined ? [] : root.elements;
  if (!Array.isArray(rawElements)) throw new Error("Excalidraw elements must be an array");
  const elements = rawElements
    .map((element, index) => {
      const record = asRecord(element, `Excalidraw element ${index + 1}`);
      const next = clone(record);
      if (typeof next.id !== "string" || !next.id.trim()) next.id = `imported-element-${index + 1}`;
      return next;
    })
    .filter((element) => element.isDeleted !== true);

  const appState = root.appState === undefined
    ? {}
    : clone(asRecord(root.appState, "Excalidraw appState"));
  const files = normalizeCollection(root.files, "Excalidraw files");
  return {
    title: titleForImport(root, sourceName),
    sourceName,
    elements,
    appState,
    files,
  };
}

export function createIdeaSketchPageFromImport(
  scene: ImportedExcalidrawScene,
  options: ImportProjectionOptions = {},
): IdeaSketchPage {
  return {
    id: options.pageId ?? createPageId(),
    title: sanitizeImportTitle(options.title ?? scene.title),
    elements: clone(scene.elements),
    appState: clone(scene.appState),
    files: clone(scene.files),
  };
}

export function createIdeaSketchDocumentFromImport(
  scene: ImportedExcalidrawScene,
  options: ImportProjectionOptions = {},
): IdeaSketchDocument {
  const now = options.now ?? new Date().toISOString();
  return {
    type: "ideasketch",
    formatVersion: IDEA_SKETCH_FORMAT_VERSION,
    created: now,
    modified: now,
    pages: [createIdeaSketchPageFromImport(scene, options)],
  };
}
