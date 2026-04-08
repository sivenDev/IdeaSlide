import { useEffect, useRef, useState } from "react";
import type { Camera } from "../lib/cameraUtils";
import { parseSvgMarkup } from "../lib/cameraThumbnail";
import { buildCameraPreviewKey, extractPreviewAppState } from "../lib/previewKeys";
import { previewRendererClient } from "../lib/previewRenderer";

export function useCameraThumbnails(
  cameras: Camera[],
  elements: readonly any[],
  appState: Partial<any>,
  files: Record<string, any>,
  debounceMs = 500,
  enabled = true,
) {
  const [thumbnails, setThumbnails] = useState<Map<string, SVGSVGElement>>(new Map());
  const timeoutRef = useRef<number | null>(null);
  const requestVersionRef = useRef(0);
  const renderPayloadRef = useRef({
    cameras,
    elements,
    appState: extractPreviewAppState(appState),
    files,
  });

  const previewAppState = extractPreviewAppState(appState);
  renderPayloadRef.current = {
    cameras,
    elements,
    appState: previewAppState,
    files,
  };

  const renderKey = buildCameraPreviewKey(elements, files, cameras, previewAppState);

  useEffect(() => {
    const cancelPendingWork = () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    requestVersionRef.current += 1;
    const requestVersion = requestVersionRef.current;
    cancelPendingWork();

    if (!enabled) {
      return cancelPendingWork;
    }

    if (cameras.length === 0) {
      setThumbnails((prev) => (prev.size === 0 ? prev : new Map()));
      return cancelPendingWork;
    }

    timeoutRef.current = window.setTimeout(async () => {
      timeoutRef.current = null;

      try {
        const renderPayload = renderPayloadRef.current;
        const result = await previewRendererClient.renderCameras({
          renderKey,
          cameras: renderPayload.cameras,
          elements: renderPayload.elements,
          appState: renderPayload.appState,
          files: renderPayload.files,
        });

        if (
          requestVersionRef.current !== requestVersion ||
          result.status === "replaced"
        ) {
          return;
        }

        setThumbnails(() => {
          const next = new Map<string, SVGSVGElement>();

          for (const camera of renderPayload.cameras) {
            const svgMarkup = result.value.get(camera.id);
            if (!svgMarkup) {
              continue;
            }

            const svgElement = parseSvgMarkup(svgMarkup);
            if (svgElement instanceof SVGSVGElement) {
              next.set(camera.id, svgElement);
            }
          }

          return next;
        });
      } catch (error) {
        if (requestVersionRef.current !== requestVersion) {
          return;
        }
        console.error("Failed to generate camera thumbnails:", error);
      }
    }, debounceMs);

    return cancelPendingWork;
  }, [debounceMs, enabled, renderKey]);

  return thumbnails;
}
