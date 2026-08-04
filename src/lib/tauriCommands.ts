import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  DocumentModel,
  IdeaSketchDocument,
  RecentFile,
  Slide,
  WorkspaceEntry,
  WorkspaceChangeEvent,
  WorkspaceMetadataSnapshot,
  WorkspaceDocument,
  WorkspaceSession,
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
import { getFileTypeDefinition } from "./fileTypeRegistry.ts";
import { applyWorkspaceEntryOrder, flattenWorkspaceEntryOrder } from "./workspaceOrdering.ts";

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

export type OpenedDocument =
  | { status: "editable"; fileType: string; model: DocumentModel; sourceModified?: string; readOnly?: boolean }
  | { status: "legacy-protected"; fileType: string; version: string; message: string };

export interface FileInspection {
  exists: boolean;
  modified?: string | null;
  readOnly: boolean;
  size?: number | null;
}

interface BackendWorkspaceOpenResult {
  root: string;
  name: string;
  readOnly: boolean;
  entries: WorkspaceEntry[];
  metadata: WorkspaceMetadataSnapshot;
}

interface WorkspaceMutationResult<T> {
  value: T;
  metadataError?: string | null;
}

export interface WorkspaceSaveResult {
  saved: boolean;
  metadataError?: string | null;
  sourceModified?: string;
}

function joinFilesystemPath(root: string, relativePath: string): string {
  return `${root.replace(/[\\/]$/, "")}/${relativePath}`;
}

async function parseBackendOpenResult(result: BackendOpenDocumentResult): Promise<OpenedDocument> {
  if (result.status === "legacy-protected") {
    return {
      status: result.status,
      fileType: result.fileType,
      version: result.version,
      message: result.message,
    };
  }
  const fileType = result.document.type;
  const definition = getFileTypeDefinition(fileType);
  if (!definition) throw new Error(`No frontend document module is registered for ${fileType}`);
  return {
    status: "editable",
    fileType,
    model: await definition.parse(unwrapIdeaSketchData(result.document)),
  };
}

export async function chooseWorkspaceDirectory(): Promise<string> {
  const directory = await open({ directory: true, multiple: false });
  if (!directory || typeof directory !== "string") {
    throw new Error("Workspace selection cancelled");
  }
  return directory;
}

export async function openWorkspace(root?: string): Promise<WorkspaceSession> {
  const selectedRoot = root ?? await chooseWorkspaceDirectory();
  const result = await invoke<BackendWorkspaceOpenResult>("open_workspace", { root: selectedRoot });
  const persistedOrder = result.metadata.state?.entryOrder ?? [];
  const entries = applyWorkspaceEntryOrder(result.entries, persistedOrder);
  return {
    ...result,
    entries,
    entryOrder: persistedOrder.length > 0 ? flattenWorkspaceEntryOrder(entries) : [],
    expandedPaths: result.metadata.state?.expandedPaths ?? [],
  };
}

export async function refreshWorkspace(root: string): Promise<WorkspaceEntry[]> {
  return invoke<WorkspaceEntry[]>("refresh_workspace", { root });
}

export async function openWorkspaceDocument(root: string, path: string): Promise<OpenedDocument> {
  const opened = await parseBackendOpenResult(
    await invoke<BackendOpenDocumentResult>("open_workspace_document", { root, path }),
  );
  if (opened.status !== "editable") return opened;
  const inspection = await inspectFile(joinFilesystemPath(root, path));
  return { ...opened, sourceModified: inspection.modified ?? undefined, readOnly: inspection.readOnly };
}

export async function openStandaloneDocument(path: string): Promise<OpenedDocument> {
  requireIdeaSketchDefinition(path);
  const opened = await parseBackendOpenResult(
    await invoke<BackendOpenDocumentResult>("open_file", { path }),
  );
  if (opened.status !== "editable") return opened;
  const inspection = await inspectFile(path);
  return { ...opened, sourceModified: inspection.modified ?? undefined, readOnly: inspection.readOnly };
}

export async function chooseAndOpenStandaloneDocument(): Promise<{ path: string; document: OpenedDocument }> {
  const path = await open({
    filters: [{ name: "IdeaNote IdeaSketch", extensions: ["is"] }],
    multiple: false,
  });
  if (!path || typeof path !== "string") throw new Error("File selection cancelled");
  return { path, document: await openStandaloneDocument(path) };
}

export async function createWorkspaceFolder(
  root: string,
  parentPath: string,
  name?: string,
): Promise<WorkspaceMutationResult<WorkspaceEntry>> {
  return invoke("create_workspace_folder", { root, parentPath, name });
}

export async function createWorkspaceDocument(
  root: string,
  parentPath: string,
  fileType: string,
  name?: string,
): Promise<WorkspaceMutationResult<WorkspaceEntry>> {
  return invoke("create_workspace_document", { root, parentPath, fileType, name });
}

export async function renameWorkspaceEntry(
  root: string,
  path: string,
  newName: string,
): Promise<WorkspaceEntry> {
  return invoke("rename_workspace_entry", { root, path, newName });
}

export async function moveWorkspaceEntry(
  root: string,
  path: string,
  destinationParentPath: string,
): Promise<WorkspaceEntry> {
  return invoke("move_workspace_entry", { root, path, destinationParentPath });
}

export async function trashWorkspaceEntry(root: string, path: string): Promise<void> {
  await invoke("trash_workspace_entry", { root, path });
}

export async function saveWorkspaceDocument(
  root: string,
  path: string,
  model: DocumentModel,
): Promise<WorkspaceSaveResult> {
  const definition = getFileTypeDefinition(model.type);
  if (!definition) throw new Error(`Unsupported document type: ${model.type}`);
  const data = await definition.serialize(model);
  const result = await invoke<WorkspaceSaveResult>("save_workspace_document", {
    root,
    path,
    data: { type: model.type, data },
  });
  const inspection = await inspectFile(joinFilesystemPath(root, path));
  return { ...result, sourceModified: inspection.modified ?? undefined };
}

export async function saveStandaloneDocument(path: string, model: DocumentModel): Promise<FileInspection> {
  const definition = getFileTypeDefinition(model.type);
  if (!definition) throw new Error(`Unsupported document type: ${model.type}`);
  const data = await definition.serialize(model);
  await invoke("save_file", { path, data: { type: model.type, data } });
  return inspectFile(path);
}

export async function inspectFile(path: string): Promise<FileInspection> {
  return invoke<FileInspection>("inspect_file", { path });
}

export async function chooseStandaloneSavePath(defaultName = "Untitled.is"): Promise<string | null> {
  return save({
    filters: [{ name: "IdeaNote IdeaSketch", extensions: ["is"] }],
    defaultPath: defaultName,
  });
}

export async function saveWorkspaceState(
  root: string,
  state: { schemaVersion: number; activePath?: string | null; expandedPaths: string[]; entryOrder: string[] },
): Promise<void> {
  await invoke("save_workspace_state", { root, state });
}

export async function startWorkspaceWatcher(root: string): Promise<void> {
  await invoke("start_workspace_watcher", { root });
}

export async function stopWorkspaceWatcher(): Promise<void> {
  await invoke("stop_workspace_watcher");
}

export type { WorkspaceChangeEvent };

export interface RecoveryDraftData {
  schemaVersion: number;
  sourcePath: string;
  sourceModified?: string | null;
  timestamp: string;
  model: DocumentModel;
}

export type RecoveryScopeData =
  | { mode: "workspace"; root: string; path: string }
  | { mode: "standalone"; path: string; sessionId: string };

export async function writeRecoveryDraft(scope: RecoveryScopeData, draft: RecoveryDraftData): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("write_recovery_draft", { scope, draft });
}

export async function loadRecoveryDraft(scope: RecoveryScopeData): Promise<RecoveryDraftData | null> {
  if (!("__TAURI_INTERNALS__" in window)) return null;
  return invoke<RecoveryDraftData | null>("load_recovery_draft", { scope });
}

export async function deleteRecoveryDraft(scope: RecoveryScopeData): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("delete_recovery_draft", { scope });
}

export interface StandaloneRecoveryRecordData {
  key: string;
  draft: RecoveryDraftData;
}

export async function listStandaloneRecoveryDrafts(): Promise<StandaloneRecoveryRecordData[]> {
  if (!("__TAURI_INTERNALS__" in window)) return [];
  return invoke<StandaloneRecoveryRecordData[]>("list_standalone_recovery_drafts");
}

export async function deleteStandaloneRecoveryDraft(key: string): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("delete_standalone_recovery_draft", { key });
}

export async function exitApplication(): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("exit_application");
}
