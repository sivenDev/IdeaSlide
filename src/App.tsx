import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppStoreProvider, useAppStore } from "./hooks/useAppStore";
import { EditorLayout } from "./components/EditorLayout";
import { PresentationMode } from "./components/PresentationMode";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RecoveryPrompt } from "./components/RecoveryPrompt";
import { SettingsCenter } from "./components/SettingsCenter";
import { SettingsProvider, useSettings } from "./hooks/useSettings";
import {
  getOpenedFile,
  deleteStandaloneRecoveryDraft,
  listStandaloneRecoveryDrafts,
  type StandaloneRecoveryRecordData,
} from "./lib/tauriCommands";
import { getFileTypeDefinition } from "./lib/fileTypeRegistry";
import { initPreviewRenderer } from "./lib/previewRenderer";

function AppContent() {
  const { state, dispatch } = useAppStore();
  const { settings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [startupRecoveries, setStartupRecoveries] = useState<StandaloneRecoveryRecordData[]>([]);
  const [pendingStandalonePath, setPendingStandalonePath] = useState<string>();
  const isTauriRuntime = "__TAURI_INTERNALS__" in window;
  const windowLabel = isTauriRuntime ? getCurrentWindow().label : "main";
  const isRendererWindow = windowLabel === "preview-renderer";

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };
    window.addEventListener("contextmenu", handleContextMenu, true);
    return () => window.removeEventListener("contextmenu", handleContextMenu, true);
  }, []);

  const requestStandalonePath = useCallback((path: string) => {
    setPendingStandalonePath(path);
  }, []);

  const handlePendingStandalonePathHandled = useCallback(() => {
    setPendingStandalonePath(undefined);
  }, []);

  const handlePresentationExit = useCallback(() => {
    dispatch({ type: "EXIT_PRESENTATION" });
  }, [dispatch]);

  useEffect(() => {
    if (windowLabel === "preview-renderer") initPreviewRenderer().catch(console.error);
  }, [windowLabel]);

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

  return (
    <>
      <ErrorBoundary>
        <EditorLayout
          readOnly={false}
          pendingStandalonePath={pendingStandalonePath}
          onPendingStandalonePathHandled={handlePendingStandalonePathHandled}
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
