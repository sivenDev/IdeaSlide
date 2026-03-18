export interface CameraBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Camera {
  id: string;
  order: number;
  bounds: CameraBounds;
}

export interface ViewportTarget {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

export type CameraSourceMode = "hardcoded" | "element-derived";

export interface CameraElementLike {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
  customData?: {
    type?: string;
    order?: number;
  };
}
