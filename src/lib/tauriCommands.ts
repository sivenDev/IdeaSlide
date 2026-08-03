import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  IdeaSketchDocument,
  RecentFile,
  Slide,
  WorkspaceDocument,
} from "../types";
import {
  createEmptyIdeaSketchDocument,
  ideaSketchDocumentToWorkspace,
  LegacyIdeaSketchFormatError,
  parseIdeaSketchFile,
  serializeIdeaSketchDocument,
  workspaceToIdeaSketchDocument,
  type IdeaSketchFileData,
} from "./ideaSketchDocument.ts";
import { getFileTypeDefinitionByPath } from "./fileTypeRegistry.ts";

const createdTimestampByPath = new Map<string, string>();

interface BackendDocumentData {
  type: "ideasketch";
  data: IdeaSketchFileData;
}

type BackendOpenDocumentResult =
  | { status: "editable"; document: BackendDocumentData }
  | {
      status: "legacy-protected";
      fileType: "ideasketch";
      version: string;
      message: string;
    };

function wrapIdeaSketchData(data: IdeaSketchFileData): BackendDocumentData {
  return { type: "ideasketch", data };
}

function unwrapIdeaSketchData(data: unknown): IdeaSketchFileData {
  if (data && typeof data === "object" && "type" in data && "data" in data) {
    const envelope = data as Partial<BackendDocumentData>;
    if (envelope.type !== "ideasketch") {
      throw new Error(`Unsupported backend document type: ${String(envelope.type)}`);
    }
    return envelope.data as IdeaSketchFileData;
  }
  return data as IdeaSketchFileData;
}

function unwrapOpenResult(result: BackendOpenDocumentResult): IdeaSketchFileData {
  if (result.status === "legacy-protected") {
    const error = new LegacyIdeaSketchFormatError(result.version);
    error.message = result.message;
    throw error;
  }
  return unwrapIdeaSketchData(result.document);
}

function rememberCreatedTimestamp(path: string, data: IdeaSketchFileData): void {
  if (typeof data?.manifest?.created === "string" && data.manifest.created.length > 0) {
    createdTimestampByPath.set(path, data.manifest.created);
  }
}

function requireIdeaSketchDefinition(path: string) {
  const definition = getFileTypeDefinitionByPath(path);
  if (!definition || definition.type !== "ideasketch") {
    throw new Error(`Unsupported file type: ${path}`);
  }
  return definition;
}

export function convertFromIsFileData(data: unknown): WorkspaceDocument {
  return ideaSketchDocumentToWorkspace(parseIdeaSketchFile(unwrapIdeaSketchData(data)));
}

export function convertToIsFileData(
  workspace: WorkspaceDocument,
  createdTimestamp?: string,
): IdeaSketchFileData {
  const document = workspaceToIdeaSketchDocument(workspace, createdTimestamp);
  return serializeIdeaSketchDocument(document);
}

export async function createNewFile(): Promise<{
  path: string;
  workspace: WorkspaceDocument;
}> {
  const filePath = await save({
    filters: [{ name: "IdeaNote IdeaSketch", extensions: ["is"] }],
    defaultPath: "Untitled.is",
  });

  if (!filePath) {
    throw new Error("File creation cancelled");
  }

  requireIdeaSketchDefinition(filePath);
  const data = unwrapIdeaSketchData(
    await invoke<BackendDocumentData>("create_file", { path: filePath }),
  );
  rememberCreatedTimestamp(filePath, data);
  return { path: filePath, workspace: convertFromIsFileData(data) };
}

export async function openFile(): Promise<{
  path: string;
  workspace: WorkspaceDocument;
}> {
  const filePath = await open({
    filters: [{ name: "IdeaNote IdeaSketch", extensions: ["is"] }],
    multiple: false,
  });

  if (!filePath || typeof filePath !== "string") {
    throw new Error("File selection cancelled");
  }

  requireIdeaSketchDefinition(filePath);
  const data = unwrapOpenResult(
    await invoke<BackendOpenDocumentResult>("open_file", { path: filePath }),
  );
  rememberCreatedTimestamp(filePath, data);
  return { path: filePath, workspace: convertFromIsFileData(data) };
}

export function createNewPresentation(): { workspace: WorkspaceDocument } {
  return { workspace: ideaSketchDocumentToWorkspace(createEmptyIdeaSketchDocument()) };
}

function ideaSketchFromSlides(
  slides: Slide[],
  createdTimestamp?: string,
): IdeaSketchDocument {
  const now = new Date().toISOString();
  return {
    type: "ideasketch",
    formatVersion: "1.0",
    created: createdTimestamp ?? now,
    modified: now,
    pages: slides.map((slide, index) => ({
      ...slide,
      title: slide.title?.trim() || `Page ${index + 1}`,
    })),
  };
}

export async function saveFile(
  path: string,
  workspaceOrSlides: WorkspaceDocument | Slide[],
): Promise<void> {
  requireIdeaSketchDefinition(path);
  const createdTimestamp = createdTimestampByPath.get(path);
  const document = Array.isArray(workspaceOrSlides)
    ? ideaSketchFromSlides(workspaceOrSlides, createdTimestamp)
    : workspaceToIdeaSketchDocument(workspaceOrSlides, createdTimestamp);
  const data = serializeIdeaSketchDocument(document);
  await invoke("save_file", { path, data: wrapIdeaSketchData(data) });
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
  requireIdeaSketchDefinition(path);
  const data = unwrapOpenResult(
    await invoke<BackendOpenDocumentResult>("open_file", { path }),
  );
  rememberCreatedTimestamp(path, data);
  return convertFromIsFileData(data);
}
