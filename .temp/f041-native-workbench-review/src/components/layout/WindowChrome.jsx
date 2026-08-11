import { PanelLeft } from "lucide-react";
import { useEffect } from "react";
import { mockWindowApi, windowChromeInsets } from "../../mock/mockWindowApi.js";

export function WindowChrome({ state, workspaceOpen, onToggleWorkspace }) {
  const insets = windowChromeInsets(state);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.metaKey && event.ctrlKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        mockWindowApi.toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
  return (
    <div
      className={`window-chrome window-chrome--${state.platform} ${state.fullscreen ? "is-fullscreen" : "is-windowed"}`}
      data-tauri-drag-region
      data-platform={state.platform}
      data-fullscreen={state.fullscreen ? "true" : "false"}
      title="Control-Command-F toggles the mock fullscreen state"
    >
      {insets.trafficLights && (
        <div className="traffic-lights" aria-hidden="true">
          <span /><span /><button type="button" tabIndex={-1} aria-hidden="true" onClick={(event) => { event.stopPropagation(); mockWindowApi.setFullscreen(true); }} />
        </div>
      )}
      <button
        className="panel-toggle panel-toggle--workspace"
        type="button"
        aria-label={workspaceOpen ? "Hide Workspaces" : "Show Workspaces"}
        aria-pressed={workspaceOpen}
        data-tooltip={workspaceOpen ? "Hide Workspaces" : "Show Workspaces"}
        onDoubleClick={(event) => event.stopPropagation()}
        onClick={onToggleWorkspace}
      >
        <PanelLeft size={16} />
      </button>
    </div>
  );
}
