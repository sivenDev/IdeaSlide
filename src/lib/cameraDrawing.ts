export const CAMERA_PREVIEW_ID = "camera-preview";

interface CameraDrawingApi {
  getSceneElements?: () => readonly any[];
  setActiveTool: (tool: { type: string; customType?: string }) => void;
  updateScene?: (payload: { elements: readonly any[] }) => void;
}

export function enterCameraDrawingMode(api: CameraDrawingApi) {
  api.setActiveTool({ type: "custom", customType: "camera" });
}

export function exitCameraDrawingMode(api: CameraDrawingApi) {
  const sceneElements = api.getSceneElements?.() ?? [];
  const nextElements = sceneElements.filter((element: any) => element.id !== CAMERA_PREVIEW_ID);

  if (nextElements.length !== sceneElements.length) {
    api.updateScene?.({
      elements: nextElements,
    });
  }

  api.setActiveTool({ type: "selection" });
}
