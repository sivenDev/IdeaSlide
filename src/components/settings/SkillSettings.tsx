import { useSettingsDraft } from "../../hooks/useSettings";
import { AgentSkillManager } from "./AgentSkillManager";

export function SkillSettings() {
  const { activationState } = useSettingsDraft();
  return (
    <section className="ideanote-settings-section ideanote-settings-section--wide" aria-label="Skill settings">
      <AgentSkillManager activationState={activationState} />
    </section>
  );
}
