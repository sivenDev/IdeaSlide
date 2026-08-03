import { useCallback, useEffect, useState } from "react";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../hooks/useAppStore";
import { getFileTypeDefinition } from "../lib/fileTypeRegistry";
import {
  addRecentFile,
  chooseAndOpenStandaloneDocument,
  chooseStandaloneSavePath,
  createWorkspaceDocument,
  createWorkspaceFolder,
  moveWorkspaceEntry,
  openStandaloneDocument,
  openWorkspace,
  openWorkspaceDocument,
  refreshWorkspace,
  renameWorkspaceEntry,
  saveStandaloneDocument,
  saveWorkspaceDocument,
  saveWorkspaceState,
  trashWorkspaceEntry,
  type OpenedDocument,
} from "../lib/tauriCommands";
import {
  createWorkspaceStateSnapshot,
  findWorkspaceEntry,
  mayPersistWorkspaceState,
  restoreWorkspaceDocuments,
} from "../lib/workspaceState";
import {
  WORKSPACE_PANEL_DEFAULT_WIDTH,
  WORKSPACE_PANEL_MAX_WIDTH,
  WORKSPACE_PANEL_MIN_WIDTH,
  clampWorkspacePanelWidth,
} from "../lib/panelSizing";
import type { DocumentSession, WorkspaceEntry } from "../types";
import { Toolbar } from "./Toolbar";
import { WorkspaceExplorer } from "./WorkspaceExplorer";
import { DocumentTabs } from "./DocumentTabs";
import { DocumentEditorHost } from "./DocumentEditorHost";
import { ResizableDivider } from "./ResizableDivider";

interface EditorLayoutProps {
  onGoHome: () => void;
  readOnly?: boolean;
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
    fileType: opened.fileType, status: readOnly ? "read-only" : "editable",
    model: opened.model, isDirty: false, revision: 0, readOnly,
  };
}

function joinWorkspacePath(root: string, relativePath: string): string {
  return `${root.replace(/[\\/]$/, "")}/${relativePath}`;
}

export function EditorLayout({ onGoHome, readOnly = false }: EditorLayoutProps) {
  const { state, dispatch } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(state.mode === "workspace");
  const [workspacePanelWidth, setWorkspacePanelWidth] = useState(WORKSPACE_PANEL_DEFAULT_WIDTH);
  const [isResizingWorkspace, setIsResizingWorkspace] = useState(false);
  const activeDocument = state.documents.find((document) => document.id === state.activeSessionId);
  const effectiveReadOnly = readOnly || Boolean(activeDocument?.readOnly) || activeDocument?.status === "read-only";

  useEffect(() => setShowWorkspace(state.mode === "workspace"), [state.mode]);

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
          status: activeDocument.readOnly ? "read-only" : "editable",
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
    dispatch({ type: "SET_WORKSPACE_ENTRIES", entries });
  }, [dispatch, state.workspace]);

  const openEntry = useCallback((entry: WorkspaceEntry) => {
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

  const handleCreateDocument = useCallback(async (parentPath: string, fileType: string) => {
    if (!state.workspace) throw new Error("No Workspace is open");
    const result = await createWorkspaceDocument(state.workspace.root, parentPath, fileType);
    if (!result.metadataError) dispatch({ type: "MARK_WORKSPACE_METADATA_EXISTS" });
    await refreshTree();
    dispatch({ type: "SELECT_WORKSPACE_PATH", path: result.value.path });
    openEntry(result.value);
    if (result.metadataError) {
      await message(`The file was created, but Workspace state could not be saved: ${result.metadataError}`, {
        title: "Workspace State Warning",
        kind: "warning",
      });
    }
    return result.value;
  }, [dispatch, openEntry, refreshTree, state.workspace]);

  const handleRename = useCallback(async (path: string, newName: string) => {
    if (!state.workspace) return;
    const renamed = await renameWorkspaceEntry(state.workspace.root, path, newName);
    dispatch({ type: "REMAP_WORKSPACE_PATH", fromPath: path, toPath: renamed.path });
    dispatch({ type: "SELECT_WORKSPACE_PATH", path: renamed.path });
    await refreshTree();
  }, [dispatch, refreshTree, state.workspace]);

  const handleMove = useCallback(async (path: string, destinationParentPath: string) => {
    if (!state.workspace) return;
    const moved = await moveWorkspaceEntry(state.workspace.root, path, destinationParentPath);
    dispatch({ type: "REMAP_WORKSPACE_PATH", fromPath: path, toPath: moved.path });
    dispatch({ type: "SELECT_WORKSPACE_PATH", path: moved.path });
    await refreshTree();
  }, [dispatch, refreshTree, state.workspace]);

  const handleTrash = useCallback(async (path: string) => {
    if (!state.workspace) return;
    await trashWorkspaceEntry(state.workspace.root, path);
    state.documents.filter((document) => document.mode === "workspace" && (document.filePath === path || document.filePath.startsWith(`${path}/`)))
      .forEach((document) => dispatch({ type: "SET_DOCUMENT_STATUS", sessionId: document.id, status: "missing", message: "The file was moved to Trash." }));
    await refreshTree();
  }, [dispatch, refreshTree, state.documents, state.workspace]);

  const saveDocument = useCallback(async (document: DocumentSession, forceSaveAs = false): Promise<boolean> => {
    if (!document.model || document.status === "legacy-protected" || document.status === "unsupported" || document.status === "missing") return false;
    try {
      setIsSaving(true);
      if (document.mode === "workspace" && state.workspace && document.filePath && !forceSaveAs) {
        const result = await saveWorkspaceDocument(state.workspace.root, document.filePath, document.model);
        dispatch({ type: "MARK_DOCUMENT_SAVED", sessionId: document.id });
        if (!result.metadataError) dispatch({ type: "MARK_WORKSPACE_METADATA_EXISTS" });
        if (result.metadataError) {
          await message(`The document was saved, but Workspace state could not be saved: ${result.metadataError}`, { title: "Workspace State Warning", kind: "warning" });
        }
        return true;
      }
      let path = forceSaveAs ? "" : document.filePath;
      if (!path) path = await chooseStandaloneSavePath(document.displayName || "Untitled.is") ?? "";
      if (!path) return false;
      await saveStandaloneDocument(path, document.model);
      dispatch({ type: "UPDATE_DOCUMENT_PATH", sessionId: document.id, filePath: path, mode: "standalone" });
      dispatch({ type: "MARK_DOCUMENT_SAVED", sessionId: document.id });
      addRecentFile(path).catch(console.error);
      return true;
    } catch (cause) {
      await message(`Failed to save file: ${cause instanceof Error ? cause.message : String(cause)}`, { title: "Save Error", kind: "error" });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [dispatch, state.workspace]);

  const handleSave = useCallback(() => activeDocument ? saveDocument(activeDocument) : Promise.resolve(false), [activeDocument, saveDocument]);
  const handleSaveAs = useCallback(() => activeDocument ? saveDocument(activeDocument, true) : Promise.resolve(false), [activeDocument, saveDocument]);
  const handleSaveAll = useCallback(async () => {
    const results: string[] = [];
    for (const document of state.documents.filter((item) => item.isDirty)) {
      if (!await saveDocument(document)) results.push(document.displayName || document.filePath || "Untitled.is");
    }
    if (results.length > 0) await message(`Some files could not be saved:\n${results.join("\n")}`, { title: "Save All", kind: "warning" });
  }, [saveDocument, state.documents]);

  const requestClose = useCallback(async (sessionId: string): Promise<boolean> => {
    const document = state.documents.find((item) => item.id === sessionId);
    if (!document) return true;
    if (document.isDirty) {
      const shouldSave = await ask(`Save changes to “${document.displayName || "Untitled.is"}” before closing?`, {
        title: "Unsaved Changes", kind: "warning", okLabel: "Save", cancelLabel: "More Options",
      });
      if (shouldSave) {
        if (!await saveDocument(document)) return false;
      } else {
        const discard = await ask("Discard the unsaved changes?", {
          title: "Unsaved Changes", kind: "warning", okLabel: "Discard", cancelLabel: "Cancel",
        });
        if (!discard) return false;
      }
    }
    dispatch({ type: "CLOSE_DOCUMENT", sessionId });
    return true;
  }, [dispatch, saveDocument, state.documents]);

  const closeCollection = useCallback(async (sessionIds: string[]) => {
    for (const sessionId of sessionIds) {
      if (!await requestClose(sessionId)) break;
    }
  }, [requestClose]);

  const handleNewFile = useCallback(async () => {
    if (state.workspace) {
      const selected = state.workspace.selectedPath
        ? findWorkspaceEntry(state.workspace.entries, state.workspace.selectedPath)
        : undefined;
      const parentPath = selected?.kind === "directory" ? selected.path : selected?.path.includes("/") ? selected.path.slice(0, selected.path.lastIndexOf("/")) : "";
      await handleCreateDocument(parentPath, "ideasketch");
      return;
    }
    const definition = getFileTypeDefinition("ideasketch");
    if (!definition) return;
    dispatch({
      type: "OPEN_DOCUMENT",
      document: {
        id: crypto.randomUUID(), mode: "standalone", filePath: "", displayName: "Untitled.is",
        fileType: definition.type, status: "editable", model: await definition.createEmpty(), isDirty: true, revision: 1,
      },
    });
  }, [dispatch, handleCreateDocument, state.workspace]);

  const handleOpenFile = useCallback(async () => {
    const { path, document } = await chooseAndOpenStandaloneDocument();
    dispatch({ type: "OPEN_DOCUMENT", document: sessionFromOpened(path, "standalone", document) });
    addRecentFile(path).catch(console.error);
  }, [dispatch]);

  const handleOpenWorkspace = useCallback(async () => {
    const workspace = await openWorkspace();
    const restored = restoreWorkspaceDocuments(workspace);
    dispatch({ type: "OPEN_WORKSPACE", workspace, restoredDocuments: restored.documents, activePath: restored.activePath });
  }, [dispatch]);

  const handleGoHome = useCallback(async () => {
    if (state.documents.some((document) => document.isDirty)) {
      const leave = await ask("There are unsaved files. Leave the current session?", { title: "Unsaved Changes", kind: "warning", okLabel: "Leave", cancelLabel: "Stay" });
      if (!leave) return;
    }
    onGoHome();
  }, [onGoHome, state.documents]);

  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(isMac ? event.metaKey : event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (event.altKey) void handleSaveAll();
      else if (event.shiftKey) void handleSaveAs();
      else void handleSave();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleSave, handleSaveAll, handleSaveAs]);

  const activeFullPath = activeDocument?.mode === "workspace" && state.workspace
    ? joinWorkspacePath(state.workspace.root, activeDocument.filePath)
    : activeDocument?.filePath;
  const dirty = state.documents.some((document) => document.isDirty);

  return (
    <div className="idea-slide-editor-shell flex h-screen flex-col">
      <Toolbar
        fileName={activeDocument?.displayName || state.workspace?.name}
        isDirty={dirty}
        isSaving={isSaving}
        onNewFile={() => void handleNewFile()}
        onOpenFile={() => void handleOpenFile()}
        onOpenWorkspace={() => void handleOpenWorkspace()}
        onSave={() => void handleSave()}
        onSaveAs={() => void handleSaveAs()}
        onSaveAll={() => void handleSaveAll()}
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
          <DocumentTabs
            documents={state.documents}
            activeSessionId={state.activeSessionId}
            recentlyClosedCount={state.recentlyClosed.length}
            onActivate={(sessionId) => dispatch({ type: "ACTIVATE_DOCUMENT", sessionId })}
            onRequestClose={(sessionId) => void requestClose(sessionId)}
            onCloseOthers={(sessionId) => void closeCollection(state.documents.filter((document) => document.id !== sessionId).map((document) => document.id))}
            onCloseRight={(sessionId) => {
              const index = state.documents.findIndex((document) => document.id === sessionId);
              void closeCollection(state.documents.slice(index + 1).map((document) => document.id));
            }}
            onReopenLast={() => dispatch({ type: "REOPEN_LAST_DOCUMENT" })}
          />
          <div className="min-h-0 flex-1 overflow-hidden">
            <DocumentEditorHost document={activeDocument} fullPath={activeFullPath} />
          </div>
        </main>
      </div>
      {effectiveReadOnly && <div className="absolute bottom-3 right-3 rounded-full bg-gray-900/80 px-3 py-1.5 text-[11px] font-medium text-white">Read only</div>}
    </div>
  );
}
