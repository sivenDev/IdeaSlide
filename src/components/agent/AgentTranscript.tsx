import { ArrowDown } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { AgentItem as AgentItemModel, AgentThreadState, AgentTurnEvidence } from "../../lib/agent/protocol";
import type { AgentPresentationSnapshot } from "../../lib/agent/agentTextPresentation";
import { AgentItem } from "./AgentItem";

const MAX_VISIBLE_ITEMS = 300;

interface TranscriptEntry {
  item: AgentItemModel;
  evidence?: AgentTurnEvidence;
}

export function AgentTranscript({
  state,
  presentation,
  showToolActivity,
  onRetry,
  onApprovalDecision,
}: {
  state: AgentThreadState;
  presentation: AgentPresentationSnapshot;
  showToolActivity: boolean;
  onRetry?: () => void;
  onApprovalDecision?: (itemId: string, approved: boolean) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [anchored, setAnchored] = useState(true);
  const turnEntries = state.thread.turns.flatMap((turn): TranscriptEntry[] => {
    let lastAssistantIndex = -1;
    turn.items.forEach((item, index) => {
      if (item.kind === "message" && item.role === "assistant") lastAssistantIndex = index;
    });
    return turn.items.map((item, index) => ({
      item,
      evidence: index === lastAssistantIndex ? turn.evidence : undefined,
    }));
  });
  const allEntries: TranscriptEntry[] = [
    ...state.notices.map((item) => ({ item })),
    ...turnEntries,
  ].filter(({ item }) => item.kind !== "changeReview");
  const hiddenCount = Math.max(0, allEntries.length - MAX_VISIBLE_ITEMS);
  const entries = hiddenCount ? allEntries.slice(-MAX_VISIBLE_ITEMS) : allEntries;
  const contentSignal = entries.map(({ item }) => {
    const presentedContent = item.kind === "message" && item.role === "assistant"
      ? presentation.items[item.id]?.displayedContent ?? item.content
      : item.kind === "message" || item.kind === "activity"
        ? item.content
        : "";
    return `${item.id}:${item.status}:${presentedContent.length}`;
  }).join("|");

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
          {entries.map(({ item, evidence }) => (
            <AgentItem
              key={item.id}
              item={item}
              displayedContent={item.kind === "message" && item.role === "assistant"
                ? presentation.items[item.id]?.displayedContent
                : undefined}
              presentationStatus={item.kind === "message" && item.role === "assistant"
                ? presentation.items[item.id]?.presentationStatus
                : undefined}
              evidence={evidence}
              showToolActivity={showToolActivity}
              onRetry={onRetry}
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
