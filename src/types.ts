// Use any for Excalidraw types to avoid import issues
export interface Slide {
  id: string;
  elements: readonly any[];
  appState: Partial<any>;
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
  lastOpened: number;
}

export interface FileManifest {
  version: string;
  slideCount: number;
  createdAt: string;
  modifiedAt: string;
}
