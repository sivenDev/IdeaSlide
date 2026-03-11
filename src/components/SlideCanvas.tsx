import { Excalidraw } from "@excalidraw/excalidraw";
import { useCallback, useRef } from "react";

interface SlideCanvasProps {
  elements: readonly any[];
  appState: Partial<any>;
  onChange: (elements: readonly any[], appState: Partial<any>) => void;
}

export function SlideCanvas({ elements, appState, onChange }: SlideCanvasProps) {
  const isInitialLoad = useRef(true);

  const handleChange = useCallback(
    (els: readonly any[], state: any) => {
      // Skip the initial onChange call from Excalidraw mounting
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
      }
      onChange(els, state);
    },
    [onChange]
  );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Excalidraw
        initialData={{
          elements: elements as any[],
          appState: {
            ...appState,
            viewBackgroundColor: "#ffffff",
          },
        }}
        onChange={handleChange}
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
