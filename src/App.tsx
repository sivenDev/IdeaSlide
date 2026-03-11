import { useState, useEffect } from "react";
import { SlideStoreProvider, useSlideStore } from "./hooks/useSlideStore";
import { LaunchScreen } from "./components/LaunchScreen";
import { EditorLayout } from "./components/EditorLayout";

function AppContent() {
  const { dispatch } = useSlideStore();
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    console.log("AppContent mounted, showEditor:", showEditor);
  }, [showEditor]);

  function handleFileOpened(filePath: string, slides: any[]) {
    console.log("handleFileOpened called:", { filePath, slides });
    dispatch({
      type: "LOAD_PRESENTATION",
      payload: { slides, filePath },
    });
    setShowEditor(true);
  }

  console.log("AppContent render, showEditor:", showEditor);

  if (!showEditor) {
    return <LaunchScreen onFileOpened={handleFileOpened} />;
  }

  return <EditorLayout />;
}

function App() {
  console.log("App component rendering");
  return (
    <SlideStoreProvider>
      <AppContent />
    </SlideStoreProvider>
  );
}

export default App;
