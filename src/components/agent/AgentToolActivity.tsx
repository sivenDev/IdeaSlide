import { Check, LoaderCircle, Wrench, X } from "lucide-react";
import type { AgentToolItem } from "../../lib/agent/protocol";

interface AvailableTool {
  name: string;
  description: string;
  requires: string[];
  source: "editor" | "skill";
}

function getAvailableTools(output: unknown): AvailableTool[] | undefined {
  if (!output || typeof output !== "object") return undefined;
  const availableTools = (output as { availableTools?: unknown }).availableTools;
  if (!Array.isArray(availableTools)) return undefined;
  const tools = availableTools.filter((tool): tool is AvailableTool => {
    if (!tool || typeof tool !== "object") return false;
    const candidate = tool as Partial<AvailableTool>;
    return typeof candidate.name === "string"
      && typeof candidate.description === "string"
      && Array.isArray(candidate.requires)
      && candidate.requires.every((requirement) => typeof requirement === "string")
      && (candidate.source === "editor" || candidate.source === "skill");
  });
  return tools.length === availableTools.length ? tools : undefined;
}

export function AgentToolActivity({ item }: { item: AgentToolItem }) {
  const availableTools = getAvailableTools(item.output);
  const hasDetails = item.input !== undefined || item.output !== undefined;
  const header = (
    <>
      <Wrench aria-hidden size={13} />
      <div className="min-w-0 flex-1">
        <div className="ideanote-agent-tool-activity__name">{item.name.replace(/_/g, " ")}</div>
        {item.summary && <div className="ideanote-agent-tool-activity__summary">{item.summary}</div>}
      </div>
      {item.status === "running" && <LoaderCircle className="ideanote-agent-spin" aria-label="Running" size={12} />}
      {item.status === "completed" && <Check aria-label="Completed" size={12} />}
      {(item.status === "failed" || item.status === "cancelled") && <X aria-label={item.status} size={12} />}
    </>
  );

  if (!hasDetails) {
    return <div className={`ideanote-agent-tool-activity is-${item.status}`}><div className="ideanote-agent-tool-activity__header">{header}</div></div>;
  }

  return (
    <details className={`ideanote-agent-tool-activity is-${item.status}`}>
      <summary>{header}</summary>
      <div className="ideanote-agent-tool-activity__details">
        {availableTools ? (
          <div className="ideanote-agent-tool-catalog" aria-label="Available editor Tools">
            {availableTools.map((tool) => (
              <div className="ideanote-agent-tool-catalog__item" key={`${tool.source}:${tool.name}`}>
                <div className="ideanote-agent-tool-catalog__heading">
                  <code>{tool.name}</code>
                  {tool.source === "skill" && <span>Skill</span>}
                </div>
                <p>{tool.description}</p>
                {tool.requires.length > 0 && <small>Requires {tool.requires.join(", ")}</small>}
              </div>
            ))}
          </div>
        ) : (
          <>
            {item.input !== undefined && <pre><strong>Input</strong>{JSON.stringify(item.input, null, 2)}</pre>}
            {item.output !== undefined && <pre><strong>Result</strong>{JSON.stringify(item.output, null, 2)}</pre>}
          </>
        )}
      </div>
    </details>
  );
}
