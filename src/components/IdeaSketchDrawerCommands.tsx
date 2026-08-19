import { useId, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileJson,
  ImageDown,
  type LucideIcon,
  Package,
  Palette,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/Tooltip";

interface IdeaSketchDrawerCommandsProps {
  ready: boolean;
  readOnly: boolean;
  backgroundColor: string;
  onImportExcalidraw: () => void;
  onExportExcalidraw: () => void;
  onExportIdeaSketch: () => void;
  onExportImage: () => void;
  onExportDrawio: () => void;
  onBackgroundChange: (color: string) => void;
  onClearCanvas: () => void;
}

const iconProps = { size: 15, strokeWidth: 1.8, "aria-hidden": true } as const;

interface CommandRowProps {
  icon: LucideIcon;
  label: string;
  description: string;
  disabled: boolean;
  onClick: () => void;
}

function CommandRow({
  icon: Icon,
  label,
  description,
  disabled,
  onClick,
}: CommandRowProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="ideanote-ideasketch-drawer-commands__row"
          disabled={disabled}
          onClick={onClick}
        >
          <Icon {...iconProps} />
          <span>{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{description}</TooltipContent>
    </Tooltip>
  );
}

export function IdeaSketchDrawerCommands({
  ready,
  readOnly,
  backgroundColor,
  onImportExcalidraw,
  onExportExcalidraw,
  onExportIdeaSketch,
  onExportImage,
  onExportDrawio,
  onBackgroundChange,
  onClearCanvas,
}: IdeaSketchDrawerCommandsProps) {
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  const backgroundDisabled = readOnly || !ready;
  return (
    <TooltipProvider>
      <section
        className={`ideanote-ideasketch-drawer-commands${
          expanded ? " is-expanded" : ""
        }`}
        aria-label="Page and Canvas actions"
      >
        <button
          type="button"
          className="ideanote-ideasketch-drawer-commands__toggle"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((value) => !value)}
        >
          <span className="ideanote-ideasketch-drawer-commands__toggle-label">
            Actions
          </span>
          {expanded ? (
            <ChevronDown size={14} strokeWidth={2} aria-hidden />
          ) : (
            <ChevronUp size={14} strokeWidth={2} aria-hidden />
          )}
        </button>
        {expanded && (
          <div id={bodyId} className="ideanote-ideasketch-drawer-commands__body">
            <div
              className="ideanote-ideasketch-drawer-commands__group"
              role="group"
              aria-label="Page"
            >
              <p
                className="ideanote-ideasketch-drawer-commands__group-title"
                aria-hidden
              >
                Page
              </p>
              <div className="ideanote-ideasketch-drawer-commands__list">
                <CommandRow
                  icon={Upload}
                  label="Import Excalidraw"
                  description="Import an Excalidraw scene as a new Page in this document."
                  disabled={readOnly}
                  onClick={onImportExcalidraw}
                />
                <CommandRow
                  icon={FileJson}
                  label="Export Excalidraw"
                  description="Export the current Page as an editable Excalidraw scene (.excalidraw)."
                  disabled={!ready}
                  onClick={onExportExcalidraw}
                />
                <CommandRow
                  icon={Package}
                  label="Export .is"
                  description="Export the current Page as a standalone .is document."
                  disabled={!ready}
                  onClick={onExportIdeaSketch}
                />
                <CommandRow
                  icon={ImageDown}
                  label="Export image"
                  description="Export the current Page as a PNG or SVG image."
                  disabled={!ready}
                  onClick={onExportImage}
                />
                <CommandRow
                  icon={Download}
                  label="Export draw.io"
                  description="Export the current Page as an editable draw.io diagram."
                  disabled={!ready}
                  onClick={onExportDrawio}
                />
              </div>
            </div>

            <div
              className="ideanote-ideasketch-drawer-commands__group"
              role="group"
              aria-label="Canvas"
            >
              <p
                className="ideanote-ideasketch-drawer-commands__group-title"
                aria-hidden
              >
                Canvas
              </p>
              <div className="ideanote-ideasketch-drawer-commands__list">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <label
                      className={`ideanote-ideasketch-drawer-commands__row ideanote-ideasketch-drawer-commands__row--color${
                        backgroundDisabled ? " is-disabled" : ""
                      }`}
                    >
                      <Palette {...iconProps} />
                      <span>Canvas background</span>
                      <span
                        className="ideanote-ideasketch-drawer-commands__swatch"
                        style={{ backgroundColor }}
                        aria-hidden
                      />
                      <input
                        type="color"
                        aria-label="Canvas background color"
                        value={backgroundColor}
                        disabled={backgroundDisabled}
                        onChange={(event) => onBackgroundChange(event.target.value)}
                      />
                    </label>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Change the Canvas background color.
                  </TooltipContent>
                </Tooltip>
                <CommandRow
                  icon={Trash2}
                  label="Clear canvas"
                  description="Remove every element from the current Page."
                  disabled={readOnly || !ready}
                  onClick={onClearCanvas}
                />
              </div>
            </div>
          </div>
        )}
      </section>
    </TooltipProvider>
  );
}
