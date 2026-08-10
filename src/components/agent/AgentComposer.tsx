import { ComposerPrimitive } from "@assistant-ui/react";
import { CornerDownRight, RotateCcw, Send, Square } from "lucide-react";
import type { AgentSkillMetadata } from "../../lib/agent/types";
import { AgentSkillPicker } from "./AgentSkillPicker";

export function AgentComposer({
  disabled,
  running,
  steeringAvailable,
  retryAvailable,
  targetLabel,
  skills,
  editorSkillId,
  selectedSkillIds,
  onSelectedSkillIdsChange,
  onRetry,
}: {
  disabled: boolean;
  running: boolean;
  steeringAvailable: boolean;
  retryAvailable: boolean;
  targetLabel: string;
  skills: AgentSkillMetadata[];
  editorSkillId?: string;
  selectedSkillIds: string[];
  onSelectedSkillIdsChange: (ids: string[]) => void;
  onRetry: () => void;
}) {
  return (
    <ComposerPrimitive.Root className="ideanote-agent-composer">
      <div className="ideanote-agent-composer__target" title={targetLabel}>
        {running && steeringAvailable ? <CornerDownRight aria-hidden size={11} /> : null}
        <span>{running && steeringAvailable ? "Steer current Turn" : targetLabel}</span>
      </div>
      <ComposerPrimitive.Input
        aria-label="Message Agent"
        placeholder={running && steeringAvailable ? "Add direction to the current Turn…" : "Ask about or edit this file…"}
        rows={3}
        disabled={disabled || (running && !steeringAvailable)}
        submitMode="enter"
      />
      <AgentSkillPicker
        skills={skills}
        editorSkillId={editorSkillId}
        selectedIds={selectedSkillIds}
        disabled={disabled || running}
        onChange={onSelectedSkillIdsChange}
      />
      <div className="flex items-center justify-between gap-2">
        {retryAvailable && !running ? (
          <button type="button" className="ideanote-agent-retry" onClick={onRetry}>
            <RotateCcw aria-hidden size={11} /> Retry last Turn
          </button>
        ) : (
          <span className="text-[10px] text-gray-400">Enter to send · Shift+Enter for a new line</span>
        )}
        {running ? (
          <ComposerPrimitive.Cancel className="ideanote-agent-send" aria-label="Stop Agent run">
            <Square aria-hidden size={13} fill="currentColor" />
          </ComposerPrimitive.Cancel>
        ) : (
          <ComposerPrimitive.Send className="ideanote-agent-send" aria-label="Send to Agent">
            <Send aria-hidden size={14} />
          </ComposerPrimitive.Send>
        )}
      </div>
    </ComposerPrimitive.Root>
  );
}
