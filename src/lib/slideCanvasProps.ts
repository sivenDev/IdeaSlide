interface SlideCanvasComparableProps {
  slideId: string;
  pageTitle?: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
  onChange: unknown;
  viewMode?: boolean;
  onApiReady?: unknown;
  onConvertSelection?: unknown;
  onInteractionChange?: unknown;
  editorRefreshToken?: number;
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
    previousProps.onConvertSelection === nextProps.onConvertSelection &&
    previousProps.onInteractionChange === nextProps.onInteractionChange &&
    previousProps.editorRefreshToken === nextProps.editorRefreshToken &&
    previousProps.cameraDrawingRequestToken === nextProps.cameraDrawingRequestToken
  );
}
