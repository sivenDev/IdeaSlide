import { CheckCircle2, CircleEllipsis, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { AgentChangeReviewItem, AgentItem as AgentItemModel } from "../../lib/agent/protocol";
import { AgentErrorCard } from "./AgentErrorCard";
import { AgentMarkdown } from "./AgentMarkdown";
import { AgentPlan } from "./AgentPlan";
import { AgentReasoningSummary } from "./AgentReasoningSummary";
import { AgentToolActivity } from "./AgentToolActivity";

function AgentLifecycleActivity({
  label,
  status,
  createdAt,
}: {
  label: string;
  status: AgentItemModel["status"];
  createdAt: number;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (status !== "running") return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [status]);
  const elapsed = Math.max(0, now - createdAt);
  return (
    <div className={`ideanote-agent-lifecycle is-${status}`} role={status === "running" ? "status" : undefined}>
      {status === "running" ? <CircleEllipsis className="ideanote-agent-spin" aria-hidden size={11} /> : <CheckCircle2 aria-hidden size={11} />}
      <span>{label}</span>
      {status === "running" && <time>{(elapsed / 1000).toFixed(1)}s</time>}
    </div>
  );
}

export function AgentItem({
  item,
  showToolActivity,
  onRetry,
  renderChangeReview,
  onApprovalDecision,
}: {
  item: AgentItemModel;
  showToolActivity: boolean;
  onRetry?: () => void;
  renderChangeReview: (item: AgentChangeReviewItem) => ReactNode;
  onApprovalDecision?: (itemId: string, approved: boolean) => void;
}) {
  switch (item.kind) {
    case "message":
      if (!item.content && item.status === "running") {
        return null;
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
          {!item.decision && onApprovalDecision && (
            <div className="mt-2 flex gap-2">
              <button type="button" className="ideanote-agent-review__secondary" onClick={() => onApprovalDecision(item.id, false)}>Reject</button>
              <button type="button" className="ideanote-agent-review__primary" onClick={() => onApprovalDecision(item.id, true)}>Approve</button>
            </div>
          )}
        </section>
      );
    case "changeReview":
      return <>{renderChangeReview(item)}</>;
    case "error":
      return <AgentErrorCard error={item.error} onRetry={onRetry} />;
    case "lifecycle":
      return <AgentLifecycleActivity label={item.label} status={item.status} createdAt={item.createdAt} />;
  }
}
