import type { ViewportTarget } from "./types";

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

interface AnimationHandle {
  cancel: () => void;
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

  function animateTo(target: ViewportTarget, options: AnimationOptions): AnimationHandle {
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

    return {
      cancel: () => {
        if (token === activeToken) {
          cancelActiveAnimation();
        }
      },
    };
  }

  return {
    animateTo,
    cancel: cancelActiveAnimation,
  };
}
