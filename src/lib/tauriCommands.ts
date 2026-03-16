import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { Slide, RecentFile } from "../types";

type MediaItem = {
  id: string;
  mimeType: string;
  ext: string;
  bytesBase64: string;
};

interface IsFileData {
  manifest: {
    version: string;
    created: string;
    modified: string;
    slides: Array<{ id: string; title: string }>;
  };
  slides: Array<{
    id: string;
    content: {
      elements?: readonly any[];
      appState?: Partial<any>;
      files?: Record<string, any>;
      [key: string]: any;
    };
  }>;
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

function buildSlideManifestEntries(slides: Slide[]): Array<{ id: string; title: string }> {
  return slides.map((slide, index) => ({
    id: slide.id,
    title: `Slide ${index + 1}`,
  }));
}

function createManifest(slides: Slide[], createdTimestamp?: string) {
  const modified = new Date().toISOString();
  return {
    version: "1.0",
    created: createdTimestamp ?? modified,
    modified,
    slides: buildSlideManifestEntries(slides),
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

function buildSerializedSlides(slides: Slide[]) {
  const allUsedFileIds = new Set<string>();
  const fileById = new Map<string, any>();

  const serializedSlides = slides.map((slide) => {
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

    return {
      id: slide.id,
      content: {
        type: "excalidraw",
        version: 2,
        elements: slide.elements,
        appState: slide.appState,
        files: trimmedFiles,
      },
    };
  });

  return {
    serializedSlides,
    sortedUsedFileIds: Array.from(allUsedFileIds).sort(),
    fileById,
  };
}

function convertToIsFileData(slides: Slide[], createdTimestamp?: string): IsFileData {
  const { serializedSlides, sortedUsedFileIds, fileById } = buildSerializedSlides(slides);
  const media = getSerializedMedia(sortedUsedFileIds, fileById);

  return {
    manifest: createManifest(slides, createdTimestamp),
    slides: serializedSlides,
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

export function convertFromIsFileData(data: IsFileData): Slide[] {
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

  return data.slides.map((slide) => {
    const sourceFiles = slide.content.files || {};
    const reconstructedFiles: Record<string, any> = {};

    for (const [fileKey, fileEntry] of Object.entries(sourceFiles)) {
      if (!hasMediaArray) {
        reconstructedFiles[fileKey] = fileEntry;
        continue;
      }

      const rebuilt = rebuildFileEntry(fileKey, fileEntry, mediaById);
      if (rebuilt) {
        reconstructedFiles[rebuilt.key] = rebuilt.value;
      }
    }

    return {
      id: slide.id,
      elements: slide.content.elements || [],
      appState: slide.content.appState || {},
      files: reconstructedFiles,
    };
  });
}


export async function createNewFile(): Promise<{ path: string; slides: Slide[] }> {
  const filePath = await save({
    filters: [{ name: "IdeaSlide", extensions: ["is"] }],
    defaultPath: "Untitled.is",
  });

  if (!filePath) {
    throw new Error("File creation cancelled");
  }

  const data = await invoke<IsFileData>("create_file", { path: filePath });
  rememberCreatedTimestamp(filePath, data);
  const slides = convertFromIsFileData(data);

  return { path: filePath, slides };
}

export async function openFile(): Promise<{ path: string; slides: Slide[] }> {
  const filePath = await open({
    filters: [{ name: "IdeaSlide", extensions: ["is"] }],
    multiple: false,
  });

  if (!filePath || typeof filePath !== "string") {
    throw new Error("File selection cancelled");
  }

  const data = await invoke<IsFileData>("open_file", { path: filePath });
  rememberCreatedTimestamp(filePath, data);
  const slides = convertFromIsFileData(data);

  return { path: filePath, slides };
}

export function createNewPresentation(): { slides: Slide[] } {
  return {
    slides: [{ id: crypto.randomUUID(), elements: [], appState: {}, files: {} }],
  };
}

export async function saveFile(path: string, slides: Slide[]): Promise<void> {
  const createdTimestamp = createdTimestampByPath.get(path);
  const data = convertToIsFileData(slides, createdTimestamp);
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

export async function getOpenedFile(): Promise<string | null> {
  return await invoke<string | null>("get_opened_file");
}

export async function openRecentFile(path: string): Promise<Slide[]> {
  const data = await invoke<IsFileData>("open_file", { path });
  rememberCreatedTimestamp(path, data);
  return convertFromIsFileData(data);
}
