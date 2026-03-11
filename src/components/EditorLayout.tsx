import { useState, useCallback, useRef, useEffect } from "react";
import { useSlideStore } from "../hooks/useSlideStore";
import { useAutoSave } from "../hooks/useAutoSave";
import { useSlideThumbnails } from "../hooks/useSlideThumbnails";
import { Toolbar } from "./Toolbar";
import { SlidePreviewPanel } from "./SlidePreviewPanel";
import { SlideCanvas } from "./SlideCanvas";
import { ResizableDivider } from "./ResizableDivider";
import { ErrorBoundary } from "./ErrorBoundary";
import { createNewPresentation, openFile, saveFile, addRecentFile } from "../lib/tauriCommands";
import { save, message, ask } from "@tauri-apps/plugin-dialog";

interface EditorLayoutProps {
  onGoHome: () => void;
}

export function EditorLayout({ onGoHome }: EditorLayoutProps) {
  const { state, dispatch } = useSlideStore();
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const thumbnails = useSlideThumbnails(state.slides);

  useAutoSave({
    filePath: state.filePath,
    slides: state.slides,
    isDirty: state.isDirty,
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

  const currentSlide = state.slides[state.currentSlideIndex];
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

  // Track element versions to detect actual content changes
  function buildFingerprint(elements: readonly any[]) {
    return elements.map((el: any) => `${el.id}:${el.version}`).join(",");
  }
  const lastElementsFingerprintRef = useRef(buildFingerprint(currentSlide.elements));

  // Use a ref for currentSlideIndex to avoid re-creating the callback
  const currentSlideIndexRef = useRef(state.currentSlideIndex);
  if (currentSlideIndexRef.current !== state.currentSlideIndex) {
    // Initialize fingerprint with the new slide's elements so the first
    // onChange after mount doesn't falsely trigger isDirty
    const newSlide = state.slides[state.currentSlideIndex];
    lastElementsFingerprintRef.current = buildFingerprint(newSlide.elements);
  }
  currentSlideIndexRef.current = state.currentSlideIndex;

  const handleSlideChange = useCallback(
    (elements: readonly any[], appState: Partial<any>) => {
      // Build a lightweight fingerprint from element count + versions
      const fingerprint = buildFingerprint(elements);
      const elementsChanged = fingerprint !== lastElementsFingerprintRef.current;
      lastElementsFingerprintRef.current = fingerprint;

      dispatch({
        type: "UPDATE_SLIDE",
        payload: {
          index: currentSlideIndexRef.current,
          elements,
          appState,
          elementsChanged,
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
        onNewIdea={handleNewIdea}
        onOpenFile={handleOpenFile}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onGoHome={handleGoHome}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className={`transition-all duration-300 overflow-hidden flex-shrink-0 ${showPreview ? "w-64" : "w-0"}`}>
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
        </div>

        <ResizableDivider
          isVisible={showPreview}
          onToggle={() => setShowPreview((prev) => !prev)}
        />

        <div className="flex-1 relative">
          <div className="absolute inset-0">
            <ErrorBoundary>
              <SlideCanvas
                slideId={currentSlide.id}
                elements={currentSlide.elements}
                appState={currentSlide.appState}
                onChange={handleSlideChange}
              />
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
