import { useState, useEffect } from "react";
import { useSlideStore } from "../hooks/useSlideStore";
import { Toolbar } from "./Toolbar";
import { SlidePreviewPanel } from "./SlidePreviewPanel";
import { createNewFile, openFile, saveFile } from "../lib/tauriCommands";
import { save } from "@tauri-apps/plugin-dialog";

export function EditorLayout() {
  const { state, dispatch } = useSlideStore();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    console.log("EditorLayout mounted");
    console.log("Current state:", state);
  }, []);

  const currentSlide = state.slides[state.currentSlideIndex];
  const fileName = state.filePath?.split("/").pop();

  console.log("EditorLayout render:", {
    currentSlide,
    fileName,
    slideCount: state.slides.length
  });

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

  return (
    <div className="h-screen flex flex-col bg-gray-100">
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

        <div className="flex-1 bg-white flex items-center justify-center">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold mb-4">Excalidraw Canvas Placeholder</h2>
            <p className="text-gray-600 mb-2">Slide {state.currentSlideIndex + 1} of {state.slides.length}</p>
            <p className="text-gray-600">Current slide ID: {currentSlide.id}</p>
            <p className="text-gray-600">Elements: {currentSlide.elements.length}</p>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                If you see this, React is rendering correctly!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
