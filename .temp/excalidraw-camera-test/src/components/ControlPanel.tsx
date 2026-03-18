import type { EasingMode } from "../lib/animateViewport";
import type { Camera, CameraSourceMode, ViewportTarget } from "../lib/types";

interface ControlPanelProps {
  cameraSourceMode: CameraSourceMode;
  cameras: readonly Camera[];
  selectedCameraIndex: number;
  durationMs: number;
  paddingFactor: number;
  easing: EasingMode;
  showCameraBorders: boolean;
  targetViewport: ViewportTarget | null;
  actualViewport: ViewportTarget | null;
  deltas: ViewportTarget | null;
  onSourceModeChange: (mode: CameraSourceMode) => void;
  onSelectCamera: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onReplay: () => void;
  onDurationChange: (durationMs: number) => void;
  onPaddingFactorChange: (paddingFactor: number) => void;
  onEasingChange: (easing: EasingMode) => void;
  onToggleCameraBorders: () => void;
}

function formatViewport(viewport: ViewportTarget | null): string {
  if (!viewport) {
    return "n/a";
  }

  return `x ${viewport.scrollX.toFixed(2)} | y ${viewport.scrollY.toFixed(2)} | z ${viewport.zoom.toFixed(3)}`;
}

export function ControlPanel({
  cameraSourceMode,
  cameras,
  selectedCameraIndex,
  durationMs,
  paddingFactor,
  easing,
  showCameraBorders,
  targetViewport,
  actualViewport,
  deltas,
  onSourceModeChange,
  onSelectCamera,
  onPrevious,
  onNext,
  onReplay,
  onDurationChange,
  onPaddingFactorChange,
  onEasingChange,
  onToggleCameraBorders,
}: ControlPanelProps) {
  return (
    <div className="control-content">
      <section className="control-section">
        <div className="section-label">Camera Source</div>
        <div className="segmented-control">
          <button
            className={cameraSourceMode === "hardcoded" ? "selected" : ""}
            onClick={() => onSourceModeChange("hardcoded")}
          >
            Hardcoded
          </button>
          <button
            className={cameraSourceMode === "element-derived" ? "selected" : ""}
            onClick={() => onSourceModeChange("element-derived")}
          >
            Element-derived
          </button>
        </div>
      </section>

      <section className="control-section">
        <div className="section-label">Playback</div>
        <div className="button-row">
          <button onClick={onPrevious}>Previous</button>
          <button onClick={onReplay}>Replay</button>
          <button onClick={onNext}>Next</button>
        </div>
      </section>

      <section className="control-section">
        <div className="section-label">Parameters</div>
        <label className="field">
          <span>Duration (ms)</span>
          <input
            type="number"
            min={0}
            step={100}
            value={durationMs}
            onChange={(event) => onDurationChange(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Padding factor</span>
          <input
            type="number"
            min={0.1}
            max={1}
            step={0.05}
            value={paddingFactor}
            onChange={(event) => onPaddingFactorChange(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Easing</span>
          <select value={easing} onChange={(event) => onEasingChange(event.target.value as EasingMode)}>
            <option value="ease-in-out">ease-in-out</option>
            <option value="linear">linear</option>
          </select>
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={showCameraBorders} onChange={onToggleCameraBorders} />
          <span>Show camera borders</span>
        </label>
      </section>

      <section className="control-section">
        <div className="section-label">Cameras</div>
        <div className="camera-list">
          {cameras.map((camera, index) => (
            <button
              key={camera.id}
              className={`camera-item ${selectedCameraIndex === index ? "active" : ""}`}
              onClick={() => onSelectCamera(index)}
            >
              <span>Camera {camera.order}</span>
              <small>
                {camera.bounds.width} x {camera.bounds.height}
              </small>
            </button>
          ))}
        </div>
      </section>

      <section className="control-section debug-panel">
        <div className="section-label">Viewport Debug</div>
        <div className="debug-row">
          <span>Target</span>
          <code>{formatViewport(targetViewport)}</code>
        </div>
        <div className="debug-row">
          <span>Actual</span>
          <code>{formatViewport(actualViewport)}</code>
        </div>
        <div className="debug-row">
          <span>Delta</span>
          <code>{formatViewport(deltas)}</code>
        </div>
        <div className="tolerance-note">
          Success target: scrollX &lt;= 1px, scrollY &lt;= 1px, zoom &lt;= 0.01
        </div>
      </section>
    </div>
  );
}
