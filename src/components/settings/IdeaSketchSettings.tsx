import { useSettings } from "../../hooks/useSettings";
import { SettingsField } from "./SettingsField";
import { SettingsSwitch } from "./SettingsSwitch";

export function IdeaSketchSettings() {
  const { settings, updateSettings } = useSettings();
  return (
    <section aria-labelledby="settings-ideasketch-title">
      <h2 id="settings-ideasketch-title" className="ideanote-settings-title">IdeaSketch</h2>
      <SettingsField title="Preview laser pointer" description="Show the presentation laser pointer and its fading trail in Preview.">
        <SettingsSwitch
          label="Enable Preview laser pointer"
          checked={settings.ideaSketch.previewLaserEnabled}
          onCheckedChange={(previewLaserEnabled) => void updateSettings((current) => ({
            ...current,
            ideaSketch: { ...current.ideaSketch, previewLaserEnabled },
          }))}
        />
      </SettingsField>
    </section>
  );
}
