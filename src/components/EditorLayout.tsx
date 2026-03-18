import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSlideStore } from "../hooks/useSlideStore";
import { useAutoSave } from "../hooks/useAutoSave";
import { useEditorSession } from "../hooks/useEditorSession";
import { useSlideThumbnails } from "../hooks/useSlideThumbnails";
import { Toolbar } from "./Toolbar";
import { SlidePreviewPanel } from "./SlidePreviewPanel";
import { CameraList } from "./CameraList";
import { SlideCanvas } from "./SlideCanvas";
import { ResizableDivider } from "./ResizableDivider";
import { ErrorBoundary } from "./ErrorBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/Tabs";
import { createNewPresentation, openFile, saveFile, addRecentFile } from "../lib/tauriCommands";
import { extractCameras, reorderCameras } from "../lib/cameraUtils";
import { useCameraThumbnails } from "../hooks/useCameraThumbnails";
import { isCameraThumbnailGenerationEnabled } from "../lib/cameraThumbnail";
import { isTargetWithinNode } from "../lib/domTargets";
import { save, message, ask } from "@tauri-apps/plugin-dialog";

interface EditorLayoutProps {
  onGoHome: () => void;
  readOnly?: boolean;
}

type BottomTab = "cameras" | "slides";

export function EditorLayout({ onGoHome, readOnly = false }: EditorLayoutProps) {
  const { state, dispatch } = useSlideStore();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);
  const [showPreview, setShowPreview] = useState(true);
  const [bottomTab, setBottomTab] = useState<BottomTab>("cameras");
  const excalidrawApiRef = useRef<any>(null);
  const cameraListRef = useRef<HTMLDivElement>(null);

  const currentSlide = state.slides[state.currentSlideIndex];
  const { draft, flushDraft, hasPendingCommit, slidesForPersistence, updateDraft } = useEditorSession({
    slide: currentSlide,
    slideIndex: state.currentSlideIndex,
    slides: state.slides,
    onCommit: (index, payload) => {
      dispatch({
        type: "COMMIT_SLIDE",
        payload: {
          index,
          slide: payload.slide,
        },
      });
    },
    onDirty: () => {
      if (!readOnly) {
        dispatch({ type: "MARK_DIRTY" });
      }
    },
  });
  const updateDraftRef = useRef(updateDraft);

  useEffect(() => {
    updateDraftRef.current = updateDraft;
  }, [updateDraft]);

  // Keep the editor canvas mounted against the slide-switch snapshot only.
  // Live typing stays inside Excalidraw and no longer round-trips through
  // parent props on every change, which avoids text flicker during preview work.
  const canvasInitialScene = useMemo(
    () => ({
      slideId: currentSlide.id,
      elements: currentSlide.elements,
      appState: currentSlide.appState,
      files: currentSlide.files,
    }),
    [currentSlide.id],
  );

  const slidePreviewSlides = useMemo(() => {
    const nextSlides = [...state.slides];
    nextSlides[state.currentSlideIndex] = {
      id: draft.slideId,
      elements: draft.elements,
      appState: draft.appState,
      files: draft.files,
    };
    return nextSlides;
  }, [
    draft.appState,
    draft.elements,
    draft.files,
    draft.slideId,
    state.currentSlideIndex,
    state.slides,
  ]);

  const thumbnails = useSlideThumbnails(slidePreviewSlides, {
    enabled: showPreview && bottomTab === "slides",
  });

  const cameras = extractCameras(draft.elements);
  const activeCameraId =
    selectedCameraId && cameras.some((camera) => camera.id === selectedCameraId)
      ? selectedCameraId
      : undefined;
  const cameraThumbnailsEnabled = isCameraThumbnailGenerationEnabled({
    showPreview,
    bottomTab,
  });

  const cameraThumbnails = useCameraThumbnails(
    cameras,
    draft.elements,
    draft.appState,
    draft.files,
    250,
    cameraThumbnailsEnabled
  );
  const effectiveIsDirty = !readOnly && (state.isDirty || hasPendingCommit);

  useAutoSave({
    filePath: state.filePath,
    slides: slidesForPersistence,
    isDirty: effectiveIsDirty,
    onSaveStart: () => {
      flushDraft();
      setIsSaving(true);
    },
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

  useEffect(() => {
    setSelectedCameraId(undefined);
  }, [currentSlide.id]);

  useEffect(() => {
    setSelectedCameraId((previousSelectedCameraId) => {
      if (!previousSelectedCameraId) {
        return undefined;
      }

      return cameras.some((camera) => camera.id === previousSelectedCameraId)
        ? previousSelectedCameraId
        : undefined;
    });
  }, [cameras]);

  useEffect(() => {
    if (bottomTab !== "cameras") {
      setSelectedCameraId(undefined);
    }
  }, [bottomTab]);

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
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  }

  async function handleSave() {
    if (state.filePath) {
      try {
        setIsSaving(true);
        flushDraft();
        await saveFile(state.filePath, slidesForPersistence);
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
    slidesForPersistence,
    flushDraft,
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

      flushDraft();
      await saveFile(filePath, slidesForPersistence);
      dispatch({
        type: "LOAD_PRESENTATION",
        payload: { slides: slidesForPersistence, filePath },
      });
      addRecentFile(filePath).catch(console.error);
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  }

  const handleGoHome = useCallback(async () => {
    if (effectiveIsDirty) {
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
    flushDraft();
    onGoHome();
  }, [effectiveIsDirty, onGoHome, flushDraft]);

  const handleSlideChange = useCallback(
    (elements: readonly any[], appState: Partial<any>, files: Record<string, any>) => {
      updateDraftRef.current(elements, appState, files);
    },
    []
  );

  const handleCanvasApiReady = useCallback((api: any) => {
    excalidrawApiRef.current = api;
  }, []);

  const handleBottomTabChange = useCallback((value: string) => {
    setBottomTab(value === "slides" ? "slides" : "cameras");
  }, []);

  return (
    <div
      className="h-screen flex flex-col"
      onPointerDownCapture={(event) => {
        if (!selectedCameraId || bottomTab !== "cameras") {
          return;
        }

        if (isTargetWithinNode(cameraListRef.current, event.target)) {
          return;
        }

        setSelectedCameraId(undefined);
      }}
    >
      <Toolbar
        fileName={fileName}
        isDirty={effectiveIsDirty}
        isSaving={isSaving}
        showPreview={showPreview}
        onNewIdea={handleNewIdea}
        onOpenFile={handleOpenFile}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onGoHome={handleGoHome}
        onTogglePreview={() => setShowPreview((prev) => !prev)}
        onAddSlide={() => {
          flushDraft();
          dispatch({ type: "ADD_SLIDE" });
        }}
        onStartPreview={() => {
          flushDraft();
          dispatch({ type: 'START_PRESENTATION', payload: { mode: 'preview' } });
        }}
        onStartFullscreen={() => {
          flushDraft();
          dispatch({ type: 'START_PRESENTATION', payload: { mode: 'fullscreen' } });
        }}
        onStartFromBeginning={() => {
          flushDraft();
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
                slideId={canvasInitialScene.slideId}
                elements={canvasInitialScene.elements}
                appState={canvasInitialScene.appState}
                files={canvasInitialScene.files}
                onChange={handleSlideChange}
                onApiReady={handleCanvasApiReady}
              />
            </ErrorBoundary>
          </div>
        </div>

        <ResizableDivider
          isVisible={showPreview}
          onToggle={() => setShowPreview((prev) => !prev)}
        />

        <div className={`transition-all duration-300 overflow-hidden ${showPreview ? "h-[182px]" : "h-0"}`}>
          <Tabs
            value={bottomTab}
            onValueChange={handleBottomTabChange}
            className="h-full flex flex-col"
          >
            <TabsList className="flex items-center bg-gray-50 border-b border-gray-200 px-3 h-8 flex-shrink-0">
              <TabsTrigger
                value="cameras"
                className="data-[state=active]:text-amber-600 data-[state=active]:border-gray-200 data-[state=active]:border-b-white data-[state=active]:-mb-px"
              >
                Cameras
              </TabsTrigger>
              <TabsTrigger
                value="slides"
                className="data-[state=active]:text-blue-600 data-[state=active]:border-gray-200 data-[state=active]:border-b-white data-[state=active]:-mb-px"
              >
                Slides
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cameras">
              <div ref={cameraListRef}>
                <CameraList
                  cameras={cameras}
                  thumbnails={cameraThumbnails}
                  activeCameraId={activeCameraId}
                  onCameraSelect={(camera) => {
                    const api = excalidrawApiRef.current;
                    if (api) {
                      setSelectedCameraId(camera.id);
                      const cameraElement = api
                        .getSceneElements()
                        .find((el: any) => el.id === camera.id);

                      if (!cameraElement) {
                        return;
                      }

                      api.setActiveTool({ type: "selection" });
                      api.updateScene({
                        appState: {
                          selectedElementIds: { [camera.id]: true },
                        },
                      });
                      api.scrollToContent(
                        [cameraElement],
                        { fitToContent: true, animate: true, duration: 300 }
                      );
                    }
                  }}
                  onCameraDelete={(cameraId) => {
                    const api = excalidrawApiRef.current;
                    if (api) {
                      if (activeCameraId === cameraId) {
                        setSelectedCameraId(undefined);
                      }
                      const newElements = draft.elements.filter((el: any) => el.id !== cameraId);
                      const sceneUpdate: any = { elements: newElements };
                      if (activeCameraId === cameraId) {
                        sceneUpdate.appState = { selectedElementIds: {} };
                      }
                      api.updateScene(sceneUpdate);
                    }
                  }}
                  onReorder={(orderedIds) => {
                    const api = excalidrawApiRef.current;
                    if (api) {
                      const newElements = reorderCameras(draft.elements, orderedIds);
                      api.updateScene({ elements: newElements });
                    }
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="slides">
              <SlidePreviewPanel
                slides={state.slides}
                currentSlideIndex={state.currentSlideIndex}
                thumbnails={thumbnails}
                onSlideSelect={(index) => {
                  flushDraft();
                  dispatch({ type: "SET_CURRENT_SLIDE", payload: { index } });
                }}
                onAddSlide={() => {
                  flushDraft();
                  dispatch({ type: "ADD_SLIDE" });
                }}
                onDeleteSlide={(index) => {
                  flushDraft();
                  dispatch({ type: "DELETE_SLIDE", payload: { index } });
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
