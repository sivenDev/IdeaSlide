import { Check, LoaderCircle, Wrench, X } from "lucide-react";
import type { AgentToolItem } from "../../lib/agent/protocol";

export function AgentToolActivity({ item }: { item: AgentToolItem }) {
  const hasDetails = item.input !== undefined || item.output !== undefined;
  return (
    <details className={`ideanote-agent-tool-activity is-${item.status}`}>
      <summary>
        <Wrench aria-hidden size={13} />
        <div className="min-w-0 flex-1">
          <div className="ideanote-agent-tool-activity__name">{item.name.replace(/_/g, " ")}</div>
          {item.summary && <div className="ideanote-agent-tool-activity__summary">{item.summary}</div>}
        </div>
        {item.status === "running" && <LoaderCircle className="ideanote-agent-spin" aria-label="Running" size={12} />}
        {item.status === "completed" && <Check aria-label="Completed" size={12} />}
        {(item.status === "failed" || item.status === "cancelled") && <X aria-label={item.status} size={12} />}
      </summary>
      {hasDetails && (
        <div className="ideanote-agent-tool-activity__details">
          {item.input !== undefined && <pre><strong>Input</strong>{JSON.stringify(item.input, null, 2)}</pre>}
          {item.output !== undefined && <pre><strong>Result</strong>{JSON.stringify(item.output, null, 2)}</pre>}
        </div>
      )}
    </details>
  );
}
