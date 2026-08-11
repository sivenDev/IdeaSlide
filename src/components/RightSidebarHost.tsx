import type { ReactNode } from "react";

export function RightSidebarHost({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <aside className="ideanote-right-sidebar" aria-label="AI Agent">
      {children}
    </aside>
  );
}
