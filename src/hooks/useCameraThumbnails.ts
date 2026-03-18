import { useState, useEffect, useRef } from "react";
import { exportToSvg } from "@excalidraw/excalidraw";
import type { Camera } from "../lib/cameraUtils";
import { getElementsInCamera } from "../lib/cameraUtils";

export function useCameraThumbnails(
  cameras: Camera[],
  elements: readonly any[],
  files: Record<string, any>,
  debounceMs = 500
) {
  const [thumbnails, setThumbnails] = useState<Map<string, SVGSVGElement>>(new Map());
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  // Store previous values to detect actual changes
  const prevCamerasRef = useRef<string>('');
  const prevElementsLengthRef = useRef<number>(0);

  useEffect(() => {
    // Create stable signature for cameras
    const cameraSignature = cameras.map(c =>
      `${c.id}:${c.bounds.x},${c.bounds.y},${c.bounds.width},${c.bounds.height}`
    ).join('|');

    // Only proceed if cameras or elements actually changed
    const camerasChanged = cameraSignature !== prevCamerasRef.current;
    const elementsChanged = elements.length !== prevElementsLengthRef.current;

    if (!camerasChanged && !elementsChanged) {
      return;
    }

    prevCamerasRef.current = cameraSignature;
    prevElementsLengthRef.current = elements.length;

    // Clear all pending timeouts
    for (const timeout of timeoutsRef.current.values()) {
      clearTimeout(timeout);
    }
    timeoutsRef.current.clear();

    for (const camera of cameras) {
      const visibleElements = getElementsInCamera(elements, camera);

      if (visibleElements.length === 0) {
        setThumbnails((prev) => {
          if (!prev.has(camera.id)) return prev;
          const next = new Map(prev);
          next.delete(camera.id);
          return next;
        });
        continue;
      }

      const timeout = window.setTimeout(async () => {
        try {
          const svg = await exportToSvg({
            elements: visibleElements as any,
            appState: {
              viewBackgroundColor: "#ffffff",
              exportBackground: true,
              exportPadding: 0,
            },
            files: files as any,
          });

          svg.setAttribute("width", "100%");
          svg.setAttribute("height", "100%");
          svg.setAttribute(
            "viewBox",
            `${camera.bounds.x} ${camera.bounds.y} ${camera.bounds.width} ${camera.bounds.height}`
          );

          setThumbnails((prev) => {
            const next = new Map(prev);
            next.set(camera.id, svg);
            return next;
          });
        } catch (err) {
          console.error(`Failed to generate camera thumbnail ${camera.id}:`, err);
        }
      }, debounceMs);

      timeoutsRef.current.set(camera.id, timeout);
    }

    // Clean up thumbnails for removed cameras
    setThumbnails((prev) => {
      const cameraIdSet = new Set(cameras.map((c) => c.id));
      let changed = false;
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (!cameraIdSet.has(key)) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    return () => {
      for (const timeout of timeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
    };
  }, [cameras, elements, files, debounceMs]);

  return thumbnails;
}
