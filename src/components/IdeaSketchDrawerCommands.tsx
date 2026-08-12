import {
  CircleHelp,
  Download,
  ImageDown,
  Palette,
  Trash2,
} from "lucide-react";

interface IdeaSketchDrawerCommandsProps {
  ready: boolean;
  readOnly: boolean;
  backgroundColor: string;
  onExportImage: () => void;
  onExportDrawio: () => void;
  onBackgroundChange: (color: string) => void;
  onClearCanvas: () => void;
  onHelp: () => void;
}

const iconProps = { size: 15, strokeWidth: 1.8, "aria-hidden": true } as const;

export function IdeaSketchDrawerCommands({
  ready,
  readOnly,
  backgroundColor,
  onExportImage,
  onExportDrawio,
  onBackgroundChange,
  onClearCanvas,
  onHelp,
}: IdeaSketchDrawerCommandsProps) {
  return (
    <section className="ideanote-ideasketch-drawer-commands" aria-label="Canvas and export actions">
      <h2>Canvas &amp; export</h2>
      <div className="ideanote-ideasketch-drawer-commands__grid">
        <button type="button" disabled={!ready} onClick={onExportImage}>
          <ImageDown {...iconProps} />
          <span>Export image</span>
        </button>
        <button type="button" disabled={!ready} onClick={onExportDrawio}>
          <Download {...iconProps} />
          <span>Export draw.io</span>
        </button>
        <label className={readOnly || !ready ? "is-disabled" : ""}>
          <Palette {...iconProps} />
          <span>Canvas background</span>
          <input
            type="color"
            aria-label="Canvas background color"
            value={backgroundColor}
            disabled={readOnly || !ready}
            onChange={(event) => onBackgroundChange(event.target.value)}
          />
        </label>
        <button type="button" disabled={readOnly || !ready} onClick={onClearCanvas}>
          <Trash2 {...iconProps} />
          <span>Clear canvas</span>
        </button>
        <button type="button" disabled={!ready} onClick={onHelp}>
          <CircleHelp {...iconProps} />
          <span>Help</span>
        </button>
      </div>
    </section>
  );
}
