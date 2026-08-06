import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { extractCameras, type Camera } from "../lib/cameraUtils";
import {
  extractCameraBadgeViewport,
  projectCameraBadges,
  type CameraBadgeContainer,
  type CameraBadgeLike,
  type CameraBadgeViewport,
} from "../lib/cameraBadges";

interface CameraBadgeOverlayProps {
  api: any;
  containerRef: RefObject<HTMLDivElement | null>;
  slideId: string;
}

function getBadgeBackgroundColor(color: string) {
  const normalizedColor = color.trim();
  const shortHexMatch = /^#([\da-f]{3})$/i.exec(normalizedColor);
  const fullHexMatch = /^#([\da-f]{6})$/i.exec(normalizedColor);
  const rgbMatch = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)$/i.exec(normalizedColor);
  const alpha = 0.76;

  if (shortHexMatch) {
    const [r, g, b] = shortHexMatch[1].split("").map((value) => Number.parseInt(`${value}${value}`, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  if (fullHexMatch) {
    const hex = fullHexMatch[1];
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return normalizedColor;
}

function buildProjectedBadgeSignature(badges: readonly CameraBadgeLike[]) {
  return badges
    .map((badge) => `${badge.id}:${badge.order}:${badge.left}:${badge.top}:${badge.strokeColor}`)
    .join("|");
}

export function CameraBadgeOverlay({ api, containerRef, slideId }: CameraBadgeOverlayProps) {
  const [badges, setBadges] = useState<CameraBadgeLike[]>([]);
  const camerasRef = useRef<Camera[]>([]);
  const sceneElementsRef = useRef<readonly any[] | null>(null);
  const viewportRef = useRef<CameraBadgeViewport>(extractCameraBadgeViewport(undefined));
  const containerRectRef = useRef<CameraBadgeContainer>({ left: 0, top: 0 });
  const projectedSignatureRef = useRef("");
  const frameRef = useRef<number | null>(null);

  const readContainerRect = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    containerRectRef.current = {
      left: rect?.left ?? 0,
      top: rect?.top ?? 0,
    };
  }, [containerRef]);

  const project = useCallback(() => {
    frameRef.current = null;
    const nextBadges = projectCameraBadges(
      camerasRef.current,
      viewportRef.current,
      containerRectRef.current,
    );
    const nextSignature = buildProjectedBadgeSignature(nextBadges);
    if (nextSignature === projectedSignatureRef.current) return;
    projectedSignatureRef.current = nextSignature;
    setBadges(nextBadges);
  }, []);

  const scheduleProjection = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(project);
  }, [project]);

  useEffect(() => {
    if (!api) return;

    const syncScene = (nextElements: readonly any[], nextAppState: Partial<any>) => {
      if (sceneElementsRef.current !== nextElements) {
        sceneElementsRef.current = nextElements;
        camerasRef.current = extractCameras(nextElements);
      }
      viewportRef.current = extractCameraBadgeViewport(nextAppState);
      scheduleProjection();
    };

    readContainerRect();
    syncScene(api.getSceneElements(), api.getAppState());

    const unsubscribeChange = api.onChange(
      (nextElements: readonly any[], nextAppState: Partial<any>) => {
        syncScene(nextElements, nextAppState);
      },
    );
    const unsubscribeScroll = api.onScrollChange(
      (scrollX: number, scrollY: number, zoom: { value?: number } | number) => {
        viewportRef.current = {
          ...viewportRef.current,
          scrollX,
          scrollY,
          zoom: typeof zoom === "number" ? zoom : zoom?.value ?? 1,
        };
        scheduleProjection();
      },
    );
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          readContainerRect();
          viewportRef.current = extractCameraBadgeViewport(api.getAppState());
          scheduleProjection();
        });

    if (containerRef.current && resizeObserver) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      unsubscribeChange();
      unsubscribeScroll();
      resizeObserver?.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      sceneElementsRef.current = null;
      camerasRef.current = [];
      projectedSignatureRef.current = "";
    };
  }, [api, containerRef, readContainerRect, scheduleProjection, slideId]);

  if (badges.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
    >
      {badges.map((badge) => (
        <div
          key={badge.id}
          className="absolute min-w-6 h-6 px-2 rounded-full border border-white/90 text-white text-xs font-semibold shadow-md flex items-center justify-center"
          style={{
            backgroundColor: getBadgeBackgroundColor(badge.strokeColor),
            left: `${badge.left}px`,
            top: `${badge.top}px`,
            transform: "translate(-28%, -52%)",
          }}
        >
          {badge.order}
        </div>
      ))}
    </div>
  );
}
