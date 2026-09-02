export function createCameraPreviewId() {
  return `camera-preview:${globalThis.crypto.randomUUID()}`;
}

interface CameraDrawingApi {
  getSceneElements?: () => readonly any[];
  setActiveTool: (tool: { type: string; customType?: string }) => void;
  updateScene?: (payload: { elements: readonly any[] }) => void;
}

export function enterCameraDrawingMode(api: CameraDrawingApi) {
  api.setActiveTool({ type: "custom", customType: "camera" });
}

export function exitCameraDrawingMode(api: CameraDrawingApi, previewId?: string) {
  const sceneElements = api.getSceneElements?.() ?? [];
  const nextElements = previewId
    ? sceneElements.filter((element: any) => element.id !== previewId)
    : sceneElements;

  if (nextElements.length !== sceneElements.length) {
    api.updateScene?.({
      elements: nextElements,
    });
  }

  api.setActiveTool({ type: "selection" });
}
