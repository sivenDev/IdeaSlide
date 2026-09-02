import {
  CaptureUpdateAction,
  Excalidraw,
  newElementWith,
} from "@excalidraw/excalidraw";
import {
  memo,
  useRef,
  useEffect,
  useState,
  useCallback,
  type ClipboardEvent as ReactClipboardEvent,
  type FormEvent as ReactFormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { getNextCameraOrder } from "../lib/cameraUtils";
import {
  createCameraPreviewId,
  enterCameraDrawingMode,
} from "../lib/cameraDrawing";
import { areSlideCanvasPropsEqual } from "../lib/slideCanvasProps";
import {
  buildSelectedElementIdsSignature,
  getStyleConversionAvailability,
  type StyleConversionTarget,
} from "../lib/excalidrawStyleConversion";
import { exportExcalidrawToDrawio } from "../lib/drawioExport";
import { useSettings } from "../hooks/useSettings";
import { CanvasSelectionActions } from "./CanvasSelectionActions";
import { CameraBadgeOverlay } from "./CameraBadgeOverlay";
import {
  createIdeaSketchNativeActionOwnership,
  type IdeaSketchNativeActionToken,
} from "../lib/ideasketch-sdk/editorHostAdapter.ts";
import type { IdeaSketchNativeInteractionReason } from "../lib/ideasketch-sdk/host.ts";

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

function isNativeMutationKeyboardEvent(event: ReactKeyboardEvent<HTMLDivElement>) {
  const key = event.key.toLowerCase();
  if (key === "delete" || key === "backspace" || key.startsWith("arrow")) return true;
  return (event.metaKey || event.ctrlKey) && key === "d";
}

function isWritableEventTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (
    target.isContentEditable
    || target.tagName === "INPUT"
    || target.tagName === "TEXTAREA"
    || target.tagName === "SELECT"
  );
}

export interface SlideCanvasCommandApi {
  exportDrawio: () => void;
  openImageExport: () => void;
  changeCanvasBackground: (color: string) => void;
  clearCanvas: () => void;
}

interface SlideCanvasProps {
  slideId: string;
  pageTitle: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
  onChange: (elements: readonly any[], appState: Partial<any>, files: Record<string, any>) => boolean;
  viewMode?: boolean;
  onApiReady?: (api: any | undefined, slideId: string) => void;
  onCommandApiReady?: (api: SlideCanvasCommandApi | undefined, slideId: string) => void;
  onConvertSelection?: (target: StyleConversionTarget) => void;
  onSelectionPresenceChange?: (selected: boolean) => void;
  onInteractionChange?: (active: boolean) => void;
  onNativeInteractionChange?: (change: {
    active: boolean;
    reason: IdeaSketchNativeInteractionReason;
  }) => void;
  onCameraPreviewChange?: (previewId?: string) => void;
  editorRefreshToken: number;
  layoutRefreshToken?: number;
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
  onCommandApiReady,
  onConvertSelection,
  onSelectionPresenceChange,
  onInteractionChange,
  onNativeInteractionChange,
  onCameraPreviewChange,
  editorRefreshToken,
  layoutRefreshToken = 0,
  cameraDrawingRequestToken = 0,
}: SlideCanvasProps) {
  const { resolvedTheme } = useSettings();
  // Use a ref to always have the latest onChange without causing re-renders
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onSelectionPresenceChangeRef = useRef(onSelectionPresenceChange);
  const onInteractionChangeRef = useRef(onInteractionChange);
  const onNativeInteractionChangeRef = useRef(onNativeInteractionChange);
  const onCameraPreviewChangeRef = useRef(onCameraPreviewChange);
  const excalidrawApiRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const interactionActiveRef = useRef(false);
  const interactionIdleTimeoutRef = useRef<number | null>(null);
  const nativeInteractionReasonsRef = useRef(new Set<IdeaSketchNativeInteractionReason>());
  const nativeInteractionTimeoutsRef = useRef(new Map<IdeaSketchNativeInteractionReason, number>());
  const selectionPresentRef = useRef<boolean | undefined>(undefined);
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
    onSelectionPresenceChangeRef.current = onSelectionPresenceChange;
  }, [onSelectionPresenceChange]);
  useEffect(() => {
    onInteractionChangeRef.current = onInteractionChange;
  }, [onInteractionChange]);
  useEffect(() => {
    onNativeInteractionChangeRef.current = onNativeInteractionChange;
  }, [onNativeInteractionChange]);
  useEffect(() => {
    onCameraPreviewChangeRef.current = onCameraPreviewChange;
  }, [onCameraPreviewChange]);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      excalidrawApiRef.current = null;
      onApiReady?.(undefined, slideId);
    };
  }, [onApiReady, slideId]);

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

  const clearNativeInteractionTimeout = useCallback((reason: IdeaSketchNativeInteractionReason) => {
    const timeout = nativeInteractionTimeoutsRef.current.get(reason);
    if (timeout === undefined) return;
    window.clearTimeout(timeout);
    nativeInteractionTimeoutsRef.current.delete(reason);
  }, []);
  const beginNativeInteraction = useCallback((reason: IdeaSketchNativeInteractionReason) => {
    clearNativeInteractionTimeout(reason);
    if (nativeInteractionReasonsRef.current.has(reason)) return;
    nativeInteractionReasonsRef.current.add(reason);
    onNativeInteractionChangeRef.current?.({ active: true, reason });
  }, [clearNativeInteractionTimeout]);
  const finishNativeInteraction = useCallback((reason: IdeaSketchNativeInteractionReason) => {
    clearNativeInteractionTimeout(reason);
    if (!nativeInteractionReasonsRef.current.delete(reason)) return;
    onNativeInteractionChangeRef.current?.({ active: false, reason });
  }, [clearNativeInteractionTimeout]);
  const finishNativeInteractionSoon = useCallback((reason: IdeaSketchNativeInteractionReason) => {
    clearNativeInteractionTimeout(reason);
    if (!nativeInteractionReasonsRef.current.has(reason)) return;
    const timeout = window.setTimeout(() => {
      nativeInteractionTimeoutsRef.current.delete(reason);
      finishNativeInteraction(reason);
    }, 180);
    nativeInteractionTimeoutsRef.current.set(reason, timeout);
  }, [clearNativeInteractionTimeout, finishNativeInteraction]);
  const pulseNativeInteraction = useCallback((reason: IdeaSketchNativeInteractionReason) => {
    beginNativeInteraction(reason);
    finishNativeInteractionSoon(reason);
  }, [beginNativeInteraction, finishNativeInteractionSoon]);
  const nativeActionOwnershipRef = useRef<ReturnType<
    typeof createIdeaSketchNativeActionOwnership
  > | null>(null);
  if (!nativeActionOwnershipRef.current) {
    nativeActionOwnershipRef.current = createIdeaSketchNativeActionOwnership();
  }
  const beginNativeAction = useCallback(() => {
    const token = nativeActionOwnershipRef.current!.begin();
    beginNativeInteraction("native-action");
    return token;
  }, [beginNativeInteraction]);
  const finishNativeAction = useCallback((token: IdeaSketchNativeActionToken) => {
    if (nativeActionOwnershipRef.current!.settle(token)) {
      finishNativeInteraction("native-action");
    }
  }, [finishNativeInteraction]);
  const settleNativeActionAfterSynchronousEvent = useCallback((token: IdeaSketchNativeActionToken) => {
    window.requestAnimationFrame(() => {
      finishNativeAction(token);
    });
  }, [finishNativeAction]);

  useEffect(() => () => {
    if (nativeActionOwnershipRef.current?.clear()) {
      finishNativeInteraction("native-action");
    }
    for (const timeout of nativeInteractionTimeoutsRef.current.values()) {
      window.clearTimeout(timeout);
    }
    nativeInteractionTimeoutsRef.current.clear();
    for (const reason of nativeInteractionReasonsRef.current) {
      onNativeInteractionChangeRef.current?.({ active: false, reason });
    }
    nativeInteractionReasonsRef.current.clear();
  }, [finishNativeInteraction]);

  useEffect(() => {
    if (!viewMode || !nativeActionOwnershipRef.current?.clear()) return;
    finishNativeInteraction("native-action");
  }, [finishNativeInteraction, viewMode]);

  useEffect(() => {
    const finishPointerInteraction = () => {
      finishCanvasInteractionSoon();
      finishNativeInteractionSoon("pointer");
    };
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
  }, [clearInteractionIdleTimeout, finishCanvasInteractionSoon, finishNativeInteractionSoon]);

  const syncStyleConversionAvailability = useCallback((
    nextElements: readonly any[],
    nextAppState: Partial<any>,
  ) => {
    const nextObservation = {
      elements: nextElements,
      selectedIdsSignature: buildSelectedElementIdsSignature(nextAppState.selectedElementIds),
      readOnly: Boolean(viewMode),
    };
    const nextSelectionPresent = nextObservation.selectedIdsSignature.length > 0;
    if (selectionPresentRef.current !== nextSelectionPresent) {
      selectionPresentRef.current = nextSelectionPresent;
      onSelectionPresenceChangeRef.current?.(nextSelectionPresent);
    }
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
  const cameraPreviewIdRef = useRef<string | undefined>(undefined);
  const drawioExportInFlightRef = useRef(false);
  const [apiReadyVersion, setApiReadyVersion] = useState(0);

  // Handle API ready
  const handleApiReady = useCallback((api: any) => {
    if (!isMountedRef.current) return;
    if (
      excalidrawApiRef.current
      && excalidrawApiRef.current !== api
      && nativeActionOwnershipRef.current?.clear()
    ) {
      finishNativeInteraction("native-action");
    }
    excalidrawApiRef.current = api;
    syncStyleConversionAvailabilityRef.current(api.getSceneElements(), api.getAppState());
    setApiReadyVersion((value) => value + 1);
    onApiReady?.(api, slideId);
  }, [finishNativeInteraction, onApiReady, slideId]);

  useEffect(() => {
    const api = excalidrawApiRef.current;
    if (!api) {
      return;
    }

    const unsubscribeChange = api.onChange(
      (nextElements: readonly any[], nextAppState: Partial<any>) => {
        syncStyleConversionAvailabilityRef.current(nextElements, nextAppState);
        if (nextAppState.editingTextElement) beginNativeInteraction("text");
        else finishNativeInteractionSoon("text");
        if (
          nextAppState.selectedElementsAreBeingDragged
          || nextAppState.isResizing
          || nextAppState.isRotating
          || nextAppState.multiElement
          || nextAppState.selectionElement
        ) {
          beginNativeInteraction("pointer");
        } else if (!interactionActiveRef.current) {
          finishNativeInteractionSoon("pointer");
        }
      },
    );
    const unsubscribeScrollInteraction = api.onScrollChange(() => {
      pulseCanvasInteraction();
    });

    return () => {
      unsubscribeChange();
      unsubscribeScrollInteraction();
    };
  }, [
    apiReadyVersion,
    beginNativeInteraction,
    finishNativeInteractionSoon,
    pulseCanvasInteraction,
    slideId,
  ]);

  useEffect(() => {
    const api = excalidrawApiRef.current;
    if (!api || (editorRefreshToken === 0 && layoutRefreshToken === 0)) {
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
  }, [apiReadyVersion, editorRefreshToken, layoutRefreshToken]);

  // Start camera drawing mode
  const startCameraDrawing = useCallback(() => {
    const api = excalidrawApiRef.current;
    if (!api) return;

    const previewId = createCameraPreviewId();
    cameraPreviewIdRef.current = previewId;
    onCameraPreviewChangeRef.current?.(previewId);
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
      const previewId = cameraPreviewIdRef.current;
      if (!previewId) return;

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
        .filter((el: any) => el.id !== previewId);

      // Create preview rectangle
      const previewElement = {
        id: previewId,
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
      beginNativeInteraction("camera-preview");
      cameraPreviewActiveRef.current = true;
      api.updateScene({
        elements: [...currentElements, previewElement],
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      finishNativeInteractionSoon("camera-preview");
    };
  }, [beginNativeInteraction, finishNativeInteractionSoon, isDrawingCamera]);

  // Handle pointer up - finish drawing camera rectangle
  useEffect(() => {
    const api = excalidrawApiRef.current;
    if (!api || !isDrawingCamera) return;

    const unsubscribe = api.onPointerUp((activeTool: any, _pointerDownState: any, event: PointerEvent) => {
      if (activeTool.type === "custom" && activeTool.customType === "camera" && drawStartRef.current) {
        const pointer = getScenePointerFromEvent(api, event);
        if (!pointer) return;
        const previewId = cameraPreviewIdRef.current;
        if (!previewId) return;

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
          .filter((el: any) => el.id !== previewId);

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
        finishNativeInteractionSoon("camera-preview");
        cameraPreviewIdRef.current = undefined;
        onCameraPreviewChangeRef.current?.(undefined);
        drawStartRef.current = null;
        setIsDrawingCamera(false);
        api.setActiveTool({ type: "selection" });
      }
    });

    return unsubscribe;
  }, [finishNativeInteractionSoon, isDrawingCamera]);

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
    finishNativeInteractionSoon("camera-preview");
    const previewId = cameraPreviewIdRef.current;
    cameraPreviewIdRef.current = undefined;
    onCameraPreviewChangeRef.current?.(undefined);
    const sceneElements = api.getSceneElements();
    if (!previewId || !sceneElements.some((el: any) => el.id === previewId)) {
      return;
    }

    api.updateScene({
      elements: sceneElements.filter((el: any) => el.id !== previewId),
    });
  }, [finishNativeInteractionSoon, isDrawingCamera]);

  useEffect(() => () => {
    cameraPreviewIdRef.current = undefined;
    onCameraPreviewChangeRef.current?.(undefined);
  }, []);

  const handleExportDrawio = useCallback(() => {
    const api = excalidrawApiRef.current;
    if (!api || drawioExportInFlightRef.current) return;
    drawioExportInFlightRef.current = true;

    void exportExcalidrawToDrawio({
      pageTitle,
      elements: api.getSceneElements().filter(
        (element: any) => element.id !== cameraPreviewIdRef.current,
      ),
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

  const openImageExport = useCallback(() => {
    excalidrawApiRef.current?.updateScene({
      appState: { openDialog: { name: "imageExport" } },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, []);
  const changeCanvasBackground = useCallback((color: string) => {
    const api = excalidrawApiRef.current;
    if (!api || viewMode) return;
    api.updateScene({
      appState: { viewBackgroundColor: color },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, [viewMode]);
  const clearCanvas = useCallback(() => {
    const api = excalidrawApiRef.current;
    if (!api || viewMode) return;
    api.updateScene({
      elements: api.getSceneElementsIncludingDeleted().map((element: any) => (
        element.isDeleted ? element : newElementWith(element, { isDeleted: true })
      )),
      appState: { selectedElementIds: {} },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, [viewMode]);
  useEffect(() => {
    if (apiReadyVersion === 0 || !onCommandApiReady) return;
    const commandApi: SlideCanvasCommandApi = {
      exportDrawio: handleExportDrawio,
      openImageExport,
      changeCanvasBackground,
      clearCanvas,
    };
    onCommandApiReady(commandApi, slideId);
    return () => onCommandApiReady(undefined, slideId);
  }, [
    apiReadyVersion,
    changeCanvasBackground,
    clearCanvas,
    handleExportDrawio,
    onCommandApiReady,
    openImageExport,
    slideId,
  ]);
  const renderSelectionActions = useCallback(
    () => onConvertSelection
      ? <CanvasSelectionActions onConvert={onConvertSelection} />
      : null,
    [onConvertSelection],
  );
  const handlePointerDownCapture = useCallback(() => {
    beginCanvasInteraction();
    beginNativeInteraction("pointer");
  }, [beginCanvasInteraction, beginNativeInteraction]);
  const handleKeyDownCapture = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    pulseCanvasInteraction();
    if ((event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y")) {
      pulseNativeInteraction("history");
    } else if (isNativeMutationKeyboardEvent(event)) {
      settleNativeActionAfterSynchronousEvent(beginNativeAction());
    }
  }, [beginNativeAction, pulseCanvasInteraction, pulseNativeInteraction, settleNativeActionAfterSynchronousEvent]);
  const handleBeforeInputCapture = useCallback((event: ReactFormEvent<HTMLDivElement>) => {
    if ((event.nativeEvent as InputEvent).inputType === "insertFromPaste") return;
    settleNativeActionAfterSynchronousEvent(beginNativeAction());
  }, [beginNativeAction, settleNativeActionAfterSynchronousEvent]);
  const handleCutCapture = useCallback((event: ReactClipboardEvent<HTMLDivElement>) => {
    if (isWritableEventTarget(event.target)) return;
    settleNativeActionAfterSynchronousEvent(beginNativeAction());
  }, [beginNativeAction, settleNativeActionAfterSynchronousEvent]);
  const handlePasteLifecycle = useCallback((payload: {
    phase: "start";
    event: ClipboardEvent | null;
  } | {
    phase: "end";
    event: ClipboardEvent | null;
    token: unknown;
  }) => {
    if (payload.phase === "start") return beginNativeAction();
    finishNativeAction(payload.token as IdeaSketchNativeActionToken);
    return undefined;
  }, [beginNativeAction, finishNativeAction]);
  const handleCompositionStartCapture = useCallback(() => {
    beginNativeInteraction("ime");
  }, [beginNativeInteraction]);
  const handleCompositionEndCapture = useCallback(() => {
    finishNativeInteractionSoon("ime");
  }, [finishNativeInteractionSoon]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
      onPointerDownCapture={handlePointerDownCapture}
      onKeyDownCapture={handleKeyDownCapture}
      onBeforeInputCapture={handleBeforeInputCapture}
      onCutCapture={handleCutCapture}
      onCompositionStartCapture={handleCompositionStartCapture}
      onCompositionEndCapture={handleCompositionEndCapture}
      onWheelCapture={pulseCanvasInteraction}
    >
      <Excalidraw
        key={`excalidraw:${slideId}`}
        theme={resolvedTheme}
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
        onPasteLifecycle={viewMode ? undefined : handlePasteLifecycle}
        UIOptions={{
          canvasActions: excalidrawCanvasActions,
        }}
        renderTopRightUI={!viewMode && canConvertSelection && onConvertSelection
          ? renderSelectionActions
          : undefined}
      >
      </Excalidraw>
      {!viewMode && (
        <CameraBadgeOverlay
          key={`camera-badges:${slideId}`}
          api={excalidrawApiRef.current}
          containerRef={containerRef}
          slideId={slideId}
        />
      )}
    </div>
  );
}

export const SlideCanvas = memo(SlideCanvasInner, areSlideCanvasPropsEqual);
