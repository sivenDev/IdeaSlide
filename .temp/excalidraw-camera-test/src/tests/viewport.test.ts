import { describe, expect, it } from "vitest";
import { calculateViewportTarget } from "../lib/viewport";

function projectScenePoint(
  sceneX: number,
  sceneY: number,
  target: { scrollX: number; scrollY: number; zoom: number }
) {
  return {
    x: (sceneX + target.scrollX) * target.zoom,
    y: (sceneY + target.scrollY) * target.zoom,
  };
}

describe("calculateViewportTarget", () => {
  it("fits a camera inside the viewport using padding", () => {
    const cameraBounds = { x: 100, y: 50, width: 400, height: 200 };
    const target = calculateViewportTarget({
      cameraBounds,
      viewportWidth: 800,
      viewportHeight: 600,
      paddingFactor: 0.9,
    });

    expect(target).toEqual({
      scrollX: -77.77777777777777,
      scrollY: 16.666666666666657,
      zoom: 1.8,
    });
    expect(projectScenePoint(300, 150, target)).toEqual({ x: 400, y: 300 });
  });

  it("uses width as the limiting dimension for wide cameras", () => {
    const target = calculateViewportTarget({
      cameraBounds: { x: 1000, y: 200, width: 800, height: 200 },
      viewportWidth: 1000,
      viewportHeight: 600,
      paddingFactor: 0.8,
    });

    expect(target).toEqual({
      scrollX: -900,
      scrollY: 0,
      zoom: 1,
    });
  });

  it("uses height as the limiting dimension for tall cameras", () => {
    const target = calculateViewportTarget({
      cameraBounds: { x: -300, y: 100, width: 200, height: 900 },
      viewportWidth: 1200,
      viewportHeight: 900,
      paddingFactor: 0.75,
    });

    expect(target).toEqual({
      scrollX: 1000,
      scrollY: 50,
      zoom: 0.75,
    });
  });

  it("adjusts the target when viewport size changes", () => {
    const target = calculateViewportTarget({
      cameraBounds: { x: 50, y: 50, width: 100, height: 100 },
      viewportWidth: 500,
      viewportHeight: 300,
      paddingFactor: 1,
    });

    expect(target).toEqual({
      scrollX: -16.66666666666667,
      scrollY: -50,
      zoom: 3,
    });
  });
});
