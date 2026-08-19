import { FileInput } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/Tooltip";

const iconProps = { "aria-hidden": true, size: 13, strokeWidth: 1.9 } as const;

export function ImportMenu({
  onImportExcalidraw,
  disabled = false,
  label = "Import",
}: {
  onImportExcalidraw: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ideanote-tree-action"
                aria-label={label}
                disabled={disabled}
              >
                <FileInput {...iconProps} />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="ideanote-compact-menu">
          <DropdownMenuItem onSelect={onImportExcalidraw}>
            <FileInput {...iconProps} />
            Import Excalidraw
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
