import { Bot, PanelRightClose } from "lucide-react";
import type { ReactNode } from "react";

export function RightSidebarHost({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <aside className="ideanote-right-sidebar" aria-label="AI Agent">
      <div className="ideanote-right-sidebar__header">
        <Bot aria-hidden size={14} />
        <span>Agent</span>
        {onClose && (
          <button type="button" aria-label="Hide Agent" onClick={onClose}>
            <PanelRightClose aria-hidden size={15} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {children}
      </div>
    </aside>
  );
}
