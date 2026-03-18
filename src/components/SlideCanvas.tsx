import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { getNextCameraOrder } from "../lib/cameraUtils";

interface SlideCanvasProps {
  slideId: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
  onChange: (elements: readonly any[], appState: Partial<any>, files: Record<string, any>) => void;
  viewMode?: boolean;
  onApiReady?: (api: any) => void;
}

export function SlideCanvas({ slideId, elements, appState, files, onChange, viewMode, onApiReady }: SlideCanvasProps) {
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
  const stableOnChange = useRef((els: readonly any[], state: any, sceneFiles: Record<string, any>) => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    onChangeRef.current(els, state, sceneFiles || {});
  }).current;

  // Camera drawing state
  const [isDrawingCamera, setIsDrawingCamera] = useState(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const excalidrawApiRef = useRef<any>(null);

  // Handle API ready
  const handleApiReady = useCallback((api: any) => {
    excalidrawApiRef.current = api;
    onApiReady?.(api);
  }, [onApiReady]);

  // Start camera drawing mode
  const startCameraDrawing = useCallback(() => {
    const api = excalidrawApiRef.current;
    if (!api) return;

    setIsDrawingCamera(true);
    api.setActiveTool({ type: "custom", customType: "camera" });
  }, []);

  // Handle pointer down - start drawing camera rectangle
  useEffect(() => {
    const api = excalidrawApiRef.current;
    if (!api || !isDrawingCamera) return;

    const unsubscribe = api.onPointerDown((activeTool: any, _pointerDownState: any, event: PointerEvent) => {
      if (activeTool.type === "custom" && activeTool.customType === "camera") {
        const appState = api.getAppState();
        const { scrollX, scrollY, zoom } = appState;

        // Get canvas bounding rect for proper coordinate conversion
        const canvas = document.querySelector('.excalidraw__canvas') as HTMLElement;
        const rect = canvas?.getBoundingClientRect();

        if (!rect) return;

        // Convert screen coordinates to canvas coordinates
        const canvasX = (event.clientX - rect.left - scrollX) / zoom.value;
        const canvasY = (event.clientY - rect.top - scrollY) / zoom.value;

        drawStartRef.current = { x: canvasX, y: canvasY };
      }
    });

    return unsubscribe;
  }, [isDrawingCamera]);

  // Handle pointer move - show preview while dragging
  useEffect(() => {
    const api = excalidrawApiRef.current;
    if (!api || !isDrawingCamera || !drawStartRef.current) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!drawStartRef.current) return;

      const appState = api.getAppState();
      const { scrollX, scrollY, zoom } = appState;

      // Get canvas bounding rect for proper coordinate conversion
      const canvas = document.querySelector('.excalidraw__canvas') as HTMLElement;
      const rect = canvas?.getBoundingClientRect();

      if (!rect) return;

      // Convert screen coordinates to canvas coordinates
      const canvasX = (event.clientX - rect.left - scrollX) / zoom.value;
      const canvasY = (event.clientY - rect.top - scrollY) / zoom.value;

      const startX = drawStartRef.current.x;
      const startY = drawStartRef.current.y;

      // Calculate rectangle bounds
      const x = Math.min(startX, canvasX);
      const y = Math.min(startY, canvasY);
      const width = Math.abs(canvasX - startX);
      const height = Math.abs(canvasY - startY);

      // Get current elements and filter out any existing preview
      const currentElements = api.getSceneElements().filter((el: any) => el.id !== "camera-preview");

      // Create preview rectangle
      const previewElement = {
        id: "camera-preview",
        type: "rectangle",
        x,
        y,
        width,
        height,
        angle: 0,
        strokeColor: "#1e90ff",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "dashed",
        roughness: 0,
        opacity: 40,
        roundness: null,
        seed: Math.floor(Math.random() * 2147483647),
        version: 1,
        versionNonce: Math.floor(Math.random() * 2147483647),
        isDeleted: false,
        groupIds: [],
        frameId: null,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
      };

      // Update scene with preview
      api.updateScene({
        elements: [...currentElements, previewElement],
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [isDrawingCamera, drawStartRef.current]);

  // Handle pointer up - finish drawing camera rectangle
  useEffect(() => {
    const api = excalidrawApiRef.current;
    if (!api || !isDrawingCamera) return;

    const unsubscribe = api.onPointerUp((activeTool: any, _pointerDownState: any, event: PointerEvent) => {
      if (activeTool.type === "custom" && activeTool.customType === "camera" && drawStartRef.current) {
        const appState = api.getAppState();
        const { scrollX, scrollY, zoom } = appState;

        // Get canvas bounding rect for proper coordinate conversion
        const canvas = document.querySelector('.excalidraw__canvas') as HTMLElement;
        const rect = canvas?.getBoundingClientRect();

        if (!rect) return;

        // Convert screen coordinates to canvas coordinates
        const canvasX = (event.clientX - rect.left - scrollX) / zoom.value;
        const canvasY = (event.clientY - rect.top - scrollY) / zoom.value;

        const startX = drawStartRef.current.x;
        const startY = drawStartRef.current.y;

        // Calculate rectangle bounds
        const x = Math.min(startX, canvasX);
        const y = Math.min(startY, canvasY);
        const width = Math.abs(canvasX - startX);
        const height = Math.abs(canvasY - startY);

        // Remove preview and get clean elements
        const currentElements = api.getSceneElements().filter((el: any) => el.id !== "camera-preview");

        // Only create camera if drag was significant (> 10px)
        if (width > 10 && height > 10) {
          const order = getNextCameraOrder(currentElements);

          // Create camera element
          const cameraElement = {
            id: crypto.randomUUID(),
            type: "rectangle",
            x,
            y,
            width,
            height,
            angle: 0,
            strokeColor: "#1e90ff",
            backgroundColor: "transparent",
            fillStyle: "solid",
            strokeWidth: 2,
            strokeStyle: "dashed",
            roughness: 0,
            opacity: 60,
            roundness: null,
            seed: Math.floor(Math.random() * 2147483647),
            version: 1,
            versionNonce: Math.floor(Math.random() * 2147483647),
            isDeleted: false,
            groupIds: [],
            frameId: null,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            customData: { type: "camera", order },
          };

          // Add camera to scene
          api.updateScene({
            elements: [...currentElements, cameraElement],
          });
        } else {
          // Just remove preview if drag was too small
          api.updateScene({
            elements: currentElements,
          });
        }

        // Reset drawing state
        drawStartRef.current = null;
        setIsDrawingCamera(false);
        api.setActiveTool({ type: "selection" });
      }
    });

    return unsubscribe;
  }, [isDrawingCamera]);

  // Render custom UI in top-right corner
  const renderTopRightUI = useCallback(() => {
    if (viewMode) return null;

    return (
      <button
        onClick={startCameraDrawing}
        className="px-2.5 py-1.5 rounded-md border border-amber-500 bg-amber-50 text-amber-600 text-sm font-medium hover:bg-amber-100 transition-colors flex items-center gap-1.5 shadow-sm"
        title="Draw a camera rectangle"
        style={{ marginRight: '8px' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        {isDrawingCamera ? "Drawing..." : "Camera"}
      </button>
    );
  }, [viewMode, isDrawingCamera, startCameraDrawing]);
  const mainMenu = useMemo(
    () => (
      <MainMenu>
        <MainMenu.DefaultItems.ToggleTheme />
        <MainMenu.DefaultItems.ChangeCanvasBackground />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.DefaultItems.Help />
      </MainMenu>
    ),
    [],
  );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Excalidraw
        key={slideId}
        excalidrawAPI={handleApiReady}
        initialData={{
          elements: elements as any[],
          appState: {
            ...appState,
            viewBackgroundColor: "#ffffff",
            // Ensure collaborators is always a Map to prevent errors
            collaborators: new Map(),
            ...(viewMode && {
              viewModeEnabled: true,
              zenModeEnabled: true,
            }),
          },
          files,
        }}
        onChange={viewMode ? undefined : stableOnChange}
        renderTopRightUI={renderTopRightUI}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: false,
            saveAsImage: false,
          },
        }}
      >
        {!viewMode && mainMenu}
      </Excalidraw>
    </div>
  );
}
