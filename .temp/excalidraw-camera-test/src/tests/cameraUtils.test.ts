import { describe, expect, it } from "vitest";
import { extractCameras, filterCameraElements } from "../lib/cameraUtils";

function makeElement(overrides: Record<string, unknown> = {}) {
  return {
    id: "element-1",
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    isDeleted: false,
    customData: undefined,
    ...overrides,
  };
}

describe("extractCameras", () => {
  it("extracts only rectangle elements marked as cameras", () => {
    const elements = [
      makeElement({
        id: "camera-1",
        customData: { type: "camera", order: 2 },
      }),
      makeElement({
        id: "ellipse-camera",
        type: "ellipse",
        customData: { type: "camera", order: 1 },
      }),
      makeElement({
        id: "plain-rectangle",
      }),
    ];

    expect(extractCameras(elements)).toEqual([
      {
        id: "camera-1",
        order: 2,
        bounds: { x: 0, y: 0, width: 100, height: 80 },
      },
    ]);
  });

  it("ignores deleted camera elements", () => {
    const elements = [
      makeElement({
        id: "deleted-camera",
        isDeleted: true,
        customData: { type: "camera", order: 1 },
      }),
    ];

    expect(extractCameras(elements)).toEqual([]);
  });

  it("normalizes negative rectangle sizes into positive bounds", () => {
    const elements = [
      makeElement({
        id: "camera-negative",
        x: 300,
        y: 180,
        width: -120,
        height: -60,
        customData: { type: "camera", order: 1 },
      }),
    ];

    expect(extractCameras(elements)).toEqual([
      {
        id: "camera-negative",
        order: 1,
        bounds: { x: 180, y: 120, width: 120, height: 60 },
      },
    ]);
  });

  it("sorts ordered cameras by ascending customData.order", () => {
    const elements = [
      makeElement({
        id: "camera-3",
        customData: { type: "camera", order: 3 },
      }),
      makeElement({
        id: "camera-1",
        customData: { type: "camera", order: 1 },
      }),
      makeElement({
        id: "camera-2",
        customData: { type: "camera", order: 2 },
      }),
    ];

    expect(extractCameras(elements).map((camera) => camera.id)).toEqual([
      "camera-1",
      "camera-2",
      "camera-3",
    ]);
  });

  it("places unordered cameras after ordered cameras while preserving element order", () => {
    const elements = [
      makeElement({
        id: "unordered-1",
        customData: { type: "camera" },
      }),
      makeElement({
        id: "ordered-2",
        customData: { type: "camera", order: 2 },
      }),
      makeElement({
        id: "unordered-2",
        customData: { type: "camera", order: Number.NaN },
      }),
      makeElement({
        id: "ordered-1",
        customData: { type: "camera", order: 1 },
      }),
    ];

    expect(extractCameras(elements).map((camera) => camera.id)).toEqual([
      "ordered-1",
      "ordered-2",
      "unordered-1",
      "unordered-2",
    ]);
  });
});

describe("filterCameraElements", () => {
  it("removes camera rectangles while preserving non-camera elements", () => {
    const elements = [
      makeElement({
        id: "camera-1",
        customData: { type: "camera", order: 1 },
      }),
      makeElement({
        id: "shape-1",
      }),
      makeElement({
        id: "shape-2",
        type: "ellipse",
      }),
    ];

    expect(filterCameraElements(elements).map((element) => element.id)).toEqual([
      "shape-1",
      "shape-2",
    ]);
  });
});
