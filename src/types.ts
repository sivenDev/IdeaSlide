// Use any for Excalidraw types to avoid import issues
export type ExcalidrawFiles = Record<string, any>;

export interface Slide {
  id: string;
  title?: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: ExcalidrawFiles;
}

export interface WorkspaceResource {
  id: string;
  type: string;
  name: string;
  parentId: string | null;
  order: number;
  contentRef?: string;
  [key: string]: unknown;
}

export interface CanvasResourceContent {
  type?: string;
  version?: number;
  elements: readonly any[];
  appState: Partial<any>;
  files: ExcalidrawFiles;
  [key: string]: unknown;
}

export interface WorkspaceDocument {
  resources: WorkspaceResource[];
  contents: Record<string, unknown>;
  activeResourceId: string;
  manifestExtra?: Record<string, unknown>;
}

export interface Presentation {
  slides: Slide[];
  currentSlideIndex: number;
  filePath?: string;
  isDirty: boolean;
}

export interface RecentFile {
  path: string;
  name: string;
  modified: string;
  opened_at: string;
}

export interface FileManifest {
  version: string;
  slideCount: number;
  createdAt: string;
  modifiedAt: string;
}

export type DocumentMode = "workspace" | "standalone";
export type DocumentStatus =
  | "editable"
  | "legacy-protected"
  | "unsupported"
  | "invalid"
  | "missing";

export interface IdeaSketchPage extends Slide {
  title: string;
}

export interface IdeaSketchDocument {
  type: "ideasketch";
  formatVersion: "1.0";
  created: string;
  modified: string;
  pages: IdeaSketchPage[];
}

export type DocumentModel = IdeaSketchDocument;

export interface DocumentSession<TModel = DocumentModel> {
  id: string;
  mode: DocumentMode;
  filePath: string;
  fileType: string;
  status: DocumentStatus;
  model?: TModel;
  isDirty: boolean;
  revision: number;
  protectedVersion?: string;
  message?: string;
}

export interface PersistenceAdapter<TModel = DocumentModel> {
  load(): Promise<TModel>;
  save(model: TModel): Promise<void>;
  saveAs?(model: TModel, path: string): Promise<void>;
}
