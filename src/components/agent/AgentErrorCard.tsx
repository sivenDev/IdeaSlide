import { AlertCircle, RotateCcw } from "lucide-react";
import type { AgentError } from "../../lib/agent/protocol";

export function AgentErrorCard({ error, onRetry }: { error: AgentError; onRetry?: () => void }) {
  return (
    <section className="ideanote-agent-error" role="alert">
      <div className="ideanote-agent-item__heading">
        <AlertCircle aria-hidden size={13} />
        <span>Agent could not finish</span>
      </div>
      <p>{error.message}</p>
      {error.recovery && <p className="ideanote-agent-error__recovery">{error.recovery}</p>}
      <div className="ideanote-agent-error__footer">
        {error.diagnosticId && <code>{error.diagnosticId}</code>}
        {error.retryable && onRetry && (
          <button type="button" onClick={onRetry}>
            <RotateCcw aria-hidden size={11} /> Retry
          </button>
        )}
      </div>
    </section>
  );
}
