import type { Slide } from "../types";
import { extractPersistedAppState } from "./editorSession.ts";
import { buildSceneFingerprint } from "./sceneFingerprint.ts";

interface AutoSaveTriggerInput {
  filePath?: string;
  slides: Slide[];
  isDirty: boolean;
  debounceMs: number;
}

function buildSlidesSignature(slides: Slide[]) {
  return slides
    .map((slide) =>
      [
        slide.id,
        buildSceneFingerprint(slide.elements, slide.files),
        JSON.stringify(extractPersistedAppState(slide.appState)),
      ].join("::"),
    )
    .join("|");
}

export function buildAutoSaveTriggerKey({
  filePath,
  slides,
  isDirty,
  debounceMs,
}: AutoSaveTriggerInput) {
  return JSON.stringify({
    filePath: filePath ?? "",
    isDirty,
    debounceMs,
    slides: buildSlidesSignature(slides),
  });
}
