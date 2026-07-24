import { Button as ExcalidrawButton } from "@excalidraw/excalidraw";

interface CanvasPresentationControlsProps {
  cameraCount: number;
  isCameraListOpen: boolean;
  onToggleCameras: () => void;
}

export function CanvasPresentationControls({
  cameraCount,
  isCameraListOpen,
  onToggleCameras,
}: CanvasPresentationControlsProps) {
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
    </div>
  );
}
