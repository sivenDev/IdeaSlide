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

const controlClassName =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white/95 px-3 text-sm font-medium text-gray-700 shadow-sm backdrop-blur transition-colors hover:border-gray-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:pointer-events-none disabled:opacity-45";

export function CanvasPresentationControls({
  cameraCount,
  isCameraListOpen,
  onToggleCameras,
  onStartPreview,
  onStartFullscreen,
}: CanvasPresentationControlsProps) {
  const hasCameras = cameraCount > 0;

  return (
    <div className="mr-2 flex items-center gap-2">
      <button
        type="button"
        aria-label={isCameraListOpen ? "Hide cameras" : "Show cameras"}
        aria-pressed={isCameraListOpen}
        onClick={onToggleCameras}
        className={controlClassName}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M8 5 9.5 2.8h5L16 5M8 12h8" />
        </svg>
        Cameras {cameraCount}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Present"
            disabled={!hasCameras}
            className={`${controlClassName} border-blue-500 bg-blue-500 text-white hover:border-blue-600 hover:bg-blue-600`}
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
              <path d="m6 3 13 9-13 9V3Z" />
            </svg>
            Present
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="m4 6 4 4 4-4" />
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={onStartPreview}>Preview</DropdownMenuItem>
          <DropdownMenuItem onSelect={onStartFullscreen}>Fullscreen</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
