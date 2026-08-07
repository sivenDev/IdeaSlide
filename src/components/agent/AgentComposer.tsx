import { ComposerPrimitive } from "@assistant-ui/react";
import { Send, Square } from "lucide-react";

export function AgentComposer({
  disabled,
  running,
}: {
  disabled: boolean;
  running: boolean;
}) {
  return (
    <ComposerPrimitive.Root className="ideanote-agent-composer">
      <ComposerPrimitive.Input
        aria-label="Message Agent"
        placeholder="Ask about this file or propose a change…"
        rows={3}
        disabled={disabled}
        submitMode="enter"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-gray-400">Enter to send · Shift+Enter for a new line</span>
        {running ? (
          <ComposerPrimitive.Cancel className="ideanote-agent-send" aria-label="Cancel Agent run">
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
