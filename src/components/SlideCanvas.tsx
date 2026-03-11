import { Excalidraw } from "@excalidraw/excalidraw";

interface SlideCanvasProps {
  elements: readonly any[];
  appState: Partial<any>;
  onChange: (elements: readonly any[], appState: Partial<any>) => void;
}

export function SlideCanvas({ elements, appState, onChange }: SlideCanvasProps) {
  return (
    <div className="w-full h-full">
      <Excalidraw
        initialData={{
          elements: elements as any[],
          appState,
        }}
        onChange={(els, state) => {
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
  );
}
