import type { IdeaSketchDocument, IdeaSketchPage } from "../../types.ts";
import { canonicalStringify } from "./canonicalDigest.ts";
import type {
  IdeaSketchNativeInteractionReason,
  IdeaSketchSdkHostScene,
} from "./host.ts";

const PERSISTENT_APP_STATE_KEYS = Object.freeze([
  "viewBackgroundColor",
  "gridSize",
] as const);

interface IdeaSketchSceneApi {
  getSceneElementsIncludingDeleted(): readonly unknown[];
  getAppState(): Partial<Record<string, unknown>>;
  getFiles(): Record<string, unknown>;
  updateScene(input: {
    elements: readonly unknown[];
    appState?: Partial<Record<string, unknown>>;
    captureUpdate: unknown;
    onCommit?: () => void;
  }): void;
}

declare const nativeActionTokenBrand: unique symbol;

export type IdeaSketchNativeActionToken = number & {
  readonly [nativeActionTokenBrand]: true;
};

export interface IdeaSketchNativeActionOwnership {
  begin(): IdeaSketchNativeActionToken;
  settle(token: IdeaSketchNativeActionToken): boolean;
  clear(): boolean;
  isActive(): boolean;
}

export interface IdeaSketchSceneCommitSettlement {
  promise: Promise<void>;
  acknowledge(): boolean;
  cancel(): boolean;
}

export interface IdeaSketchSceneCommitSettlements {
  begin(): IdeaSketchSceneCommitSettlement;
  clear(error?: Error): boolean;
}

export function createIdeaSketchSceneCommitSettlements(): IdeaSketchSceneCommitSettlements {
  let nextToken = 0;
  const pending = new Map<number, {
    resolve: () => void;
    reject: (error: Error) => void;
  }>();

  return {
    begin() {
      nextToken += 1;
      const token = nextToken;
      let resolvePromise!: () => void;
      let rejectPromise!: (error: Error) => void;
      const promise = new Promise<void>((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      });
      pending.set(token, { resolve: resolvePromise, reject: rejectPromise });
      return {
        promise,
        acknowledge() {
          const settlement = pending.get(token);
          if (!settlement) return false;
          pending.delete(token);
          settlement.resolve();
          return true;
        },
        cancel() {
          return pending.delete(token);
        },
      };
    },
    clear(error = new Error("The mounted IdeaSketch scene changed before its commit settled.")) {
      if (pending.size === 0) return false;
      const settlements = [...pending.values()];
      pending.clear();
      for (const settlement of settlements) settlement.reject(error);
      return true;
    },
  };
}

export function createIdeaSketchNativeActionOwnership(): IdeaSketchNativeActionOwnership {
  let nextToken = 0;
  const activeTokens = new Set<IdeaSketchNativeActionToken>();

  return {
    begin() {
      nextToken += 1;
      const token = nextToken as IdeaSketchNativeActionToken;
      activeTokens.add(token);
      return token;
    },
    settle(token) {
      if (!activeTokens.delete(token)) return false;
      return activeTokens.size === 0;
    },
    clear() {
      if (activeTokens.size === 0) return false;
      activeTokens.clear();
      return true;
    },
    isActive() {
      return activeTokens.size > 0;
    },
  };
}

export function excludeCameraPreview(
  elements: readonly unknown[],
  activeCameraPreviewId?: string,
) {
  if (!activeCameraPreviewId) return elements;
  return elements.filter((element) => !(
    typeof element === "object"
    && element !== null
    && (element as { id?: unknown }).id === activeCameraPreviewId
  ));
}

export function captureIdeaSketchHostScene(input: {
  api?: IdeaSketchSceneApi;
  page: IdeaSketchPage;
  activeCameraPreviewId?: string;
}): IdeaSketchSdkHostScene {
  if (!input.api) {
    return {
      elements: excludeCameraPreview(input.page.elements, input.activeCameraPreviewId),
      appState: input.page.appState,
      files: input.page.files,
    };
  }
  return {
    elements: excludeCameraPreview(
      input.api.getSceneElementsIncludingDeleted(),
      input.activeCameraPreviewId,
    ),
    appState: input.api.getAppState(),
    files: input.api.getFiles(),
  };
}

export function mergeActiveSceneIntoDocument(input: {
  document: IdeaSketchDocument;
  activePageId: string;
  scene: IdeaSketchSdkHostScene;
  mounted: boolean;
}): IdeaSketchDocument {
  if (!input.mounted) return input.document;
  return {
    ...input.document,
    pages: input.document.pages.map((page) => (
      page.id === input.activePageId ? { ...page, ...input.scene } : page
    )),
  };
}

export function deriveLiveNativeInteractionReasons(
  trackedReasons: readonly IdeaSketchNativeInteractionReason[],
  appState: Partial<Record<string, unknown>>,
) {
  const reasons = new Set(trackedReasons);
  if (appState.editingTextElement) reasons.add("text");
  if (
    appState.selectedElementsAreBeingDragged
    || appState.isResizing
    || appState.isRotating
    || appState.multiElement
    || appState.selectionElement
  ) {
    reasons.add("pointer");
  }
  return [...reasons].sort();
}

function persistentAppStatePatch(
  current: Partial<Record<string, unknown>>,
  next: Partial<Record<string, unknown>>,
) {
  const patch: Partial<Record<string, unknown>> = {};
  for (const key of PERSISTENT_APP_STATE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) continue;
    if (canonicalStringify(current[key] ?? null) === canonicalStringify(next[key] ?? null)) continue;
    patch[key] = next[key];
  }
  return patch;
}

export function commitIdeaSketchHostScene(input: {
  api: IdeaSketchSceneApi;
  currentScene: IdeaSketchSdkHostScene;
  nextScene: IdeaSketchSdkHostScene;
  captureUpdate: unknown;
  activeCameraPreviewId?: string;
  onCommit?: () => void;
}) {
  if (canonicalStringify(input.currentScene.files) !== canonicalStringify(input.nextScene.files)) {
    throw new Error("IdeaSketch scene transactions cannot modify files.");
  }
  const appState = persistentAppStatePatch(
    input.currentScene.appState,
    input.nextScene.appState,
  );
  input.api.updateScene({
    elements: excludeCameraPreview(input.nextScene.elements, input.activeCameraPreviewId),
    ...(Object.keys(appState).length > 0 ? { appState } : {}),
    captureUpdate: input.captureUpdate,
    ...(input.onCommit ? { onCommit: input.onCommit } : {}),
  });
}
