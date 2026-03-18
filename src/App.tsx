import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { SlideStoreProvider, useSlideStore } from "./hooks/useSlideStore";
import { LaunchScreen } from "./components/LaunchScreen";
import { EditorLayout } from "./components/EditorLayout";
import { PresentationMode } from "./components/PresentationMode";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { invoke } from "@tauri-apps/api/core";
import { openRecentFile, addRecentFile, getOpenedFile, convertFromIsFileData } from "./lib/tauriCommands";
import { initMcpRenderer } from "./lib/mcpRenderer";
import { initCameraThumbnailRenderer } from "./lib/cameraThumbnailRenderer";

function AppContent() {
  const { state, dispatch } = useSlideStore();
  const [showEditor, setShowEditor] = useState(false);
  const [mcpVisible, setMcpVisible] = useState(false);
  const windowLabel = getCurrentWindow().label;
  const isRendererWindow =
    windowLabel === "mcp-renderer" || windowLabel === "camera-renderer";

  async function loadFileFromPath(filePath: string) {
    const slides = await openRecentFile(filePath);
    await addRecentFile(filePath);
    dispatch({
      type: "LOAD_PRESENTATION",
      payload: { slides, filePath },
    });
    setShowEditor(true);
  }

  function handleFileOpened(filePath: string, slides: any[]) {
    dispatch({
      type: "LOAD_PRESENTATION",
      payload: { slides, filePath: filePath || undefined },
    });
    setShowEditor(true);
  }

  // Hidden renderer windows boot only the renderer event handlers.
  useEffect(() => {
    if (windowLabel === "mcp-renderer") {
      initMcpRenderer().catch(console.error);
    }
    if (windowLabel === "camera-renderer") {
      initCameraThumbnailRenderer().catch(console.error);
    }
  }, [windowLabel]);

  // MCP visible mode: check on startup and listen for state changes
  useEffect(() => {
    if (isRendererWindow) return;
    invoke<boolean>("is_mcp_visible").then((visible) => {
      setMcpVisible(visible);
    }).catch(() => {});
  }, [isRendererWindow]);

  useEffect(() => {
    if (isRendererWindow) return;
    if (!mcpVisible) return;
    const unlisten = listen<{ path: string; data: any }>("mcp-state-changed", (event) => {
      const slides = convertFromIsFileData(event.payload.data);
      dispatch({
        type: "LOAD_PRESENTATION",
        payload: { slides, filePath: event.payload.path },
      });
      setShowEditor(true);
    });

    const unlistenSession = listen<{
      type: string;
      session_id: string;
      path?: string;
      elements?: any[];
      total_elements?: number;
    }>("mcp-session-event", (event) => {
      const { type, session_id, path, elements } = event.payload;
      switch (type) {
        case "elements_appended":
          if (path && !showEditor) {
            dispatch({ type: "SESSION_STARTED", sessionId: session_id, path });
            setShowEditor(true);
          }
          if (elements) {
            dispatch({ type: "SESSION_ELEMENTS_UPDATED", sessionId: session_id, elements });
          }
          break;
        case "session_committed":
        case "session_aborted":
          dispatch({ type: "SESSION_ENDED", sessionId: session_id });
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
      unlistenSession.then((fn) => fn());
    };
  }, [isRendererWindow, mcpVisible, dispatch]);

  // Cold start: check if app was launched by opening a .is file
  useEffect(() => {
    if (isRendererWindow) return;
    getOpenedFile().then((filePath) => {
      if (filePath) {
        loadFileFromPath(filePath).catch((err) =>
          console.error("Failed to open file on launch:", err)
        );
      }
    });
  }, [isRendererWindow]);

  // Hot start: listen for file-open events while app is running
  useEffect(() => {
    if (isRendererWindow) return;
    const unlisten = listen<string>("file-open", async (event) => {
      try {
        await loadFileFromPath(event.payload);
      } catch (err) {
        console.error("Failed to open file from system:", err);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [isRendererWindow, dispatch]);

  if (isRendererWindow) {
    return null;
  }

  if (!showEditor) {
    return <LaunchScreen onFileOpened={handleFileOpened} />;
  }

  // Presentation mode takes priority over editor
  if (state.presentationMode !== 'none') {
    return (
      <PresentationMode
        slides={state.slides}
        startIndex={state.currentSlideIndex}
        mode={state.presentationMode as 'preview' | 'fullscreen'}
        transitionSpeed={state.transitionSpeed}
        onExit={() => dispatch({ type: 'EXIT_PRESENTATION' })}
      />
    );
  }

  return (
    <ErrorBoundary>
      <EditorLayout onGoHome={() => setShowEditor(false)} readOnly={mcpVisible} />
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <SlideStoreProvider>
        <AppContent />
      </SlideStoreProvider>
    </ErrorBoundary>
  );
}

export default App;
