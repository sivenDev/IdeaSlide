import { useState } from "react";
import { SlideStoreProvider, useSlideStore } from "./hooks/useSlideStore";
import { LaunchScreen } from "./components/LaunchScreen";
import { EditorLayout } from "./components/EditorLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";

function AppContent() {
  const { dispatch } = useSlideStore();
  const [showEditor, setShowEditor] = useState(false);

  function handleFileOpened(filePath: string, slides: any[]) {
    console.log("handleFileOpened called:", { filePath, slides });
    dispatch({
      type: "LOAD_PRESENTATION",
      payload: { slides, filePath },
    });
    setShowEditor(true);
  }

  if (!showEditor) {
    return <LaunchScreen onFileOpened={handleFileOpened} />;
  }

  return (
    <ErrorBoundary>
      <EditorLayout />
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
