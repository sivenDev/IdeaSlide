import { Brain, ChevronDown } from "lucide-react";
import { AgentMarkdown } from "./AgentMarkdown";

export function AgentReasoningSummary({ content, running }: { content: string; running: boolean }) {
  return (
    <details className="ideanote-agent-reasoning" open={running}>
      <summary>
        <Brain aria-hidden size={13} />
        <span>Reasoning summary</span>
        <ChevronDown className="ideanote-agent-disclosure-chevron" aria-hidden size={13} />
      </summary>
      <div className="ideanote-agent-reasoning__content">
        <AgentMarkdown content={content || "Waiting for a summary…"} />
      </div>
    </details>
  );
}
