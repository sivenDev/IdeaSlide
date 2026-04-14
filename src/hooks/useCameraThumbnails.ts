import { useEffect, useRef, useState } from "react";
import type { Camera } from "../lib/cameraUtils";
import { parseSvgMarkup } from "../lib/cameraThumbnail";
import { buildCameraPreviewKey } from "../lib/previewKeys";
import { previewRendererClient } from "../lib/previewRenderer";

export interface CameraPreviewSnapshot {
  cameras: Camera[];
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
  sceneFingerprint: string;
  cameraSignature: string;
  background: string;
}

export function useCameraThumbnails({
  snapshot,
  debounceMs = 500,
  enabled = true,
}: {
  snapshot: CameraPreviewSnapshot | null;
  debounceMs?: number;
  enabled?: boolean;
}) {
  const [thumbnails, setThumbnails] = useState<Map<string, SVGSVGElement>>(new Map());
  const timeoutRef = useRef<number | null>(null);
  const requestVersionRef = useRef(0);
  const snapshotRef = useRef<CameraPreviewSnapshot | null>(snapshot);

  snapshotRef.current = snapshot;

  const renderKey = snapshot
    ? buildCameraPreviewKey({
        sceneFingerprint: snapshot.sceneFingerprint,
        cameraSignature: snapshot.cameraSignature,
        background: snapshot.background,
      })
    : null;

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

    if (!enabled || !snapshot || snapshot.cameras.length === 0 || !renderKey) {
      setThumbnails((prev) => (prev.size === 0 ? prev : new Map()));
      return cancelPendingWork;
    }

    timeoutRef.current = window.setTimeout(async () => {
      timeoutRef.current = null;

      try {
        const nextSnapshot = snapshotRef.current;
        if (!nextSnapshot) {
          return;
        }

        const result = await previewRendererClient.renderCameras({
          renderKey,
          cameras: nextSnapshot.cameras,
          elements: nextSnapshot.elements,
          appState: nextSnapshot.appState,
          files: nextSnapshot.files,
        });

        if (
          requestVersionRef.current !== requestVersion ||
          result.status === "replaced"
        ) {
          return;
        }

        setThumbnails(() => {
          const next = new Map<string, SVGSVGElement>();

          for (const camera of nextSnapshot.cameras) {
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
