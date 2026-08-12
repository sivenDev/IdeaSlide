import { Info, PanelRightClose, SquarePen } from "lucide-react";
import type { ReactNode } from "react";

export function AgentThreadHeader({
  conversationSelector,
  running,
  onNewThread,
  onOpenInspector,
  onClose,
}: {
  conversationSelector: ReactNode;
  running: boolean;
  onNewThread: () => void;
  onOpenInspector: () => void;
  onClose: () => void;
}) {
  return (
    <header className="ideanote-agent-thread-header">
      {conversationSelector}
      <div className="ideanote-agent-thread-header__actions">
        <button type="button" onClick={onNewThread} disabled={running} aria-label="New conversation">
          <SquarePen aria-hidden size={14} />
        </button>
        <button type="button" onClick={onOpenInspector} aria-label="Runtime Inspector">
          <Info aria-hidden size={14} />
        </button>
        <button type="button" onClick={onClose} aria-label="Hide Agent">
          <PanelRightClose aria-hidden size={14} />
        </button>
      </div>
    </header>
  );
}
