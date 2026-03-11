import { useState } from "react";
import { SlideStoreProvider, useSlideStore } from "./hooks/useSlideStore";
import { LaunchScreen } from "./components/LaunchScreen";
import { EditorLayout } from "./components/EditorLayout";
import { PresentationMode } from "./components/PresentationMode";
import { ErrorBoundary } from "./components/ErrorBoundary";

function AppContent() {
  const { state, dispatch } = useSlideStore();
  const [showEditor, setShowEditor] = useState(false);

  function handleFileOpened(filePath: string, slides: any[]) {
    dispatch({
      type: "LOAD_PRESENTATION",
      payload: { slides, filePath: filePath || undefined },
    });
    setShowEditor(true);
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
        onExit={() => dispatch({ type: 'EXIT_PRESENTATION' })}
      />
    );
  }

  return (
    <ErrorBoundary>
      <EditorLayout onGoHome={() => setShowEditor(false)} />
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
