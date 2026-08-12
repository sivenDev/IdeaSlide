import { useSettingsDraft } from "../../hooks/useSettings";
import { AgentSkillManager } from "./AgentSkillManager";

export function SkillSettings() {
  const { activationState } = useSettingsDraft();
  return (
    <section className="ideanote-settings-section ideanote-settings-section--wide" aria-labelledby="settings-skills-title">
      <h2 id="settings-skills-title" className="ideanote-settings-title">Skills</h2>
      <AgentSkillManager activationState={activationState} />
    </section>
  );
}
