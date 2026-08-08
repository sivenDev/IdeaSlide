import { CheckCircle2, CircleEllipsis, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { AgentChangeReviewItem, AgentItem as AgentItemModel } from "../../lib/agent/protocol";
import { AgentErrorCard } from "./AgentErrorCard";
import { AgentMarkdown } from "./AgentMarkdown";
import { AgentPlan } from "./AgentPlan";
import { AgentReasoningSummary } from "./AgentReasoningSummary";
import { AgentToolActivity } from "./AgentToolActivity";

export function AgentItem({
  item,
  showToolActivity,
  onRetry,
  renderChangeReview,
}: {
  item: AgentItemModel;
  showToolActivity: boolean;
  onRetry?: () => void;
  renderChangeReview: (item: AgentChangeReviewItem) => ReactNode;
}) {
  switch (item.kind) {
    case "message":
      if (!item.content && item.status === "running") {
        return (
          <div className="ideanote-agent-waiting" role="status">
            <CircleEllipsis aria-hidden size={14} /> Waiting for the model
          </div>
        );
      }
      if (!item.content) return null;
      return item.role === "user" ? (
        <div className="ideanote-agent-message is-user">{item.content}</div>
      ) : (
        <article className={`ideanote-agent-message is-assistant is-${item.status}`}>
          <span className="ideanote-agent-message__marker"><Sparkles aria-hidden size={12} /></span>
          <div className="min-w-0 flex-1"><AgentMarkdown content={item.content} /></div>
        </article>
      );
    case "reasoningSummary":
      return <AgentReasoningSummary content={item.content} running={item.status === "running"} />;
    case "plan":
      return <AgentPlan item={item} />;
    case "tool":
      return showToolActivity ? <AgentToolActivity item={item} /> : null;
    case "approval":
      return (
        <section className={`ideanote-agent-approval is-${item.status}`}>
          <div className="ideanote-agent-item__heading"><ShieldCheck aria-hidden size={13} /><span>{item.title}</span></div>
          <p>{item.description}</p>
          {item.decision && <span className="ideanote-agent-approval__decision">{item.decision}</span>}
        </section>
      );
    case "changeReview":
      return <>{renderChangeReview(item)}</>;
    case "error":
      return <AgentErrorCard error={item.error} onRetry={onRetry} />;
    case "lifecycle":
      return (
        <div className={`ideanote-agent-lifecycle is-${item.status}`}>
          <CheckCircle2 aria-hidden size={11} /> {item.label}
        </div>
      );
  }
}
