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

export interface IdeaSketchInternalSceneCommitRecord {
  requestId?: string;
  pageRef?: string;
  operationKinds: readonly string[];
  affectedRefs: readonly string[];
}

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

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

/**
 * Reconcile the SDK adapter's canonical scene with Excalidraw's native
 * normalization without allowing native restore to rewrite unrelated
 * elements or discard persistent tombstones. `restoreElements()` is allowed
 * to repair the changed closure, while unchanged entries remain byte-for-byte
 * identical to the canonical scene supplied by the SDK transaction.
 */
export function mergeIdeaSketchNativeNormalizedElements(input: {
  currentElements: readonly unknown[];
  nextElements: readonly unknown[];
  normalizedElements: readonly unknown[];
}): readonly unknown[] {
  const currentById = new Map<string, unknown>();
  for (const element of input.currentElements) {
    const id = record(element)?.id;
    if (typeof id === "string") currentById.set(id, element);
  }

  const normalizedById = new Map<string, unknown>();
  for (const element of input.normalizedElements) {
    const id = record(element)?.id;
    if (typeof id !== "string") continue;
    if (normalizedById.has(id)) throw new Error(`Native Excalidraw normalization produced duplicate id: ${id}.`);
    normalizedById.set(id, element);
  }

  return input.nextElements.map((element) => {
    const item = record(element);
    const id = item?.id;
    if (typeof id !== "string") return element;
    const current = currentById.get(id);
    const changed = current === undefined || canonicalStringify(current) !== canonicalStringify(element);
    if (!changed) return element;

    const normalized = normalizedById.get(id);
    if (normalized !== undefined) {
      const normalizedId = record(normalized)?.id;
      if (normalizedId !== id) throw new Error(`Native Excalidraw normalization changed element id ${id}.`);
      return normalized;
    }

    // Excalidraw intentionally filters invisible elements. A canonical SDK
    // tombstone is still part of the persistent .is scene and must survive
    // that filter; a live element being silently omitted is unsafe.
    if (item?.isDeleted === true) return element;
    throw new Error(`Native Excalidraw normalization omitted live element ${id}.`);
  });
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
  // Scene operations normally preserve selection. Deletion/clear is the
  // intentional exception: forward only the cleaned selection delta so the
  // mounted Excalidraw appState cannot retain tombstoned ids.
  if (Object.prototype.hasOwnProperty.call(next, "selectedElementIds")
    && canonicalStringify(current.selectedElementIds ?? null) !== canonicalStringify(next.selectedElementIds ?? null)) {
    patch.selectedElementIds = next.selectedElementIds;
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
  onSceneCommitRecord?: (record: IdeaSketchInternalSceneCommitRecord) => void;
  sceneCommitRecord?: IdeaSketchInternalSceneCommitRecord;
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
  if (input.sceneCommitRecord) input.onSceneCommitRecord?.(input.sceneCommitRecord);
}
