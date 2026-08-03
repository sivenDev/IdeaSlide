import type { DocumentModel, IdeaSketchDocument } from "../types";
import {
  createEmptyIdeaSketchDocument,
  parseIdeaSketchFile,
  serializeIdeaSketchDocument,
  type IdeaSketchFileData,
} from "./ideaSketchDocument.ts";

export interface FileTypeDefinition<TModel extends DocumentModel = DocumentModel> {
  type: string;
  displayName: string;
  extensions: string[];
  icon: string;
  editor: string;
  creatable: boolean;
  openable: boolean;
  createEmpty(options?: Record<string, string>): Promise<TModel>;
  parse(data: unknown): Promise<TModel>;
  serialize(model: TModel, modified?: string): Promise<unknown>;
}

const IDEA_SKETCH_DEFINITION: FileTypeDefinition<IdeaSketchDocument> = {
  type: "ideasketch",
  displayName: "IdeaSketch",
  extensions: ["is"],
  icon: "canvas",
  editor: "ideasketch",
  creatable: true,
  openable: true,
  async createEmpty(options = {}) {
    return createEmptyIdeaSketchDocument(options);
  },
  async parse(data) {
    return parseIdeaSketchFile(data);
  },
  async serialize(model, modified) {
    return serializeIdeaSketchDocument(model, modified) satisfies IdeaSketchFileData;
  },
};

const FILE_TYPE_REGISTRY = new Map<string, FileTypeDefinition>([
  [IDEA_SKETCH_DEFINITION.type, IDEA_SKETCH_DEFINITION as FileTypeDefinition],
]);

export function getFileTypeDefinition(type: string): FileTypeDefinition | undefined {
  return FILE_TYPE_REGISTRY.get(type);
}

export function getFileTypeDefinitionByPath(filePath: string): FileTypeDefinition | undefined {
  const fileName = filePath.replace(/\\/g, "/").split("/").pop() ?? "";
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0 || dotIndex === fileName.length - 1) return undefined;
  const extension = fileName.slice(dotIndex + 1).toLowerCase();
  return Array.from(FILE_TYPE_REGISTRY.values()).find((definition) =>
    definition.extensions.some((candidate) => candidate.toLowerCase() === extension)
  );
}

export function getCreatableFileTypeDefinitions(): FileTypeDefinition[] {
  return Array.from(FILE_TYPE_REGISTRY.values()).filter((definition) => definition.creatable);
}

export function getOpenableFileTypeDefinitions(): FileTypeDefinition[] {
  return Array.from(FILE_TYPE_REGISTRY.values()).filter((definition) => definition.openable);
}
