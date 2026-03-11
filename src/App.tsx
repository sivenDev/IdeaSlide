import { useState } from "react";
import { SlideStoreProvider, useSlideStore } from "./hooks/useSlideStore";
import { LaunchScreen } from "./components/LaunchScreen";
import { EditorLayout } from "./components/EditorLayout";

function AppContent() {
  const { dispatch } = useSlideStore();
  const [showEditor, setShowEditor] = useState(false);

  function handleFileOpened(filePath: string, slides: any[]) {
    dispatch({
      type: "LOAD_PRESENTATION",
      payload: { slides, filePath },
    });
    setShowEditor(true);
  }

  if (!showEditor) {
    return <LaunchScreen onFileOpened={handleFileOpened} />;
  }

  return <EditorLayout />;
}

function App() {
  return (
    <SlideStoreProvider>
      <AppContent />
    </SlideStoreProvider>
  );
}

export default App;
