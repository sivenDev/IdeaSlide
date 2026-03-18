export interface CameraBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportTarget {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

export type EasingMode = "linear" | "ease-in-out";

interface Scheduler {
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(id: number): void;
}

interface AnimatorOptions {
  scheduler?: Scheduler;
  getCurrentViewport: () => ViewportTarget;
  onUpdate: (next: ViewportTarget) => void;
}

interface AnimationOptions {
  durationMs: number;
  easing: EasingMode;
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function getEasedProgress(progress: number, easing: EasingMode): number {
  if (easing === "ease-in-out") {
    return progress < 0.5
      ? 2 * progress * progress
      : -1 + (4 - 2 * progress) * progress;
  }

  return progress;
}

const browserScheduler: Scheduler = {
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
};

export function calculateViewportTarget({
  cameraBounds,
  viewportWidth,
  viewportHeight,
  paddingFactor,
}: {
  cameraBounds: CameraBounds;
  viewportWidth: number;
  viewportHeight: number;
  paddingFactor: number;
}): ViewportTarget {
  const zoomX = (viewportWidth * paddingFactor) / cameraBounds.width;
  const zoomY = (viewportHeight * paddingFactor) / cameraBounds.height;
  const zoom = Math.min(zoomX, zoomY);
  const centerX = cameraBounds.x + cameraBounds.width / 2;
  const centerY = cameraBounds.y + cameraBounds.height / 2;

  return {
    scrollX: viewportWidth / (2 * zoom) - centerX,
    scrollY: viewportHeight / (2 * zoom) - centerY,
    zoom,
  };
}

export function createViewportAnimator({
  scheduler = browserScheduler,
  getCurrentViewport,
  onUpdate,
}: AnimatorOptions) {
  let activeToken = 0;
  let activeFrameId: number | null = null;

  function cancelActiveAnimation() {
    activeToken += 1;

    if (activeFrameId !== null) {
      scheduler.cancelFrame(activeFrameId);
      activeFrameId = null;
    }
  }

  function animateTo(target: ViewportTarget, options: AnimationOptions) {
    cancelActiveAnimation();

    const token = activeToken;
    const start = getCurrentViewport();
    let startTime: number | null = null;

    const step = (time: number) => {
      if (token !== activeToken) {
        return;
      }

      if (startTime === null) {
        startTime = time;
      }

      const elapsed = time - startTime;
      const rawProgress = options.durationMs <= 0 ? 1 : Math.min(elapsed / options.durationMs, 1);
      const progress = getEasedProgress(rawProgress, options.easing);

      onUpdate({
        scrollX: interpolate(start.scrollX, target.scrollX, progress),
        scrollY: interpolate(start.scrollY, target.scrollY, progress),
        zoom: interpolate(start.zoom, target.zoom, progress),
      });

      if (rawProgress < 1) {
        activeFrameId = scheduler.requestFrame(step);
      } else {
        activeFrameId = null;
      }
    };

    activeFrameId = scheduler.requestFrame(step);
  }

  return {
    animateTo,
    cancel: cancelActiveAnimation,
  };
}
