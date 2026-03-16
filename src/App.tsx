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

function AppContent() {
  const { state, dispatch } = useSlideStore();
  const [showEditor, setShowEditor] = useState(false);
  const [mcpVisible, setMcpVisible] = useState(false);

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

  // MCP renderer mode: initialize headless Excalidraw renderer
  useEffect(() => {
    if (getCurrentWindow().label === 'mcp-renderer') {
      initMcpRenderer().catch(console.error);
    }
  }, []);

  // MCP visible mode: check on startup and listen for state changes
  useEffect(() => {
    invoke<boolean>("is_mcp_visible").then((visible) => {
      setMcpVisible(visible);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!mcpVisible) return;
    const unlisten = listen<{ path: string; data: any }>("mcp-state-changed", (event) => {
      const slides = convertFromIsFileData(event.payload.data);
      dispatch({
        type: "LOAD_PRESENTATION",
        payload: { slides, filePath: event.payload.path },
      });
      setShowEditor(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [mcpVisible, dispatch]);

  // Cold start: check if app was launched by opening a .is file
  useEffect(() => {
    getOpenedFile().then((filePath) => {
      if (filePath) {
        loadFileFromPath(filePath).catch((err) =>
          console.error("Failed to open file on launch:", err)
        );
      }
    });
  }, []);

  // Hot start: listen for file-open events while app is running
  useEffect(() => {
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
  }, [dispatch]);

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
