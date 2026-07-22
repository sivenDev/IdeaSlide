import type { Slide, WorkspaceResource } from "../types";
import { ErrorBoundary } from "./ErrorBoundary";
import { SlideCanvas } from "./SlideCanvas";
import { getResourceTypeDefinition } from "../lib/resourceTypeRegistry";

interface ResourceEditorHostProps {
  resource: WorkspaceResource;
  slide: Slide;
  onChange: (elements: readonly any[], appState: Partial<any>, files: Record<string, any>) => void;
  onApiReady: (api: any) => void;
  editorRefreshToken: number;
}

export function ResourceEditorHost({
  resource,
  slide,
  onChange,
  onApiReady,
  editorRefreshToken,
}: ResourceEditorHostProps) {
  const definition = getResourceTypeDefinition(resource.type);
  if (definition?.editor === "canvas") {
    return (
      <ErrorBoundary>
        <SlideCanvas
          slideId={slide.id}
          elements={slide.elements}
          appState={slide.appState}
          files={slide.files}
          onChange={onChange}
          onApiReady={onApiReady}
          editorRefreshToken={editorRefreshToken}
        />
      </ErrorBoundary>
    );
  }

  if (definition?.editor === "folder") {
    return (
      <div className="flex h-full items-center justify-center bg-[#f7f7f8] text-center">
        <div className="max-w-sm px-8">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-500">▰</div>
          <h2 className="text-base font-semibold text-gray-800">{resource.name}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">Choose a Canvas inside this folder, or create a new one from the Workspace panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center bg-[#f7f7f8] text-center">
      <div className="max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-gray-800">Unsupported resource</div>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          This build does not have an editor for “{resource.type}”. The resource and its data will be preserved when you save.
        </p>
      </div>
    </div>
  );
}
