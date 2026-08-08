import { AlertTriangle, Check, FilePenLine, RotateCcw, X } from "lucide-react";
import type { AgentChangeSet } from "../../lib/agent/types";

export function AgentChangeReview({
  changeSet,
  operationLabels,
  readOnly,
  onApprove,
  onReject,
  onUndo,
  canUndo,
}: {
  changeSet: AgentChangeSet;
  operationLabels: string[];
  readOnly: boolean;
  onApprove: () => void;
  onReject: () => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  return (
    <section className={`ideanote-agent-review is-${changeSet.status}`} aria-label="Agent Change Review">
      <div className="flex items-start gap-2.5">
        <div className="ideanote-agent-review__icon"><FilePenLine aria-hidden size={15} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-gray-900">Change Review</div>
          <p className="mt-1 text-[11px] leading-5 text-gray-600">{changeSet.summary}</p>
          {operationLabels.map((label, index) => (
            <div className="mt-2 rounded-md bg-white/75 px-2.5 py-2 text-[10px] text-gray-500" key={`${changeSet.id}:${index}`}>
              {label}
            </div>
          ))}
        </div>
      </div>
      {readOnly && (
        <div className="mt-3 flex items-center gap-2 text-[10px] text-amber-700">
          <AlertTriangle aria-hidden size={12} /> This proposal cannot be applied to the current editor state.
        </div>
      )}
      {changeSet.status === "proposed" && (
        <div className="mt-3 flex gap-2">
          <button type="button" className="ideanote-agent-review__primary" disabled={readOnly} onClick={onApprove} aria-label={`Apply ${changeSet.summary}`}>
            <Check aria-hidden size={12} /> Apply
          </button>
          <button type="button" className="ideanote-agent-review__secondary" onClick={onReject} aria-label={`Reject ${changeSet.summary}`}>
            <X aria-hidden size={12} /> Reject
          </button>
        </div>
      )}
      {changeSet.status === "applied" && canUndo && (
        <button type="button" className="ideanote-agent-review__secondary mt-3" onClick={onUndo}>
          <RotateCcw aria-hidden size={12} /> Undo Agent change
        </button>
      )}
      {changeSet.status === "stale" && <div className="mt-3 text-[10px] font-medium text-red-700">The document changed. Generate a fresh proposal.</div>}
    </section>
  );
}
