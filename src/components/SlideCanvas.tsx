import { Excalidraw } from "@excalidraw/excalidraw";
import { useRef, useEffect } from "react";

interface SlideCanvasProps {
  slideId: string;
  elements: readonly any[];
  appState: Partial<any>;
  onChange: (elements: readonly any[], appState: Partial<any>) => void;
}

export function SlideCanvas({ slideId, elements, appState, onChange }: SlideCanvasProps) {
  // Use a ref to always have the latest onChange without causing re-renders
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const isInitialLoad = useRef(true);

  // Reset initial load flag when slide changes
  useEffect(() => {
    isInitialLoad.current = true;
  }, [slideId]);

  // Stable callback that never changes identity
  const stableOnChange = useRef((els: readonly any[], state: any) => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    onChangeRef.current(els, state);
  }).current;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Excalidraw
        key={slideId}
        initialData={{
          elements: elements as any[],
          appState: {
            ...appState,
            viewBackgroundColor: "#ffffff",
            // Ensure collaborators is always a Map to prevent errors
            collaborators: new Map(),
          },
        }}
        onChange={stableOnChange}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: false,
            saveAsImage: false,
          },
        }}
      />
    </div>
  );
}
