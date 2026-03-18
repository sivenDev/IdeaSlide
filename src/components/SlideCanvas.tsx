import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import { memo, useRef, useEffect, useMemo, useState, useCallback } from "react";
import { getNextCameraOrder } from "../lib/cameraUtils";
import {
  buildCameraBadgeSignature,
  getCameraBadges,
} from "../lib/cameraBadges";
import {
  CAMERA_PREVIEW_ID,
  enterCameraDrawingMode,
  exitCameraDrawingMode,
} from "../lib/cameraDrawing";
import { areSlideCanvasPropsEqual } from "../lib/slideCanvasProps";

function getScenePointerFromEvent(api: any, event: PointerEvent) {
  const appState = api.getAppState();
  const { scrollX, scrollY, zoom } = appState;
  const canvas = document.querySelector(".excalidraw__canvas") as HTMLElement | null;
  const rect = canvas?.getBoundingClientRect();

  if (!rect) {
    return null;
  }

  return {
    x: (event.clientX - rect.left) / zoom.value - scrollX,
    y: (event.clientY - rect.top) / zoom.value - scrollY,
  };
}

function getBadgeBackgroundColor(color: string) {
  const normalizedColor = color.trim();
  const shortHexMatch = /^#([\da-f]{3})$/i.exec(normalizedColor);
  const fullHexMatch = /^#([\da-f]{6})$/i.exec(normalizedColor);
  const rgbMatch = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)$/i.exec(normalizedColor);
  const alpha = 0.76;

  if (shortHexMatch) {
    const [r, g, b] = shortHexMatch[1].split("").map((value) => Number.parseInt(`${value}${value}`, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  if (fullHexMatch) {
    const hex = fullHexMatch[1];
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return normalizedColor;
}

interface SlideCanvasProps {
  slideId: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
  onChange: (elements: readonly any[], appState: Partial<any>, files: Record<string, any>) => void;
  viewMode?: boolean;
  onApiReady?: (api: any) => void;
}

function SlideCanvasInner({ slideId, elements, appState, files, onChange, viewMode, onApiReady }: SlideCanvasProps) {
  // Use a ref to always have the latest onChange without causing re-renders
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const getBadgeContainerRect = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    return {
      left: rect?.left ?? 0,
      top: rect?.top ?? 0,
    };
  }, []);
  const [cameraBadges, setCameraBadges] = useState(() =>
    getCameraBadges(elements, appState, getBadgeContainerRect()),
  );
  const cameraBadgeSignatureRef = useRef(
    buildCameraBadgeSignature(elements, appState, getBadgeContainerRect()),
  );
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const syncCameraBadges = useCallback((nextElements: readonly any[], nextAppState: Partial<any>) => {
    const containerRect = getBadgeContainerRect();
    const nextSignature = buildCameraBadgeSignature(nextElements, nextAppState, containerRect);

    if (nextSignature === cameraBadgeSignatureRef.current) {
      return;
    }

    cameraBadgeSignatureRef.current = nextSignature;
    setCameraBadges(getCameraBadges(nextElements, nextAppState, containerRect));
  }, [getBadgeContainerRect]);
  const syncCameraBadgesRef = useRef(syncCameraBadges);

  useEffect(() => {
    syncCameraBadgesRef.current = syncCameraBadges;
  }, [syncCameraBadges]);

  const isInitialLoad = useRef(true);

  // Reset initial load flag when slide changes
  useEffect(() => {
    isInitialLoad.current = true;
  }, [slideId]);

  useEffect(() => {
    const containerRect = getBadgeContainerRect();
    const nextSignature = buildCameraBadgeSignature(elements, appState, containerRect);
    cameraBadgeSignatureRef.current = nextSignature;
    setCameraBadges(getCameraBadges(elements, appState, containerRect));
  }, [slideId, elements, appState, getBadgeContainerRect]);

  // Stable callback that never changes identity
  const stableOnChange = useRef((els: readonly any[], state: any, sceneFiles: Record<string, any>) => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    // The preview rectangle is purely local UI state for drag feedback and
    // should not be persisted into the slide store.
    if (els.some((element: any) => element.id === CAMERA_PREVIEW_ID)) {
      return;
    }

    syncCameraBadgesRef.current(els, state);
    onChangeRef.current(els, state, sceneFiles || {});
  }).current;

  // Camera drawing state
  const [isDrawingCamera, setIsDrawingCamera] = useState(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const excalidrawApiRef = useRef<any>(null);
  const [apiReadyVersion, setApiReadyVersion] = useState(0);

  // Handle API ready
  const handleApiReady = useCallback((api: any) => {
    excalidrawApiRef.current = api;
    syncCameraBadgesRef.current(api.getSceneElements(), api.getAppState());
    setApiReadyVersion((value) => value + 1);
    onApiReady?.(api);
  }, [onApiReady]);

  useEffect(() => {
    const api = excalidrawApiRef.current;
    if (!api) {
      return;
    }

    syncCameraBadgesRef.current(api.getSceneElements(), api.getAppState());

    const unsubscribeChange = api.onChange(
      (nextElements: readonly any[], nextAppState: Partial<any>) => {
        syncCameraBadgesRef.current(nextElements, nextAppState);
      },
    );
    const unsubscribeScroll = api.onScrollChange(() => {
      syncCameraBadgesRef.current(api.getSceneElements(), api.getAppState());
    });
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          syncCameraBadgesRef.current(api.getSceneElements(), api.getAppState());
        });

    if (containerRef.current && resizeObserver) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      unsubscribeChange();
      unsubscribeScroll();
      resizeObserver?.disconnect();
    };
  }, [apiReadyVersion, slideId]);

  // Start camera drawing mode
  const startCameraDrawing = useCallback(() => {
    const api = excalidrawApiRef.current;
    if (!api) return;

    setIsDrawingCamera(true);
    enterCameraDrawingMode(api);
  }, []);

  const stopCameraDrawing = useCallback(() => {
    const api = excalidrawApiRef.current;
    if (!api) return;

    drawStartRef.current = null;
    setIsDrawingCamera(false);
    exitCameraDrawingMode(api);
  }, []);

  const toggleCameraDrawing = useCallback(() => {
    if (isDrawingCamera) {
      stopCameraDrawing();
      return;
    }

    startCameraDrawing();
  }, [isDrawingCamera, startCameraDrawing, stopCameraDrawing]);

  // Handle pointer down - start drawing camera rectangle
  useEffect(() => {
    const api = excalidrawApiRef.current;
    if (!api || !isDrawingCamera) return;

    const unsubscribe = api.onPointerDown((activeTool: any, _pointerDownState: any, event: PointerEvent) => {
      if (activeTool.type === "custom" && activeTool.customType === "camera") {
        const pointer = getScenePointerFromEvent(api, event);
        if (!pointer) return;
        drawStartRef.current = pointer;
      }
    });

    return unsubscribe;
  }, [isDrawingCamera]);

  // Handle pointer move - show preview while dragging
  useEffect(() => {
    const api = excalidrawApiRef.current;
    if (!api || !isDrawingCamera) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!drawStartRef.current) return;
      const pointer = getScenePointerFromEvent(api, event);
      if (!pointer) return;

      const startX = drawStartRef.current.x;
      const startY = drawStartRef.current.y;

      // Calculate rectangle bounds
      const x = Math.min(startX, pointer.x);
      const y = Math.min(startY, pointer.y);
      const width = Math.abs(pointer.x - startX);
      const height = Math.abs(pointer.y - startY);

      // Get current elements and filter out any existing preview
      const currentElements = api
        .getSceneElements()
        .filter((el: any) => el.id !== CAMERA_PREVIEW_ID);

      // Create preview rectangle
      const previewElement = {
        id: CAMERA_PREVIEW_ID,
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
  }, [isDrawingCamera]);

  // Handle pointer up - finish drawing camera rectangle
  useEffect(() => {
    const api = excalidrawApiRef.current;
    if (!api || !isDrawingCamera) return;

    const unsubscribe = api.onPointerUp((activeTool: any, _pointerDownState: any, event: PointerEvent) => {
      if (activeTool.type === "custom" && activeTool.customType === "camera" && drawStartRef.current) {
        const pointer = getScenePointerFromEvent(api, event);
        if (!pointer) return;

        const startX = drawStartRef.current.x;
        const startY = drawStartRef.current.y;

        // Calculate rectangle bounds
        const x = Math.min(startX, pointer.x);
        const y = Math.min(startY, pointer.y);
        const width = Math.abs(pointer.x - startX);
        const height = Math.abs(pointer.y - startY);

        // Remove preview and get clean elements
        const currentElements = api
          .getSceneElements()
          .filter((el: any) => el.id !== CAMERA_PREVIEW_ID);

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

  useEffect(() => {
    if (isDrawingCamera) {
      return;
    }

    const api = excalidrawApiRef.current;
    if (!api) {
      return;
    }

    drawStartRef.current = null;
    const sceneElements = api.getSceneElements();
    if (!sceneElements.some((el: any) => el.id === CAMERA_PREVIEW_ID)) {
      return;
    }

    api.updateScene({
      elements: sceneElements.filter((el: any) => el.id !== CAMERA_PREVIEW_ID),
    });
  }, [isDrawingCamera]);

  // Render custom UI in top-right corner
  const renderTopRightUI = useCallback(() => {
    if (viewMode) return null;

    return (
        <button
        onClick={toggleCameraDrawing}
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
  }, [viewMode, isDrawingCamera, toggleCameraDrawing]);
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
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
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
      {!viewMode && cameraBadges.length > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
        >
          {cameraBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="absolute min-w-6 h-6 px-2 rounded-full border border-white/90 text-white text-xs font-semibold shadow-md flex items-center justify-center"
                  style={{
                    backgroundColor: getBadgeBackgroundColor(badge.strokeColor),
                    left: `${badge.left}px`,
                    top: `${badge.top}px`,
                    transform: "translate(-28%, -52%)",
                  }}
                >
              {badge.order}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const SlideCanvas = memo(SlideCanvasInner, areSlideCanvasPropsEqual);
