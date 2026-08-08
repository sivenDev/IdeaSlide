import { ArrowDown } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { AgentChangeReviewItem, AgentItem as AgentItemModel, AgentThreadState } from "../../lib/agent/protocol";
import { AgentItem } from "./AgentItem";

const MAX_VISIBLE_ITEMS = 300;

export function AgentTranscript({
  state,
  showToolActivity,
  onRetry,
  renderChangeReview,
  onApprovalDecision,
}: {
  state: AgentThreadState;
  showToolActivity: boolean;
  onRetry?: () => void;
  renderChangeReview: (item: AgentChangeReviewItem) => ReactNode;
  onApprovalDecision?: (itemId: string, approved: boolean) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [anchored, setAnchored] = useState(true);
  const allItems = [...state.notices, ...state.thread.turns.flatMap((turn) => turn.items)];
  const hiddenCount = Math.max(0, allItems.length - MAX_VISIBLE_ITEMS);
  const items = hiddenCount ? allItems.slice(-MAX_VISIBLE_ITEMS) : allItems;
  const contentSignal = items.map((item) => `${item.id}:${item.status}:${item.kind === "message" || item.kind === "reasoningSummary" ? item.content.length : 0}`).join("|");

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport && anchored) viewport.scrollTop = viewport.scrollHeight;
  }, [anchored, contentSignal]);

  const handleScroll = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setAnchored(viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 48);
  };

  const jumpToLatest = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    setAnchored(true);
  };

  return (
    <div className="ideanote-agent-transcript-wrap">
      <div ref={viewportRef} className="ideanote-agent-messages" onScroll={handleScroll}>
        {hiddenCount > 0 && (
          <div className="ideanote-agent-transcript-limit">{hiddenCount} earlier items are hidden in this view.</div>
        )}
        <div className="ideanote-agent-activity-rail" aria-label="Agent transcript">
          {items.map((item: AgentItemModel) => (
            <AgentItem
              key={item.id}
              item={item}
              showToolActivity={showToolActivity}
              onRetry={onRetry}
              renderChangeReview={renderChangeReview}
              onApprovalDecision={onApprovalDecision}
            />
          ))}
        </div>
      </div>
      {!anchored && (
        <button type="button" className="ideanote-agent-jump-latest" onClick={jumpToLatest}>
          <ArrowDown aria-hidden size={12} /> Jump to latest
        </button>
      )}
    </div>
  );
}
