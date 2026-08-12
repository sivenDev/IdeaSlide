import { useSettingsDraft } from "../../hooks/useSettings";
import { SettingsField } from "./SettingsField";
import { SettingsSwitch } from "./SettingsSwitch";

export function IdeaSketchSettings() {
  const { settings, updateSettings } = useSettingsDraft();
  return (
    <section className="ideanote-settings-section" aria-label="IdeaSketch settings">
      <SettingsField title="Preview laser pointer" description="Show the presentation laser pointer and its fading trail in Preview.">
        <SettingsSwitch
          label="Enable Preview laser pointer"
          checked={settings.ideaSketch.previewLaserEnabled}
          onCheckedChange={(previewLaserEnabled) => { void updateSettings((current) => ({
            ...current,
            ideaSketch: { ...current.ideaSketch, previewLaserEnabled },
          })).catch(() => undefined); }}
        />
      </SettingsField>
    </section>
  );
}
