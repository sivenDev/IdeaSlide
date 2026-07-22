import type {
  CanvasResourceContent,
  Slide,
  WorkspaceDocument,
  WorkspaceResource,
} from "../types.ts";
import { getResourceTypeDefinition } from "./resourceTypeRegistry.ts";

export const CURRENT_WORKSPACE_FORMAT_VERSION = "2.0";

export function createCanvasContent(): CanvasResourceContent {
  return {
    type: "excalidraw",
    version: 2,
    elements: [],
    appState: {},
    files: {},
  };
}

export function createInitialWorkspace(): WorkspaceDocument {
  const id = crypto.randomUUID();
  const canvasType = getResourceTypeDefinition("canvas")!;
  return {
    resources: [
      {
        id,
        type: "canvas",
        name: canvasType.createName,
        parentId: null,
        order: 0,
        contentRef: canvasType.createContentRef(id),
      },
    ],
    contents: { [id]: createCanvasContent() },
    activeResourceId: id,
    manifestExtra: {},
  };
}

export function validateWorkspaceResources(resources: WorkspaceResource[]): void {
  const byId = new Map<string, WorkspaceResource>();
  const siblingOrders = new Set<string>();

  for (const resource of resources) {
    if (!resource.id || byId.has(resource.id)) {
      throw new Error(`Duplicate or empty workspace resource id: ${resource.id}`);
    }
    byId.set(resource.id, resource);
    const siblingKey = `${resource.parentId ?? "root"}:${resource.order}`;
    if (siblingOrders.has(siblingKey)) {
      throw new Error(`Duplicate sibling order for ${resource.id}`);
    }
    siblingOrders.add(siblingKey);
  }

  if (!resources.some((resource) => resource.type === "canvas")) {
    throw new Error("A workspace must contain at least one canvas");
  }

  for (const resource of resources) {
    if (resource.parentId !== null) {
      const parent = byId.get(resource.parentId);
      if (!parent) {
        throw new Error(`Missing parent ${resource.parentId}`);
      }
      if (parent.type !== "folder") {
        throw new Error(`Resource parent must be a folder: ${resource.parentId}`);
      }
    }

    const definition = getResourceTypeDefinition(resource.type);
    if (definition?.editor === "folder" && resource.contentRef !== undefined) {
      throw new Error(`Folder ${resource.id} cannot have content`);
    }
    if (
      definition?.editor === "canvas" &&
      resource.contentRef !== `canvases/${resource.id}.json`
    ) {
      throw new Error(`Canvas ${resource.id} has an invalid contentRef`);
    }

    const visited = new Set<string>([resource.id]);
    let parentId = resource.parentId;
    while (parentId !== null) {
      if (visited.has(parentId)) {
        throw new Error(`Workspace resource cycle includes ${parentId}`);
      }
      visited.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
  }
}

function compareResources(left: WorkspaceResource, right: WorkspaceResource): number {
  return left.order - right.order || left.id.localeCompare(right.id);
}

export function getOrderedWorkspaceResources(
  resources: WorkspaceResource[],
): WorkspaceResource[] {
  validateWorkspaceResources(resources);
  const children = new Map<string | null, WorkspaceResource[]>();
  for (const resource of resources) {
    const siblings = children.get(resource.parentId) ?? [];
    siblings.push(resource);
    children.set(resource.parentId, siblings);
  }
  for (const siblings of children.values()) {
    siblings.sort(compareResources);
  }

  const ordered: WorkspaceResource[] = [];
  const visit = (parentId: string | null) => {
    for (const resource of children.get(parentId) ?? []) {
      ordered.push(resource);
      visit(resource.id);
    }
  };
  visit(null);
  return ordered;
}

export function getOrderedCanvasResources(
  resources: WorkspaceResource[],
): WorkspaceResource[] {
  return getOrderedWorkspaceResources(resources).filter(
    (resource) => getResourceTypeDefinition(resource.type)?.participatesInPresentation,
  );
}

export function getDescendantIds(
  resources: WorkspaceResource[],
  resourceId: string,
): Set<string> {
  const descendants = new Set<string>();
  const visit = (parentId: string) => {
    for (const resource of resources) {
      if (resource.parentId === parentId && !descendants.has(resource.id)) {
        descendants.add(resource.id);
        visit(resource.id);
      }
    }
  };
  visit(resourceId);
  return descendants;
}

export function normalizeSiblingOrders(
  resources: WorkspaceResource[],
): WorkspaceResource[] {
  const byParent = new Map<string | null, WorkspaceResource[]>();
  for (const resource of resources) {
    const siblings = byParent.get(resource.parentId) ?? [];
    siblings.push(resource);
    byParent.set(resource.parentId, siblings);
  }

  const orderById = new Map<string, number>();
  for (const siblings of byParent.values()) {
    siblings.sort(compareResources);
    siblings.forEach((resource, order) => orderById.set(resource.id, order));
  }

  return resources.map((resource) => ({
    ...resource,
    order: orderById.get(resource.id) ?? resource.order,
  }));
}

export function getCanvasContent(
  workspace: Pick<WorkspaceDocument, "contents">,
  resourceId: string,
): CanvasResourceContent {
  const content = workspace.contents[resourceId] as Partial<CanvasResourceContent> | undefined;
  return {
    ...(content ?? {}),
    type: typeof content?.type === "string" ? content.type : "excalidraw",
    version: typeof content?.version === "number" ? content.version : 2,
    elements: Array.isArray(content?.elements) ? content.elements : [],
    appState: content?.appState ?? {},
    files: content?.files ?? {},
  };
}

export function canvasContentToSlide(
  workspace: Pick<WorkspaceDocument, "contents">,
  resource: WorkspaceResource,
): Slide {
  const content = getCanvasContent(workspace, resource.id);
  return {
    id: resource.id,
    title: resource.name,
    elements: content.elements,
    appState: content.appState,
    files: content.files,
  };
}

export function slideToCanvasContent(slide: Slide): CanvasResourceContent {
  return {
    type: "excalidraw",
    version: 2,
    elements: slide.elements,
    appState: slide.appState,
    files: slide.files,
  };
}

export function projectWorkspaceToSlides(workspace: WorkspaceDocument): Slide[] {
  return getOrderedCanvasResources(workspace.resources).map((resource) =>
    canvasContentToSlide(workspace, resource),
  );
}
