import { Info, PanelRightClose, Settings2, SquarePen } from "lucide-react";
import type { ReactNode } from "react";

export function AgentThreadHeader({
  conversationSelector,
  running,
  onNewThread,
  onOpenInspector,
  onOpenSettings,
  onClose,
}: {
  conversationSelector: ReactNode;
  running: boolean;
  onNewThread: () => void;
  onOpenInspector: () => void;
  onOpenSettings: () => void;
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
        <button type="button" onClick={onOpenSettings} aria-label="Open Agent settings">
          <Settings2 aria-hidden size={14} />
        </button>
        <button type="button" onClick={onClose} aria-label="Hide Agent">
          <PanelRightClose aria-hidden size={14} />
        </button>
      </div>
    </header>
  );
}
