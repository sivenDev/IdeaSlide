import { Check, FlaskConical, RotateCcw } from "lucide-react";
import { reviewScenarios } from "../../scenarios/reviewScenarioRegistry.js";

export function ReviewScenariosSettings({ activeScenario, onScenario }) {
  const groups = [...new Set(reviewScenarios.map((scenario) => scenario.group))];
  return (
    <section className="settings-section settings-section--wide review-scenarios">
      <h2>Review Scenarios</h2>
      <p>Switch deterministic mock contracts through the same product UI. These controls are excluded from any production migration.</p>
      <div className="settings-callout review-scenarios__boundary"><FlaskConical size={18} /><span><strong>Backend results are simulated</strong><small>Files, watchers, recovery, credentials, runtimes, Tools, and application exit stay inside this browser review.</small></span></div>
      <button className="settings-secondary review-reset" type="button" onClick={() => onScenario("normal")}><RotateCcw size={13} />Reset demo to Welcome</button>
      {groups.map((group) => (
        <section className="scenario-group" key={group} aria-labelledby={`scenario-${group.replaceAll(" ", "-")}`}>
          <h3 id={`scenario-${group.replaceAll(" ", "-")}`}>{group}</h3>
          <div className="scenario-list">
            {reviewScenarios.filter((scenario) => scenario.group === group).map((scenario) => (
              <button key={scenario.id} className={activeScenario === scenario.id ? "is-active" : ""} type="button" aria-pressed={activeScenario === scenario.id} onClick={() => onScenario(scenario.id)}>
                <span><strong>{scenario.label}</strong><small>{scenario.description}</small></span>
                {activeScenario === scenario.id && <Check size={14} />}
              </button>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
