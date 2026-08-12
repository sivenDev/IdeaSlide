import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type {
  DocumentModel,
  RecentFile,
  RecentWorkspace,
  WorkspaceEntry,
  WorkspaceChangeEvent,
  WorkspaceMetadataSnapshot,
  WorkspaceSession,
} from "../types";
import {
  getFileTypeDefinition,
  getFileTypeDefinitionByPath,
  getOpenableFileTypeDefinitions,
} from "./fileTypeRegistry.ts";

interface BackendDocumentData {
  type: string;
  data: unknown;
}

type BackendOpenDocumentResult =
  | { status: "editable"; document: BackendDocumentData }
  | {
      status: "legacy-protected";
      fileType: "ideasketch";
      version: string;
      message: string;
    };

export class DesktopOperationCancelledError extends Error {
  readonly kind = "cancelled";

  constructor(message: string) {
    super(message);
    this.name = "DesktopOperationCancelledError";
  }
}

export function isDesktopOperationCancelled(error: unknown): error is DesktopOperationCancelledError {
  return error instanceof DesktopOperationCancelledError
    || (Boolean(error) && typeof error === "object" && (error as { kind?: unknown }).kind === "cancelled");
}

export async function getRecentFiles(): Promise<RecentFile[]> {
  return invoke<RecentFile[]>("get_recent_files");
}

export async function addRecentFile(path: string): Promise<void> {
  await invoke("add_recent_file", { path });
}

export async function removeRecentFile(path: string): Promise<void> {
  await invoke("remove_recent_file", { path });
}

export async function getRecentWorkspaces(): Promise<RecentWorkspace[]> {
  return invoke<RecentWorkspace[]>("get_recent_workspaces");
}

export async function removeRecentWorkspace(path: string): Promise<void> {
  await invoke("remove_recent_workspace", { path });
}

export interface RenamedPathResult {
  path: string;
  metadataError?: string | null;
}

export interface ProviderProbeResult {
  models: string[];
}

export interface WorkspaceAgentContextCommand {
  root?: string;
  readOnly: boolean;
  protectedPaths: string[];
  generation: number;
}

export interface WorkspaceAgentContextCommandStatus {
  available: boolean;
  capabilityId?: string;
  generation: number;
}

export async function syncWorkspaceAgentContextCommand(
  context: WorkspaceAgentContextCommand,
): Promise<WorkspaceAgentContextCommandStatus> {
  return invoke<WorkspaceAgentContextCommandStatus>("sync_workspace_agent_context", { context });
}

export async function probeAiProvider(baseUrl: string, apiKey?: string): Promise<ProviderProbeResult> {
  return await invoke<ProviderProbeResult>("probe_ai_provider", {
    baseUrl,
    apiKey: apiKey?.trim() || null,
  });
}

export async function renameStandalonePath(path: string, newName: string): Promise<RenamedPathResult> {
  return await invoke<RenamedPathResult>("rename_standalone_path", { path, newName });
}

export async function renameWorkspaceRoot(root: string, newName: string): Promise<RenamedPathResult> {
  return await invoke<RenamedPathResult>("rename_workspace_root", { root, newName });
}

export async function getOpenedFile(): Promise<string | null> {
  return await invoke<string | null>("get_opened_file");
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
    model: await definition.parse(result.document.data),
  };
}

export async function chooseWorkspaceDirectory(): Promise<string> {
  const directory = await open({ directory: true, multiple: false });
  if (!directory || typeof directory !== "string") {
    throw new DesktopOperationCancelledError("Workspace selection was cancelled.");
  }
  return directory;
}

export async function openWorkspace(root?: string): Promise<WorkspaceSession> {
  const selectedRoot = root ?? await chooseWorkspaceDirectory();
  const result = await invoke<BackendWorkspaceOpenResult>("open_workspace", { root: selectedRoot });
  return createWorkspaceSessionFromOpenResult(result);
}

export function createWorkspaceSessionFromOpenResult(
  result: BackendWorkspaceOpenResult,
): WorkspaceSession {
  return {
    ...result,
    entryOrder: [],
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
  const definition = getFileTypeDefinitionByPath(path);
  if (!definition?.openable) throw new Error(`Unsupported file type: ${path}`);
  const opened = await parseBackendOpenResult(
    await invoke<BackendOpenDocumentResult>("open_file", { path }),
  );
  if (opened.status !== "editable") return opened;
  const inspection = await inspectFile(path);
  return { ...opened, sourceModified: inspection.modified ?? undefined, readOnly: inspection.readOnly };
}

export async function chooseAndOpenStandaloneDocument(): Promise<{ path: string; document: OpenedDocument }> {
  const definitions = getOpenableFileTypeDefinitions();
  const path = await open({
    filters: [
      { name: "IdeaNote Documents", extensions: definitions.flatMap((definition) => definition.extensions) },
      ...definitions.map((definition) => ({
        name: definition.displayName,
        extensions: definition.extensions,
      })),
    ],
    multiple: false,
  });
  if (!path || typeof path !== "string") {
    throw new DesktopOperationCancelledError("File selection was cancelled.");
  }
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

export async function readDocumentImage(documentPath: string, href: string): Promise<string> {
  return invoke<string>("read_document_image", { documentPath, href });
}

export async function writeFileBytes(path: string, data: number[]): Promise<void> {
  await invoke("write_file_bytes", { path, data });
}

export async function revealPath(path: string): Promise<void> {
  await revealItemInDir(path);
}

export async function chooseStandaloneSavePath(
  defaultName = "Untitled.is",
  fileType?: string,
): Promise<string | null> {
  const definition = fileType
    ? getFileTypeDefinition(fileType)
    : getFileTypeDefinitionByPath(defaultName);
  const filters = definition
    ? [{ name: definition.displayName, extensions: definition.extensions }]
    : getOpenableFileTypeDefinitions().map((candidate) => ({
      name: candidate.displayName,
      extensions: candidate.extensions,
    }));
  return save({
    filters,
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

export async function relaunchAfterUpdate(): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("relaunch_after_update");
}
