import type {
  IdeaSketchDocument,
  IdeaSketchPage,
} from "../types";

export const IDEA_SKETCH_FORMAT_VERSION = "1.0" as const;
export const LEGACY_WORKSPACE_FORMAT_VERSION = "2.0" as const;

export interface IdeaSketchManifestEntry {
  id: string;
  title: string;
}

export interface IdeaSketchFileData {
  manifest: {
    version: string;
    created: string;
    modified: string;
    slides: IdeaSketchManifestEntry[];
  };
  slides: Array<{
    id: string;
    content: Record<string, any>;
  }>;
  media: Array<{
    id: string;
    mimeType: string;
    ext: string;
    bytesBase64: string;
  }>;
}

export class LegacyIdeaSketchFormatError extends Error {
  readonly kind = "legacy-protected";
  readonly version: string;

  constructor(version: string) {
    super(
      `Legacy .is format version ${version} is not editable by this IdeaNote build. ` +
      "The file was not modified; migration will be provided by Workspace Import/Export.",
    );
    this.name = "LegacyIdeaSketchFormatError";
    this.version = version;
  }
}

interface EmptyDocumentOptions {
  now?: string;
  pageId?: string;
}

function createPageId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `page-${Date.now()}`;
}

function isValidPageId(id: string): boolean {
  return id.length > 0 && /^[A-Za-z0-9_-]+$/.test(id);
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function normalizeScene(content: unknown): Omit<IdeaSketchPage, "id" | "title"> {
  assertRecord(content, "IdeaSketch Page content");
  const files = content.files && typeof content.files === "object"
    ? content.files as Record<string, any>
    : {};
  return {
    elements: Array.isArray(content.elements) ? content.elements : [],
    appState: content.appState && typeof content.appState === "object" ? content.appState : {},
    files,
  };
}

function reconstructMedia(
  files: Record<string, any>,
  media: IdeaSketchFileData["media"],
): Record<string, any> {
  if (!Array.isArray(media) || media.length === 0) {
    return files;
  }
  const mediaById = new Map(media.map((item) => [item.id, item]));
  return Object.fromEntries(
    Object.entries(files).map(([key, entry]) => {
      const id = typeof entry?.id === "string" ? entry.id : key;
      const item = mediaById.get(id);
      if (!item || typeof item.bytesBase64 !== "string" || typeof item.mimeType !== "string") {
        return [key, entry];
      }
      return [key, {
        ...entry,
        id,
        mimeType: item.mimeType,
        dataURL: `data:${item.mimeType};base64,${item.bytesBase64}`,
      }];
    }),
  );
}

export function createEmptyIdeaSketchDocument(
  options: EmptyDocumentOptions = {},
): IdeaSketchDocument {
  const now = options.now ?? new Date().toISOString();
  return {
    type: "ideasketch",
    formatVersion: IDEA_SKETCH_FORMAT_VERSION,
    created: now,
    modified: now,
    pages: [{
      id: options.pageId ?? createPageId(),
      title: "Untitled page",
      elements: [],
      appState: {},
      files: {},
    }],
  };
}

export function parseIdeaSketchFile(data: unknown): IdeaSketchDocument {
  assertRecord(data, "IdeaSketch file data");
  assertRecord(data.manifest, "IdeaSketch manifest");
  const version = data.manifest.version;
  if (version === LEGACY_WORKSPACE_FORMAT_VERSION) {
    throw new LegacyIdeaSketchFormatError(version);
  }
  if (version !== IDEA_SKETCH_FORMAT_VERSION) {
    throw new Error(`Unsupported .is format version ${String(version)}`);
  }
  if (!Array.isArray(data.manifest.slides) || data.manifest.slides.length === 0) {
    throw new Error("IdeaSketch v1 manifest must contain at least one Page");
  }
  if (!Array.isArray(data.slides)) {
    throw new Error("IdeaSketch v1 file is missing Page payloads");
  }

  const payloadById = new Map<string, Record<string, any>>();
  for (const item of data.slides) {
    assertRecord(item, "IdeaSketch Page payload");
    if (typeof item.id !== "string" || !isValidPageId(item.id)) {
      throw new Error(`Invalid IdeaSketch Page payload id: ${String(item.id)}`);
    }
    if (payloadById.has(item.id)) {
      throw new Error(`Duplicate IdeaSketch Page payload id: ${item.id}`);
    }
    assertRecord(item.content, `IdeaSketch Page ${item.id} content`);
    payloadById.set(item.id, item.content);
  }

  const ids = new Set<string>();
  const pages = data.manifest.slides.map((entry: unknown, index: number) => {
    assertRecord(entry, "IdeaSketch manifest Page entry");
    if (typeof entry.id !== "string" || !isValidPageId(entry.id)) {
      throw new Error(`Invalid IdeaSketch Page id: ${String(entry.id)}`);
    }
    if (ids.has(entry.id)) {
      throw new Error(`Duplicate IdeaSketch Page id: ${entry.id}`);
    }
    ids.add(entry.id);
    const payload = payloadById.get(entry.id);
    if (!payload) {
      throw new Error(`Missing IdeaSketch Page payload: ${entry.id}`);
    }
    const scene = normalizeScene(payload);
    return {
      id: entry.id,
      title: typeof entry.title === "string" && entry.title.trim()
        ? entry.title
        : `Page ${index + 1}`,
      ...scene,
      files: reconstructMedia(scene.files, Array.isArray(data.media) ? data.media : []),
    };
  });

  if (payloadById.size !== ids.size) {
    throw new Error("IdeaSketch v1 file contains orphan Page payloads");
  }

  return {
    type: "ideasketch",
    formatVersion: IDEA_SKETCH_FORMAT_VERSION,
    created: typeof data.manifest.created === "string" ? data.manifest.created : "",
    modified: typeof data.manifest.modified === "string" ? data.manifest.modified : "",
    pages,
  };
}

export function serializeIdeaSketchDocument(
  document: IdeaSketchDocument,
  modified = new Date().toISOString(),
): IdeaSketchFileData {
  if (document.formatVersion !== IDEA_SKETCH_FORMAT_VERSION) {
    throw new Error(`Cannot serialize IdeaSketch format ${document.formatVersion}`);
  }
  if (document.pages.length === 0) {
    throw new Error("IdeaSketch must contain at least one Page");
  }
  const ids = new Set<string>();
  for (const page of document.pages) {
    if (!isValidPageId(page.id) || ids.has(page.id)) {
      throw new Error(`Duplicate or empty IdeaSketch Page id: ${page.id}`);
    }
    ids.add(page.id);
  }

  return {
    manifest: {
      version: IDEA_SKETCH_FORMAT_VERSION,
      created: document.created || modified,
      modified,
      slides: document.pages.map((page) => ({ id: page.id, title: page.title })),
    },
    slides: document.pages.map((page) => ({
      id: page.id,
      content: {
        type: "excalidraw",
        version: 2,
        elements: page.elements,
        appState: page.appState,
        files: page.files,
      },
    })),
    media: [],
  };
}
