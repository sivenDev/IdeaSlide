import { Circle, Settings2 } from "lucide-react";
import type { AgentCapabilities } from "../../lib/agent/protocol";

export function AgentThreadHeader({
  title,
  runtimeLabel,
  capabilities,
  running,
  onOpenSettings,
}: {
  title: string;
  runtimeLabel: string;
  capabilities: AgentCapabilities;
  running: boolean;
  onOpenSettings: () => void;
}) {
  const capabilityLabel = capabilities.reasoningSummary ? "Reasoning summaries" : "Text activity";
  return (
    <header className="ideanote-agent-thread-header">
      <div className="min-w-0 flex-1">
        <div className="ideanote-agent-thread-header__title" title={title}>{title}</div>
        <div className="ideanote-agent-thread-header__meta">
          <Circle className={running ? "is-running" : ""} aria-hidden fill="currentColor" size={6} />
          <span>{running ? "Working" : runtimeLabel}</span>
          <span aria-hidden>·</span>
          <span>{capabilityLabel}</span>
        </div>
      </div>
      <button type="button" onClick={onOpenSettings} aria-label="Open Agent settings">
        <Settings2 aria-hidden size={13} />
      </button>
    </header>
  );
}
