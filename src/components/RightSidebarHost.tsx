import { Bot } from "lucide-react";
import type { ReactNode } from "react";

export function RightSidebarHost({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <aside className="ideanote-right-sidebar" aria-label="AI Agent">
      <div className="ideanote-right-sidebar__header">
        <Bot aria-hidden size={14} />
        <span>Agent</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {children}
      </div>
    </aside>
  );
}
