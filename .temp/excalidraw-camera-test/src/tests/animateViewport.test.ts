import { describe, expect, it } from "vitest";
import { createViewportAnimator } from "../lib/animateViewport";
import type { ViewportTarget } from "../lib/types";

class FakeScheduler {
  private nextId = 1;
  private callbacks = new Map<number, (time: number) => void>();

  requestFrame(callback: (time: number) => void): number {
    const id = this.nextId++;
    this.callbacks.set(id, callback);
    return id;
  }

  cancelFrame(id: number): void {
    this.callbacks.delete(id);
  }

  step(time: number): void {
    const callbacks = [...this.callbacks.entries()];
    this.callbacks.clear();

    for (const [, callback] of callbacks) {
      callback(time);
    }
  }
}

describe("createViewportAnimator", () => {
  it("updates towards the target over scheduled frames", () => {
    const scheduler = new FakeScheduler();
    let current: ViewportTarget = { scrollX: 0, scrollY: 0, zoom: 1 };
    const updates: ViewportTarget[] = [];

    const animator = createViewportAnimator({
      scheduler,
      getCurrentViewport: () => current,
      onUpdate: (next) => {
        current = next;
        updates.push(next);
      },
    });

    animator.animateTo(
      { scrollX: 100, scrollY: 50, zoom: 2 },
      { durationMs: 1000, easing: "linear" }
    );

    scheduler.step(0);
    scheduler.step(500);
    scheduler.step(1000);

    expect(updates.at(-1)).toEqual({ scrollX: 100, scrollY: 50, zoom: 2 });
  });

  it("cancels the first animation when a second one starts", () => {
    const scheduler = new FakeScheduler();
    let current: ViewportTarget = { scrollX: 0, scrollY: 0, zoom: 1 };
    const updates: ViewportTarget[] = [];

    const animator = createViewportAnimator({
      scheduler,
      getCurrentViewport: () => current,
      onUpdate: (next) => {
        current = next;
        updates.push(next);
      },
    });

    animator.animateTo(
      { scrollX: 100, scrollY: 0, zoom: 2 },
      { durationMs: 1000, easing: "linear" }
    );

    scheduler.step(0);
    scheduler.step(400);

    animator.animateTo(
      { scrollX: -50, scrollY: 25, zoom: 0.5 },
      { durationMs: 600, easing: "linear" }
    );

    scheduler.step(400);
    scheduler.step(700);
    scheduler.step(1000);

    expect(updates.at(-1)).toEqual({ scrollX: -50, scrollY: 25, zoom: 0.5 });
  });

  it("ignores stale frames after cancellation", () => {
    const scheduler = new FakeScheduler();
    let current: ViewportTarget = { scrollX: 0, scrollY: 0, zoom: 1 };

    const animator = createViewportAnimator({
      scheduler,
      getCurrentViewport: () => current,
      onUpdate: (next) => {
        current = next;
      },
    });

    const firstRun = animator.animateTo(
      { scrollX: 80, scrollY: 20, zoom: 1.4 },
      { durationMs: 1000, easing: "linear" }
    );

    scheduler.step(0);
    scheduler.step(250);
    firstRun.cancel();
    scheduler.step(500);

    expect(current).toEqual({ scrollX: 20, scrollY: 5, zoom: 1.1 });
  });
});
