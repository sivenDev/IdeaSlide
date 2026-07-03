interface SlideCanvasComparableProps {
  slideId: string;
  elements: readonly any[];
  appState: Partial<any>;
  files: Record<string, any>;
  onChange: unknown;
  viewMode?: boolean;
  onApiReady?: unknown;
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
    previousProps.onApiReady === nextProps.onApiReady
  );
}
