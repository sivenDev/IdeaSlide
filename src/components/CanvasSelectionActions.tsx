import { FilePlus2, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import type { StyleConversionTarget } from "../lib/excalidrawStyleConversion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";
import { ToolbarAction } from "./ui/ToolbarAction";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/Tooltip";

interface CanvasSelectionActionsProps {
  onConvert: (target: StyleConversionTarget) => void;
}

export function CanvasSelectionActions({ onConvert }: CanvasSelectionActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="idea-slide-canvas-selection-actions">
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <Tooltip open={open ? false : undefined}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <ToolbarAction
                  aria-label="Convert style"
                  className="idea-slide-canvas-selection-actions__trigger"
                  variant="secondary"
                >
                  <Sparkles aria-hidden="true" size={15} />
                  <span>Convert style</span>
                </ToolbarAction>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Convert selected elements</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => onConvert("new-page")}>
              <FilePlus2 aria-hidden="true" size={15} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span>New Page</span>
                <span className="text-[11px] text-gray-400">Recommended · keep source</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onConvert("current-page")}>
              <RefreshCw aria-hidden="true" size={15} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span>Current Page</span>
                <span className="text-[11px] text-gray-400">Replace selection · Undo available</span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}
