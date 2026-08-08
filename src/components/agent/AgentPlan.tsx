import { Check, Circle, ListChecks, LoaderCircle, X } from "lucide-react";
import type { AgentPlanItem } from "../../lib/agent/protocol";

function StepIcon({ status }: { status: AgentPlanItem["steps"][number]["status"] }) {
  if (status === "completed") return <Check aria-hidden size={11} />;
  if (status === "running") return <LoaderCircle className="ideanote-agent-spin" aria-hidden size={11} />;
  if (status === "cancelled") return <X aria-hidden size={11} />;
  return <Circle aria-hidden size={9} />;
}

export function AgentPlan({ item }: { item: AgentPlanItem }) {
  return (
    <section className="ideanote-agent-plan" aria-label="Agent plan">
      <div className="ideanote-agent-item__heading">
        <ListChecks aria-hidden size={13} />
        <span>{item.title}</span>
      </div>
      <ol>
        {item.steps.map((step) => (
          <li key={step.id} className={`is-${step.status}`}>
            <span className="ideanote-agent-plan__step-icon"><StepIcon status={step.status} /></span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
