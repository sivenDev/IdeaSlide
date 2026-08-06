import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import { memo, useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Download } from "lucide-react";
import { getNextCameraOrder } from "../lib/cameraUtils";
import {
  CAMERA_PREVIEW_ID,
  enterCameraDrawingMode,
} from "../lib/cameraDrawing";
import { areSlideCanvasPropsEqual } from "../lib/slideCanvasProps";
import {
  buildSelectedElementIdsSignature,
  getStyleConversionAvailability,
  type StyleConversionTarget,
} from "../lib/excalidrawStyleConversion";
import { exportExcalidrawToDrawio } from "../lib/drawioExport";
import { CanvasSelectionActions } from "./CanvasSelectionActions";
import { CameraBadgeOverlay } from "./CameraBadgeOverlay";

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

interface SlideCanvasProps {
  slideId: string;
  pageTitle: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
  onChange: (elements: readonly any[], appState: Partial<any>, files: Record<string, any>) => void;
  viewMode?: boolean;
  onApiReady?: (api: any, slideId: string) => void;
  onConvertSelection?: (target: StyleConversionTarget) => void;
  onInteractionChange?: (active: boolean) => void;
  editorRefreshToken: number;
  cameraDrawingRequestToken?: number;
}

const excalidrawCanvasActions = {
  loadScene: false,
  export: {
    saveFileToDisk: false,
  },
  saveAsImage: true,
  saveToActiveFile: false,
  saveFileToDisk: false,
};

function SlideCanvasInner({
  slideId,
  pageTitle,
  elements,
  appState,
  files,
  onChange,
  viewMode,
  onApiReady,
  onConvertSelection,
  onInteractionChange,
  editorRefreshToken,
  cameraDrawingRequestToken = 0,
}: SlideCanvasProps) {
  // Use a ref to always have the latest onChange without causing re-renders
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onInteractionChangeRef = useRef(onInteractionChange);
  const isMountedRef = useRef(true);
  const interactionActiveRef = useRef(false);
  const interactionIdleTimeoutRef = useRef<number | null>(null);
  const [canConvertSelection, setCanConvertSelection] = useState(() =>
    getStyleConversionAvailability(elements, appState.selectedElementIds, Boolean(viewMode)),
  );
  const selectionObservationRef = useRef({
    elements,
    selectedIdsSignature: buildSelectedElementIdsSignature(appState.selectedElementIds),
    readOnly: Boolean(viewMode),
  });
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onInteractionChangeRef.current = onInteractionChange;
  }, [onInteractionChange]);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const clearInteractionIdleTimeout = useCallback(() => {
    if (interactionIdleTimeoutRef.current === null) return;
    window.clearTimeout(interactionIdleTimeoutRef.current);
    interactionIdleTimeoutRef.current = null;
  }, []);
  const beginCanvasInteraction = useCallback(() => {
    clearInteractionIdleTimeout();
    if (interactionActiveRef.current) return;
    interactionActiveRef.current = true;
    onInteractionChangeRef.current?.(true);
  }, [clearInteractionIdleTimeout]);
  const finishCanvasInteractionSoon = useCallback(() => {
    clearInteractionIdleTimeout();
    interactionIdleTimeoutRef.current = window.setTimeout(() => {
      interactionIdleTimeoutRef.current = null;
      if (!interactionActiveRef.current) return;
      interactionActiveRef.current = false;
      onInteractionChangeRef.current?.(false);
    }, 180);
  }, [clearInteractionIdleTimeout]);
  const pulseCanvasInteraction = useCallback(() => {
    beginCanvasInteraction();
    finishCanvasInteractionSoon();
  }, [beginCanvasInteraction, finishCanvasInteractionSoon]);

  useEffect(() => {
    const finishPointerInteraction = () => finishCanvasInteractionSoon();
    window.addEventListener("pointerup", finishPointerInteraction);
    window.addEventListener("pointercancel", finishPointerInteraction);
    return () => {
      window.removeEventListener("pointerup", finishPointerInteraction);
      window.removeEventListener("pointercancel", finishPointerInteraction);
      clearInteractionIdleTimeout();
      if (interactionActiveRef.current) {
        interactionActiveRef.current = false;
        onInteractionChangeRef.current?.(false);
      }
    };
  }, [clearInteractionIdleTimeout, finishCanvasInteractionSoon]);

  const syncStyleConversionAvailability = useCallback((
    nextElements: readonly any[],
    nextAppState: Partial<any>,
  ) => {
    const nextObservation = {
      elements: nextElements,
      selectedIdsSignature: buildSelectedElementIdsSignature(nextAppState.selectedElementIds),
      readOnly: Boolean(viewMode),
    };
    const previousObservation = selectionObservationRef.current;
    if (
      previousObservation.elements === nextObservation.elements &&
      previousObservation.selectedIdsSignature === nextObservation.selectedIdsSignature &&
      previousObservation.readOnly === nextObservation.readOnly
    ) {
      return;
    }
    selectionObservationRef.current = nextObservation;
    const nextAvailability = getStyleConversionAvailability(
      nextElements,
      nextAppState.selectedElementIds,
      Boolean(viewMode),
    );
    setCanConvertSelection((current) => current === nextAvailability ? current : nextAvailability);
  }, [viewMode]);
  const syncStyleConversionAvailabilityRef = useRef(syncStyleConversionAvailability);

  useEffect(() => {
    syncStyleConversionAvailabilityRef.current = syncStyleConversionAvailability;
  }, [syncStyleConversionAvailability]);

  const isInitialLoad = useRef(true);

  // Reset initial load flag when slide changes
  useEffect(() => {
    isInitialLoad.current = true;
  }, [slideId]);

  useEffect(() => {
    syncStyleConversionAvailabilityRef.current(elements, appState);
  }, [slideId, elements, appState]);

  // Stable callback that never changes identity
  const stableOnChange = useRef((els: readonly any[], state: any, sceneFiles: Record<string, any>) => {
    if (!isMountedRef.current) {
      return;
    }

    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    // The preview rectangle is purely local UI state for drag feedback and
    // should not be persisted into the slide store.
    if (cameraPreviewActiveRef.current) {
      return;
    }

    onChangeRef.current(els, state, sceneFiles || {});
  }).current;

  // Camera drawing state
  const [isDrawingCamera, setIsDrawingCamera] = useState(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const cameraPreviewActiveRef = useRef(false);
  const excalidrawApiRef = useRef<any>(null);
  const drawioExportInFlightRef = useRef(false);
  const [apiReadyVersion, setApiReadyVersion] = useState(0);

  // Handle API ready
  const handleApiReady = useCallback((api: any) => {
    if (!isMountedRef.current) return;
    excalidrawApiRef.current = api;
    syncStyleConversionAvailabilityRef.current(api.getSceneElements(), api.getAppState());
    setApiReadyVersion((value) => value + 1);
    onApiReady?.(api, slideId);
  }, [onApiReady, slideId]);

  useEffect(() => {
    const api = excalidrawApiRef.current;
    if (!api) {
      return;
    }

    const unsubscribeChange = api.onChange(
      (nextElements: readonly any[], nextAppState: Partial<any>) => {
        syncStyleConversionAvailabilityRef.current(nextElements, nextAppState);
      },
    );
    const unsubscribeScrollInteraction = api.onScrollChange(() => {
      pulseCanvasInteraction();
    });

    return () => {
      unsubscribeChange();
      unsubscribeScrollInteraction();
    };
  }, [apiReadyVersion, pulseCanvasInteraction, slideId]);

  useEffect(() => {
    const api = excalidrawApiRef.current;
    if (!api || editorRefreshToken === 0) {
      return;
    }

    const refreshEditorCanvas = () => {
      api.refresh();
    };
    let refreshFrameId: number | null = null;
    const firstFrameId = requestAnimationFrame(() => {
      refreshFrameId = requestAnimationFrame(refreshEditorCanvas);
    });
    const timeoutId = window.setTimeout(refreshEditorCanvas, 120);

    return () => {
      cancelAnimationFrame(firstFrameId);
      if (refreshFrameId !== null) {
        cancelAnimationFrame(refreshFrameId);
      }
      window.clearTimeout(timeoutId);
    };
  }, [apiReadyVersion, editorRefreshToken]);

  // Start camera drawing mode
  const startCameraDrawing = useCallback(() => {
    const api = excalidrawApiRef.current;
    if (!api) return;

    setIsDrawingCamera(true);
    enterCameraDrawingMode(api);
  }, []);

  const lastCameraDrawingRequestTokenRef = useRef(cameraDrawingRequestToken);
  useEffect(() => {
    if (cameraDrawingRequestToken === lastCameraDrawingRequestTokenRef.current) return;
    if (!excalidrawApiRef.current) return;
    lastCameraDrawingRequestTokenRef.current = cameraDrawingRequestToken;
    startCameraDrawing();
  }, [apiReadyVersion, cameraDrawingRequestToken, startCameraDrawing]);

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
      cameraPreviewActiveRef.current = true;
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
          cameraPreviewActiveRef.current = false;
          api.updateScene({
            elements: [...currentElements, cameraElement],
          });
        } else {
          // Just remove preview if drag was too small
          cameraPreviewActiveRef.current = false;
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
    cameraPreviewActiveRef.current = false;
    const sceneElements = api.getSceneElements();
    if (!sceneElements.some((el: any) => el.id === CAMERA_PREVIEW_ID)) {
      return;
    }

    api.updateScene({
      elements: sceneElements.filter((el: any) => el.id !== CAMERA_PREVIEW_ID),
    });
  }, [isDrawingCamera]);

  const handleExportDrawio = useCallback(() => {
    const api = excalidrawApiRef.current;
    if (!api || drawioExportInFlightRef.current) return;
    drawioExportInFlightRef.current = true;

    void exportExcalidrawToDrawio({
      pageTitle,
      elements: api.getSceneElements(),
      files: api.getFiles(),
    })
      .then((result) => {
        if (result.status === "cancelled") return;
        const skipped = result.summary.skipped > 0
          ? ` Skipped ${result.summary.skipped} unsupported element${result.summary.skipped === 1 ? "" : "s"}: ${result.summary.skippedTypes.join(", ")}.`
          : "";
        api.setToast({
          message: `Exported ${result.fileName}.${skipped}`,
          duration: skipped ? 5200 : 3200,
        });
      })
      .catch((error) => {
        const detail = error instanceof Error ? error.message : String(error);
        api.setToast({ message: `Failed to export draw.io: ${detail}`, duration: 5200 });
      })
      .finally(() => {
        drawioExportInFlightRef.current = false;
      });
  }, [pageTitle]);

  const mainMenu = useMemo(() => (
    <MainMenu>
      <MainMenu.Item
        icon={<Download aria-hidden="true" size={16} strokeWidth={1.8} />}
        onSelect={handleExportDrawio}
      >
        Export as draw.io
      </MainMenu.Item>
      <MainMenu.DefaultItems.SaveAsImage />
      <MainMenu.DefaultItems.ToggleTheme />
      <MainMenu.DefaultItems.ChangeCanvasBackground />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.DefaultItems.Help />
    </MainMenu>
  ), [handleExportDrawio]);
  const renderSelectionActions = useCallback(
    () => onConvertSelection
      ? <CanvasSelectionActions onConvert={onConvertSelection} />
      : null,
    [onConvertSelection],
  );

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
      onPointerDownCapture={beginCanvasInteraction}
      onWheelCapture={pulseCanvasInteraction}
    >
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
        UIOptions={{
          canvasActions: excalidrawCanvasActions,
        }}
        renderTopRightUI={!viewMode && canConvertSelection && onConvertSelection
          ? renderSelectionActions
          : undefined}
      >
        {!viewMode && mainMenu}
      </Excalidraw>
      {!viewMode && (
        <CameraBadgeOverlay
          key={slideId}
          api={excalidrawApiRef.current}
          containerRef={containerRef}
          slideId={slideId}
        />
      )}
    </div>
  );
}

export const SlideCanvas = memo(SlideCanvasInner, areSlideCanvasPropsEqual);
