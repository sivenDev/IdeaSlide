import { describe, expect, it } from "vitest";
import { demoCameras } from "../data/demoCameras";
import { demoSceneElements } from "../data/demoScene";
import { extractCameras } from "../lib/cameraUtils";

function expectNestedCamera(child: { x: number; y: number; width: number; height: number }) {
  const parent = demoCameras[0].bounds;

  expect(child.x).toBeGreaterThanOrEqual(parent.x);
  expect(child.y).toBeGreaterThanOrEqual(parent.y);
  expect(child.x + child.width).toBeLessThanOrEqual(parent.x + parent.width);
  expect(child.y + child.height).toBeLessThanOrEqual(parent.y + parent.height);
}

describe("demo camera data", () => {
  it("adds a fourth hardcoded camera nested inside camera 1", () => {
    expect(demoCameras).toHaveLength(4);

    const camera4 = demoCameras.find((camera) => camera.order === 4);
    expect(camera4).toBeDefined();
    expectNestedCamera(camera4!.bounds);
  });

  it("adds the same fourth camera to the element-derived scene", () => {
    const extracted = extractCameras(demoSceneElements);

    expect(extracted).toHaveLength(4);

    const camera4 = extracted.find((camera) => camera.order === 4);
    expect(camera4).toBeDefined();
    expectNestedCamera(camera4!.bounds);
    expect(camera4!.bounds).toEqual(demoCameras[3].bounds);
  });
});
