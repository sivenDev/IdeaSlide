import type {
  ApplicationState,
  DocumentEditorState,
  DocumentModel,
  DocumentSession,
  DocumentStatus,
  IdeaSketchPage,
  WorkspaceEntry,
  WorkspaceSession,
} from "../types.ts";
import { normalizeDocumentPath } from "./documentSession.ts";

const RECENTLY_CLOSED_LIMIT = 10;

export type AppStoreAction =
  | { type: "GO_HOME" }
  | { type: "OPEN_WORKSPACE"; workspace: WorkspaceSession; restoredDocuments?: DocumentSession[]; activePath?: string }
  | { type: "OPEN_DOCUMENT"; document: DocumentSession }
  | { type: "ACTIVATE_DOCUMENT"; sessionId: string }
  | { type: "SET_DOCUMENT_MODEL"; sessionId: string; model: DocumentModel; status?: DocumentStatus; sourceModified?: string }
  | { type: "SET_DOCUMENT_STATUS"; sessionId: string; status: DocumentStatus; message?: string }
  | { type: "UPDATE_DOCUMENT_MODEL"; sessionId: string; model: DocumentModel }
  | { type: "MARK_DOCUMENT_DIRTY"; sessionId: string }
  | { type: "MARK_DOCUMENT_SAVED"; sessionId: string; sourceModified?: string }
  | { type: "SET_DOCUMENT_EDITOR_STATE"; sessionId: string; editorState: DocumentEditorState }
  | { type: "UPDATE_DOCUMENT_PATH"; sessionId: string; filePath: string; displayName?: string; mode?: "workspace" | "standalone" }
  | { type: "CLOSE_DOCUMENT"; sessionId: string }
  | { type: "CLOSE_OTHER_DOCUMENTS"; sessionId: string }
  | { type: "CLOSE_DOCUMENTS_TO_RIGHT"; sessionId: string }
  | { type: "REOPEN_LAST_DOCUMENT" }
  | { type: "SET_WORKSPACE_ENTRIES"; entries: WorkspaceEntry[] }
  | { type: "MARK_WORKSPACE_METADATA_EXISTS" }
  | { type: "SELECT_WORKSPACE_PATH"; path?: string }
  | { type: "SET_EXPANDED_PATHS"; paths: string[] }
  | { type: "REMAP_WORKSPACE_PATH"; fromPath: string; toPath: string }
  | { type: "START_PRESENTATION"; sessionId: string; pageId: string; page: IdeaSketchPage; mode: "preview" | "fullscreen" }
  | { type: "EXIT_PRESENTATION" };

export function createInitialAppState(): ApplicationState {
  return {
    mode: "launch",
    documents: [],
    recentlyClosed: [],
    presentationMode: "none",
    editorRefreshToken: 0,
  };
}

function basename(path: string): string {
  return normalizeDocumentPath(path).split("/").pop() || "Untitled.is";
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

function nextActiveAfterClose(
  documents: DocumentSession[],
  closingIndex: number,
): string | undefined {
  return documents[closingIndex + 1]?.id ?? documents[closingIndex - 1]?.id;
}

function closeDocuments(
  state: ApplicationState,
  shouldClose: (document: DocumentSession, index: number) => boolean,
): ApplicationState {
  const closed = state.documents.filter(shouldClose);
  if (closed.length === 0) return state;
  const documents = state.documents.filter((document, index) => !shouldClose(document, index));
  const activeSessionId = documents.some((document) => document.id === state.activeSessionId)
    ? state.activeSessionId
    : documents[0]?.id;
  return {
    ...state,
    documents,
    activeSessionId,
    recentlyClosed: [...closed.reverse(), ...state.recentlyClosed].slice(0, RECENTLY_CLOSED_LIMIT),
  };
}

export function appStoreReducer(
  state: ApplicationState,
  action: AppStoreAction,
): ApplicationState {
  switch (action.type) {
    case "GO_HOME":
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
        workspace: action.workspace,
        documents,
        activeSessionId,
      };
    }
    case "OPEN_DOCUMENT": {
      const document = prepareDocumentSession(action.document, state.workspace?.root);
      const existing = document.pathKey
        ? state.documents.find((candidate) => candidate.pathKey === document.pathKey)
        : undefined;
      if (existing) {
        return { ...state, activeSessionId: existing.id };
      }
      return {
        ...state,
        mode: state.workspace ? "workspace" : "standalone",
        documents: [...state.documents, document],
        activeSessionId: document.id,
      };
    }
    case "ACTIVATE_DOCUMENT":
      return state.documents.some((document) => document.id === action.sessionId)
        ? { ...state, activeSessionId: action.sessionId }
        : state;
    case "SET_DOCUMENT_MODEL":
      return {
        ...state,
        documents: state.documents.map((document) => document.id === action.sessionId ? {
          ...document,
          model: action.model,
          status: action.status ?? (document.readOnly ? "read-only" : "editable"),
          sourceModified: action.sourceModified ?? document.sourceModified,
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
          if (document.id !== action.sessionId || document.status !== "editable") return document;
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
          if (document.id !== action.sessionId || document.status !== "editable") return document;
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
        } : document),
      };
    }
    case "CLOSE_DOCUMENT": {
      const closingIndex = state.documents.findIndex((document) => document.id === action.sessionId);
      if (closingIndex < 0) return state;
      const closed = state.documents[closingIndex];
      const documents = state.documents.filter((document) => document.id !== action.sessionId);
      return {
        ...state,
        documents,
        activeSessionId: state.activeSessionId === action.sessionId
          ? nextActiveAfterClose(state.documents, closingIndex)
          : state.activeSessionId,
        recentlyClosed: [closed, ...state.recentlyClosed].slice(0, RECENTLY_CLOSED_LIMIT),
      };
    }
    case "CLOSE_OTHER_DOCUMENTS":
      return closeDocuments(state, (document) => document.id !== action.sessionId);
    case "CLOSE_DOCUMENTS_TO_RIGHT": {
      const index = state.documents.findIndex((document) => document.id === action.sessionId);
      return index < 0 ? state : closeDocuments(state, (_document, candidateIndex) => candidateIndex > index);
    }
    case "REOPEN_LAST_DOCUMENT": {
      const [document, ...recentlyClosed] = state.recentlyClosed;
      if (!document) return state;
      const prepared = prepareDocumentSession(document, state.workspace?.root);
      const existing = prepared.pathKey
        ? state.documents.find((candidate) => candidate.pathKey === prepared.pathKey)
        : undefined;
      return existing
        ? { ...state, recentlyClosed, activeSessionId: existing.id }
        : {
            ...state,
            documents: [...state.documents, prepared],
            activeSessionId: prepared.id,
            recentlyClosed,
          };
    }
    case "SET_WORKSPACE_ENTRIES":
      return state.workspace ? { ...state, workspace: { ...state.workspace, entries: action.entries } } : state;
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
    case "REMAP_WORKSPACE_PATH": {
      const fromPath = normalizeDocumentPath(action.fromPath);
      const toPath = normalizeDocumentPath(action.toPath);
      const remap = (path: string) => path === fromPath
        ? toPath
        : path.startsWith(`${fromPath}/`) ? `${toPath}${path.slice(fromPath.length)}` : path;
      return {
        ...state,
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
