import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { RecentFile, Slide, WorkspaceDocument, WorkspaceResource } from "../types";
import {
  createInitialWorkspace,
  getCanvasContent,
  getOrderedCanvasResources,
} from "./workspaceResources.ts";

type MediaItem = {
  id: string;
  mimeType: string;
  ext: string;
  bytesBase64: string;
};

interface ResourceManifestEntry extends WorkspaceResource {}

interface IsFileData {
  manifest: {
    version: string;
    created: string;
    modified: string;
    resources?: ResourceManifestEntry[];
    slides?: Array<{ id: string; title: string }>;
    [key: string]: unknown;
  };
  contents?: Array<{
    id: string;
    content: Record<string, any>;
  }>;
  slides?: Array<{ id: string; content: Record<string, any> }>;
  media?: MediaItem[];
}

const MIME_TYPE_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpg": "jpg",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const TEN_MB = 10 * 1024 * 1024;
const HUNDRED_MB = 100 * 1024 * 1024;

let cachedMediaKey: string | null = null;
let cachedEncodedMedia: MediaItem[] | null = null;
const createdTimestampByPath = new Map<string, string>();

function rememberCreatedTimestamp(path: string, data: IsFileData): void {
  if (typeof data?.manifest?.created === "string" && data.manifest.created.length > 0) {
    createdTimestampByPath.set(path, data.manifest.created);
  }
}

function getPayloadSignature(file: any): string {
  let base64 = "";

  if (typeof file?.dataURL === "string") {
    const parsed = parseDataUrl(file.dataURL);
    if (parsed?.bytesBase64) {
      base64 = parsed.bytesBase64;
    }
  }

  if (!base64 && typeof file?.bytesBase64 === "string" && isValidBase64(file.bytesBase64)) {
    base64 = file.bytesBase64;
  }

  if (!base64) {
    return "none";
  }

  const prefix = base64.slice(0, 32);
  const suffix = base64.slice(-32);
  return `${base64.length}:${prefix}:${suffix}`;
}

function cloneMediaItems(items: MediaItem[]): MediaItem[] {
  return items.map((item) => ({ ...item }));
}

function createManifest(workspace: WorkspaceDocument, createdTimestamp?: string) {
  const modified = new Date().toISOString();
  return {
    ...(workspace.manifestExtra ?? {}),
    version: "2.0",
    created: createdTimestamp ?? modified,
    modified,
    activeResourceId: workspace.activeResourceId,
    resources: workspace.resources,
  };
}

function isCorruptFileEntry(fileEntry: any): boolean {
  if (!fileEntry || typeof fileEntry !== "object") {
    return true;
  }

  if (typeof fileEntry.dataURL === "string") {
    const parsed = parseDataUrl(fileEntry.dataURL);
    return !parsed || !isValidBase64(parsed.bytesBase64);
  }

  if (typeof fileEntry.bytesBase64 === "string") {
    return !isValidBase64(fileEntry.bytesBase64);
  }

  return false;
}

function buildMediaCacheKey(fileIds: string[], fileById: Map<string, any>): string {
  return fileIds
    .map((id) => {
      const file = fileById.get(id);
      const mimeType = typeof file?.mimeType === "string" ? file.mimeType : "";
      const size = getFileSize(file);
      const payloadSignature = getPayloadSignature(file);
      return `${id}:${mimeType}:${size}:${payloadSignature}`;
    })
    .join("|");
}

function warnMediaSize(id: string, size: number): void {
  if (size > TEN_MB) {
    console.warn(
      `[IdeaSlide] Large image (${id}) is ${(size / (1024 * 1024)).toFixed(1)}MB; autosave/performance may slow down.`
    );
  }
}

function warnTotalMediaSize(totalMediaBytes: number): void {
  if (totalMediaBytes > HUNDRED_MB) {
    console.warn(
      `[IdeaSlide] Total embedded media is ${(totalMediaBytes / (1024 * 1024)).toFixed(1)}MB; autosave/performance may slow down.`
    );
  }
}

function encodeMedia(fileIds: string[], fileById: Map<string, any>): MediaItem[] {
  let totalMediaBytes = 0;

  const media = fileIds.flatMap((id) => {
    const file = fileById.get(id);
    if (!file) {
      return [];
    }

    const encoded = encodeMediaFromFile(file);
    const ext = MIME_TYPE_TO_EXT[encoded.mimeType];

    totalMediaBytes += encoded.size;
    warnMediaSize(id, encoded.size);

    return [{ id, mimeType: encoded.mimeType, ext, bytesBase64: encoded.bytesBase64 }];
  });

  warnTotalMediaSize(totalMediaBytes);
  return media;
}

function getSerializedMedia(fileIds: string[], fileById: Map<string, any>): MediaItem[] {
  const mediaCacheKey = buildMediaCacheKey(fileIds, fileById);

  if (cachedMediaKey === mediaCacheKey && cachedEncodedMedia) {
    return cloneMediaItems(cachedEncodedMedia);
  }

  const media = encodeMedia(fileIds, fileById);
  cachedMediaKey = mediaCacheKey;
  cachedEncodedMedia = cloneMediaItems(media);
  return media;
}

function getSlideFileById(files: unknown, fileId: string): any {
  if (!files) return undefined;

  if (files instanceof Map) {
    if (files.has(fileId)) {
      return files.get(fileId);
    }

    for (const candidate of files.values()) {
      if (typeof candidate?.id === "string" && candidate.id === fileId) {
        return candidate;
      }
    }

    return undefined;
  }

  const recordFiles = files as Record<string, any>;
  const directMatch = recordFiles[fileId];
  if (directMatch) {
    return directMatch;
  }

  for (const candidate of Object.values(recordFiles)) {
    if (typeof candidate?.id === "string" && candidate.id === fileId) {
      return candidate;
    }
  }

  return undefined;
}

function buildSerializedContents(workspace: WorkspaceDocument) {
  const allUsedFileIds = new Set<string>();
  const fileById = new Map<string, any>();

  const serializedContents = workspace.resources.flatMap((resource) => {
    if (!resource.contentRef) {
      return [];
    }
    if (resource.type !== "canvas") {
      return [{ id: resource.id, content: workspace.contents[resource.id] as Record<string, any> }];
    }

    const slide = {
      id: resource.id,
      ...getCanvasContent(workspace, resource.id),
    };
    const usedFileIds = new Set<string>();

    for (const element of slide.elements || []) {
      if (element?.type === "image" && typeof element?.fileId === "string") {
        usedFileIds.add(element.fileId);
        allUsedFileIds.add(element.fileId);
      }
    }

    const trimmedFiles: Record<string, any> = {};
    for (const fileId of usedFileIds) {
      const file = getSlideFileById(slide.files, fileId);
      if (!file) continue;

      trimmedFiles[fileId] = file;
      if (!fileById.has(fileId)) {
        fileById.set(fileId, file);
      }
    }

    return [{
      id: slide.id,
      content: {
        type: "excalidraw",
        version: 2,
        elements: slide.elements,
        appState: slide.appState,
        files: trimmedFiles,
      },
    }];
  });

  return {
    serializedContents,
    sortedUsedFileIds: Array.from(allUsedFileIds).sort(),
    fileById,
  };
}

export function convertToIsFileData(
  workspace: WorkspaceDocument,
  createdTimestamp?: string,
): IsFileData {
  const { serializedContents, sortedUsedFileIds, fileById } =
    buildSerializedContents(workspace);
  const media = getSerializedMedia(sortedUsedFileIds, fileById);

  return {
    manifest: createManifest(workspace, createdTimestamp),
    contents: serializedContents,
    media,
  };
}

function rebuildFileEntry(fileKey: string, fileEntry: any, mediaById: Map<string, MediaItem>) {
  const fileId = typeof fileEntry?.id === "string" ? fileEntry.id : fileKey;
  const media = mediaById.get(fileId);

  if (!media) {
    return { key: fileKey, value: fileEntry };
  }

  if (!isValidBase64(media.bytesBase64)) {
    return isCorruptFileEntry(fileEntry) ? null : { key: fileKey, value: fileEntry };
  }

  return {
    key: fileKey,
    value: {
      ...(fileEntry as any),
      id: fileId,
      mimeType: media.mimeType,
      dataURL: `data:${media.mimeType};base64,${media.bytesBase64}`,
      size:
        typeof fileEntry?.size === "number"
          ? fileEntry.size
          : base64ByteLength(media.bytesBase64),
    },
  };
}

function base64ByteLength(base64: string): number {
  if (!base64) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function isValidBase64(base64: string): boolean {
  if (!base64) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return false;

  try {
    atob(base64);
    return true;
  } catch {
    return false;
  }
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytesBase64: string } | null {
  if (!dataUrl.startsWith("data:")) {
    return null;
  }

  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex <= 5) {
    return null;
  }

  const header = dataUrl.slice(5, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  if (!header.includes(";base64") || !payload) {
    return null;
  }

  const mimeType = header.split(";")[0] || "";
  return { mimeType, bytesBase64: payload };
}

function getFileSize(file: any): number {
  if (typeof file?.size === "number" && Number.isFinite(file.size)) {
    return file.size;
  }

  if (typeof file?.dataURL === "string") {
    const parsed = parseDataUrl(file.dataURL);
    if (parsed) {
      return base64ByteLength(parsed.bytesBase64);
    }
  }

  if (typeof file?.bytesBase64 === "string") {
    return base64ByteLength(file.bytesBase64);
  }

  return 0;
}

function encodeMediaFromFile(file: any): { mimeType: string; bytesBase64: string; size: number } {
  const mimeType = typeof file?.mimeType === "string" ? file.mimeType : "";

  if (!(mimeType in MIME_TYPE_TO_EXT)) {
    throw new Error(`Unsupported image mimeType: ${mimeType || "(missing)"}`);
  }

  if (typeof file?.dataURL === "string") {
    const parsed = parseDataUrl(file.dataURL);
    if (parsed) {
      const parsedMimeType = parsed.mimeType || mimeType;
      if (!(parsedMimeType in MIME_TYPE_TO_EXT)) {
        throw new Error(`Unsupported image mimeType: ${parsedMimeType || "(missing)"}`);
      }

      const size =
        typeof file?.size === "number" && Number.isFinite(file.size)
          ? file.size
          : base64ByteLength(parsed.bytesBase64);

      return {
        mimeType: parsedMimeType,
        bytesBase64: parsed.bytesBase64,
        size,
      };
    }
  }

  if (typeof file?.bytesBase64 === "string" && isValidBase64(file.bytesBase64)) {
    return {
      mimeType,
      bytesBase64: file.bytesBase64,
      size: getFileSize(file),
    };
  }

  throw new Error(`Image file payload is missing or invalid for file id ${String(file?.id ?? "")}`);
}

function reconstructCanvasContent(
  content: Record<string, any>,
  hasMediaArray: boolean,
  mediaById: Map<string, MediaItem>,
) {
  const sourceFiles = content.files || {};
  const reconstructedFiles: Record<string, any> = {};

  for (const [fileKey, fileEntry] of Object.entries(sourceFiles)) {
    if (!hasMediaArray) {
      reconstructedFiles[fileKey] = fileEntry;
      continue;
    }

    const rebuilt = rebuildFileEntry(fileKey, fileEntry, mediaById);
    if (rebuilt) reconstructedFiles[rebuilt.key] = rebuilt.value;
  }

  return {
    ...content,
    type: typeof content.type === "string" ? content.type : "excalidraw",
    version: typeof content.version === "number" ? content.version : 2,
    elements: content.elements || [],
    appState: content.appState || {},
    files: reconstructedFiles,
  };
}

function workspaceFromLegacySlides(data: IsFileData): WorkspaceDocument {
  const slides = data.slides ?? [];
  const entries = data.manifest.slides ?? [];
  const resources = entries.map((entry, order) => ({
    id: entry.id,
    type: "canvas",
    name: entry.title?.trim() || `Canvas ${order + 1}`,
    parentId: null,
    order,
    contentRef: `canvases/${entry.id}.json`,
  }));
  const contents = Object.fromEntries(slides.map((slide) => [slide.id, slide.content]));
  return {
    resources,
    contents,
    activeResourceId: resources[0]?.id ?? "",
    manifestExtra: {},
  };
}

export function convertFromIsFileData(data: IsFileData): WorkspaceDocument {
  const hasMediaArray = Array.isArray(data.media);
  const mediaById = new Map<string, MediaItem>();

  if (hasMediaArray) {
    for (const media of data.media || []) {
      if (
        typeof media?.id === "string" &&
        typeof media?.mimeType === "string" &&
        typeof media?.bytesBase64 === "string"
      ) {
        mediaById.set(media.id, media);
      }
    }
  }

  const baseWorkspace = data.manifest.resources
    ? {
        resources: data.manifest.resources,
        contents: Object.fromEntries(
          (data.contents ?? []).map((item) => [item.id, item.content]),
        ),
        activeResourceId: (() => {
          const savedActiveResourceId = data.manifest.activeResourceId;
          if (
            typeof savedActiveResourceId === "string" &&
            data.manifest.resources?.some((resource) => resource.id === savedActiveResourceId)
          ) {
            return savedActiveResourceId;
          }
          return getOrderedCanvasResources(data.manifest.resources)[0]?.id
            ?? data.manifest.resources[0]?.id
            ?? "";
        })(),
        manifestExtra: Object.fromEntries(
          Object.entries(data.manifest).filter(
            ([key]) => !["version", "created", "modified", "activeResourceId", "resources", "slides"].includes(key),
          ),
        ),
      }
    : workspaceFromLegacySlides(data);

  const canvasIds = new Set(
    baseWorkspace.resources
      .filter((resource) => resource.type === "canvas")
      .map((resource) => resource.id),
  );
  const contents = Object.fromEntries(
    Object.entries(baseWorkspace.contents).map(([id, content]) => [
      id,
      canvasIds.has(id)
        ? reconstructCanvasContent(content as Record<string, any>, hasMediaArray, mediaById)
        : content,
    ]),
  );

  return { ...baseWorkspace, contents };
}

export async function createNewFile(): Promise<{ path: string; workspace: WorkspaceDocument }> {
  const filePath = await save({
    filters: [{ name: "IdeaSlide", extensions: ["is"] }],
    defaultPath: "Untitled.is",
  });

  if (!filePath) {
    throw new Error("File creation cancelled");
  }

  const data = await invoke<IsFileData>("create_file", { path: filePath });
  rememberCreatedTimestamp(filePath, data);
  const workspace = convertFromIsFileData(data);

  return { path: filePath, workspace };
}

export async function openFile(): Promise<{ path: string; workspace: WorkspaceDocument }> {
  const filePath = await open({
    filters: [{ name: "IdeaSlide", extensions: ["is"] }],
    multiple: false,
  });

  if (!filePath || typeof filePath !== "string") {
    throw new Error("File selection cancelled");
  }

  const data = await invoke<IsFileData>("open_file", { path: filePath });
  rememberCreatedTimestamp(filePath, data);
  const workspace = convertFromIsFileData(data);

  return { path: filePath, workspace };
}

export function createNewPresentation(): { workspace: WorkspaceDocument } {
  return { workspace: createInitialWorkspace() };
}

function workspaceFromSlides(slides: Slide[]): WorkspaceDocument {
  const resources = slides.map((slide, order) => ({
    id: slide.id,
    type: "canvas",
    name: slide.title ?? `Canvas ${order + 1}`,
    parentId: null,
    order,
    contentRef: `canvases/${slide.id}.json`,
  }));
  return {
    resources,
    contents: Object.fromEntries(
      slides.map((slide) => [
        slide.id,
        {
          type: "excalidraw",
          version: 2,
          elements: slide.elements,
          appState: slide.appState,
          files: slide.files,
        },
      ]),
    ),
    activeResourceId: resources[0]?.id ?? "",
    manifestExtra: {},
  };
}

export async function saveFile(
  path: string,
  workspaceOrSlides: WorkspaceDocument | Slide[],
): Promise<void> {
  const createdTimestamp = createdTimestampByPath.get(path);
  const workspace = Array.isArray(workspaceOrSlides)
    ? workspaceFromSlides(workspaceOrSlides)
    : workspaceOrSlides;
  const data = convertToIsFileData(workspace, createdTimestamp);
  await invoke("save_file", { path, data });
  rememberCreatedTimestamp(path, data);
}

export async function getRecentFiles(): Promise<RecentFile[]> {
  try {
    return await invoke<RecentFile[]>("get_recent_files");
  } catch {
    return [];
  }
}

export async function addRecentFile(path: string): Promise<void> {
  await invoke("add_recent_file", { path });
}

export async function removeRecentFile(path: string): Promise<void> {
  await invoke("remove_recent_file", { path });
}

export async function getOpenedFile(): Promise<string | null> {
  return await invoke<string | null>("get_opened_file");
}

export async function openRecentFile(path: string): Promise<WorkspaceDocument> {
  const data = await invoke<IsFileData>("open_file", { path });
  rememberCreatedTimestamp(path, data);
  return convertFromIsFileData(data);
}
