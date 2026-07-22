import type { Slide, WorkspaceDocument, WorkspaceResource } from "../types.ts";
import {
  createCanvasContent,
  createInitialWorkspace,
  getDescendantIds,
  getOrderedCanvasResources,
  normalizeSiblingOrders,
  slideToCanvasContent,
} from "./workspaceResources.ts";
import { getResourceTypeDefinition, isRegisteredResourceType } from "./resourceTypeRegistry.ts";

export type TransitionSpeed = "fast" | "medium" | "slow";

export interface SessionState {
  sessionId: string;
  path: string;
  elements: any[];
}

export interface WorkspaceStoreState extends WorkspaceDocument {
  filePath?: string;
  isDirty: boolean;
  presentationMode: "none" | "preview" | "fullscreen";
  currentCameraIndex: number;
  transitionSpeed: TransitionSpeed;
  activeSessions: Map<string, SessionState>;
}

export type WorkspaceStoreAction =
  | { type: "LOAD_WORKSPACE"; payload: { workspace: WorkspaceDocument; filePath?: string } }
  | {
      type: "ADD_RESOURCE";
      payload: { resourceType: "folder" | "canvas"; parentId: string | null; index?: number };
    }
  | { type: "RENAME_RESOURCE"; payload: { resourceId: string; name: string } }
  | {
      type: "MOVE_RESOURCE";
      payload: { resourceId: string; parentId: string | null; index: number };
    }
  | { type: "DELETE_RESOURCE"; payload: { resourceId: string } }
  | { type: "SET_ACTIVE_RESOURCE"; payload: { resourceId: string } }
  | { type: "COMMIT_CANVAS"; payload: { resourceId: string; slide: Slide } }
  | { type: "MARK_SAVED" }
  | { type: "MARK_DIRTY" }
  | { type: "START_PRESENTATION"; payload: { mode: "preview" | "fullscreen" } }
  | { type: "EXIT_PRESENTATION" }
  | { type: "SET_CAMERA_INDEX"; payload: { index: number } }
  | { type: "SET_TRANSITION_SPEED"; payload: { speed: TransitionSpeed } }
  | { type: "SESSION_STARTED"; sessionId: string; path: string }
  | { type: "SESSION_ELEMENTS_UPDATED"; sessionId: string; elements: any[] }
  | { type: "SESSION_ENDED"; sessionId: string };

export function createInitialWorkspaceStoreState(): WorkspaceStoreState {
  return {
    ...createInitialWorkspace(),
    isDirty: false,
    presentationMode: "none",
    currentCameraIndex: 0,
    transitionSpeed: "slow",
    activeSessions: new Map(),
  };
}

function reorderForMove(
  resources: WorkspaceResource[],
  resourceId: string,
  nextParentId: string | null,
  nextIndex: number,
): WorkspaceResource[] {
  const moving = resources.find((resource) => resource.id === resourceId);
  if (!moving) return resources;

  const remaining = resources.filter((resource) => resource.id !== resourceId);
  const oldParentId = moving.parentId;
  const updates = new Map<string, WorkspaceResource>();

  if (oldParentId !== nextParentId) {
    remaining
      .filter((resource) => resource.parentId === oldParentId)
      .sort((left, right) => left.order - right.order)
      .forEach((resource, order) => updates.set(resource.id, { ...resource, order }));
  }

  const nextSiblings = remaining
    .filter((resource) => resource.parentId === nextParentId)
    .sort((left, right) => left.order - right.order);
  nextSiblings.splice(Math.max(0, Math.min(nextIndex, nextSiblings.length)), 0, {
    ...moving,
    parentId: nextParentId,
  });
  nextSiblings.forEach((resource, order) =>
    updates.set(resource.id, { ...resource, parentId: nextParentId, order }),
  );

  return resources.map((resource) => updates.get(resource.id) ?? resource);
}

export function workspaceStoreReducer(
  state: WorkspaceStoreState,
  action: WorkspaceStoreAction,
): WorkspaceStoreState {
  switch (action.type) {
    case "LOAD_WORKSPACE":
      return {
        ...state,
        ...action.payload.workspace,
        filePath: action.payload.filePath,
        isDirty: false,
        presentationMode: "none",
        currentCameraIndex: 0,
      };

    case "ADD_RESOURCE": {
      const parent = action.payload.parentId
        ? state.resources.find((resource) => resource.id === action.payload.parentId)
        : undefined;
      if (action.payload.parentId !== null && parent?.type !== "folder") return state;

      const siblings = state.resources
        .filter((resource) => resource.parentId === action.payload.parentId)
        .sort((left, right) => left.order - right.order);
      const index = Math.max(0, Math.min(action.payload.index ?? siblings.length, siblings.length));
      const id = crypto.randomUUID();
      const definition = getResourceTypeDefinition(action.payload.resourceType);
      if (!definition) return state;
      const resource: WorkspaceResource = {
        id,
        type: action.payload.resourceType,
        name: definition.createName,
        parentId: action.payload.parentId,
        order: index,
        ...(definition.createContentRef(id)
          ? { contentRef: definition.createContentRef(id) }
          : {}),
      };
      const resources = normalizeSiblingOrders([
        ...state.resources.map((item) =>
          item.parentId === resource.parentId && item.order >= index
            ? { ...item, order: item.order + 1 }
            : item,
        ),
        resource,
      ]);
      return {
        ...state,
        resources,
        contents:
          resource.type === "canvas"
            ? { ...state.contents, [id]: createCanvasContent() }
            : state.contents,
        activeResourceId: id,
        isDirty: true,
      };
    }

    case "RENAME_RESOURCE": {
      const name = action.payload.name.trim();
      if (!name) return state;
      const resource = state.resources.find((item) => item.id === action.payload.resourceId);
      if (!resource || !isRegisteredResourceType(resource.type) || resource.name === name) return state;
      return {
        ...state,
        resources: state.resources.map((item) =>
          item.id === action.payload.resourceId ? { ...item, name } : item,
        ),
        isDirty: true,
      };
    }

    case "MOVE_RESOURCE": {
      const resource = state.resources.find((item) => item.id === action.payload.resourceId);
      const parent = action.payload.parentId
        ? state.resources.find((item) => item.id === action.payload.parentId)
        : undefined;
      if (
        !resource ||
        !isRegisteredResourceType(resource.type) ||
        (action.payload.parentId !== null && parent?.type !== "folder")
      ) return state;
      const descendants = getDescendantIds(state.resources, resource.id);
      if (action.payload.parentId === resource.id || descendants.has(action.payload.parentId ?? "")) {
        return state;
      }
      const resources = reorderForMove(
        state.resources,
        resource.id,
        action.payload.parentId,
        action.payload.index,
      );
      if (resources === state.resources) return state;
      return { ...state, resources, isDirty: true };
    }

    case "DELETE_RESOURCE": {
      const resource = state.resources.find((item) => item.id === action.payload.resourceId);
      if (!resource || !isRegisteredResourceType(resource.type)) return state;
      const deletedIds = getDescendantIds(state.resources, resource.id);
      deletedIds.add(resource.id);
      const deletedResources = state.resources.filter((item) => deletedIds.has(item.id));
      if (deletedResources.some((item) => !isRegisteredResourceType(item.type))) return state;

      const deletedCanvasCount = deletedResources.filter((item) => item.type === "canvas").length;
      const totalCanvasCount = state.resources.filter((item) => item.type === "canvas").length;
      if (totalCanvasCount - deletedCanvasCount < 1) return state;

      const resources = normalizeSiblingOrders(
        state.resources.filter((item) => !deletedIds.has(item.id)),
      );
      const contents = { ...state.contents };
      for (const id of deletedIds) delete contents[id];
      const activeResourceId = deletedIds.has(state.activeResourceId)
        ? getOrderedCanvasResources(resources)[0]?.id ?? state.activeResourceId
        : state.activeResourceId;
      return { ...state, resources, contents, activeResourceId, isDirty: true };
    }

    case "SET_ACTIVE_RESOURCE":
      if (!state.resources.some((resource) => resource.id === action.payload.resourceId)) return state;
      return {
        ...state,
        activeResourceId: action.payload.resourceId,
        currentCameraIndex: 0,
      };

    case "COMMIT_CANVAS": {
      const resource = state.resources.find(
        (item) => item.id === action.payload.resourceId && item.type === "canvas",
      );
      if (!resource) return state;
      return {
        ...state,
        contents: {
          ...state.contents,
          [resource.id]: {
            ...((state.contents[resource.id] as Record<string, unknown> | undefined) ?? {}),
            ...slideToCanvasContent(action.payload.slide),
          },
        },
        isDirty: true,
      };
    }

    case "MARK_SAVED":
      return state.isDirty ? { ...state, isDirty: false } : state;
    case "MARK_DIRTY":
      return state.isDirty ? state : { ...state, isDirty: true };
    case "START_PRESENTATION":
      return { ...state, presentationMode: action.payload.mode, currentCameraIndex: 0 };
    case "EXIT_PRESENTATION":
      return { ...state, presentationMode: "none", currentCameraIndex: 0 };
    case "SET_CAMERA_INDEX":
      return { ...state, currentCameraIndex: action.payload.index };
    case "SET_TRANSITION_SPEED":
      return { ...state, transitionSpeed: action.payload.speed };

    case "SESSION_STARTED": {
      const activeSessions = new Map(state.activeSessions);
      activeSessions.set(action.sessionId, {
        sessionId: action.sessionId,
        path: action.path,
        elements: [],
      });
      return { ...state, activeSessions };
    }
    case "SESSION_ELEMENTS_UPDATED": {
      const session = state.activeSessions.get(action.sessionId);
      if (!session) return state;
      const activeSessions = new Map(state.activeSessions);
      activeSessions.set(action.sessionId, { ...session, elements: action.elements });
      return { ...state, activeSessions };
    }
    case "SESSION_ENDED": {
      const activeSessions = new Map(state.activeSessions);
      activeSessions.delete(action.sessionId);
      return { ...state, activeSessions };
    }
    default:
      return state;
  }
}
