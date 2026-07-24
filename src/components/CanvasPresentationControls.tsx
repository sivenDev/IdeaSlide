import { Button as ExcalidrawButton } from "@excalidraw/excalidraw";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";

interface CanvasPresentationControlsProps {
  cameraCount: number;
  isCameraListOpen: boolean;
  onToggleCameras: () => void;
  onStartPreview: () => void;
  onStartFullscreen: () => void;
}

export function CanvasPresentationControls({
  cameraCount,
  isCameraListOpen,
  onToggleCameras,
  onStartPreview,
  onStartFullscreen,
}: CanvasPresentationControlsProps) {
  const hasCameras = cameraCount > 0;

  return (
    <div className="idea-slide-canvas-controls">
      <ExcalidrawButton
        onSelect={onToggleCameras}
        selected={isCameraListOpen}
        aria-label={isCameraListOpen ? "Hide cameras" : "Show cameras"}
        aria-pressed={isCameraListOpen}
        className="idea-slide-canvas-control idea-slide-canvas-control--cameras"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M8 5 9.5 2.8h5L16 5M8 12h8" />
        </svg>
        <span className="idea-slide-canvas-control__label">Cameras</span>
        <span className="idea-slide-canvas-control__count">{cameraCount}</span>
      </ExcalidrawButton>

      <span className="idea-slide-canvas-controls__divider" aria-hidden="true" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ExcalidrawButton
            onSelect={() => undefined}
            aria-label="Present"
            disabled={!hasCameras}
            className="idea-slide-canvas-control idea-slide-canvas-control--present"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 3 13 9-13 9V3Z" />
            </svg>
            <span className="idea-slide-canvas-control__label">Present</span>
            <svg className="idea-slide-canvas-control__chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="m4 6 4 4 4-4" />
            </svg>
          </ExcalidrawButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={onStartPreview}>Preview</DropdownMenuItem>
          <DropdownMenuItem onSelect={onStartFullscreen}>Fullscreen</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
