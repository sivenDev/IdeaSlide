import type { IdeaSketchDocument } from "../../types.ts";

const PERSISTENT_APP_STATE_KEYS = new Set([
  "viewBackgroundColor",
  "gridSize",
]);

function canonicalize(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON numbers must be finite.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (
    typeof value === "undefined"
    || typeof value === "bigint"
    || typeof value === "symbol"
    || typeof value === "function"
  ) {
    throw new TypeError("The value is not JSON-compatible.");
  }
  if (typeof value !== "object") throw new TypeError("The value is not JSON-compatible.");
  if (seen.has(value)) throw new TypeError("Canonical JSON values cannot contain cycles.");
  seen.add(value);
  if (Array.isArray(value)) {
    for (const key of Reflect.ownKeys(value)) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) {
        throw new TypeError("Canonical JSON arrays cannot contain non-index properties.");
      }
    }
    const result = value.map((entry, index) => {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new TypeError("Canonical JSON arrays cannot be sparse.");
      }
      return canonicalize(entry, seen);
    });
    seen.delete(value);
    return result;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Canonical JSON objects must use a plain-object prototype.");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    const keys = Reflect.ownKeys(record);
    if (keys.some((key) => typeof key !== "string")) {
      throw new TypeError("Canonical JSON objects cannot contain symbol keys.");
    }
    for (const key of (keys as string[]).sort()) {
      if (!Object.prototype.propertyIsEnumerable.call(record, key)) {
        throw new TypeError("Canonical JSON objects cannot contain non-enumerable properties.");
      }
      result[key] = canonicalize(record[key], seen);
    }
    seen.delete(value);
    return result;
  }
  throw new TypeError("The value is not JSON-compatible.");
}

export function canonicalStringify(value: unknown) {
  return JSON.stringify(canonicalize(value, new WeakSet<object>()));
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function canonicalPayloadDigest(value: unknown) {
  return sha256(canonicalStringify(value));
}

function persistentAppState(appState: Partial<Record<string, unknown>>) {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(appState).sort()) {
    if (PERSISTENT_APP_STATE_KEYS.has(key)) result[key] = appState[key];
  }
  return result;
}

async function fileDigestEntries(files: Record<string, unknown>) {
  const entries: Array<{ id: string; digest: string }> = [];
  for (const id of Object.keys(files).sort()) {
    entries.push({ id, digest: await canonicalPayloadDigest(files[id]) });
  }
  return entries;
}

export async function createCanonicalSceneProjection(scene: {
  elements: readonly unknown[];
  appState: Partial<Record<string, unknown>>;
  files: Record<string, unknown>;
}, options: {
  ephemeralElementIds?: ReadonlySet<string>;
} = {}) {
  return {
    elements: options.ephemeralElementIds
      ? scene.elements.filter((element) => !(
          typeof element === "object"
          && element !== null
          && typeof (element as { id?: unknown }).id === "string"
          && options.ephemeralElementIds!.has((element as { id: string }).id)
        ))
      : scene.elements,
    appState: persistentAppState(scene.appState),
    files: await fileDigestEntries(scene.files),
  };
}

export async function computeSceneDigest(scene: {
  elements: readonly unknown[];
  appState: Partial<Record<string, unknown>>;
  files: Record<string, unknown>;
}, options?: {
  ephemeralElementIds?: ReadonlySet<string>;
}) {
  return canonicalPayloadDigest(await createCanonicalSceneProjection(scene, options));
}

export async function computeDocumentDigest(document: IdeaSketchDocument) {
  const pages = [];
  for (const page of document.pages) {
    pages.push({
      id: page.id,
      title: page.title,
      sceneDigest: await computeSceneDigest(page),
    });
  }
  return canonicalPayloadDigest({
    type: document.type,
    formatVersion: document.formatVersion,
    created: document.created,
    modified: document.modified,
    pages,
  });
}
