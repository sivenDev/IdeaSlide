import type { Camera } from "./cameraUtils.ts";
import { buildCameraCollectionSignature } from "./cameraUtils.ts";
import { buildSceneFingerprint } from "./sceneFingerprint.ts";

export interface CameraPreviewState {
  sceneFingerprint: string;
  cameraSignature: string;
  background: string;
}

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

export function buildCameraPreviewKey(state: CameraPreviewState) {
  return `camera:${state.sceneFingerprint}::${state.cameraSignature}::${state.background}`;
}

export function buildLiveCameraPreviewState(
  elements: readonly any[],
  files: Record<string, any>,
  cameras: Camera[],
  appState: Partial<any> = {}
): CameraPreviewState {
  return {
    sceneFingerprint: buildSceneFingerprint(elements, files),
    cameraSignature: buildCameraCollectionSignature(cameras),
    background: buildPreviewAppStateFingerprint(appState),
  };
}

export function buildLiveCameraRenderKey(
  elements: readonly any[],
  files: Record<string, any>,
  cameras: Camera[],
  appState: Partial<any> = {}
) {
  return buildCameraPreviewKey(
    buildLiveCameraPreviewState(elements, files, cameras, appState)
  );
}
