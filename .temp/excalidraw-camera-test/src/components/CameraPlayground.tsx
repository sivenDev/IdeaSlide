import { Excalidraw } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { EasingMode } from "../lib/animateViewport";
import { createViewportAnimator } from "../lib/animateViewport";
import { filterCameraElements } from "../lib/cameraUtils";
import type { Camera, CameraElementLike, ViewportTarget } from "../lib/types";
import { calculateViewportTarget } from "../lib/viewport";

interface CameraPlaygroundProps {
  sceneElements: readonly CameraElementLike[];
  sceneAppState: Partial<Record<string, unknown>>;
  cameras: readonly Camera[];
  selectedCamera: Camera | null;
  durationMs: number;
  paddingFactor: number;
  easing: EasingMode;
  showCameraBorders: boolean;
  replayToken: number;
  onTargetViewportChange: (viewport: ViewportTarget | null) => void;
  onActualViewportChange: (viewport: ViewportTarget | null) => void;
}

function readViewport(api: any): ViewportTarget {
  const appState = api.getAppState();
  return {
    scrollX: appState.scrollX ?? 0,
    scrollY: appState.scrollY ?? 0,
    zoom: appState.zoom?.value ?? 1,
  };
}

export function CameraPlayground({
  sceneElements,
  sceneAppState,
  cameras,
  selectedCamera,
  durationMs,
  paddingFactor,
  easing,
  showCameraBorders,
  replayToken,
  onTargetViewportChange,
  onActualViewportChange,
}: CameraPlaygroundProps) {
  const apiRef = useRef<any>(null);
  const animatorRef = useRef<ReturnType<typeof createViewportAnimator> | null>(null);

  const renderedElements = useMemo(
    () => (showCameraBorders ? [...sceneElements] : filterCameraElements(sceneElements)),
    [sceneElements, showCameraBorders]
  );
  const initialData = useMemo(
    () => ({
      elements: renderedElements as any[],
      appState: {
        ...sceneAppState,
        collaborators: new Map(),
      },
      files: {},
    }),
    [renderedElements, sceneAppState]
  );

  const handleApiReady = useCallback(
    (api: any) => {
      apiRef.current = api;
      animatorRef.current = createViewportAnimator({
        getCurrentViewport: () => readViewport(api),
        onUpdate: (next) => {
          api.updateScene({
            appState: {
              scrollX: next.scrollX,
              scrollY: next.scrollY,
              zoom: { value: next.zoom as any },
            } as any,
          });
          onActualViewportChange(readViewport(api));
        },
      });

      onActualViewportChange(readViewport(api));
    },
    [onActualViewportChange]
  );

  const handleSceneChange = useCallback(() => {
    if (!apiRef.current) {
      return;
    }

    onActualViewportChange(readViewport(apiRef.current));
  }, [onActualViewportChange]);

  useEffect(() => {
    return () => {
      animatorRef.current?.cancel();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) {
      return;
    }

    api.updateScene({ elements: renderedElements as any[] });
  }, [renderedElements]);

  useEffect(() => {
    const api = apiRef.current;
    const animator = animatorRef.current;

    if (!api || !animator || !selectedCamera) {
      onTargetViewportChange(null);
      return;
    }

    let cancelled = false;
    let frameId: number | null = null;

    const animateWhenReady = () => {
      if (cancelled) {
        return;
      }

      const appState = api.getAppState();
      const viewportWidth = appState.width ?? 0;
      const viewportHeight = appState.height ?? 0;

      if (viewportWidth <= 0 || viewportHeight <= 0) {
        frameId = requestAnimationFrame(animateWhenReady);
        return;
      }

      const target = calculateViewportTarget({
        cameraBounds: selectedCamera.bounds,
        viewportWidth,
        viewportHeight,
        paddingFactor,
      });

      onTargetViewportChange(target);
      animator.animateTo(target, { durationMs, easing });
    };

    animateWhenReady();

    return () => {
      cancelled = true;
      animator.cancel();
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [
    selectedCamera,
    durationMs,
    paddingFactor,
    easing,
    replayToken,
    onTargetViewportChange,
  ]);

  return (
    <div className="canvas-host">
      <Excalidraw
        excalidrawAPI={handleApiReady}
        initialData={initialData}
        onChange={handleSceneChange}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: false,
            saveAsImage: false,
          },
        }}
      />
      <div className="canvas-badge">
        <strong>Source:</strong> {cameras.length} camera{cameras.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
