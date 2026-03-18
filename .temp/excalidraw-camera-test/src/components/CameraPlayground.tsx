import { Excalidraw } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

interface CameraBadge {
  id: string;
  order: number;
  left: number;
  top: number;
}

function projectCameraBadges(api: any, cameras: readonly Camera[], host: HTMLDivElement | null) {
  const appState = api.getAppState();
  const zoom = appState.zoom?.value ?? 1;
  const scrollX = appState.scrollX ?? 0;
  const scrollY = appState.scrollY ?? 0;
  const offsetLeft = appState.offsetLeft ?? 0;
  const offsetTop = appState.offsetTop ?? 0;
  const hostRect = host?.getBoundingClientRect();
  const localOffsetLeft = offsetLeft - (hostRect?.left ?? 0);
  const localOffsetTop = offsetTop - (hostRect?.top ?? 0);

  return cameras.map((camera): CameraBadge => ({
    id: camera.id,
    order: camera.order,
    left: (camera.bounds.x + scrollX) * zoom + localOffsetLeft,
    top: (camera.bounds.y + scrollY) * zoom + localOffsetTop,
  }));
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
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const animatorRef = useRef<ReturnType<typeof createViewportAnimator> | null>(null);
  const [cameraBadges, setCameraBadges] = useState<CameraBadge[]>([]);
  const [apiReadyVersion, setApiReadyVersion] = useState(0);

  const syncCameraBadges = useCallback(() => {
    const api = apiRef.current;
    if (!api) {
      return;
    }

    setCameraBadges(projectCameraBadges(api, cameras, hostRef.current));
  }, [cameras]);

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
      setCameraBadges(projectCameraBadges(api, cameras, hostRef.current));
      setApiReadyVersion((value) => value + 1);
    },
    [cameras, onActualViewportChange]
  );

  const handleSceneChange = useCallback(() => {
    if (!apiRef.current) {
      return;
    }

    onActualViewportChange(readViewport(apiRef.current));
    syncCameraBadges();
  }, [onActualViewportChange, syncCameraBadges]);

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
    syncCameraBadges();
  }, [renderedElements, syncCameraBadges]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) {
      return;
    }

    syncCameraBadges();
    const unsubscribeChange = api.onChange(() => {
      syncCameraBadges();
    });
    const unsubscribeScroll = api.onScrollChange(() => {
      syncCameraBadges();
    });
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          syncCameraBadges();
        });

    if (hostRef.current && resizeObserver) {
      resizeObserver.observe(hostRef.current);
    }

    return () => {
      unsubscribeChange();
      unsubscribeScroll();
      resizeObserver?.disconnect();
    };
  }, [apiReadyVersion, syncCameraBadges]);

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
    <div ref={hostRef} className="canvas-host">
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
      <div className="camera-badge-layer" aria-hidden="true">
        {cameraBadges.map((badge) => (
          <div
            key={badge.id}
            className="camera-order-badge"
            style={{
              left: `${badge.left}px`,
              top: `${badge.top}px`,
            }}
          >
            {badge.order}
          </div>
        ))}
      </div>
      <div className="canvas-badge">
        <strong>Source:</strong> {cameras.length} camera{cameras.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
