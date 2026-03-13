// Use any for Excalidraw types to avoid import issues
export type ExcalidrawFiles = Record<string, any>;

export interface Slide {
  id: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: ExcalidrawFiles;
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
}

export interface FileManifest {
  version: string;
  slideCount: number;
  createdAt: string;
  modifiedAt: string;
}
