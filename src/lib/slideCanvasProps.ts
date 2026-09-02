interface SlideCanvasComparableProps {
  slideId: string;
  pageTitle?: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
  onChange: unknown;
  viewMode?: boolean;
  onApiReady?: unknown;
  onCommandApiReady?: unknown;
  onConvertSelection?: unknown;
  onSelectionPresenceChange?: unknown;
  onInteractionChange?: unknown;
  onNativeInteractionChange?: unknown;
  onCameraPreviewChange?: unknown;
  editorRefreshToken?: number;
  layoutRefreshToken?: number;
  cameraDrawingRequestToken?: number;
}

export function areSlideCanvasPropsEqual(
  previousProps: SlideCanvasComparableProps,
  nextProps: SlideCanvasComparableProps
) {
  return (
    previousProps.slideId === nextProps.slideId &&
    previousProps.pageTitle === nextProps.pageTitle &&
    previousProps.elements === nextProps.elements &&
    previousProps.appState === nextProps.appState &&
    previousProps.files === nextProps.files &&
    previousProps.onChange === nextProps.onChange &&
    previousProps.viewMode === nextProps.viewMode &&
    previousProps.onApiReady === nextProps.onApiReady &&
    previousProps.onCommandApiReady === nextProps.onCommandApiReady &&
    previousProps.onConvertSelection === nextProps.onConvertSelection &&
    previousProps.onSelectionPresenceChange === nextProps.onSelectionPresenceChange &&
    previousProps.onInteractionChange === nextProps.onInteractionChange &&
    previousProps.onNativeInteractionChange === nextProps.onNativeInteractionChange &&
    previousProps.onCameraPreviewChange === nextProps.onCameraPreviewChange &&
    previousProps.editorRefreshToken === nextProps.editorRefreshToken &&
    previousProps.layoutRefreshToken === nextProps.layoutRefreshToken &&
    previousProps.cameraDrawingRequestToken === nextProps.cameraDrawingRequestToken
  );
}
