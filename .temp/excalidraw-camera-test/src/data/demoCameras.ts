import type { Camera } from "../lib/types";

export const demoCameras: Camera[] = [
  {
    id: "hardcoded-camera-1",
    order: 1,
    bounds: { x: 80, y: 80, width: 500, height: 320 },
  },
  {
    id: "hardcoded-camera-2",
    order: 2,
    bounds: { x: 1280, y: 140, width: 500, height: 320 },
  },
  {
    id: "hardcoded-camera-3",
    order: 3,
    bounds: { x: 620, y: 820, width: 440, height: 320 },
  },
  {
    id: "hardcoded-camera-4",
    order: 4,
    bounds: { x: 160, y: 120, width: 260, height: 180 },
  },
];
