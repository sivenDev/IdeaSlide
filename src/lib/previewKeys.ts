import { buildSceneFingerprint } from "./sceneFingerprint.ts";

export function extractPreviewAppState(appState: Partial<any> | undefined) {
  return {
    viewBackgroundColor: appState?.viewBackgroundColor ?? "#ffffff",
  };
}

function buildPreviewAppStateFingerprint(appState: Partial<any> | undefined) {
  return JSON.stringify(extractPreviewAppState(appState));
}

export function buildSlidePreviewKey(
  elements: readonly any[],
  files: Record<string, any>,
  appState: Partial<any> = {}
) {
  return `slide:${buildSceneFingerprint(elements, files)}::${buildPreviewAppStateFingerprint(appState)}`;
}

export interface CameraPreviewState {
  cameraSignature: string;
  background: string;
}

export function buildCameraPreviewKey(state: CameraPreviewState) {
  return `camera:${state.cameraSignature}::${state.background}`;
}
