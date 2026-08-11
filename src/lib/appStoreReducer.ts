import type {
  ApplicationState,
  DocumentEditorState,
  DocumentModel,
  DocumentSession,
  DocumentStatus,
  IdeaSketchPage,
  WorkspaceEntry,
  WorkspaceChangeEvent,
  WorkspaceSession,
} from "../types.ts";
import { normalizeDocumentPath } from "./documentSession.ts";
import {
  applyWorkspaceTreeEvent,
  classifyExternalDocumentChange,
  classifyInspectedDocument,
  type InspectedFileState,
} from "./externalFileChanges.ts";
import {
  applyWorkspaceEntryOrder,
  flattenWorkspaceEntryOrder,
  projectWorkspaceEntryDrop,
  remapWorkspaceEntryOrder,
  type WorkspaceDropRequest,
} from "./workspaceOrdering.ts";

const IN_MEMORY_EDITABLE_STATUSES: DocumentStatus[] = [
  "editable",
  "external-change",
  "conflict",
  "missing",
  "root-missing",
];

export type AppStoreAction =
  | { type: "RESET_SESSION" }
  | { type: "OPEN_WORKSPACE"; workspace: WorkspaceSession; restoredDocuments?: DocumentSession[]; activePath?: string }
  | { type: "REPLACE_WORKSPACE"; workspace: WorkspaceSession; reloadDocuments?: boolean }
  | { type: "OPEN_DOCUMENT"; document: DocumentSession }
  | { type: "SET_DOCUMENT_MODEL"; sessionId: string; model: DocumentModel; status?: DocumentStatus; sourceModified?: string; readOnly?: boolean }
  | { type: "SET_DOCUMENT_STATUS"; sessionId: string; status: DocumentStatus; message?: string }
  | { type: "UPDATE_DOCUMENT_MODEL"; sessionId: string; model: DocumentModel }
  | { type: "MARK_DOCUMENT_DIRTY"; sessionId: string }
  | { type: "MARK_DOCUMENT_SAVED"; sessionId: string; sourceModified?: string }
  | { type: "SET_DOCUMENT_SOURCE_MODIFIED"; sessionId: string; sourceModified?: string }
  | { type: "SET_DOCUMENT_EDITOR_STATE"; sessionId: string; editorState: DocumentEditorState }
  | { type: "UPDATE_DOCUMENT_PATH"; sessionId: string; filePath: string; displayName?: string; mode?: "workspace" | "standalone" }
  | { type: "CLOSE_DOCUMENT"; sessionId: string }
  | { type: "SET_WORKSPACE_ENTRIES"; entries: WorkspaceEntry[]; entryOrder?: string[] }
  | { type: "APPLY_WORKSPACE_CHANGE"; event: WorkspaceChangeEvent }
  | { type: "APPLY_DOCUMENT_INSPECTION"; sessionId: string; inspection: InspectedFileState }
  | { type: "MARK_WORKSPACE_METADATA_EXISTS" }
  | { type: "SELECT_WORKSPACE_PATH"; path?: string }
  | { type: "SET_EXPANDED_PATHS"; paths: string[] }
  | { type: "MOVE_WORKSPACE_ENTRY"; request: WorkspaceDropRequest }
  | { type: "REMAP_WORKSPACE_PATH"; fromPath: string; toPath: string }
  | { type: "START_PRESENTATION"; sessionId: string; pageId: string; page: IdeaSketchPage; mode: "preview" | "fullscreen" }
  | { type: "EXIT_PRESENTATION" };

export function createInitialAppState(): ApplicationState {
  return {
    mode: "empty",
    documents: [],
    presentationMode: "none",
    editorRefreshToken: 0,
  };
}

function basename(path: string): string {
  return normalizeDocumentPath(path).split("/").pop() || "Untitled.is";
}

function pathWithinWorkspaceEntry(path: string, parent: string): boolean {
  return path === parent || path.startsWith(`${parent}/`);
}

export function createDocumentPathKey(
  mode: "workspace" | "standalone",
  filePath: string,
  workspaceRoot?: string,
): string {
  const normalized = normalizeDocumentPath(filePath);
  if (!normalized) return "";
  return mode === "workspace"
    ? `workspace:${normalizeDocumentPath(workspaceRoot ?? "")}/${normalized}`
    : `standalone:${normalized}`;
}

export function prepareDocumentSession(
  document: DocumentSession,
  workspaceRoot?: string,
): DocumentSession {
  const filePath = normalizeDocumentPath(document.filePath);
  return {
    ...document,
    filePath,
    displayName: document.displayName ?? basename(filePath),
    pathKey: document.pathKey ?? createDocumentPathKey(document.mode, filePath, workspaceRoot),
  };
}

export function isProtectedDocumentSession(document: DocumentSession): boolean {
  return document.isDirty || !["editable", "loading"].includes(document.status);
}

export function appStoreReducer(
  state: ApplicationState,
  action: AppStoreAction,
): ApplicationState {
  switch (action.type) {
    case "RESET_SESSION":
      return createInitialAppState();
    case "OPEN_WORKSPACE": {
      const documents = (action.restoredDocuments ?? []).map((document) =>
        prepareDocumentSession(document, action.workspace.root),
      );
      const activeSessionId = documents.find((document) => document.filePath === action.activePath)?.id
        ?? documents[0]?.id;
      return {
        ...createInitialAppState(),
        mode: "workspace",
        workspace: {
          ...action.workspace,
          selectedPath: action.activePath ?? action.workspace.selectedPath,
        },
        documents,
        activeSessionId,
      };
    }
    case "REPLACE_WORKSPACE": {
      const workspace = action.workspace;
      const findEntry = (entries: WorkspaceEntry[], path: string): WorkspaceEntry | undefined => {
        for (const entry of entries) {
          if (entry.path === path) return entry;
          const nested = findEntry(entry.children, path);
          if (nested) return nested;
        }
        return undefined;
      };
      const documents = state.documents.map((document) => {
        if (document.mode !== "workspace") return document;
        const entry = findEntry(workspace.entries, document.filePath);
        if (!entry || entry.kind !== "file") {
          return prepareDocumentSession({
            ...document,
            status: "missing",
            message: "This file was not found in the relocated Workspace.",
            pathKey: undefined,
          }, workspace.root);
        }
        if (!action.reloadDocuments) {
          return prepareDocumentSession({
            ...document,
            readOnly: workspace.readOnly || entry.readOnly,
            pathKey: undefined,
          }, workspace.root);
        }
        if (["legacy-protected", "unsupported", "invalid"].includes(document.status)) {
          return prepareDocumentSession({ ...document, pathKey: undefined }, workspace.root);
        }
        const documentReadOnly = workspace.readOnly || entry.readOnly;
        const sourceMatches = Boolean(
          document.sourceModified
          && entry.modified
          && document.sourceModified === entry.modified,
        );
        const relocatedConflict = document.isDirty && (!sourceMatches || documentReadOnly);
        return prepareDocumentSession({
          ...document,
          status: !document.isDirty
            ? "loading"
            : relocatedConflict ? "conflict" : "editable",
          readOnly: documentReadOnly,
          sourceModified: sourceMatches ? document.sourceModified : entry.modified ?? document.sourceModified,
          message: relocatedConflict
            ? "The relocated Workspace contains a different or read-only file at this path. Reload it or use Save As; IdeaNote will not overwrite it silently."
            : undefined,
          pathKey: undefined,
        }, workspace.root);
      });
      return { ...state, mode: "workspace", workspace, documents };
    }
    case "OPEN_DOCUMENT": {
      const document = prepareDocumentSession(action.document, state.workspace?.root);
      if (document.mode === "standalone") {
        return {
          ...createInitialAppState(),
          mode: "standalone",
          documents: [document],
          activeSessionId: document.id,
        };
      }
      const existing = document.pathKey
        ? state.documents.find((candidate) => candidate.pathKey === document.pathKey)
        : undefined;
      const documents = state.documents.filter((candidate) =>
        candidate.id === existing?.id || isProtectedDocumentSession(candidate),
      );
      if (existing) {
        return {
          ...state,
          workspace: state.workspace ? { ...state.workspace, selectedPath: existing.filePath } : state.workspace,
          documents,
          activeSessionId: existing.id,
        };
      }
      return {
        ...state,
        mode: "workspace",
        workspace: state.workspace ? { ...state.workspace, selectedPath: document.filePath } : state.workspace,
        documents: [...documents, document],
        activeSessionId: document.id,
      };
    }
    case "SET_DOCUMENT_MODEL":
      return {
        ...state,
        documents: state.documents.map((document) => document.id === action.sessionId ? {
          ...document,
          model: action.model,
          status: action.status ?? (document.readOnly ? "read-only" : "editable"),
          sourceModified: action.sourceModified ?? document.sourceModified,
          readOnly: action.readOnly ?? document.readOnly,
          message: undefined,
        } : document),
      };
    case "SET_DOCUMENT_STATUS":
      return {
        ...state,
        documents: state.documents.map((document) => document.id === action.sessionId
          ? { ...document, status: action.status, message: action.message }
          : document),
      };
    case "UPDATE_DOCUMENT_MODEL":
      return {
        ...state,
        documents: state.documents.map((document) => {
          if (document.id !== action.sessionId || !IN_MEMORY_EDITABLE_STATUSES.includes(document.status)) return document;
          return {
            ...document,
            model: action.model,
            isDirty: true,
            revision: document.revision + 1,
          };
        }),
      };
    case "MARK_DOCUMENT_DIRTY":
      return {
        ...state,
        documents: state.documents.map((document) => {
          if (document.id !== action.sessionId || !IN_MEMORY_EDITABLE_STATUSES.includes(document.status)) return document;
          return document.isDirty ? document : {
            ...document,
            isDirty: true,
            revision: document.revision + 1,
          };
        }),
      };
    case "MARK_DOCUMENT_SAVED":
      return {
        ...state,
        documents: state.documents.map((document) => document.id === action.sessionId
          ? { ...document, isDirty: false, sourceModified: action.sourceModified ?? document.sourceModified }
          : document),
      };
    case "SET_DOCUMENT_SOURCE_MODIFIED":
      return {
        ...state,
        documents: state.documents.map((document) => document.id === action.sessionId
          ? { ...document, sourceModified: action.sourceModified ?? document.sourceModified }
          : document),
      };
    case "SET_DOCUMENT_EDITOR_STATE":
      return {
        ...state,
        documents: state.documents.map((document) => document.id === action.sessionId
          ? { ...document, editorState: action.editorState }
          : document),
      };
    case "UPDATE_DOCUMENT_PATH": {
      const current = state.documents.find((document) => document.id === action.sessionId);
      if (!current) return state;
      const mode = action.mode ?? current.mode;
      const nextPath = normalizeDocumentPath(action.filePath);
      const pathKey = createDocumentPathKey(mode, nextPath, state.workspace?.root);
      if (pathKey && state.documents.some((document) => document.id !== current.id && document.pathKey === pathKey)) {
        return state;
      }
      return {
        ...state,
        documents: state.documents.map((document) => document.id === current.id ? {
          ...document,
          mode,
          filePath: nextPath,
          pathKey,
          displayName: action.displayName ?? basename(nextPath),
          status: mode === "standalone" ? "editable" : document.status,
          readOnly: mode === "standalone" ? false : document.readOnly,
          message: mode === "standalone" ? undefined : document.message,
        } : document),
      };
    }
    case "CLOSE_DOCUMENT": {
      if (!state.documents.some((document) => document.id === action.sessionId)) return state;
      const documents = state.documents.filter((document) => document.id !== action.sessionId);
      const activeSessionId = state.activeSessionId === action.sessionId
        ? undefined
        : state.activeSessionId;
      return {
        ...state,
        mode: documents.length === 0 && state.mode === "standalone" ? "empty" : state.mode,
        documents,
        activeSessionId,
      };
    }
    case "SET_WORKSPACE_ENTRIES": {
      if (!state.workspace) return state;
      const currentOrder = action.entryOrder ?? state.workspace.entryOrder ?? [];
      const entries = currentOrder.length > 0
        ? applyWorkspaceEntryOrder(action.entries, currentOrder)
        : action.entries;
      return {
        ...state,
        workspace: {
          ...state.workspace,
          entries,
          entryOrder: currentOrder.length > 0 ? flattenWorkspaceEntryOrder(entries) : [],
        },
      };
    }
    case "APPLY_WORKSPACE_CHANGE": {
      if (!state.workspace) return state;
      const workspace = state.workspace;
      const documentDecisions = state.documents.map((document) => ({
        document,
        decision: classifyExternalDocumentChange(document, action.event),
      }));
      const retainsRemovedEntry = action.event.kind === "remove"
        && Boolean(action.event.path)
        && documentDecisions.some(({ document, decision }) =>
          decision.kind === "missing"
          && document.isDirty
          && document.mode === "workspace"
          && pathWithinWorkspaceEntry(document.filePath, action.event.path!),
        );
      const documents: DocumentSession[] = documentDecisions.flatMap(({ document, decision }) => {
        switch (decision.kind) {
          case "modified":
            return [{
              ...document,
              status: decision.status,
              message: decision.message,
              sourceModified: decision.sourceModified ?? document.sourceModified,
              readOnly: decision.readOnly ?? document.readOnly,
            }];
          case "missing":
            return document.isDirty
              ? [{ ...document, status: "missing" as const, message: decision.message }]
              : [];
          case "root-missing":
            return [{ ...document, status: "root-missing" as const, message: decision.message }];
          case "read-only":
            return document.isDirty
              ? [{ ...document, status: "conflict" as const, message: decision.message, readOnly: false }]
              : [{ ...document, status: "read-only" as const, message: decision.message, readOnly: true }];
          case "relocated":
            return [prepareDocumentSession({
              ...document,
              filePath: decision.toPath,
              displayName: basename(decision.toPath),
              pathKey: undefined,
            }, workspace.root)];
          case "writable":
            return [{ ...document, status: "editable" as const, message: undefined, readOnly: false }];
          default:
            return [document];
        }
      });
      const currentOrder = workspace.entryOrder ?? [];
      const eventOrder = action.event.kind === "rename" && action.event.oldPath && action.event.newPath
        ? remapWorkspaceEntryOrder(currentOrder, action.event.oldPath, action.event.newPath)
        : currentOrder;
      const nextEntries = retainsRemovedEntry
        ? workspace.entries
        : applyWorkspaceTreeEvent(workspace.entries, action.event, eventOrder);
      const selectedPathWasRemoved = action.event.kind === "remove"
        && Boolean(action.event.path)
        && Boolean(workspace.selectedPath)
        && pathWithinWorkspaceEntry(workspace.selectedPath!, action.event.path!);
      const selectedPathIsProtected = selectedPathWasRemoved
        && documents.some((document) =>
          document.mode === "workspace"
          && document.filePath === workspace.selectedPath
          && document.status === "missing",
        );
      return {
        ...state,
        activeSessionId: documents.some((document) => document.id === state.activeSessionId)
          ? state.activeSessionId
          : undefined,
        workspace: {
          ...workspace,
          readOnly: action.event.kind === "rootStatus" && action.event.readOnly !== undefined
            ? action.event.readOnly
            : workspace.readOnly,
          status: action.event.kind === "rootMissing" ? "root-missing" : workspace.status,
          message: action.event.kind === "rootMissing"
            ? "The Workspace folder is no longer available. Relocate it to continue working."
            : workspace.message,
          selectedPath: selectedPathWasRemoved && !selectedPathIsProtected
            ? undefined
            : workspace.selectedPath,
          entries: nextEntries,
          entryOrder: retainsRemovedEntry
            ? currentOrder
            : eventOrder.length > 0
              ? flattenWorkspaceEntryOrder(nextEntries)
              : [],
        },
        documents,
      };
    }
    case "APPLY_DOCUMENT_INSPECTION": {
      const documents: DocumentSession[] = state.documents.flatMap((document) => {
        if (document.id !== action.sessionId) return [document];
        const decision = classifyInspectedDocument(document, action.inspection);
        switch (decision.kind) {
          case "modified":
            return [{
              ...document,
              status: decision.status,
              message: decision.message,
              sourceModified: decision.sourceModified ?? document.sourceModified,
              readOnly: decision.readOnly ?? document.readOnly,
            }];
          case "missing":
            return document.isDirty
              ? [{ ...document, status: "missing" as const, message: decision.message }]
              : [];
          case "read-only":
            return document.isDirty
              ? [{ ...document, status: "conflict" as const, message: decision.message, readOnly: false }]
              : [{ ...document, status: "read-only" as const, message: decision.message, readOnly: true }];
          case "writable":
            return [{ ...document, status: "editable" as const, message: undefined, readOnly: false }];
          default:
            return [document];
        }
      });
      return {
        ...state,
        documents,
        activeSessionId: documents.some((document) => document.id === state.activeSessionId)
          ? state.activeSessionId
          : undefined,
      };
    }
    case "MARK_WORKSPACE_METADATA_EXISTS":
      return state.workspace ? {
        ...state,
        workspace: {
          ...state.workspace,
          metadata: { ...state.workspace.metadata, exists: true },
        },
      } : state;
    case "SELECT_WORKSPACE_PATH":
      return state.workspace ? { ...state, workspace: { ...state.workspace, selectedPath: action.path } } : state;
    case "SET_EXPANDED_PATHS":
      return state.workspace ? { ...state, workspace: { ...state.workspace, expandedPaths: action.paths } } : state;
    case "MOVE_WORKSPACE_ENTRY": {
      if (!state.workspace || state.workspace.readOnly) return state;
      const projection = projectWorkspaceEntryDrop(state.workspace.entries, action.request);
      if (!projection.changed) return state;
      return {
        ...state,
        workspace: {
          ...state.workspace,
          entries: projection.entries,
          entryOrder: projection.entryOrder,
        },
      };
    }
    case "REMAP_WORKSPACE_PATH": {
      const fromPath = normalizeDocumentPath(action.fromPath);
      const toPath = normalizeDocumentPath(action.toPath);
      const remap = (path: string) => path === fromPath
        ? toPath
        : path.startsWith(`${fromPath}/`) ? `${toPath}${path.slice(fromPath.length)}` : path;
      return {
        ...state,
        workspace: state.workspace ? {
          ...state.workspace,
          selectedPath: state.workspace.selectedPath ? remap(state.workspace.selectedPath) : undefined,
          expandedPaths: state.workspace.expandedPaths.map(remap),
          entryOrder: remapWorkspaceEntryOrder(state.workspace.entryOrder ?? [], fromPath, toPath),
        } : state.workspace,
        documents: state.documents.map((document) => document.mode === "workspace" && remap(document.filePath) !== document.filePath
          ? prepareDocumentSession({
              ...document,
              filePath: remap(document.filePath),
              displayName: basename(remap(document.filePath)),
              pathKey: undefined,
            }, state.workspace?.root)
          : document),
      };
    }
    case "START_PRESENTATION":
      return state.documents.some((document) => document.id === action.sessionId)
        ? {
            ...state,
            presentationMode: action.mode,
            presentationSessionId: action.sessionId,
            presentationPageId: action.pageId,
            presentationPage: action.page,
          }
        : state;
    case "EXIT_PRESENTATION":
      return {
        ...state,
        presentationMode: "none",
        presentationSessionId: undefined,
        presentationPageId: undefined,
        presentationPage: undefined,
        editorRefreshToken: state.editorRefreshToken + 1,
      };
    default:
      return state;
  }
}
