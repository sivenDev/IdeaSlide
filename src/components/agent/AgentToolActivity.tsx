import { Check, LoaderCircle, Wrench, X } from "lucide-react";
import type { AgentToolItem } from "../../lib/agent/protocol";

export function AgentToolActivity({ item }: { item: AgentToolItem }) {
  return (
    <div className={`ideanote-agent-tool-activity is-${item.status}`}>
      <Wrench aria-hidden size={13} />
      <div className="min-w-0 flex-1">
        <div className="ideanote-agent-tool-activity__name">{item.name}</div>
        {item.summary && <div className="ideanote-agent-tool-activity__summary">{item.summary}</div>}
      </div>
      {item.status === "running" && <LoaderCircle className="ideanote-agent-spin" aria-label="Running" size={12} />}
      {item.status === "completed" && <Check aria-label="Completed" size={12} />}
      {(item.status === "failed" || item.status === "cancelled") && <X aria-label={item.status} size={12} />}
    </div>
  );
}
