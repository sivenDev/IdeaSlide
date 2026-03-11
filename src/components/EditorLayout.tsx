import { useState, useEffect } from "react";
import { useSlideStore } from "../hooks/useSlideStore";
import { useAutoSave } from "../hooks/useAutoSave";
import { Toolbar } from "./Toolbar";
import { SlidePreviewPanel } from "./SlidePreviewPanel";
import { SlideCanvas } from "./SlideCanvas";
import { ErrorBoundary } from "./ErrorBoundary";
import { createNewFile, openFile, saveFile } from "../lib/tauriCommands";
import { save } from "@tauri-apps/plugin-dialog";

export function EditorLayout() {
  const { state, dispatch } = useSlideStore();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    console.log("EditorLayout mounted");
    console.log("Current state:", state);
  }, []);

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

  async function handleNewFile() {
    try {
      const { path, slides } = await createNewFile();
      dispatch({
        type: "LOAD_PRESENTATION",
        payload: { slides, filePath: path },
      });
    } catch (err) {
      console.error("Failed to create new file:", err);
    }
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
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  }

  function handleSlideChange(
    elements: readonly any[],
    appState: Partial<any>
  ) {
    dispatch({
      type: "UPDATE_SLIDE",
      payload: {
        index: state.currentSlideIndex,
        elements,
        appState,
      },
    });
  }

  return (
    <div className="h-screen flex flex-col">
      <Toolbar
        fileName={fileName}
        isDirty={state.isDirty}
        isSaving={isSaving}
        onNewFile={handleNewFile}
        onOpenFile={handleOpenFile}
        onSaveAs={handleSaveAs}
      />

      <div className="flex-1 flex overflow-hidden">
        <SlidePreviewPanel
          slides={state.slides}
          currentSlideIndex={state.currentSlideIndex}
          onSlideSelect={(index) =>
            dispatch({ type: "SET_CURRENT_SLIDE", payload: { index } })
          }
          onAddSlide={() => dispatch({ type: "ADD_SLIDE" })}
          onDeleteSlide={(index) =>
            dispatch({ type: "DELETE_SLIDE", payload: { index } })
          }
        />

        <div className="flex-1 relative">
          <div className="absolute inset-0">
            <ErrorBoundary>
              <SlideCanvas
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
