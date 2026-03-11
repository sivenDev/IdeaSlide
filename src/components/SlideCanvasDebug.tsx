import { Excalidraw } from "@excalidraw/excalidraw";
import { useEffect, useRef } from "react";

interface SlideCanvasProps {
  elements: readonly any[];
  appState: Partial<any>;
  onChange: (elements: readonly any[], appState: Partial<any>) => void;
}

export function SlideCanvas({ elements, appState, onChange }: SlideCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log("SlideCanvas mounted");
    console.log("Container dimensions:", {
      width: containerRef.current?.offsetWidth,
      height: containerRef.current?.offsetHeight,
    });
    console.log("Elements:", elements);
    console.log("AppState:", appState);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{
        minHeight: "400px",
        background: "#fafafa",
        position: "relative"
      }}
    >
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}>
        <Excalidraw
          initialData={{
            elements: elements as any[],
            appState: {
              ...appState,
              viewBackgroundColor: "#ffffff",
            },
          }}
          onChange={(els, state) => {
            console.log("Excalidraw onChange:", {
              elementCount: els.length,
              stateKeys: Object.keys(state)
            });
            onChange(els, state);
          }}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              export: false,
              saveAsImage: false,
            },
          }}
        />
      </div>
    </div>
  );
}
