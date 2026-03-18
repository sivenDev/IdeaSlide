import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { SlideCanvas } from "./SlideCanvas";
import { ThumbnailNavigator } from "./ThumbnailNavigator";
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

function readViewport(api: any): ViewportTarget {
  const appState = api.getAppState();
  return {
    scrollX: appState.scrollX ?? 0,
    scrollY: appState.scrollY ?? 0,
    zoom: appState.zoom?.value ?? 1,
  };
}

interface PresentationModeProps {
  slides: Slide[];
  startIndex: number;
  mode: 'preview' | 'fullscreen';
  transitionSpeed: TransitionSpeed;
  onExit: () => void;
}

export function PresentationMode({ slides, startIndex, mode, transitionSpeed, onExit }: PresentationModeProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(startIndex);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showCameraNav, setShowCameraNav] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed] = useState<TransitionSpeed>(transitionSpeed);
  const [apiReadyVersion, setApiReadyVersion] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const excalidrawApiRef = useRef<any>(null);
  const apiSlideIdRef = useRef<string | null>(null);
  const animatorRef = useRef<ReturnType<typeof createViewportAnimator> | null>(null);

  const currentSlide = slides[currentSlideIndex];
  const cameras = useMemo(() => extractCameras(currentSlide.elements), [currentSlide.elements]);
  const hasCameras = cameras.length > 0;

  // Filter out camera elements for rendering
  const presentationElements = useMemo(
    () => filterCameraElements(currentSlide.elements),
    [currentSlide.elements]
  );

  const handleApiReady = useCallback((api: any) => {
    apiSlideIdRef.current = currentSlide.id;
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
    setApiReadyVersion((value) => value + 1);
  }, [currentSlide.id]);

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
      apiSlideIdRef.current !== currentSlide.id
    ) {
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
        cameraBounds: camera.bounds,
        viewportWidth,
        viewportHeight,
        paddingFactor: CAMERA_PADDING_FACTOR,
      });

      animator.animateTo(target, {
        durationMs: SPEED_MS[speed],
        easing: "ease-in-out",
      });
    };

    animateWhenReady();

    return () => {
      cancelled = true;
      animator.cancel();
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [apiReadyVersion, cameras, currentCameraIndex, currentSlide.id, hasCameras, speed]);

  const goNext = useCallback(() => {
    if (hasCameras && currentCameraIndex < cameras.length - 1) {
      // Next camera within current slide
      setCurrentCameraIndex((prev) => prev + 1);
    } else if (currentSlideIndex < slides.length - 1) {
      // Next slide
      setCurrentSlideIndex((prev) => prev + 1);
      setCurrentCameraIndex(0);
    }
  }, [hasCameras, currentCameraIndex, cameras.length, currentSlideIndex, slides.length]);

  const goPrev = useCallback(() => {
    if (hasCameras && currentCameraIndex > 0) {
      // Previous camera within current slide
      setCurrentCameraIndex((prev) => prev - 1);
    } else if (currentSlideIndex > 0) {
      // Previous slide — go to its last camera
      const prevSlide = slides[currentSlideIndex - 1];
      const prevCameras = extractCameras(prevSlide.elements);
      setCurrentSlideIndex((prev) => prev - 1);
      setCurrentCameraIndex(prevCameras.length > 0 ? prevCameras.length - 1 : 0);
    }
  }, [hasCameras, currentCameraIndex, currentSlideIndex, slides]);

  const goFirst = useCallback(() => {
    setCurrentSlideIndex(0);
    setCurrentCameraIndex(0);
  }, []);

  const goLast = useCallback(() => {
    const lastSlide = slides[slides.length - 1];
    const lastCameras = extractCameras(lastSlide.elements);
    setCurrentSlideIndex(slides.length - 1);
    setCurrentCameraIndex(lastCameras.length > 0 ? lastCameras.length - 1 : 0);
  }, [slides]);

  // Keyboard navigation - capture phase
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Close overlays first
      if ((showThumbnails || showCameraNav || showSettings) && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowThumbnails(false);
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
          if (hasCameras) {
            setShowCameraNav((prev) => !prev);
          } else {
            setShowThumbnails((prev) => !prev);
          }
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
  }, [goNext, goPrev, goFirst, goLast, onExit, showThumbnails, showCameraNav, showSettings, hasCameras]);

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
      animatorRef.current?.cancel();
      excalidrawApiRef.current = null;
      apiSlideIdRef.current = null;
    };
  }, []);

  const noopOnChange = useCallback(
    (_elements: readonly any[], _appState: Partial<any>, _files: Record<string, any>) => {},
    []
  );

  const presentationAppState = useMemo(() => {
    const baseAppState = {
      ...currentSlide.appState,
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
  }, [currentSlide.appState, hasCameras]);

  // Build page indicator text
  const pageIndicator = hasCameras
    ? `${currentSlideIndex + 1}.${currentCameraIndex + 1} / ${slides.length}`
    : `${currentSlideIndex + 1} / ${slides.length}`;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Presentation mode"
      className="fixed inset-0 z-50 flex items-center justify-center outline-none"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      {/* Slide content — camera elements filtered out */}
      <div className="w-full h-full">
        <ErrorBoundary>
          <SlideCanvas
            key={currentSlide.id}
            slideId={currentSlide.id}
            elements={presentationElements}
            appState={presentationAppState}
            files={currentSlide.files}
            onChange={noopOnChange}
            viewMode={true}
            onApiReady={handleApiReady}
          />
        </ErrorBoundary>
      </div>

      {/* Slide thumbnail navigator */}
      {showThumbnails && (
        <ThumbnailNavigator
          slides={slides}
          currentIndex={currentSlideIndex}
          onSelect={(index) => {
            setCurrentSlideIndex(index);
            setCurrentCameraIndex(0);
            setShowThumbnails(false);
          }}
          onClose={() => setShowThumbnails(false)}
        />
      )}

      {/* Camera navigator overlay */}
      {showCameraNav && hasCameras && (
        <CameraNavigator
          cameras={cameras}
          currentCameraIndex={currentCameraIndex}
          elements={currentSlide.elements}
          appState={currentSlide.appState}
          files={currentSlide.files}
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
          className="absolute top-4 right-4 bg-white/95 backdrop-blur rounded-lg shadow-xl p-4 z-[60] min-w-[200px]"
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
        </div>
      )}

      {/* Page indicator */}
      <div
        role="status"
        aria-live="polite"
        className="absolute bottom-6 right-6 px-4 py-2 rounded-lg text-sm font-medium text-white"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        {pageIndicator}
      </div>
    </div>
  );
}
