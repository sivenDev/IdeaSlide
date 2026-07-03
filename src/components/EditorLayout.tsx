import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSlideStore } from "../hooks/useSlideStore";
import { useAutoSave } from "../hooks/useAutoSave";
import { useEditorSession } from "../hooks/useEditorSession";
import { Toolbar } from "./Toolbar";
import { SlideCanvas } from "./SlideCanvas";
import { ErrorBoundary } from "./ErrorBoundary";
import {
  extractCameras,
  moveItemByOffset,
  reorderCameras,
  type Camera,
} from "../lib/cameraUtils";
import { createNewPresentation, openFile, saveFile, addRecentFile } from "../lib/tauriCommands";
import { save, message, ask } from "@tauri-apps/plugin-dialog";

interface EditorLayoutProps {
  onGoHome: () => void;
  readOnly?: boolean;
}

export function EditorLayout({ onGoHome, readOnly = false }: EditorLayoutProps) {
  const { state, dispatch } = useSlideStore();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);
  const excalidrawApiRef = useRef<any>(null);

  const currentSlide = state.slides[state.currentSlideIndex];
  const {
    autoSaveVersion,
    draft,
    flushDraft,
    getSlidesForPersistence,
    hasPendingCommit,
    updateDraft,
  } = useEditorSession({
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

  const cameras = useMemo(() => extractCameras(draft.elements), [draft.elements]);
  const activeCameraId =
    selectedCameraId && cameras.some((camera) => camera.id === selectedCameraId)
      ? selectedCameraId
      : undefined;

  const slidesForPersistence = useMemo(
    () => getSlidesForPersistence(),
    [autoSaveVersion, getSlidesForPersistence]
  );
  const effectiveIsDirty = !readOnly && (state.isDirty || hasPendingCommit);

  useAutoSave({
    filePath: state.filePath,
    slides: slidesForPersistence,
    isDirty: effectiveIsDirty,
    onSaveStart: () => {
      flushDraft();
      setIsSaving(true);
      return getSlidesForPersistence();
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
        const nextSlides = getSlidesForPersistence();
        await saveFile(state.filePath, nextSlides);
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

  // Capture save shortcuts before Excalidraw can handle native scene exports.
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        await handleSaveCallback();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleSaveCallback]);

  async function handleSaveAs() {
    try {
      const filePath = await save({
        filters: [{ name: "IdeaSlide", extensions: ["is"] }],
        defaultPath: fileName || "Untitled.is",
      });

      if (!filePath) return;

      flushDraft();
      const nextSlides = getSlidesForPersistence();
      await saveFile(filePath, nextSlides);
      dispatch({
        type: "LOAD_PRESENTATION",
        payload: { slides: nextSlides, filePath },
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

  const handleSelectSlide = useCallback((index: number) => {
    flushDraft();
    dispatch({ type: "SET_CURRENT_SLIDE", payload: { index } });
  }, [dispatch, flushDraft]);

  const handleAddSlide = useCallback(() => {
    flushDraft();
    dispatch({ type: "ADD_SLIDE" });
  }, [dispatch, flushDraft]);

  const handleDeleteSlide = useCallback((index: number) => {
    flushDraft();
    dispatch({ type: "DELETE_SLIDE", payload: { index } });
  }, [dispatch, flushDraft]);

  const handleSelectCamera = useCallback((camera: Camera) => {
    const api = excalidrawApiRef.current;
    if (!api) {
      return;
    }

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
    api.scrollToContent([cameraElement], {
      fitToContent: true,
      animate: true,
      duration: 300,
    });
  }, []);

  const handleDeleteCamera = useCallback((cameraId: string) => {
    const api = excalidrawApiRef.current;
    if (!api) {
      return;
    }

    if (activeCameraId === cameraId) {
      setSelectedCameraId(undefined);
    }

    const newElements = draft.elements.filter((el: any) => el.id !== cameraId);
    const sceneUpdate: any = { elements: newElements };
    if (activeCameraId === cameraId) {
      sceneUpdate.appState = { selectedElementIds: {} };
    }
    api.updateScene(sceneUpdate);
  }, [activeCameraId, draft.elements]);

  const handleReorderCamera = useCallback((cameraId: string, offset: -1 | 1) => {
    const api = excalidrawApiRef.current;
    if (!api) {
      return;
    }

    const currentIndex = cameras.findIndex((camera) => camera.id === cameraId);
    if (currentIndex === -1) {
      return;
    }

    const reorderedCameras = moveItemByOffset(cameras, currentIndex, offset);
    if (reorderedCameras[currentIndex]?.id === cameraId) {
      return;
    }

    const orderedIds = reorderedCameras.map((camera) => camera.id);
    const newElements = reorderCameras(draft.elements, orderedIds);
    api.updateScene({ elements: newElements });
  }, [cameras, draft.elements]);

  return (
    <div className="h-screen flex flex-col">
      <Toolbar
        fileName={fileName}
        isDirty={effectiveIsDirty}
        isSaving={isSaving}
        currentSlideIndex={state.currentSlideIndex}
        slideCount={state.slides.length}
        cameras={cameras}
        activeCameraId={activeCameraId}
        onNewIdea={handleNewIdea}
        onOpenFile={handleOpenFile}
        onSave={handleSave}
        onGoHome={handleGoHome}
        onSelectSlide={handleSelectSlide}
        onAddSlide={handleAddSlide}
        onDeleteSlide={handleDeleteSlide}
        onSelectCamera={handleSelectCamera}
        onDeleteCamera={handleDeleteCamera}
        onReorderCamera={handleReorderCamera}
        onStartPreview={() => {
          flushDraft();
          dispatch({ type: "START_PRESENTATION", payload: { mode: "preview" } });
        }}
        onStartFullscreen={() => {
          flushDraft();
          dispatch({ type: "START_PRESENTATION", payload: { mode: "fullscreen" } });
        }}
        onStartFromBeginning={() => {
          flushDraft();
          dispatch({ type: "SET_CURRENT_SLIDE", payload: { index: 0 } });
          dispatch({ type: "START_PRESENTATION", payload: { mode: "fullscreen" } });
        }}
      />

      {state.activeSessions.size > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-blue-700">
            Streaming: {Array.from(state.activeSessions.values()).map((s) => `${s.elements.length} elements`).join(", ")}
          </span>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
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
    </div>
  );
}
