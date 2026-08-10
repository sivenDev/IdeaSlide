import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppStoreProvider, useAppStore } from "./hooks/useAppStore";
import { LaunchScreen } from "./components/LaunchScreen";
import { EditorLayout } from "./components/EditorLayout";
import { PresentationMode } from "./components/PresentationMode";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RecoveryPrompt } from "./components/RecoveryPrompt";
import { SettingsCenter } from "./components/SettingsCenter";
import { SettingsProvider, useSettings } from "./hooks/useSettings";
import {
  addRecentFile,
  chooseAndOpenStandaloneDocument,
  getOpenedFile,
  deleteStandaloneRecoveryDraft,
  exitApplication,
  listStandaloneRecoveryDrafts,
  openStandaloneDocument,
  openWorkspace,
  type OpenedDocument,
  type StandaloneRecoveryRecordData,
} from "./lib/tauriCommands";
import { getFileTypeDefinition } from "./lib/fileTypeRegistry";
import { restoreWorkspaceDocuments } from "./lib/workspaceState";
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
    status: opened.readOnly ? "read-only" : "editable",
    model: opened.model,
    isDirty: false,
    revision: 0,
    readOnly: opened.readOnly,
    sourceModified: opened.sourceModified,
  };
}

function AppContent() {
  const { state, dispatch } = useAppStore();
  const { settings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [startupRecoveries, setStartupRecoveries] = useState<StandaloneRecoveryRecordData[]>([]);
  const [pendingStandalonePath, setPendingStandalonePath] = useState<string>();
  const latestMode = useRef(state.mode);
  latestMode.current = state.mode;
  const isTauriRuntime = "__TAURI_INTERNALS__" in window;
  const windowLabel = isTauriRuntime ? getCurrentWindow().label : "main";
  const isRendererWindow = windowLabel === "preview-renderer";

  const openStandalonePath = useCallback(async (path: string) => {
    const opened = await openStandaloneDocument(path);
    dispatch({ type: "OPEN_DOCUMENT", document: sessionFromOpened(path, "standalone", opened) });
    addRecentFile(path).catch(console.error);
  }, [dispatch]);

  const requestStandalonePath = useCallback((path: string) => {
    if (latestMode.current === "launch") {
      openStandalonePath(path).catch(console.error);
      return;
    }
    setPendingStandalonePath(path);
  }, [openStandalonePath]);

  const handlePendingStandalonePathHandled = useCallback(() => {
    setPendingStandalonePath(undefined);
  }, []);

  const handleNewFile = useCallback(async (fileType: string) => {
    const definition = getFileTypeDefinition(fileType);
    if (!definition?.creatable) throw new Error(`${fileType} is not registered for creation`);
    const model = await definition.createEmpty();
    const extension = definition.extensions[0] ?? "txt";
    dispatch({
      type: "OPEN_DOCUMENT",
      document: {
        id: crypto.randomUUID(),
        mode: "standalone",
        filePath: "",
        displayName: `Untitled.${extension}`,
        fileType: definition.type,
        status: "editable",
        model,
        isDirty: true,
        revision: 1,
      },
    });
  }, [dispatch]);

  const handleOpenWorkspace = useCallback(async (root?: string) => {
    const workspace = await openWorkspace(root);
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
    if (windowLabel === "preview-renderer") initPreviewRenderer().catch(console.error);
  }, [windowLabel]);

  useEffect(() => {
    if (isRendererWindow || !isTauriRuntime || state.mode !== "launch") return;
    const unlisten = getCurrentWindow().onCloseRequested((event) => {
      event.preventDefault();
      exitApplication().catch((error) => console.error("Failed to close IdeaNote:", error));
    });
    return () => { unlisten.then((dispose) => dispose()).catch(() => undefined); };
  }, [isRendererWindow, isTauriRuntime, state.mode]);

  useEffect(() => {
    if (isRendererWindow || !isTauriRuntime) return;
    getOpenedFile().then((path) => {
      if (path) requestStandalonePath(path);
    }).catch(console.error);
    const unlisten = listen<string>("file-open", (event) => {
      requestStandalonePath(event.payload);
    });
    return () => { unlisten.then((dispose) => dispose()); };
  }, [isRendererWindow, isTauriRuntime, requestStandalonePath]);

  useEffect(() => {
    if (isRendererWindow || !isTauriRuntime) return;
    listStandaloneRecoveryDrafts()
      .then((records) => setStartupRecoveries(records.filter((record) =>
        !record.draft.sourcePath && Boolean(getFileTypeDefinition(record.draft.model?.type)))))
      .catch((error) => console.warn("Standalone recovery drafts could not be listed:", error));
  }, [isRendererWindow, isTauriRuntime]);

  const startupRecovery = startupRecoveries[0];

  const restoreStartupRecovery = useCallback(async () => {
    if (!startupRecovery) return;
    const sessionId = crypto.randomUUID();
    const fileType = startupRecovery.draft.model.type;
    const definition = getFileTypeDefinition(fileType);
    if (!definition) return;
    const extension = definition.extensions[0] ?? "txt";
    await deleteStandaloneRecoveryDraft(startupRecovery.key).catch((error) => {
      console.warn("Failed to retire standalone recovery draft:", error);
    });
    dispatch({
      type: "OPEN_DOCUMENT",
      document: {
        id: sessionId,
        mode: "standalone",
        filePath: "",
        displayName: `Recovered Untitled.${extension}`,
        fileType,
        status: "editable",
        model: startupRecovery.draft.model,
        isDirty: true,
        revision: 1,
      },
    });
    setStartupRecoveries((records) => records.slice(1));
  }, [dispatch, startupRecovery]);

  const discardStartupRecovery = useCallback(async () => {
    if (!startupRecovery) return;
    await deleteStandaloneRecoveryDraft(startupRecovery.key).catch((error) => {
      console.warn("Failed to discard standalone recovery draft:", error);
    });
    setStartupRecoveries((records) => records.slice(1));
  }, [startupRecovery]);

  if (isRendererWindow) return null;

  let content;
  if (state.mode === "launch") {
    content = (
      <LaunchScreen
        onNewFile={handleNewFile}
        onOpenWorkspace={handleOpenWorkspace}
        onOpenFile={handleOpenFile}
        onOpenRecentWorkspace={handleOpenWorkspace}
        onOpenRecentFile={openStandalonePath}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    );
  } else {
    content = (
      <ErrorBoundary>
        <EditorLayout
          readOnly={false}
          pendingStandalonePath={pendingStandalonePath}
          onPendingStandalonePathHandled={handlePendingStandalonePathHandled}
          onGoHome={() => dispatch({ type: "GO_HOME" })}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {state.presentationMode !== "none"
          && state.presentationPage
          && state.presentationSessionId
          && state.presentationPageId && (
            <PresentationMode
              slide={state.presentationPage}
              mode={state.presentationMode}
              transitionSpeed="slow"
              onExit={handlePresentationExit}
              previewLaserEnabled={settings.ideaSketch.previewLaserEnabled}
            />
          )}
      </ErrorBoundary>
    );
  }

  return (
    <>
      {content}
      {startupRecovery && (
        <div className="fixed inset-x-4 top-4 z-[80]">
          <RecoveryPrompt
            draft={startupRecovery.draft}
            sourceChanged={false}
            onRestore={() => void restoreStartupRecovery()}
            onDiscard={() => void discardStartupRecovery()}
            onCancel={() => setStartupRecoveries([])}
          />
        </div>
      )}
      <SettingsCenter open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <AppStoreProvider>
          <AppContent />
        </AppStoreProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
