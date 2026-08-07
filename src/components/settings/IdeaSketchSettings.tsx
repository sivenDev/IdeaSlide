import { useSettings } from "../../hooks/useSettings";
import { SettingsField, SettingsToggle } from "./SettingsField";

export function IdeaSketchSettings() {
  const { settings, updateSettings } = useSettings();
  return (
    <section aria-labelledby="settings-ideasketch-title">
      <h2 id="settings-ideasketch-title" className="ideanote-settings-title">IdeaSketch</h2>
      <p className="ideanote-settings-lead">Preferences contributed by the IdeaSketch editor.</p>
      <SettingsField title="Preview laser pointer" description="Show the presentation laser pointer and its fading trail in Preview.">
        <SettingsToggle
          label="Enable Preview laser pointer"
          checked={settings.ideaSketch.previewLaserEnabled}
          onChange={(previewLaserEnabled) => void updateSettings((current) => ({
            ...current,
            ideaSketch: { ...current.ideaSketch, previewLaserEnabled },
          }))}
        />
      </SettingsField>
    </section>
  );
}
