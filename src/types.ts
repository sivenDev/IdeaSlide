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
