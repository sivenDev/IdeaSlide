import {
  buildIdeaSketchOperation,
  validateOperationPlan,
  type IdeaSketchOperationLimits,
  type IdeaSketchOperationKind,
} from "./operationSchemas.ts";
import type {
  IdeaSketchOperationBuilder,
  IdeaSketchOperationInput,
  IdeaSketchOperationOf,
  IdeaSketchOperationsNamespace,
  SdkSyncResult,
} from "./types.ts";

export type OperationBuilder<K extends IdeaSketchOperationKind = IdeaSketchOperationKind> = (
  input: IdeaSketchOperationInput<K>,
) => SdkSyncResult<IdeaSketchOperationOf<K>>;

export function createOperationBuilder<K extends IdeaSketchOperationKind>(
  kind: K,
  limits: Partial<IdeaSketchOperationLimits> = {},
): IdeaSketchOperationBuilder<K> {
  return (input) => buildIdeaSketchOperation(kind, input, limits);
}

export function createOperationsNamespace(
  limits: Partial<IdeaSketchOperationLimits> = {},
): IdeaSketchOperationsNamespace {
  const scene = <K extends IdeaSketchOperationKind>(kind: K) => createOperationBuilder(kind, limits);
  const page = <K extends IdeaSketchOperationKind>(kind: K) => createOperationBuilder(kind, limits);
  return {
    page: {
      add: page("add-page"),
      import: page("import-page"),
      duplicate: page("duplicate-page"),
      rename: page("rename-page"),
      reorder: page("reorder-page"),
      delete: page("delete-page"),
      createFromSelection: page("create-page-from-selection"),
    },
    element: {
      move: scene("move-element"),
      resize: scene("resize-element"),
      delete: scene("delete-element"),
    },
    shape: {
      create: scene("create-shape"),
      setStyle: scene("set-shape-style"),
      upsertBoundText: scene("upsert-bound-text"),
    },
    connector: {
      create: scene("create-arrow"),
      bind: scene("bind-arrow"),
      unbind: scene("unbind-arrow"),
      setStyle: scene("set-connector-style"),
      setArrowheads: scene("set-arrowheads"),
      setPoints: scene("set-connector-points"),
    },
    text: {
      create: scene("create-text"),
      bind: scene("bind-text"),
      unbind: scene("unbind-text"),
      setContent: scene("set-text"),
      setStyle: scene("set-text-style"),
      setLayout: scene("set-text-layout"),
    },
    camera: {
      create: scene("create-camera"),
      updateBounds: scene("update-camera-bounds"),
      reorder: scene("set-camera-order"),
      delete: scene("delete-camera"),
    },
    appearance: { setBackground: scene("set-background") },
    transform: { applyStylePreset: scene("apply-style-preset") },
    scene: { clear: scene("clear-scene") },
  };
}

export type OperationFactory<K extends IdeaSketchOperationKind> = (
  input: IdeaSketchOperationInput<K>,
  limits?: Partial<IdeaSketchOperationLimits>,
) => SdkSyncResult<IdeaSketchOperationOf<K>>;

const factory = <K extends IdeaSketchOperationKind>(kind: K): OperationFactory<K> => (
  input,
  limits,
) => buildIdeaSketchOperation(kind, input, limits);

export const addPage = factory("add-page");
export const importPage = factory("import-page");
export const duplicatePage = factory("duplicate-page");
export const renamePage = factory("rename-page");
export const reorderPage = factory("reorder-page");
export const deletePage = factory("delete-page");
export const createPageFromSelection = factory("create-page-from-selection");
export const createShape = factory("create-shape");
export const createArrow = factory("create-arrow");
export const createText = factory("create-text");
export const createCamera = factory("create-camera");
export const bindArrow = factory("bind-arrow");
export const unbindArrow = factory("unbind-arrow");
export const bindText = factory("bind-text");
export const unbindText = factory("unbind-text");
export const upsertBoundText = factory("upsert-bound-text");
export const setText = factory("set-text");
export const setTextStyle = factory("set-text-style");
export const setTextLayout = factory("set-text-layout");
export const setShapeStyle = factory("set-shape-style");
export const setConnectorStyle = factory("set-connector-style");
export const setArrowheads = factory("set-arrowheads");
export const moveElement = factory("move-element");
export const resizeElement = factory("resize-element");
export const setConnectorPoints = factory("set-connector-points");
export const updateCameraBounds = factory("update-camera-bounds");
export const reorderCameras = factory("set-camera-order");
export const deleteElement = factory("delete-element");
export const deleteCamera = factory("delete-camera");
export const setBackground = factory("set-background");
export const applyStylePreset = factory("apply-style-preset");
export const clearScene = factory("clear-scene");

export { buildIdeaSketchOperation, validateOperationPlan };
