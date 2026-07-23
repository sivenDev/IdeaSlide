interface SlideCanvasComparableProps {
  slideId: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
  onChange: unknown;
  viewMode?: boolean;
  onApiReady?: unknown;
  editorRefreshToken?: number;
  cameraCount?: number;
  isCameraListOpen?: boolean;
  onToggleCameras?: unknown;
  onStartPreview?: unknown;
  onStartFullscreen?: unknown;
  cameraDrawingRequestToken?: number;
}

export function areSlideCanvasPropsEqual(
  previousProps: SlideCanvasComparableProps,
  nextProps: SlideCanvasComparableProps
) {
  return (
    previousProps.slideId === nextProps.slideId &&
    previousProps.elements === nextProps.elements &&
    previousProps.appState === nextProps.appState &&
    previousProps.files === nextProps.files &&
    previousProps.onChange === nextProps.onChange &&
    previousProps.viewMode === nextProps.viewMode &&
    previousProps.onApiReady === nextProps.onApiReady &&
    previousProps.editorRefreshToken === nextProps.editorRefreshToken &&
    previousProps.cameraCount === nextProps.cameraCount &&
    previousProps.isCameraListOpen === nextProps.isCameraListOpen &&
    previousProps.onToggleCameras === nextProps.onToggleCameras &&
    previousProps.onStartPreview === nextProps.onStartPreview &&
    previousProps.onStartFullscreen === nextProps.onStartFullscreen &&
    previousProps.cameraDrawingRequestToken === nextProps.cameraDrawingRequestToken
  );
}
