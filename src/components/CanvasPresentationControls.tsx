import { Button as ExcalidrawButton } from "@excalidraw/excalidraw";
import { PanelRight, Scan } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/Tooltip";

interface CanvasPresentationControlsProps {
  isNavigatorOpen: boolean;
  onToggleNavigator: () => void;
  onAddCamera?: () => void;
}

export function CanvasPresentationControls({
  isNavigatorOpen,
  onToggleNavigator,
  onAddCamera,
}: CanvasPresentationControlsProps) {
  const navigatorTooltip = isNavigatorOpen ? "Hide navigator" : "Show navigator";

  return (
    <TooltipProvider>
      <div className="idea-slide-canvas-controls">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="idea-slide-canvas-control-tooltip-trigger">
              <ExcalidrawButton
                onSelect={onToggleNavigator}
                selected={isNavigatorOpen}
                aria-label={navigatorTooltip}
                aria-pressed={isNavigatorOpen}
                className="idea-slide-canvas-control idea-slide-canvas-control--navigator"
              >
                <PanelRight aria-hidden="true" />
              </ExcalidrawButton>
            </span>
          </TooltipTrigger>
          <TooltipContent>{navigatorTooltip}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="idea-slide-canvas-control-tooltip-trigger">
              <ExcalidrawButton
                onSelect={onAddCamera ?? (() => undefined)}
                disabled={!onAddCamera}
                aria-label="Add camera"
                className="idea-slide-canvas-control idea-slide-canvas-control--camera"
              >
                <Scan aria-hidden="true" />
              </ExcalidrawButton>
            </span>
          </TooltipTrigger>
          <TooltipContent>Add camera</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
