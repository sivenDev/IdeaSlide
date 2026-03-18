import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSlideStore } from "../hooks/useSlideStore";
import { useAutoSave } from "../hooks/useAutoSave";
import { useSlideThumbnails } from "../hooks/useSlideThumbnails";
import { Toolbar } from "./Toolbar";
import { SlidePreviewPanel } from "./SlidePreviewPanel";
import { CameraList } from "./CameraList";
import { SlideCanvas } from "./SlideCanvas";
import { ResizableDivider } from "./ResizableDivider";
import { ErrorBoundary } from "./ErrorBoundary";
import { createNewPresentation, openFile, saveFile, addRecentFile } from "../lib/tauriCommands";
import { extractCameras, reorderCameras } from "../lib/cameraUtils";
import { useCameraThumbnails } from "../hooks/useCameraThumbnails";
import { save, message, ask } from "@tauri-apps/plugin-dialog";

interface EditorLayoutProps {
  onGoHome: () => void;
  readOnly?: boolean;
}

export function EditorLayout({ onGoHome, readOnly = false }: EditorLayoutProps) {
  const { state, dispatch } = useSlideStore();
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [bottomTab, setBottomTab] = useState<'cameras' | 'slides'>('cameras');
  const excalidrawApiRef = useRef<any>(null);
  const thumbnails = useSlideThumbnails(state.slides);

  const currentSlide = state.slides[state.currentSlideIndex];

  // Memoize cameras with stable signature to prevent unnecessary re-renders
  const cameras = useMemo(() => {
    return extractCameras(currentSlide.elements);
  }, [
    currentSlide.elements.filter((el: any) => el.customData?.type === 'camera' && !el.isDeleted)
      .map((el: any) => `${el.id}:${el.customData?.order}`).join(',')
  ]);

  const cameraThumbnails = useCameraThumbnails(
    cameras,
    currentSlide.elements,
    currentSlide.files
  );

  useAutoSave({
    filePath: state.filePath,
    slides: state.slides,
    isDirty: readOnly ? false : state.isDirty,
    onSaveStart: () => setIsSaving(true),
    onSaveComplete: () => {
      setIsSaving(false);
      dispatch({ type: "MARK_SAVED" });
    },
    onSaveError: (error) => {
      setIsSaving(false);
      console.error("Auto-save failed:", error);
    },
  });

  const fileName = state.filePath?.split("/").pop();

  function handleNewIdea() {
    const { slides } = createNewPresentation();
    dispatch({
      type: "LOAD_PRESENTATION",
      payload: { slides },
    });
  }

  async function handleOpenFile() {
    try {
      const { path, slides } = await openFile();
      dispatch({
        type: "LOAD_PRESENTATION",
        payload: { slides, filePath: path },
      });
      addRecentFile(path).catch(console.error);
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  }

  async function handleSave() {
    if (state.filePath) {
      try {
        setIsSaving(true);
        await saveFile(state.filePath, state.slides);
        dispatch({ type: "MARK_SAVED" });
        addRecentFile(state.filePath).catch(console.error);
      } catch (err) {
        console.error("Failed to save:", err);
        await message(
          `Failed to save file: ${err instanceof Error ? err.message : String(err)}`,
          {
            title: "Save Error",
            kind: "error",
          }
        );
      } finally {
        setIsSaving(false);
      }
    } else {
      await handleSaveAs();
    }
  }

  const handleSaveCallback = useCallback(handleSave, [
    state.filePath,
    state.slides,
    dispatch,
  ]);

  // Keyboard shortcut: Cmd+S (macOS) or Ctrl+S (Windows/Linux) to save
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Check for Cmd+S (Mac) or Ctrl+S (Windows/Linux)
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        await handleSaveCallback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveCallback]);

  async function handleSaveAs() {
    try {
      const filePath = await save({
        filters: [{ name: "IdeaSlide", extensions: ["is"] }],
        defaultPath: fileName || "Untitled.is",
      });

      if (!filePath) return;

      await saveFile(filePath, state.slides);
      dispatch({
        type: "LOAD_PRESENTATION",
        payload: { slides: state.slides, filePath },
      });
      addRecentFile(filePath).catch(console.error);
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  }

  const handleGoHome = useCallback(async () => {
    if (state.isDirty) {
      try {
        const shouldLeave = await ask(
          "You have unsaved changes. Leave without saving?",
          {
            title: "Unsaved Changes",
            kind: "warning",
            okLabel: "Leave",
            cancelLabel: "Stay",
          }
        );
        if (!shouldLeave) return;
      } catch (err) {
        console.error("Dialog error:", err);
        return;
      }
    }
    onGoHome();
  }, [state.isDirty, onGoHome]);

  // Track element/file versions to detect actual slide content changes.
  function buildElementsFingerprint(elements: readonly any[]) {
    return elements.map((el: any) => `${el.id}:${el.version}`).join(",");
  }

  function buildFilesFingerprint(files: Record<string, any>) {
    return Object.values(files)
      .map((file: any) => {
        const id = file?.id ?? "";
        const mimeType = file?.mimeType ?? "";
        const size = file?.size ?? 0;
        return `${id}:${mimeType}:${size}`;
      })
      .sort()
      .join(",");
  }

  const lastContentFingerprintRef = useRef(
    `${buildElementsFingerprint(currentSlide.elements)}|${buildFilesFingerprint(currentSlide.files)}`
  );

  // Use a ref for currentSlideIndex to avoid re-creating the callback
  const currentSlideIndexRef = useRef(state.currentSlideIndex);
  const slidesRef = useRef(state.slides);
  slidesRef.current = state.slides;
  if (currentSlideIndexRef.current !== state.currentSlideIndex) {
    // Initialize fingerprint with the new slide's full content so the first
    // onChange after mount doesn't falsely trigger isDirty.
    const newSlide = state.slides[state.currentSlideIndex];
    lastContentFingerprintRef.current = `${buildElementsFingerprint(newSlide.elements)}|${buildFilesFingerprint(newSlide.files)}`;
  }
  currentSlideIndexRef.current = state.currentSlideIndex;

  const handleSlideChange = useCallback(
    (elements: readonly any[], appState: Partial<any>, files: Record<string, any>) => {
      const contentFingerprint = `${buildElementsFingerprint(elements)}|${buildFilesFingerprint(files)}`;
      const contentChanged = contentFingerprint !== lastContentFingerprintRef.current;
      lastContentFingerprintRef.current = contentFingerprint;

      dispatch({
        type: "UPDATE_SLIDE",
        payload: {
          index: currentSlideIndexRef.current,
          elements,
          appState,
          files,
          contentChanged,
        },
      });
    },
    [dispatch]
  );

  return (
    <div className="h-screen flex flex-col">
      <Toolbar
        fileName={fileName}
        isDirty={state.isDirty}
        isSaving={isSaving}
        showPreview={showPreview}
        onNewIdea={handleNewIdea}
        onOpenFile={handleOpenFile}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onGoHome={handleGoHome}
        onTogglePreview={() => setShowPreview((prev) => !prev)}
        onAddSlide={() => dispatch({ type: "ADD_SLIDE" })}
        onStartPreview={() => dispatch({ type: 'START_PRESENTATION', payload: { mode: 'preview' } })}
        onStartFullscreen={() => dispatch({ type: 'START_PRESENTATION', payload: { mode: 'fullscreen' } })}
        onStartFromBeginning={() => {
          dispatch({ type: 'SET_CURRENT_SLIDE', payload: { index: 0 } });
          dispatch({ type: 'START_PRESENTATION', payload: { mode: 'fullscreen' } });
        }}
      />

      {state.activeSessions.size > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-blue-700">
            Streaming: {Array.from(state.activeSessions.values()).map(s => `${s.elements.length} elements`).join(', ')}
          </span>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 relative">
          <div className="absolute inset-0">
            <ErrorBoundary>
              <SlideCanvas
                slideId={currentSlide.id}
                elements={currentSlide.elements}
                appState={currentSlide.appState}
                files={currentSlide.files}
                onChange={handleSlideChange}
                onApiReady={(api: any) => { excalidrawApiRef.current = api; }}
              />
            </ErrorBoundary>
          </div>
        </div>

        <ResizableDivider
          isVisible={showPreview}
          onToggle={() => setShowPreview((prev) => !prev)}
        />

        <div className={`transition-all duration-300 overflow-hidden ${showPreview ? "h-[182px]" : "h-0"}`}>
          {/* Tab switcher */}
          <div className="flex items-center bg-gray-50 border-b border-gray-200 px-3 h-8 flex-shrink-0">
            <button
              onClick={() => setBottomTab('cameras')}
              className={`px-3 py-1 text-xs font-medium rounded-t transition-colors ${
                bottomTab === 'cameras'
                  ? 'text-amber-600 bg-white border border-b-0 border-gray-200 -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Cameras
            </button>
            <button
              onClick={() => setBottomTab('slides')}
              className={`px-3 py-1 text-xs font-medium rounded-t transition-colors ${
                bottomTab === 'slides'
                  ? 'text-blue-600 bg-white border border-b-0 border-gray-200 -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Slides
            </button>
          </div>

          {/* Tab content */}
          {bottomTab === 'cameras' ? (
            <CameraList
              cameras={cameras}
              thumbnails={cameraThumbnails}
              onCameraSelect={(camera) => {
                const api = excalidrawApiRef.current;
                if (api) {
                  api.scrollToContent(
                    currentSlide.elements.filter((el: any) => el.id === camera.id),
                    { fitToContent: true, animate: true, duration: 300 }
                  );
                }
              }}
              onCameraDelete={(cameraId) => {
                const api = excalidrawApiRef.current;
                if (api) {
                  const newElements = currentSlide.elements.filter((el: any) => el.id !== cameraId);
                  api.updateScene({ elements: newElements });
                }
              }}
              onReorder={(orderedIds) => {
                const api = excalidrawApiRef.current;
                if (api) {
                  const newElements = reorderCameras(currentSlide.elements, orderedIds);
                  api.updateScene({ elements: newElements });
                }
              }}
            />
          ) : (
            <SlidePreviewPanel
              slides={state.slides}
              currentSlideIndex={state.currentSlideIndex}
              thumbnails={thumbnails}
              onSlideSelect={(index) =>
                dispatch({ type: "SET_CURRENT_SLIDE", payload: { index } })
              }
              onAddSlide={() => dispatch({ type: "ADD_SLIDE" })}
              onDeleteSlide={(index) =>
                dispatch({ type: "DELETE_SLIDE", payload: { index } })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
