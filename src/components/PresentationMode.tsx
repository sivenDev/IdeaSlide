import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { SlideCanvas } from "./SlideCanvas";
import { CameraNavigator } from "./CameraNavigator";
import { ErrorBoundary } from "./ErrorBoundary";
import { extractCameras, filterCameraElements } from "../lib/cameraUtils";
import { calculateViewportTarget, createViewportAnimator } from "../lib/cameraViewport";
import type { ViewportTarget } from "../lib/cameraViewport";
import type { Slide } from "../types";

type TransitionSpeed = 'fast' | 'medium' | 'slow';

const SPEED_MS: Record<TransitionSpeed, number> = {
  fast: 500,
  medium: 1000,
  slow: 1800,
};

const CAMERA_PADDING_FACTOR = 0.9;
const LASER_TRAIL_LIFETIME_MS = 700;
const LASER_TRAIL_POINT_SPACING = 5;
const LASER_TRAIL_MAX_POINTS = 180;

interface LaserPoint {
  x: number;
  y: number;
}

interface LaserTrailPoint extends LaserPoint {
  createdAt: number;
}

function appendLaserTrailSample(
  trail: LaserTrailPoint[],
  previousSample: LaserTrailPoint | null,
  point: LaserPoint,
  createdAt: number,
): LaserTrailPoint {
  if (!previousSample) {
    const firstPoint = { ...point, createdAt };
    trail.push(firstPoint);
    return firstPoint;
  }

  const deltaX = point.x - previousSample.x;
  const deltaY = point.y - previousSample.y;
  const distance = Math.hypot(deltaX, deltaY);
  const stepCount = Math.floor(distance / LASER_TRAIL_POINT_SPACING);

  if (stepCount === 0) {
    return previousSample;
  }

  let latestSample = previousSample;
  for (let step = 1; step <= stepCount; step += 1) {
    const progress = Math.min(
      (step * LASER_TRAIL_POINT_SPACING) / distance,
      1,
    );
    latestSample = {
      x: previousSample.x + deltaX * progress,
      y: previousSample.y + deltaY * progress,
      createdAt: previousSample.createdAt
        + (createdAt - previousSample.createdAt) * progress,
    };
    trail.push(latestSample);
  }

  if (trail.length > LASER_TRAIL_MAX_POINTS) {
    trail.splice(0, trail.length - LASER_TRAIL_MAX_POINTS);
  }

  return latestSample;
}

function readViewport(api: any): ViewportTarget {
  const appState = api.getAppState();
  return {
    scrollX: appState.scrollX ?? 0,
    scrollY: appState.scrollY ?? 0,
    zoom: appState.zoom?.value ?? 1,
  };
}

interface PresentationModeProps {
  slide: Slide;
  mode: 'preview' | 'fullscreen';
  transitionSpeed: TransitionSpeed;
  onExit: () => void;
  previewLaserEnabled?: boolean;
}

export function PresentationMode({ slide, mode, transitionSpeed, onExit, previewLaserEnabled = true }: PresentationModeProps) {
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [showCameraNav, setShowCameraNav] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed] = useState<TransitionSpeed>(transitionSpeed);
  const [laserEnabled, setLaserEnabled] = useState(previewLaserEnabled);
  const [apiReadyVersion, setApiReadyVersion] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const laserCanvasRef = useRef<HTMLCanvasElement>(null);
  const laserTargetRef = useRef<LaserPoint | null>(null);
  const laserTrailRef = useRef<LaserTrailPoint[]>([]);
  const laserLastTrailPointRef = useRef<LaserTrailPoint | null>(null);
  const laserAnimationFrameRef = useRef<number | null>(null);
  const laserReducedMotionRef = useRef(false);
  const excalidrawApiRef = useRef<any>(null);
  const apiSlideIdRef = useRef<string | null>(null);
  const animatorRef = useRef<ReturnType<typeof createViewportAnimator> | null>(null);
  const hasAppliedInitialCameraViewportRef = useRef(false);

  const cameras = useMemo(() => extractCameras(slide.elements), [slide.elements]);
  const hasCameras = cameras.length > 0;

  // Filter out camera elements for rendering
  const presentationElements = useMemo(
    () => filterCameraElements(slide.elements),
    [slide.elements]
  );

  const handleApiReady = useCallback((api: any) => {
    apiSlideIdRef.current = slide.id;
    excalidrawApiRef.current = api;
    animatorRef.current?.cancel();
    animatorRef.current = createViewportAnimator({
      getCurrentViewport: () => readViewport(api),
      onUpdate: (next) => {
        api.updateScene({
          appState: {
            scrollX: next.scrollX,
            scrollY: next.scrollY,
            zoom: { value: next.zoom },
          },
        });
      },
    });
    hasAppliedInitialCameraViewportRef.current = false;
    setApiReadyVersion((value) => value + 1);
  }, [slide.id]);

  // Navigate to camera when index changes
  useEffect(() => {
    const api = excalidrawApiRef.current;
    const animator = animatorRef.current;
    const camera = cameras[currentCameraIndex];

    if (
      !api ||
      !animator ||
      !hasCameras ||
      !camera ||
      apiSlideIdRef.current !== slide.id
    ) {
      return;
    }

    let cancelled = false;
    let frameId: number | null = null;

    const updateCameraViewport = () => {
      if (cancelled) {
        return;
      }

      const appState = api.getAppState();
      const viewportWidth = appState.width ?? 0;
      const viewportHeight = appState.height ?? 0;

      if (viewportWidth <= 0 || viewportHeight <= 0) {
        frameId = requestAnimationFrame(updateCameraViewport);
        return;
      }

      const target = calculateViewportTarget({
        cameraBounds: camera.bounds,
        viewportWidth,
        viewportHeight,
        paddingFactor: CAMERA_PADDING_FACTOR,
      });

      if (!hasAppliedInitialCameraViewportRef.current) {
        hasAppliedInitialCameraViewportRef.current = true;
        animator.cancel();
        api.updateScene({
          appState: {
            scrollX: target.scrollX,
            scrollY: target.scrollY,
            zoom: { value: target.zoom },
          },
        });
        return;
      }

      animator.animateTo(target, {
        durationMs: SPEED_MS[speed],
        easing: "ease-in-out",
      });
    };

    updateCameraViewport();

    return () => {
      cancelled = true;
      animator.cancel();
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [apiReadyVersion, cameras, currentCameraIndex, slide.id, hasCameras, speed]);

  const goNext = useCallback(() => {
    if (currentCameraIndex < cameras.length - 1) {
      setCurrentCameraIndex((prev) => prev + 1);
    }
  }, [currentCameraIndex, cameras.length]);

  const goPrev = useCallback(() => {
    if (currentCameraIndex > 0) {
      setCurrentCameraIndex((prev) => prev - 1);
    }
  }, [currentCameraIndex]);

  const goFirst = useCallback(() => {
    setCurrentCameraIndex(0);
  }, []);

  const goLast = useCallback(() => {
    setCurrentCameraIndex(Math.max(0, cameras.length - 1));
  }, [cameras.length]);

  const animatePreviewLaser = useCallback(function animatePreviewLaser() {
    const canvas = laserCanvasRef.current;
    const target = laserTargetRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !target || !context) {
      laserAnimationFrameRef.current = null;
      return;
    }

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const pixelRatio = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * pixelRatio);
    const pixelHeight = Math.round(height * pixelRatio);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const now = performance.now();
    const trail = laserReducedMotionRef.current
      ? []
      : laserTrailRef.current.filter(
        (point) => now - point.createdAt < LASER_TRAIL_LIFETIME_MS,
      );
    laserTrailRef.current = trail;

    for (let index = 0; index < trail.length; index += 1) {
      const point = trail[index];
      const nextPoint = trail[index + 1] ?? target;
      const strength = Math.max(
        0,
        1 - (now - point.createdAt) / LASER_TRAIL_LIFETIME_MS,
      );

      context.beginPath();
      context.moveTo(point.x, point.y);
      context.lineTo(nextPoint.x, nextPoint.y);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = 1 + strength * 5;
      context.strokeStyle = `rgba(255, 48, 48, ${strength * 0.7})`;
      context.shadowColor = `rgba(255, 35, 35, ${strength * 0.58})`;
      context.shadowBlur = 3 + strength * 11;
      context.stroke();
    }

    context.beginPath();
    context.arc(target.x, target.y, 6, 0, Math.PI * 2);
    context.fillStyle = "#ef4444";
    context.shadowColor = "rgba(255, 35, 35, 0.72)";
    context.shadowBlur = 16;
    context.fill();

    if (trail.length > 0) {
      laserAnimationFrameRef.current = requestAnimationFrame(animatePreviewLaser);
    } else {
      laserLastTrailPointRef.current = { ...target, createdAt: now };
      laserAnimationFrameRef.current = null;
    }
  }, []);

  const handlePreviewPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      mode !== "preview"
      || !laserEnabled
      || (event.pointerType && event.pointerType !== "mouse")
    ) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const nativeEvent = event.nativeEvent;
    const coalescedEvents = typeof nativeEvent.getCoalescedEvents === "function"
      ? nativeEvent.getCoalescedEvents()
      : [];
    const pointerEvents = coalescedEvents.length > 0 ? coalescedEvents : [nativeEvent];
    const latestEvent = pointerEvents[pointerEvents.length - 1];
    const now = performance.now();
    const latestEventTimestamp = latestEvent.timeStamp;

    laserReducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    for (const pointerEvent of pointerEvents) {
      const point = {
        x: pointerEvent.clientX - bounds.left,
        y: pointerEvent.clientY - bounds.top,
      };
      const createdAt = now - Math.max(0, latestEventTimestamp - pointerEvent.timeStamp);
      laserTargetRef.current = point;

      if (!laserReducedMotionRef.current) {
        laserLastTrailPointRef.current = appendLaserTrailSample(
          laserTrailRef.current,
          laserLastTrailPointRef.current,
          point,
          createdAt,
        );
      }
    }

    if (laserAnimationFrameRef.current === null) {
      laserAnimationFrameRef.current = requestAnimationFrame(animatePreviewLaser);
    }
  }, [mode, laserEnabled, animatePreviewLaser]);

  const clearPreviewPointer = useCallback(() => {
    if (laserAnimationFrameRef.current !== null) {
      cancelAnimationFrame(laserAnimationFrameRef.current);
      laserAnimationFrameRef.current = null;
    }

    laserTargetRef.current = null;
    laserTrailRef.current = [];
    laserLastTrailPointRef.current = null;

    const canvas = laserCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.restore();
    }
  }, []);

  useEffect(() => {
    if (mode !== "preview" || !laserEnabled || showCameraNav || showSettings) {
      clearPreviewPointer();
    }
  }, [mode, laserEnabled, showCameraNav, showSettings, clearPreviewPointer]);

  // Keyboard navigation - capture phase
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Close overlays first
      if ((showCameraNav || showSettings) && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowCameraNav(false);
        setShowSettings(false);
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          goNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'Backspace':
          e.preventDefault();
          e.stopPropagation();
          goPrev();
          break;
        case 'Home':
          e.preventDefault();
          e.stopPropagation();
          goFirst();
          break;
        case 'End':
          e.preventDefault();
          e.stopPropagation();
          goLast();
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onExit();
          break;
        case 'Tab':
        case 'g':
          e.preventDefault();
          e.stopPropagation();
          setShowCameraNav((prev) => !prev);
          break;
        case 's':
          e.preventDefault();
          e.stopPropagation();
          setShowSettings((prev) => !prev);
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [goNext, goPrev, goFirst, goLast, onExit, showCameraNav, showSettings]);

  // Auto-focus container on mount
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Fullscreen mode
  useEffect(() => {
    if (mode !== 'fullscreen') return;
    let cancelled = false;
    getCurrentWindow().setFullscreen(true).catch((err) => {
      if (!cancelled) console.error('Failed to enter fullscreen:', err);
    });
    return () => {
      cancelled = true;
      getCurrentWindow().setFullscreen(false).catch((err) => {
        console.error('Failed to exit fullscreen:', err);
      });
    };
  }, [mode]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (laserAnimationFrameRef.current !== null) {
        cancelAnimationFrame(laserAnimationFrameRef.current);
      }
      animatorRef.current?.cancel();
      excalidrawApiRef.current = null;
      apiSlideIdRef.current = null;
    };
  }, []);

  const noopOnChange = useCallback(
    (_elements: readonly any[], _appState: Partial<any>, _files: Record<string, any>) => false,
    []
  );

  const presentationAppState = useMemo(() => {
    const baseAppState = {
      ...slide.appState,
      viewModeEnabled: true,
      zenModeEnabled: true,
    };

    if (!hasCameras) {
      return baseAppState;
    }

    return {
      ...baseAppState,
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
    };
  }, [slide.appState, hasCameras]);

  // Build page indicator text
  const pageIndicator = `${currentCameraIndex + 1} / ${cameras.length}`;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Presentation mode"
      className={`idea-slide-presentation ${mode === "preview" ? "is-preview" : "is-fullscreen"} fixed inset-0 z-50 flex items-center justify-center outline-none`}
      style={{ backgroundColor: '#1a1a1a' }}
    >
      {/* Slide content — camera elements filtered out */}
      <div
        className="w-full h-full"
        style={{ cursor: mode === "preview" && laserEnabled ? "none" : undefined }}
        onPointerMove={handlePreviewPointerMove}
        onPointerLeave={clearPreviewPointer}
      >
        <ErrorBoundary>
          <SlideCanvas
            key={slide.id}
            slideId={slide.id}
            pageTitle={slide.title || "Page"}
            elements={presentationElements}
            appState={presentationAppState}
            files={slide.files}
            onChange={noopOnChange}
            viewMode={true}
            onApiReady={handleApiReady}
            editorRefreshToken={0}
          />
        </ErrorBoundary>
      </div>

      {mode === "preview" && laserEnabled && (
        <canvas
          ref={laserCanvasRef}
          aria-hidden="true"
          className="idea-slide-presentation-laser__canvas pointer-events-none absolute inset-0 z-[55] h-full w-full"
        />
      )}

      {/* Camera navigator overlay */}
      {showCameraNav && hasCameras && (
        <CameraNavigator
          cameras={cameras}
          currentCameraIndex={currentCameraIndex}
          elements={slide.elements}
          appState={slide.appState}
          files={slide.files}
          onSelect={(index: number) => {
            setCurrentCameraIndex(index);
            setShowCameraNav(false);
          }}
          onClose={() => setShowCameraNav(false)}
        />
      )}

      {/* Settings panel */}
      {showSettings && (
        <div
          className="absolute top-4 right-4 bg-white/95 backdrop-blur rounded-lg shadow-xl p-4 z-[60] min-w-[240px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-sm font-medium text-gray-800 mb-3">Presentation Settings</div>
          <div className="text-xs text-gray-500 mb-2">Transition Speed</div>
          <div className="flex gap-2">
            {(['fast', 'medium', 'slow'] as TransitionSpeed[]).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  speed === s
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-gray-400 mt-2">
            {SPEED_MS[speed]}ms
          </div>
          {mode === "preview" && (
            <label className="mt-4 flex items-center justify-between gap-4 border-t border-gray-200 pt-3">
              <span className="flex min-w-0 flex-col">
                <span className="text-xs font-medium text-gray-700">Laser pointer</span>
                <span className="text-[10px] text-gray-400">Show the pointer and trail</span>
              </span>
              <span className="relative inline-flex shrink-0">
                <input
                  type="checkbox"
                  role="switch"
                  checked={laserEnabled}
                  onChange={(event) => setLaserEnabled(event.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="h-5 w-9 rounded-full bg-gray-200 transition-colors peer-checked:bg-blue-500 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4"
                />
              </span>
            </label>
          )}
        </div>
      )}

      {/* Camera position indicator */}
      {hasCameras && (
        <div
          role="status"
          aria-live="polite"
          className="absolute bottom-6 right-6 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
        >
          {pageIndicator}
        </div>
      )}
    </div>
  );
}
