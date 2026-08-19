import {
  Download,
  FileJson,
  ImageDown,
  Package,
  Palette,
  Trash2,
  Upload,
} from "lucide-react";

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
  return (
    <section className="ideanote-ideasketch-drawer-commands" aria-label="Page and Canvas actions">
      <div className="ideanote-ideasketch-drawer-commands__grid">
        <button type="button" disabled={readOnly} onClick={onImportExcalidraw}>
          <Upload {...iconProps} />
          <span>Import Excalidraw</span>
        </button>
        <button type="button" disabled={!ready} onClick={onExportExcalidraw}>
          <FileJson {...iconProps} />
          <span>Export Excalidraw</span>
        </button>
        <button type="button" disabled={!ready} onClick={onExportIdeaSketch}>
          <Package {...iconProps} />
          <span>Export .is</span>
        </button>
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
      </div>
    </section>
  );
}
