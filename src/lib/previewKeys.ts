import type { Camera } from "./cameraUtils.ts";
import { buildCameraSignature } from "./cameraThumbnail.ts";
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

export function buildCameraPreviewKey(
  elements: readonly any[],
  files: Record<string, any>,
  cameras: Camera[],
  appState: Partial<any> = {}
) {
  return `camera:${buildSceneFingerprint(elements, files)}::${buildCameraSignature(cameras)}::${buildPreviewAppStateFingerprint(appState)}`;
}
