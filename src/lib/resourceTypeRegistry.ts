export type ResourceIconKind = "folder" | "canvas" | "file";
export type ResourceEditorKind = "folder" | "canvas";

export interface ResourceTypeDefinition {
  type: string;
  label: string;
  icon: ResourceIconKind;
  editor: ResourceEditorKind;
  participatesInPresentation: boolean;
  createInResourceMenu: boolean;
  createName: string;
  createContentRef: (id: string) => string | undefined;
}

const RESOURCE_TYPE_REGISTRY = new Map<string, ResourceTypeDefinition>([
  [
    "folder",
    {
      type: "folder",
      label: "Folder",
      icon: "folder",
      editor: "folder",
      participatesInPresentation: false,
      createInResourceMenu: false,
      createName: "New folder",
      createContentRef: () => undefined,
    },
  ],
  [
    "canvas",
    {
      type: "canvas",
      label: "Canvas",
      icon: "canvas",
      editor: "canvas",
      participatesInPresentation: true,
      createInResourceMenu: true,
      createName: "Untitled canvas",
      createContentRef: (id) => `canvases/${id}.json`,
    },
  ],
]);

export function getResourceTypeDefinition(type: string): ResourceTypeDefinition | undefined {
  return RESOURCE_TYPE_REGISTRY.get(type);
}

export function isRegisteredResourceType(type: string): boolean {
  return RESOURCE_TYPE_REGISTRY.has(type);
}

export function getCreatableResourceTypeDefinitions(): ResourceTypeDefinition[] {
  return Array.from(RESOURCE_TYPE_REGISTRY.values()).filter(
    (definition) => definition.createInResourceMenu,
  );
}
