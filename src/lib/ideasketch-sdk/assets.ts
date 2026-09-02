import {
  sdkRejected,
  sdkSucceeded,
  type AssetRef,
  type ElementRef,
  type PageRef,
  type SdkSyncResult,
} from "./types.ts";

export interface IdeaSketchAssetMetadata {
  ref: AssetRef;
  mimeType?: string;
  byteLength?: number;
  width?: number;
  height?: number;
  name?: string;
  referencedBy: readonly { pageRef: PageRef; elementRef: ElementRef }[];
}

export interface AssetProjectionInput {
  pageRef: PageRef | string;
  files: Record<string, unknown>;
  elements?: readonly unknown[];
}

function assetRef(id: string) {
  return `asset:${id}` as AssetRef;
}

function elementRef(id: string) {
  return `element:${id}` as ElementRef;
}

function safeNativeId(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && !/[\u0000-\u0020\u007f]/.test(value);
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function strictOptions(value: unknown): Record<string, unknown> | undefined {
  const record = object(value);
  if (!record) return undefined;
  try {
    const prototype = Object.getPrototypeOf(record);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(record)) {
      if (typeof key !== "string") return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) return undefined;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return undefined;
  }
}

function byteLength(value: unknown) {
  const record = object(value);
  if (!record) return undefined;
  if (typeof record.byteLength === "number" && Number.isFinite(record.byteLength) && record.byteLength >= 0) return record.byteLength;
  if (typeof record.dataURL === "string") {
    const comma = record.dataURL.indexOf(",");
    const encoded = comma >= 0 ? record.dataURL.slice(comma + 1) : record.dataURL;
    if (encoded.length === 0) return 0;
    if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return undefined;
    const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor(encoded.length * 3 / 4) - padding);
  }
  return undefined;
}

function dimensions(value: unknown) {
  const record = object(value);
  if (!record) return {};
  const width = typeof record.width === "number" && Number.isFinite(record.width) && record.width >= 0 ? record.width : undefined;
  const height = typeof record.height === "number" && Number.isFinite(record.height) && record.height >= 0 ? record.height : undefined;
  return { ...(width !== undefined ? { width } : {}), ...(height !== undefined ? { height } : {}) };
}

export function projectAssetMetadata(input: AssetProjectionInput): readonly IdeaSketchAssetMetadata[] {
  const references = new Map<string, Array<{ pageRef: PageRef; elementRef: ElementRef }>>();
  for (const element of input.elements ?? []) {
    const record = object(element);
    if (!record || !safeNativeId(record.id) || record.isDeleted || !safeNativeId(record.fileId)) continue;
    const list = references.get(record.fileId) ?? [];
    list.push({ pageRef: input.pageRef as PageRef, elementRef: elementRef(record.id) });
    references.set(record.fileId, list);
  }
  return Object.keys(input.files).filter(safeNativeId).sort().map((id) => {
    const file = object(input.files[id]);
    const dims = dimensions(file);
    return Object.freeze({
      ref: assetRef(id),
      ...(typeof file?.mimeType === "string" ? { mimeType: file.mimeType } : {}),
      ...(byteLength(file) !== undefined ? { byteLength: byteLength(file) } : {}),
      ...dims,
      ...(typeof file?.name === "string" ? { name: file.name } : {}),
      referencedBy: Object.freeze([...(references.get(id) ?? [])]),
    });
  });
}

export function createAssetMetadataProjection(input: AssetProjectionInput) {
  const all = projectAssetMetadata(input);
  const byRef = new Map(all.map((asset) => [asset.ref, asset]));
  return {
    list(options: { cursor?: string; limit?: number } = {}): SdkSyncResult<{
      assets: readonly IdeaSketchAssetMetadata[];
      nextCursor?: string;
      complete: boolean;
    }> {
      const strict = strictOptions(options);
      if (!strict) return sdkRejected("invalid_request", "Asset metadata list options must be an object.");
      options = strict as typeof options;
      const limit = options.limit ?? 50;
      if (!Number.isInteger(limit) || limit <= 0 || limit > 500) return sdkRejected("limit_exceeded", "Asset metadata limit is invalid.");
      let offset = 0;
      if (options.cursor !== undefined) {
        if (!/^asset-cursor:[0-9]+$/.test(options.cursor)) return sdkRejected("invalid_request", "The asset cursor is invalid.");
        const parsed = Number(options.cursor.slice("asset-cursor:".length));
        if (!Number.isInteger(parsed) || parsed < 0) return sdkRejected("snapshot_required", "The asset cursor is invalid.");
        offset = parsed;
      }
      if (offset > all.length) return sdkRejected("snapshot_required", "The asset cursor is stale.", true);
      const assets = all.slice(offset, offset + limit);
      const nextOffset = offset + assets.length;
      return sdkSucceeded({
        assets,
        complete: nextOffset >= all.length,
        ...(nextOffset < all.length ? { nextCursor: `asset-cursor:${nextOffset}` } : {}),
      });
    },
    get(ref: AssetRef): SdkSyncResult<IdeaSketchAssetMetadata> {
      if (typeof ref !== "string" || !/^asset:[^\u0000-\u0020\u007f]+$/.test(ref)) return sdkRejected("invalid_request", "The asset reference is malformed.");
      const result = byRef.get(ref);
      return result ? sdkSucceeded(result) : sdkRejected("target_not_found", "The asset reference does not exist.");
    },
  };
}
