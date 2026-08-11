import { ComposerPrimitive } from "@assistant-ui/react";
import { RotateCcw, Send, Square } from "lucide-react";
import type { AgentReasoningEffort } from "../../lib/agent/types";
import { AgentModelSelector } from "./AgentModelSelector";

export function AgentComposer({
  disabled,
  running,
  steeringAvailable,
  retryAvailable,
  models,
  selectedModel,
  reasoningEffort,
  onModelChange,
  onRetry,
}: {
  disabled: boolean;
  running: boolean;
  steeringAvailable: boolean;
  retryAvailable: boolean;
  models: string[];
  selectedModel: string;
  reasoningEffort: AgentReasoningEffort;
  onModelChange: (model: string) => void;
  onRetry: () => void;
}) {
  return (
    <ComposerPrimitive.Root className="ideanote-agent-composer">
      <ComposerPrimitive.Input
        aria-label="Message Agent"
        placeholder={running && steeringAvailable ? "Add direction to the current Turn…" : "Ask about or edit this file…"}
        rows={3}
        disabled={disabled || (running && !steeringAvailable)}
        submitMode="enter"
      />
      <div className="ideanote-agent-composer__footer">
        <AgentModelSelector
          models={models}
          selectedModel={selectedModel}
          reasoningEffort={reasoningEffort}
          disabled={disabled || running}
          onModelChange={onModelChange}
        />
        <div className="ideanote-agent-composer__actions">
          {retryAvailable && !running && (
            <button type="button" className="ideanote-agent-retry" onClick={onRetry} aria-label="Retry last Turn">
              <RotateCcw aria-hidden size={12} />
            </button>
          )}
          {running ? (
            <ComposerPrimitive.Cancel className="ideanote-agent-send" aria-label="Stop Agent run">
              <Square aria-hidden size={12} fill="currentColor" />
            </ComposerPrimitive.Cancel>
          ) : (
            <ComposerPrimitive.Send className="ideanote-agent-send" aria-label="Send to Agent">
              <Send aria-hidden size={13} />
            </ComposerPrimitive.Send>
          )}
        </div>
      </div>
    </ComposerPrimitive.Root>
  );
}
