import { Activity, Circle, History, Plus, Settings2 } from "lucide-react";
import type { AgentCapabilities } from "../../lib/agent/protocol";

export function AgentThreadHeader({
  title,
  runtimeLabel,
  runtimeDiagnostic,
  modelLabel,
  capabilities,
  running,
  historyOpen,
  inspectorOpen,
  statusLabel,
  onNewThread,
  onToggleHistory,
  onToggleInspector,
  onOpenSettings,
}: {
  title: string;
  runtimeLabel: string;
  runtimeDiagnostic?: string;
  modelLabel: string;
  capabilities: AgentCapabilities;
  running: boolean;
  historyOpen: boolean;
  inspectorOpen: boolean;
  statusLabel: string;
  onNewThread: () => void;
  onToggleHistory: () => void;
  onToggleInspector: () => void;
  onOpenSettings: () => void;
}) {
  const capabilityLabel = capabilities.plans || capabilities.toolEvents
    ? "Rich activity"
    : capabilities.textStreaming
      ? "Live text"
      : "Basic text";
  return (
    <header className="ideanote-agent-thread-header">
      <div className="min-w-0 flex-1">
        <div className="ideanote-agent-thread-header__title" title={title}>{title}</div>
        <div className="ideanote-agent-thread-header__meta" aria-live="polite">
          <Circle className={running ? "is-running" : ""} aria-hidden fill="currentColor" size={6} />
          <span title={runtimeDiagnostic}>{running ? `Working · ${runtimeLabel}` : runtimeLabel}</span>
          <span aria-hidden>·</span>
          <span title={modelLabel}>{modelLabel}</span>
          <span aria-hidden>·</span>
          <span>{capabilityLabel}</span>
          <span aria-hidden>·</span>
          <span>{statusLabel}</span>
        </div>
      </div>
      <div className="ideanote-agent-thread-header__actions">
        <button type="button" onClick={onNewThread} disabled={running} aria-label="Create new Agent Thread">
          <Plus aria-hidden size={13} />
        </button>
        <button
          type="button"
          onClick={onToggleHistory}
          aria-label="Open Agent Thread history"
          aria-expanded={historyOpen}
        >
          <History aria-hidden size={13} />
        </button>
        <button
          type="button"
          onClick={onToggleInspector}
          aria-label="Open Agent runtime inspector"
          aria-expanded={inspectorOpen}
        >
          <Activity aria-hidden size={13} />
        </button>
        <button type="button" onClick={onOpenSettings} aria-label="Open Agent settings">
          <Settings2 aria-hidden size={13} />
        </button>
      </div>
    </header>
  );
}
