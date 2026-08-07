import { Wrench } from "lucide-react";

export function AgentToolActivity({ text }: { text: string }) {
  return (
    <div className="ideanote-agent-tool-activity">
      <Wrench aria-hidden size={13} />
      <span>{text}</span>
    </div>
  );
}
