import { useState, useEffect, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { SlideCanvas } from "./SlideCanvas";
import { ThumbnailNavigator } from "./ThumbnailNavigator";
import { ErrorBoundary } from "./ErrorBoundary";
import type { Slide } from "../types";

interface PresentationModeProps {
  slides: Slide[];
  startIndex: number;
  mode: 'preview' | 'fullscreen';
  onExit: () => void;
}

export function PresentationMode({ slides, startIndex, mode, onExit }: PresentationModeProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentSlide = slides[currentIndex];

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const goFirst = useCallback(() => {
    setCurrentIndex(0);
  }, []);

  const goLast = useCallback(() => {
    setCurrentIndex(slides.length - 1);
  }, [slides.length]);

  // Keyboard navigation - use capture phase to intercept before Excalidraw
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // When thumbnail navigator is open, Esc closes it instead of exiting
      if (showThumbnails && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowThumbnails(false);
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
          setShowThumbnails((prev) => !prev);
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [goNext, goPrev, goFirst, goLast, onExit, showThumbnails]);

  // Auto-focus container on mount
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Fullscreen mode: enter on mount, exit on unmount
  useEffect(() => {
    if (mode !== 'fullscreen') return;

    let cancelled = false;

    getCurrentWindow().setFullscreen(true).catch((err) => {
      if (!cancelled) {
        console.error('Failed to enter fullscreen:', err);
      }
    });

    return () => {
      cancelled = true;
      getCurrentWindow().setFullscreen(false).catch((err) => {
        console.error('Failed to exit fullscreen:', err);
      });
    };
  }, [mode]);

  const noopOnChange = useCallback(() => {}, []);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="幻灯片放映模式"
      className="fixed inset-0 z-50 flex items-center justify-center outline-none"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      {/* Slide content */}
      <div className="w-full h-full">
        <ErrorBoundary>
          <SlideCanvas
            key={currentSlide.id}
            slideId={currentSlide.id}
            elements={currentSlide.elements}
            appState={currentSlide.appState}
            onChange={noopOnChange}
            viewMode={true}
          />
        </ErrorBoundary>
      </div>

      {/* Thumbnail navigator overlay */}
      {showThumbnails && (
        <ThumbnailNavigator
          slides={slides}
          currentIndex={currentIndex}
          onSelect={(index) => {
            setCurrentIndex(index);
            setShowThumbnails(false);
          }}
          onClose={() => setShowThumbnails(false)}
        />
      )}

      {/* Page indicator */}
      <div
        role="status"
        aria-live="polite"
        aria-label={`第 ${currentIndex + 1} 张，共 ${slides.length} 张`}
        className="absolute bottom-6 right-6 px-4 py-2 rounded-lg text-sm font-medium text-white"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        {currentIndex + 1} / {slides.length}
      </div>
    </div>
  );
}
