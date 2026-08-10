import { AlertTriangle, CheckCircle2, Gauge, History, Info, RotateCcw } from "lucide-react";
import { selectAgentDiagnosticView } from "../../lib/agent/agentDiagnostics";
import type { AgentThreadState } from "../../lib/agent/protocol";
import type { AgentPolicySettings } from "../../lib/agent/types";

function tokenCount(value?: number): string {
  return value === undefined ? "Unavailable" : new Intl.NumberFormat().format(value);
}

export function AgentRuntimeInspector({
  state,
  policy,
  running,
  onNewThread,
}: {
  state: AgentThreadState;
  policy: AgentPolicySettings;
  running: boolean;
  onNewThread: () => void;
}) {
  const latestTurn = state.thread.turns[state.thread.turns.length - 1];
  const effectivePolicy = latestTurn?.effectivePolicy ?? { ...policy, capturedAt: 0 };
  const view = selectAgentDiagnosticView(state, effectivePolicy);
  const telemetry = latestTurn?.telemetry;
  const capabilityLabels = [
    state.capabilities.textStreaming && "Streaming text",
    state.capabilities.toolEvents && "Tool events",
    state.capabilities.plans && "Plans",
    state.capabilities.cancellation && "Cancellation",
    state.capabilities.steering && "Steering",
    state.capabilities.persistence && "History",
  ].filter(Boolean).join(" · ");
  const StatusIcon = view.state === "healthy"
    ? CheckCircle2
    : view.state === "approaching-limit" || view.state === "high-pressure"
      ? AlertTriangle
      : Info;

  return (
    <aside className="ideanote-agent-inspector" aria-label="Agent runtime inspector">
      <div className={`ideanote-agent-inspector__status is-${view.state}`} role="status">
        <StatusIcon aria-hidden size={14} />
        <div>
          <strong>{view.label}</strong>
          <span>{view.detail}</span>
        </div>
        {view.recommendNewThread && (
          <button type="button" onClick={onNewThread} disabled={running}>New Thread</button>
        )}
      </div>

      <section>
        <h3><Gauge aria-hidden size={13} /> Runtime</h3>
        <dl>
          <div><dt>Effective runtime</dt><dd>{state.runtime.label}</dd></div>
          <div><dt>Model</dt><dd>{state.runtime.model || "Unavailable"}</dd></div>
          <div><dt>Health</dt><dd>{state.runtime.health ?? "unknown"}</dd></div>
          <div><dt>Capabilities</dt><dd>{capabilityLabels || "Basic text"}</dd></div>
        </dl>
      </section>

      <section>
        <h3><History aria-hidden size={13} /> Context</h3>
        <dl>
          <div><dt>Exact usage</dt><dd>{view.usedPercent === undefined ? "Unavailable" : `${view.usedPercent}%`}</dd></div>
          <div><dt>Total tokens</dt><dd>{tokenCount(state.context.total?.totalTokens)}</dd></div>
          <div><dt>Last Turn</dt><dd>{tokenCount(state.context.last?.totalTokens)}</dd></div>
          <div><dt>Context window</dt><dd>{tokenCount(state.context.modelContextWindow)}</dd></div>
        </dl>
        {state.context.runtimeCompactedAt && (
          <p className="ideanote-agent-inspector__note">Runtime compaction occurred during {state.context.runtimeCompactedTurnId ?? "this Thread"}.</p>
        )}
        {state.context.localReplayTruncatedBeforeTurnId && (
          <p className="ideanote-agent-inspector__note">Compatibility requests replay messages only from {state.context.localReplayTruncatedBeforeTurnId} onward. Visible history is retained.</p>
        )}
      </section>

      <section>
        <h3><RotateCcw aria-hidden size={13} /> Effective Turn policy</h3>
        <dl>
          <div><dt>Maximum steps</dt><dd>{effectivePolicy.maxSteps}</dd></div>
          <div><dt>Warning / New Thread</dt><dd>{effectivePolicy.contextWarningPercent}% / {effectivePolicy.newThreadPercent}%</dd></div>
          <div><dt>Compatibility replay</dt><dd>{effectivePolicy.compatibilityReplayMessageLimit} messages</dd></div>
          <div><dt>Diagnostics retained</dt><dd>{effectivePolicy.diagnosticRetention}</dd></div>
        </dl>
      </section>

      {effectivePolicy.showDeliveryTelemetry && telemetry && (
        <section>
          <h3>Source delivery</h3>
          <dl>
            <div><dt>Behavior</dt><dd>{telemetry.behavior}</dd></div>
            <div><dt>First text</dt><dd>{telemetry.firstTextMs === undefined ? "Unavailable" : `${telemetry.firstTextMs} ms`}</dd></div>
            <div><dt>Text deltas</dt><dd>{telemetry.textDeltaCount}</dd></div>
            <div><dt>Total duration</dt><dd>{telemetry.totalMs} ms</dd></div>
          </dl>
        </section>
      )}

      <section>
        <h3>Runtime diagnostics</h3>
        {state.runtimeDiagnostics.length === 0 ? (
          <p className="ideanote-agent-inspector__empty">No runtime diagnostics recorded.</p>
        ) : (
          <ol className="ideanote-agent-inspector__diagnostics">
            {[...state.runtimeDiagnostics].reverse().map((diagnostic) => (
              <li key={diagnostic.id} className={`is-${diagnostic.severity}`}>
                <strong>{diagnostic.message}</strong>
                <span>{diagnostic.category} · {diagnostic.code}</span>
                {diagnostic.recovery && <p>{diagnostic.recovery}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </aside>
  );
}
