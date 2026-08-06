import { useCallback, useEffect, useRef, useState } from "react";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppStore } from "../hooks/useAppStore";
import { useUnsavedChangesDialog } from "../hooks/useUnsavedChangesDialog";
import {
  addRecentFile,
  chooseAndOpenStandaloneDocument,
  chooseStandaloneSavePath,
  createWorkspaceDocument,
  createWorkspaceFolder,
  deleteRecoveryDraft,
  exitApplication,
  inspectFile,
  loadRecoveryDraft,
  moveWorkspaceEntry,
  openStandaloneDocument,
  openWorkspace,
  openWorkspaceDocument,
  refreshWorkspace,
  renameWorkspaceEntry,
  saveStandaloneDocument,
  saveWorkspaceDocument,
  saveWorkspaceState,
  startWorkspaceWatcher,
  stopWorkspaceWatcher,
  trashWorkspaceEntry,
  writeRecoveryDraft,
  type OpenedDocument,
  type WorkspaceChangeEvent,
} from "../lib/tauriCommands";
import {
  createWorkspaceStateSnapshot,
  mayPersistWorkspaceState,
  restoreWorkspaceDocuments,
} from "../lib/workspaceState";
import {
  WORKSPACE_PANEL_DEFAULT_WIDTH,
  WORKSPACE_PANEL_MAX_WIDTH,
  WORKSPACE_PANEL_MIN_WIDTH,
  clampWorkspacePanelWidth,
} from "../lib/panelSizing";
import { classifyRecoveryDraft, createRecoveryDraft, recoveryScopeForDocument, type RecoveryDraft } from "../lib/recovery";
import {
  classifyInspectedDocument,
  isApplicationOwnedStandaloneInspection,
} from "../lib/externalFileChanges";
import {
  resolveDirtyDocumentsSequentially,
  saveDirtyDocumentBeforeTransition,
  type UnsavedDocumentResolution,
} from "../lib/unsavedChanges";
import { isProtectedDocumentSession } from "../lib/appStoreReducer";
import {
  projectWorkspaceEntryDrop,
  workspaceParentPath,
  type WorkspaceDropRequest,
} from "../lib/workspaceOrdering";
import type { DocumentModel, DocumentSession, IdeaSketchDocument, IdeaSketchPage, WorkspaceEntry } from "../types";
import { Toolbar } from "./Toolbar";
import { WorkspaceExplorer } from "./WorkspaceExplorer";
import { DocumentEditorHost } from "./DocumentEditorHost";
import { ResizableDivider } from "./ResizableDivider";
import { IdeaSketchEditor } from "./IdeaSketchEditor";
import { ExternalChangeNotice } from "./ExternalChangeNotice";
import { RecoveryPrompt } from "./RecoveryPrompt";
import { WorkspaceStatusNotice } from "./WorkspaceStatusNotice";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

interface EditorLayoutProps {
  onGoHome: () => void;
  readOnly?: boolean;
  pendingStandalonePath?: string;
  onPendingStandalonePathHandled?: () => void;
}

function sessionFromOpened(
  path: string,
  mode: "workspace" | "standalone",
  opened: OpenedDocument,
  readOnly = false,
): DocumentSession {
  const displayName = path.replace(/\\/g, "/").split("/").pop() || "Untitled.is";
  if (opened.status === "legacy-protected") {
    return {
      id: crypto.randomUUID(), mode, filePath: path, displayName,
      fileType: opened.fileType, status: "legacy-protected",
      protectedVersion: opened.version, message: opened.message,
      isDirty: false, revision: 0, readOnly: true,
    };
  }
  return {
    id: crypto.randomUUID(), mode, filePath: path, displayName,
    fileType: opened.fileType, status: readOnly || opened.readOnly ? "read-only" : "editable",
    model: opened.model, isDirty: false, revision: 0, readOnly: readOnly || opened.readOnly,
    sourceModified: opened.sourceModified,
  };
}

function joinWorkspacePath(root: string, relativePath: string): string {
  return `${root.replace(/[\\/]$/, "")}/${relativePath}`;
}

export function EditorLayout({
  onGoHome,
  readOnly = false,
  pendingStandalonePath,
  onPendingStandalonePathHandled,
}: EditorLayoutProps) {
  const { state, dispatch } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(state.mode === "workspace");
  const [workspacePanelWidth, setWorkspacePanelWidth] = useState(WORKSPACE_PANEL_DEFAULT_WIDTH);
  const [isResizingWorkspace, setIsResizingWorkspace] = useState(false);
  const [hiddenExternalNotices, setHiddenExternalNotices] = useState<Set<string>>(() => new Set());
  const [workspaceDiagnosticsHidden, setWorkspaceDiagnosticsHidden] = useState(false);
  const [recoveryCandidate, setRecoveryCandidate] = useState<{ sessionId: string; draft: RecoveryDraft; sourceChanged: boolean }>();
  const {
    unsavedChangesDialog,
    requestUnsavedChangesDecision,
    resolveUnsavedChangesDecision,
  } = useUnsavedChangesDialog();
  const documentSnapshotProviders = useRef(new Map<string, () => IdeaSketchDocument>());
  const pendingAutoSaveModified = useRef(new Map<string, string | undefined>());
  const standaloneWriteGeneration = useRef(new Map<string, number>());
  const standaloneWritesInProgress = useRef(new Map<string, number>());
  const standaloneExpectedModified = useRef(new Map<string, string>());
  const checkedRecoveryKeys = useRef(new Set<string>());
  const closeInProgress = useRef(false);
  const latestDocuments = useRef(state.documents);
  latestDocuments.current = state.documents;
  const activeDocument = state.documents.find((document) => document.id === state.activeSessionId);
  const effectiveReadOnly = readOnly
    || Boolean(state.workspace?.readOnly)
    || Boolean(activeDocument?.readOnly)
    || activeDocument?.status === "read-only";

  useEffect(() => setShowWorkspace(state.mode === "workspace"), [state.mode]);
  useEffect(() => setWorkspaceDiagnosticsHidden(false), [state.workspace?.root, state.workspace?.metadata.diagnostics]);

  useEffect(() => {
    if (!state.workspace || !("__TAURI_INTERNALS__" in window)) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    listen<WorkspaceChangeEvent>("workspace-change", (event) => {
      if (!disposed) {
        dispatch({ type: "APPLY_WORKSPACE_CHANGE", event: event.payload });
        setHiddenExternalNotices(new Set());
      }
    }).then((dispose) => { unlisten = dispose; }).catch(console.error);
    startWorkspaceWatcher(state.workspace.root).catch((error) => {
      console.error("Failed to start Workspace watcher:", error);
    });
    return () => {
      disposed = true;
      unlisten?.();
      stopWorkspaceWatcher().catch(() => undefined);
    };
  }, [dispatch, state.workspace?.root]);

  useEffect(() => {
    if (!activeDocument || activeDocument.status !== "loading") return;
    let cancelled = false;
    const load = activeDocument.mode === "workspace" && state.workspace
      ? openWorkspaceDocument(state.workspace.root, activeDocument.filePath)
      : openStandaloneDocument(activeDocument.filePath);
    load.then((opened) => {
      if (cancelled) return;
      if (opened.status === "editable") {
        dispatch({
          type: "SET_DOCUMENT_MODEL",
          sessionId: activeDocument.id,
          model: opened.model,
          status: activeDocument.readOnly || opened.readOnly ? "read-only" : "editable",
          sourceModified: opened.sourceModified,
          readOnly: activeDocument.readOnly || opened.readOnly,
        });
      } else {
        dispatch({ type: "SET_DOCUMENT_STATUS", sessionId: activeDocument.id, status: "legacy-protected", message: opened.message });
      }
    }).catch((cause) => {
      if (!cancelled) dispatch({
        type: "SET_DOCUMENT_STATUS",
        sessionId: activeDocument.id,
        status: "error",
        message: cause instanceof Error ? cause.message : String(cause),
      });
    });
    return () => { cancelled = true; };
  }, [activeDocument, dispatch, state.workspace]);

  useEffect(() => {
    if (!mayPersistWorkspaceState(state.workspace)) return;
    const timer = window.setTimeout(() => {
      if (!state.workspace) return;
      saveWorkspaceState(state.workspace.root, createWorkspaceStateSnapshot(state)).catch(console.error);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [state.activeSessionId, state.documents, state.workspace]);

  const refreshTree = useCallback(async () => {
    if (!state.workspace) return;
    const entries = await refreshWorkspace(state.workspace.root);
    dispatch({ type: "SET_WORKSPACE_ENTRIES", entries, entryOrder: [] });
  }, [dispatch, state.workspace]);

  const flushActiveDocumentSnapshot = useCallback(() => {
    if (!activeDocument) return;
    documentSnapshotProviders.current.get(activeDocument.id)?.();
  }, [activeDocument]);

  const activateWorkspaceEntry = useCallback((entry: WorkspaceEntry) => {
    if (!state.workspace || entry.kind !== "file") return;
    dispatch({
      type: "OPEN_DOCUMENT",
      document: {
        id: crypto.randomUUID(),
        mode: "workspace",
        filePath: entry.path,
        displayName: entry.name,
        fileType: entry.fileType ?? "unsupported",
        status: entry.fileType ? "loading" : "unsupported",
        message: entry.fileType ? undefined : "This file type is not editable in the current IdeaNote MVP.",
        readOnly: state.workspace.readOnly || entry.readOnly,
        sourceModified: entry.modified ?? undefined,
        isDirty: false,
        revision: 0,
      },
    });
  }, [dispatch, state.workspace]);

  const handleCreateFolder = useCallback(async (parentPath: string) => {
    if (!state.workspace) throw new Error("No Workspace is open");
    const result = await createWorkspaceFolder(state.workspace.root, parentPath);
    await refreshTree();
    dispatch({ type: "SELECT_WORKSPACE_PATH", path: result.value.path });
    return result.value;
  }, [dispatch, refreshTree, state.workspace]);

  const handleRename = useCallback(async (path: string, newName: string) => {
    if (!state.workspace) return;
    const renamed = await renameWorkspaceEntry(state.workspace.root, path, newName);
    dispatch({ type: "REMAP_WORKSPACE_PATH", fromPath: path, toPath: renamed.path });
    dispatch({ type: "SELECT_WORKSPACE_PATH", path: renamed.path });
    await refreshTree();
  }, [dispatch, refreshTree, state.workspace]);

  const handleMove = useCallback(async (request: WorkspaceDropRequest) => {
    if (!state.workspace) return;
    const projection = projectWorkspaceEntryDrop(state.workspace.entries, request);
    if (!projection.changed) return;
    try {
      if (workspaceParentPath(request.sourcePath) === projection.destinationParentPath) return;
      const moved = await moveWorkspaceEntry(
        state.workspace.root,
        request.sourcePath,
        projection.destinationParentPath,
      );
      if (moved.path !== projection.movedPath) {
        throw new Error("Workspace move returned an unexpected destination");
      }
      if (request.sourcePath !== projection.movedPath) {
        dispatch({ type: "REMAP_WORKSPACE_PATH", fromPath: request.sourcePath, toPath: projection.movedPath });
      }
      dispatch({ type: "SELECT_WORKSPACE_PATH", path: projection.movedPath });
      await refreshTree();
    } catch (cause) {
      await message(`Failed to move Workspace entry: ${cause instanceof Error ? cause.message : String(cause)}`, {
        title: "Workspace Move Error",
        kind: "error",
      });
    }
  }, [dispatch, refreshTree, state.workspace]);

  const handleTrash = useCallback(async (path: string) => {
    if (!state.workspace) return;
    await trashWorkspaceEntry(state.workspace.root, path);
    state.documents.filter((document) => document.mode === "workspace" && (document.filePath === path || document.filePath.startsWith(`${path}/`)))
      .forEach((document) => dispatch({ type: "SET_DOCUMENT_STATUS", sessionId: document.id, status: "missing", message: "The file was moved to Trash." }));
    await refreshTree();
  }, [dispatch, refreshTree, state.documents, state.workspace]);

  const clearRecoveryForDocument = useCallback(async (document: DocumentSession) => {
    const scope = recoveryScopeForDocument(document, state.workspace?.root);
    if (scope) await deleteRecoveryDraft(scope).catch((error) => console.warn("Failed to clear recovery draft:", error));
  }, [state.workspace?.root]);

  const handleWriteRecovery = useCallback(async (sessionId: string, model: IdeaSketchDocument) => {
    const document = state.documents.find((candidate) => candidate.id === sessionId);
    if (!document) return;
    const scope = recoveryScopeForDocument(document, state.workspace?.root);
    if (!scope) return;
    await writeRecoveryDraft(scope, createRecoveryDraft(document, model));
  }, [state.documents, state.workspace?.root]);

  const inspectDocumentTarget = useCallback(async (document: DocumentSession): Promise<boolean> => {
    if (!document.filePath) return true;
    const path = document.mode === "workspace" && state.workspace
      ? joinWorkspacePath(state.workspace.root, document.filePath)
      : document.filePath;
    const inspection = await inspectFile(path);
    const decision = classifyInspectedDocument(document, inspection);
    if (decision.kind === "none") return true;
    dispatch({ type: "APPLY_DOCUMENT_INSPECTION", sessionId: document.id, inspection });
    setHiddenExternalNotices((current) => {
      const next = new Set(current);
      next.delete(document.id);
      return next;
    });
    return false;
  }, [dispatch, state.workspace]);

  const saveStandaloneDocumentWithTracking = useCallback(async (
    document: DocumentSession,
    model: DocumentModel,
    path = document.filePath,
  ) => {
    if (!path) throw new Error("Standalone save requires a file path");
    const generation = (standaloneWriteGeneration.current.get(document.id) ?? 0) + 1;
    standaloneWriteGeneration.current.set(document.id, generation);
    standaloneWritesInProgress.current.set(
      document.id,
      (standaloneWritesInProgress.current.get(document.id) ?? 0) + 1,
    );
    try {
      const inspection = await saveStandaloneDocument(path, model);
      if (inspection.modified) standaloneExpectedModified.current.set(document.id, inspection.modified);
      else standaloneExpectedModified.current.delete(document.id);
      return inspection;
    } finally {
      const remaining = (standaloneWritesInProgress.current.get(document.id) ?? 1) - 1;
      if (remaining > 0) standaloneWritesInProgress.current.set(document.id, remaining);
      else standaloneWritesInProgress.current.delete(document.id);
      standaloneWriteGeneration.current.set(
        document.id,
        (standaloneWriteGeneration.current.get(document.id) ?? generation) + 1,
      );
    }
  }, []);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let disposed = false;
    const pollStandaloneDocuments = async () => {
      const documents = latestDocuments.current.filter((document) =>
        document.mode === "standalone"
        && Boolean(document.filePath)
        && !["loading", "legacy-protected", "unsupported", "invalid"].includes(document.status));
      await Promise.all(documents.map(async (document) => {
        try {
          const expectedModified = standaloneExpectedModified.current.get(document.id);
          if (expectedModified && document.sourceModified === expectedModified) {
            standaloneExpectedModified.current.delete(document.id);
          }
          const observedGeneration = standaloneWriteGeneration.current.get(document.id) ?? 0;
          const inspection = await inspectFile(document.filePath);
          if (disposed || isApplicationOwnedStandaloneInspection(inspection, {
            observedGeneration,
            currentGeneration: standaloneWriteGeneration.current.get(document.id) ?? 0,
            writeInProgress: (standaloneWritesInProgress.current.get(document.id) ?? 0) > 0,
            expectedModified: standaloneExpectedModified.current.get(document.id),
          }) || classifyInspectedDocument(document, inspection).kind === "none") return;
          dispatch({ type: "APPLY_DOCUMENT_INSPECTION", sessionId: document.id, inspection });
          setHiddenExternalNotices((current) => {
            const next = new Set(current);
            next.delete(document.id);
            return next;
          });
        } catch (error) {
          console.warn("Failed to inspect standalone file:", error);
        }
      }));
    };
    const timer = window.setInterval(() => void pollStandaloneDocuments(), 2_000);
    void pollStandaloneDocuments();
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [dispatch]);

  useEffect(() => {
    if (!activeDocument?.model || !["editable", "read-only", "external-change", "conflict", "missing", "root-missing"].includes(activeDocument.status)) return;
    const scope = recoveryScopeForDocument(activeDocument, state.workspace?.root);
    if (!scope) return;
    const key = JSON.stringify(scope);
    if (checkedRecoveryKeys.current.has(key)) return;
    checkedRecoveryKeys.current.add(key);
    let cancelled = false;
    loadRecoveryDraft(scope).then((draft) => {
      if (cancelled || !draft) return;
      const classification = classifyRecoveryDraft(draft, activeDocument);
      if (classification !== "invalid") {
        setRecoveryCandidate({
          sessionId: activeDocument.id,
          draft,
          sourceChanged: classification === "source-changed",
        });
      }
    }).catch((error) => console.warn("Recovery draft could not be loaded:", error));
    return () => { cancelled = true; };
  }, [activeDocument, state.workspace?.root]);

  const saveDocument = useCallback(async (document: DocumentSession, forceSaveAs = false): Promise<boolean> => {
    const model = documentSnapshotProviders.current.get(document.id)?.() ?? document.model;
    if (!model || document.status === "legacy-protected" || document.status === "unsupported") return false;
    if (!forceSaveAs && ["external-change", "conflict", "missing", "read-only", "root-missing"].includes(document.status)) {
      await message("IdeaNote will not overwrite this file until the external change is resolved. Reload it or use Save As.", {
        title: "Resolve File Change",
        kind: "warning",
      });
      return false;
    }
    try {
      setIsSaving(true);
      if (!forceSaveAs && document.mode === "workspace" && state.workspace?.readOnly) {
        await message("This Workspace is read-only. Use Save As to save the document elsewhere.", {
          title: "Read-only Workspace",
          kind: "warning",
        });
        return false;
      }
      if (!forceSaveAs && document.filePath && !await inspectDocumentTarget(document)) return false;
      if (document.mode === "workspace" && state.workspace && document.filePath && !forceSaveAs) {
        const result = await saveWorkspaceDocument(state.workspace.root, document.filePath, model);
        dispatch({ type: "MARK_DOCUMENT_SAVED", sessionId: document.id, sourceModified: result.sourceModified });
        await clearRecoveryForDocument(document);
        if (!result.metadataError) dispatch({ type: "MARK_WORKSPACE_METADATA_EXISTS" });
        if (result.metadataError) {
          await message(`The document was saved, but Workspace state could not be saved: ${result.metadataError}`, { title: "Workspace State Warning", kind: "warning" });
        }
        return true;
      }
      let path = forceSaveAs ? "" : document.filePath;
      if (!path) path = await chooseStandaloneSavePath(document.displayName || "Untitled.is") ?? "";
      if (!path) return false;
      const inspection = await saveStandaloneDocumentWithTracking(document, model, path);
      await clearRecoveryForDocument(document);
      dispatch({ type: "UPDATE_DOCUMENT_PATH", sessionId: document.id, filePath: path, mode: "standalone" });
      dispatch({ type: "MARK_DOCUMENT_SAVED", sessionId: document.id, sourceModified: inspection.modified ?? undefined });
      addRecentFile(path).catch(console.error);
      return true;
    } catch (cause) {
      await message(`Failed to save file: ${cause instanceof Error ? cause.message : String(cause)}`, { title: "Save Error", kind: "error" });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [clearRecoveryForDocument, dispatch, inspectDocumentTarget, saveStandaloneDocumentWithTracking, state.workspace]);

  const handleRegisterSnapshot = useCallback((sessionId: string, provider?: () => IdeaSketchDocument) => {
    if (provider) documentSnapshotProviders.current.set(sessionId, provider);
    else documentSnapshotProviders.current.delete(sessionId);
  }, []);

  const handleAutoSave = useCallback(async (sessionId: string, model: DocumentModel) => {
    const document = state.documents.find((candidate) => candidate.id === sessionId);
    if (!document || !document.filePath || document.status !== "editable") {
      throw new Error("Auto-save requires an editable document with a saved path");
    }
    if (document.readOnly || (document.mode === "workspace" && (!state.workspace || state.workspace.readOnly))) {
      throw new Error("Auto-save paused because the file is not writable");
    }
    if (!await inspectDocumentTarget(document)) {
      throw new Error("Auto-save paused because the file changed or is not writable");
    }
    setIsSaving(true);
    try {
      let sourceModified: string | undefined;
      if (document.mode === "workspace") {
        const workspace = state.workspace;
        if (!workspace) throw new Error("Auto-save requires an open Workspace");
        const result = await saveWorkspaceDocument(workspace.root, document.filePath, model);
        sourceModified = result.sourceModified;
        if (!result.metadataError) dispatch({ type: "MARK_WORKSPACE_METADATA_EXISTS" });
        if (result.metadataError) console.warn(`Workspace metadata was not updated: ${result.metadataError}`);
      } else {
        const inspection = await saveStandaloneDocumentWithTracking(document, model);
        sourceModified = inspection.modified ?? undefined;
      }
      pendingAutoSaveModified.current.set(sessionId, sourceModified);
      dispatch({ type: "SET_DOCUMENT_SOURCE_MODIFIED", sessionId, sourceModified });
    } finally {
      setIsSaving(false);
    }
  }, [dispatch, inspectDocumentTarget, saveStandaloneDocumentWithTracking, state.documents, state.workspace]);

  const handleAutoSaveComplete = useCallback(async (sessionId: string) => {
    const document = state.documents.find((candidate) => candidate.id === sessionId);
    if (document) await clearRecoveryForDocument(document);
    dispatch({
      type: "MARK_DOCUMENT_SAVED",
      sessionId,
      sourceModified: pendingAutoSaveModified.current.get(sessionId),
    });
    pendingAutoSaveModified.current.delete(sessionId);
  }, [clearRecoveryForDocument, dispatch, state.documents]);

  const handleStartPresentation = useCallback((sessionId: string, page: IdeaSketchPage, mode: "preview" | "fullscreen") => {
    dispatch({ type: "START_PRESENTATION", sessionId, pageId: page.id, page, mode });
  }, [dispatch]);

  const handleSave = useCallback(() => activeDocument ? saveDocument(activeDocument) : Promise.resolve(false), [activeDocument, saveDocument]);
  const handleSaveAs = useCallback(() => activeDocument ? saveDocument(activeDocument, true) : Promise.resolve(false), [activeDocument, saveDocument]);

  const prepareActiveDocumentTransition = useCallback(async (): Promise<boolean> => {
    flushActiveDocumentSnapshot();
    return saveDirtyDocumentBeforeTransition(activeDocument, saveDocument);
  }, [activeDocument, flushActiveDocumentSnapshot, saveDocument]);

  const openEntry = useCallback(async (entry: WorkspaceEntry) => {
    if (!state.workspace || entry.kind !== "file") return;
    if (activeDocument?.mode === "workspace" && activeDocument.filePath === entry.path) {
      dispatch({ type: "SELECT_WORKSPACE_PATH", path: entry.path });
      return;
    }
    if (!await prepareActiveDocumentTransition()) return;
    dispatch({ type: "SELECT_WORKSPACE_PATH", path: entry.path });
    activateWorkspaceEntry(entry);
  }, [activateWorkspaceEntry, activeDocument, dispatch, prepareActiveDocumentTransition, state.workspace]);

  const handleCreateDocument = useCallback(async (parentPath: string, fileType: string): Promise<WorkspaceEntry | undefined> => {
    if (!state.workspace) throw new Error("No Workspace is open");
    if (!await prepareActiveDocumentTransition()) return undefined;
    const result = await createWorkspaceDocument(state.workspace.root, parentPath, fileType);
    if (!result.metadataError) dispatch({ type: "MARK_WORKSPACE_METADATA_EXISTS" });
    await refreshTree();
    dispatch({ type: "SELECT_WORKSPACE_PATH", path: result.value.path });
    activateWorkspaceEntry(result.value);
    if (result.metadataError) {
      await message(`The file was created, but Workspace state could not be saved: ${result.metadataError}`, {
        title: "Workspace State Warning",
        kind: "warning",
      });
    }
    return result.value;
  }, [activateWorkspaceEntry, dispatch, prepareActiveDocumentTransition, refreshTree, state.workspace]);

  const requestClose = useCallback(async (sessionId: string): Promise<boolean> => {
    const document = state.documents.find((item) => item.id === sessionId);
    if (!document) return true;
    if (document.isDirty) {
      const decision = await requestUnsavedChangesDecision(
        document.displayName || "Untitled.is",
        "closing",
      );
      if (decision === "save") {
        if (!await saveDocument(document)) return false;
      } else if (decision === "discard") {
        await clearRecoveryForDocument(document);
      } else {
        return false;
      }
    }
    dispatch({ type: "CLOSE_DOCUMENT", sessionId });
    return true;
  }, [clearRecoveryForDocument, dispatch, requestUnsavedChangesDecision, saveDocument, state.documents]);

  const confirmSessionExit = useCallback(async (): Promise<boolean> => {
    const result = await resolveDirtyDocumentsSequentially(
      state.documents,
      state.activeSessionId,
      async (document): Promise<UnsavedDocumentResolution> => {
        const decision = await requestUnsavedChangesDecision(
          document.displayName || "Untitled.is",
          "leaving",
        );
        if (decision === "save") return await saveDocument(document) ? "saved" : "cancelled";
        if (decision === "discard") return "discarded";
        return "cancelled";
      },
    );
    if (!result.proceed) return false;
    await Promise.all(result.discarded.map(clearRecoveryForDocument));
    return true;
  }, [clearRecoveryForDocument, requestUnsavedChangesDecision, saveDocument, state.activeSessionId, state.documents]);
  const confirmSessionExitRef = useRef(confirmSessionExit);
  confirmSessionExitRef.current = confirmSessionExit;

  const handleOpenFile = useCallback(async () => {
    if (!await confirmSessionExit()) return;
    const { path, document } = await chooseAndOpenStandaloneDocument();
    dispatch({ type: "OPEN_DOCUMENT", document: sessionFromOpened(path, "standalone", document) });
    addRecentFile(path).catch(console.error);
  }, [confirmSessionExit, dispatch]);

  const handleOpenWorkspace = useCallback(async () => {
    if (!await confirmSessionExit()) return;
    const workspace = await openWorkspace();
    const restored = restoreWorkspaceDocuments(workspace);
    dispatch({ type: "OPEN_WORKSPACE", workspace, restoredDocuments: restored.documents, activePath: restored.activePath });
  }, [confirmSessionExit, dispatch]);

  useEffect(() => {
    if (!pendingStandalonePath || !onPendingStandalonePathHandled) return;
    let disposed = false;
    const openPendingPath = async () => {
      try {
        if (!await confirmSessionExitRef.current()) return;
        const opened = await openStandaloneDocument(pendingStandalonePath);
        if (disposed) return;
        dispatch({
          type: "OPEN_DOCUMENT",
          document: sessionFromOpened(pendingStandalonePath, "standalone", opened),
        });
        addRecentFile(pendingStandalonePath).catch(console.error);
      } catch (error) {
        console.error("Failed to open requested file:", error);
      } finally {
        if (!disposed) onPendingStandalonePathHandled();
      }
    };
    void openPendingPath();
    return () => { disposed = true; };
  }, [dispatch, onPendingStandalonePathHandled, pendingStandalonePath]);

  const handleRelocateWorkspace = useCallback(async () => {
    const workspace = await openWorkspace();
    dispatch({ type: "REPLACE_WORKSPACE", workspace, reloadDocuments: true });
  }, [dispatch]);

  const handleRetryWorkspaceState = useCallback(async () => {
    if (!state.workspace) return;
    try {
      const workspace = await openWorkspace(state.workspace.root);
      dispatch({ type: "REPLACE_WORKSPACE", workspace });
    } catch (error) {
      await message(`Workspace state could not be reloaded: ${error instanceof Error ? error.message : String(error)}`, {
        title: "Workspace State Error",
        kind: "error",
      });
    }
  }, [dispatch, state.workspace]);

  const handleReloadActiveDocument = useCallback(async () => {
    if (!activeDocument) return;
    if (activeDocument.isDirty) {
      const reload = await ask("Reload from disk and discard the unsaved in-memory edits?", {
        title: "Reload Changed File",
        kind: "warning",
        okLabel: "Reload",
        cancelLabel: "Cancel",
      });
      if (!reload) return;
    }
    try {
      const opened = activeDocument.mode === "workspace" && state.workspace
        ? await openWorkspaceDocument(state.workspace.root, activeDocument.filePath)
        : await openStandaloneDocument(activeDocument.filePath);
      if (opened.status !== "editable") return;
      dispatch({
        type: "SET_DOCUMENT_MODEL",
        sessionId: activeDocument.id,
        model: opened.model,
        status: opened.readOnly ? "read-only" : "editable",
        sourceModified: opened.sourceModified,
        readOnly: opened.readOnly,
      });
      dispatch({ type: "MARK_DOCUMENT_SAVED", sessionId: activeDocument.id, sourceModified: opened.sourceModified });
      await clearRecoveryForDocument(activeDocument);
      setHiddenExternalNotices((current) => {
        const next = new Set(current);
        next.delete(activeDocument.id);
        return next;
      });
    } catch (error) {
      await message(`Failed to reload file: ${error instanceof Error ? error.message : String(error)}`, { title: "Reload Error", kind: "error" });
    }
  }, [activeDocument, clearRecoveryForDocument, dispatch, state.workspace]);

  const restoreRecovery = useCallback(() => {
    if (!recoveryCandidate) return;
    const document = state.documents.find((candidate) => candidate.id === recoveryCandidate.sessionId);
    const needsSaveAs = recoveryCandidate.sourceChanged || Boolean(document?.readOnly);
    dispatch({
      type: "SET_DOCUMENT_MODEL",
      sessionId: recoveryCandidate.sessionId,
      model: recoveryCandidate.draft.model,
      status: needsSaveAs ? "conflict" : "editable",
      readOnly: false,
    });
    if (needsSaveAs) {
      dispatch({
        type: "SET_DOCUMENT_STATUS",
        sessionId: recoveryCandidate.sessionId,
        status: "conflict",
        message: "The recovery draft differs from the current or read-only source. Review it and use Save As to avoid overwriting the source.",
      });
    }
    dispatch({ type: "MARK_DOCUMENT_DIRTY", sessionId: recoveryCandidate.sessionId });
    setRecoveryCandidate(undefined);
  }, [dispatch, recoveryCandidate, state.documents]);

  const discardRecovery = useCallback(async () => {
    if (!recoveryCandidate) return;
    const document = state.documents.find((candidate) => candidate.id === recoveryCandidate.sessionId);
    if (document) await clearRecoveryForDocument(document);
    setRecoveryCandidate(undefined);
  }, [clearRecoveryForDocument, recoveryCandidate, state.documents]);

  const handleGoHome = useCallback(async () => {
    if (!await confirmSessionExit()) return;
    onGoHome();
  }, [confirmSessionExit, onGoHome]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let disposed = false;
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      if (closeInProgress.current) {
        event.preventDefault();
        return;
      }
      closeInProgress.current = true;
      let shouldExit = false;
      try {
        const confirmed = await confirmSessionExit();
        if (disposed) {
          event.preventDefault();
          return;
        }
        if (!confirmed) {
          event.preventDefault();
          return;
        }
        await exitApplication();
        shouldExit = true;
      } catch (error) {
        event.preventDefault();
        await message(`Failed to close application: ${error instanceof Error ? error.message : String(error)}`, {
          title: "Close Error",
          kind: "error",
        }).catch((messageError) => console.error("Failed to show close error:", messageError));
      } finally {
        if (!shouldExit) closeInProgress.current = false;
      }
    });
    return () => {
      disposed = true;
      unlisten.then((dispose) => dispose()).catch(() => undefined);
    };
  }, [confirmSessionExit]);

  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(isMac ? event.metaKey : event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (event.shiftKey) void handleSaveAs();
      else void handleSave();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleSave, handleSaveAs]);

  const activeFullPath = activeDocument?.mode === "workspace" && state.workspace
    ? joinWorkspacePath(state.workspace.root, activeDocument.filePath)
    : activeDocument?.filePath;
  const dirty = activeDocument?.isDirty ?? false;
  const documentIndicators = state.documents
    .filter((document) => document.mode === "workspace" && Boolean(document.filePath))
    .map((document) => ({
      path: document.filePath,
      isActive: document.id === state.activeSessionId,
      isProtected: isProtectedDocumentSession(document),
      isDirty: document.isDirty,
      status: document.status,
    }));

  return (
    <div className="idea-slide-editor-shell flex h-screen flex-col">
      <Toolbar
        fileName={activeDocument?.displayName || state.workspace?.name}
        fileType={activeDocument?.fileType}
        isDirty={dirty}
        isSaving={isSaving}
        onOpenFile={() => void handleOpenFile()}
        onOpenWorkspace={() => void handleOpenWorkspace()}
        onSave={() => void handleSave()}
        onSaveAs={() => void handleSaveAs()}
        onGoHome={() => void handleGoHome()}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {state.workspace && (
          <>
            <div className={`h-full flex-shrink-0 overflow-hidden ${isResizingWorkspace ? "" : "transition-[width] duration-200"}`} style={{ width: showWorkspace ? workspacePanelWidth : 0 }}>
              <div className="h-full" style={{ width: workspacePanelWidth }}>
                <WorkspaceExplorer
                  rootName={state.workspace.name}
                  entries={state.workspace.entries}
                  selectedPath={state.workspace.selectedPath}
                  expandedPaths={state.workspace.expandedPaths}
                  documentIndicators={documentIndicators}
                  readOnly={readOnly || state.workspace.readOnly}
                  onSelect={(path) => dispatch({ type: "SELECT_WORKSPACE_PATH", path })}
                  onOpen={openEntry}
                  onCreateFolder={handleCreateFolder}
                  onCreateDocument={handleCreateDocument}
                  onRename={handleRename}
                  onMove={handleMove}
                  onTrash={handleTrash}
                  onRefresh={refreshTree}
                  onExpandedPathsChange={(paths) => dispatch({ type: "SET_EXPANDED_PATHS", paths })}
                />
              </div>
            </div>
            <ResizableDivider
              side="left"
              isVisible={showWorkspace}
              size={workspacePanelWidth}
              minSize={WORKSPACE_PANEL_MIN_WIDTH}
              maxSize={WORKSPACE_PANEL_MAX_WIDTH}
              onResize={(width) => setWorkspacePanelWidth(clampWorkspacePanelWidth(width))}
              onResizeStart={() => setIsResizingWorkspace(true)}
              onResizeEnd={() => setIsResizingWorkspace(false)}
              onToggle={() => setShowWorkspace((visible) => !visible)}
            />
          </>
        )}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {state.workspace && (
            <WorkspaceStatusNotice
              rootMissing={state.workspace.status === "root-missing"}
              readOnly={state.workspace.readOnly}
              diagnostics={state.workspace.metadata.diagnostics}
              diagnosticsHidden={workspaceDiagnosticsHidden}
              onRetry={() => void handleRetryWorkspaceState()}
              onRelocate={() => void handleRelocateWorkspace()}
              onDismissDiagnostics={() => setWorkspaceDiagnosticsHidden(true)}
            />
          )}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {activeDocument && (
              <ExternalChangeNotice
                status={activeDocument.status}
                message={activeDocument.message}
                hidden={hiddenExternalNotices.has(activeDocument.id)}
                onReload={() => void handleReloadActiveDocument()}
                onSaveAs={() => void saveDocument(activeDocument, true)}
                onKeepEditing={() => setHiddenExternalNotices((current) => new Set(current).add(activeDocument.id))}
                onClose={() => void requestClose(activeDocument.id)}
                onRelocateWorkspace={() => void handleRelocateWorkspace()}
              />
            )}
            {activeDocument && recoveryCandidate?.sessionId === activeDocument.id && (
              <RecoveryPrompt
                draft={recoveryCandidate.draft}
                sourceChanged={recoveryCandidate.sourceChanged}
                onRestore={restoreRecovery}
                onDiscard={() => void discardRecovery()}
                onCancel={() => setRecoveryCandidate(undefined)}
              />
            )}
            <div className="min-h-0 flex-1 overflow-hidden">
              <DocumentEditorHost
                document={activeDocument}
                fullPath={activeFullPath}
                renderIdeaSketch={(document) => (
                  <IdeaSketchEditor
                    document={document as DocumentSession<IdeaSketchDocument>}
                    readOnly={readOnly || Boolean(state.workspace?.readOnly) || Boolean(document.readOnly) || document.status === "read-only"}
                    editorRefreshToken={state.editorRefreshToken}
                    onModelChange={(sessionId, model) => dispatch({ type: "UPDATE_DOCUMENT_MODEL", sessionId, model })}
                    onDirty={(sessionId) => dispatch({ type: "MARK_DOCUMENT_DIRTY", sessionId })}
                    onEditorStateChange={(sessionId, activePageId) => dispatch({
                      type: "SET_DOCUMENT_EDITOR_STATE",
                      sessionId,
                      editorState: { activePageId },
                    })}
                    onRegisterSnapshot={handleRegisterSnapshot}
                    onAutoSave={handleAutoSave}
                    onAutoSaveComplete={(sessionId) => void handleAutoSaveComplete(sessionId)}
                    onWriteRecovery={handleWriteRecovery}
                    onStartPresentation={handleStartPresentation}
                  />
                )}
              />
            </div>
          </div>
        </main>
      </div>
      <UnsavedChangesDialog
        open={Boolean(unsavedChangesDialog)}
        fileName={unsavedChangesDialog?.fileName ?? "Untitled.is"}
        intent={unsavedChangesDialog?.intent ?? "leaving"}
        onDecision={resolveUnsavedChangesDecision}
      />
      {effectiveReadOnly && <div className="absolute bottom-3 right-3 rounded-full bg-gray-900/80 px-3 py-1.5 text-[11px] font-medium text-white">Read only</div>}
    </div>
  );
}
