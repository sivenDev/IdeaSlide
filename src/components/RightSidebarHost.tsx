import { Bot, LayoutList } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export type RightSidebarSurface = "navigator" | "agent";

export function RightSidebarHost({
  surface,
  agentAvailable,
  navigator,
  agent,
  onSurfaceChange,
}: {
  surface: RightSidebarSurface;
  agentAvailable: boolean;
  navigator: ReactNode;
  agent?: ReactNode;
  onSurfaceChange: (surface: RightSidebarSurface) => void;
}) {
  useEffect(() => {
    if (!agentAvailable && surface === "agent") onSurfaceChange("navigator");
  }, [agentAvailable, onSurfaceChange, surface]);
  const activeSurface = agentAvailable ? surface : "navigator";
  return (
    <aside className="ideanote-right-sidebar" aria-label="Right sidebar">
      <div className="ideanote-right-sidebar__switcher">
        <button type="button" className={activeSurface === "navigator" ? "is-active" : ""} onClick={() => onSurfaceChange("navigator")}>
          <LayoutList aria-hidden size={14} /> Navigator
        </button>
        {agentAvailable && (
          <button type="button" className={activeSurface === "agent" ? "is-active" : ""} onClick={() => onSurfaceChange("agent")}>
            <Bot aria-hidden size={14} /> Agent
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeSurface === "agent" ? agent : navigator}
      </div>
    </aside>
  );
}
