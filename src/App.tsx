import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppStoreProvider, useAppStore } from "./hooks/useAppStore";
import { LaunchScreen } from "./components/LaunchScreen";
import { EditorLayout } from "./components/EditorLayout";
import { PresentationMode } from "./components/PresentationMode";
import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  addRecentFile,
  chooseAndOpenStandaloneDocument,
  getOpenedFile,
  openStandaloneDocument,
  openWorkspace,
  type OpenedDocument,
} from "./lib/tauriCommands";
import { getFileTypeDefinition } from "./lib/fileTypeRegistry";
import { restoreWorkspaceDocuments } from "./lib/workspaceState";
import { initMcpRenderer } from "./lib/mcpRenderer";
import { initPreviewRenderer } from "./lib/previewRenderer";
import type { DocumentSession } from "./types";

function sessionFromOpened(
  path: string,
  mode: "workspace" | "standalone",
  opened: OpenedDocument,
): DocumentSession {
  const id = crypto.randomUUID();
  const displayName = path.replace(/\\/g, "/").split("/").pop() || "Untitled.is";
  if (opened.status === "legacy-protected") {
    return {
      id,
      mode,
      filePath: path,
      displayName,
      fileType: opened.fileType,
      status: "legacy-protected",
      protectedVersion: opened.version,
      message: opened.message,
      isDirty: false,
      revision: 0,
    };
  }
  return {
    id,
    mode,
    filePath: path,
    displayName,
    fileType: opened.fileType,
    status: "editable",
    model: opened.model,
    isDirty: false,
    revision: 0,
  };
}

function AppContent() {
  const { state, dispatch } = useAppStore();
  const [mcpVisible, setMcpVisible] = useState(false);
  const isTauriRuntime = "__TAURI_INTERNALS__" in window;
  const windowLabel = isTauriRuntime ? getCurrentWindow().label : "main";
  const isRendererWindow = windowLabel === "mcp-renderer" || windowLabel === "preview-renderer";

  const openStandalonePath = useCallback(async (path: string) => {
    const opened = await openStandaloneDocument(path);
    dispatch({ type: "OPEN_DOCUMENT", document: sessionFromOpened(path, "standalone", opened) });
    addRecentFile(path).catch(console.error);
  }, [dispatch]);

  const handleNewFile = useCallback(async () => {
    const definition = getFileTypeDefinition("ideasketch");
    if (!definition) throw new Error("IdeaSketch is not registered");
    const model = await definition.createEmpty();
    dispatch({
      type: "OPEN_DOCUMENT",
      document: {
        id: crypto.randomUUID(),
        mode: "standalone",
        filePath: "",
        displayName: "Untitled.is",
        fileType: definition.type,
        status: "editable",
        model,
        isDirty: true,
        revision: 1,
      },
    });
  }, [dispatch]);

  const handleOpenWorkspace = useCallback(async () => {
    const workspace = await openWorkspace();
    const restored = restoreWorkspaceDocuments(workspace);
    dispatch({
      type: "OPEN_WORKSPACE",
      workspace,
      restoredDocuments: restored.documents,
      activePath: restored.activePath,
    });
  }, [dispatch]);

  const handleOpenFile = useCallback(async () => {
    const { path, document } = await chooseAndOpenStandaloneDocument();
    dispatch({ type: "OPEN_DOCUMENT", document: sessionFromOpened(path, "standalone", document) });
    addRecentFile(path).catch(console.error);
  }, [dispatch]);

  const handlePresentationExit = useCallback(() => {
    dispatch({ type: "EXIT_PRESENTATION" });
  }, [dispatch]);

  useEffect(() => {
    if (windowLabel === "mcp-renderer") initMcpRenderer().catch(console.error);
    if (windowLabel === "preview-renderer") initPreviewRenderer().catch(console.error);
  }, [windowLabel]);

  useEffect(() => {
    if (isRendererWindow || !isTauriRuntime) return;
    invoke<boolean>("is_mcp_visible").then(setMcpVisible).catch(() => undefined);
  }, [isRendererWindow, isTauriRuntime]);

  useEffect(() => {
    if (isRendererWindow || !isTauriRuntime) return;
    getOpenedFile().then((path) => {
      if (path) return openStandalonePath(path);
    }).catch(console.error);
    const unlisten = listen<string>("file-open", (event) => {
      openStandalonePath(event.payload).catch(console.error);
    });
    return () => { unlisten.then((dispose) => dispose()); };
  }, [isRendererWindow, isTauriRuntime, openStandalonePath]);

  if (isRendererWindow) return null;

  if (state.mode === "launch") {
    return (
      <LaunchScreen
        onNewFile={handleNewFile}
        onOpenWorkspace={handleOpenWorkspace}
        onOpenFile={handleOpenFile}
        onOpenRecent={openStandalonePath}
      />
    );
  }

  if (state.presentationMode !== "none") {
    const session = state.documents.find((document) => document.id === state.presentationSessionId);
    const model = session?.model;
    if (model?.type === "ideasketch" && model.pages[0]) {
      return (
        <PresentationMode
          slide={model.pages[0]}
          mode={state.presentationMode}
          transitionSpeed="slow"
          onExit={handlePresentationExit}
        />
      );
    }
  }

  return (
    <ErrorBoundary>
      <EditorLayout
        readOnly={mcpVisible}
        onGoHome={() => dispatch({ type: "GO_HOME" })}
      />
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppStoreProvider>
        <AppContent />
      </AppStoreProvider>
    </ErrorBoundary>
  );
}

export default App;
