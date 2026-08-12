import { useSettingsDraft } from "../../hooks/useSettings";
import { SettingsField } from "./SettingsField";
import { SettingsSwitch } from "./SettingsSwitch";

export function IdeaSketchSettings() {
  const { settings, updateSettings } = useSettingsDraft();
  return (
    <section className="ideanote-settings-section" aria-label="IdeaSketch settings">
      <SettingsField
        title="Open sidebar by default"
        description="Open the Pages, Cameras, and Canvas sidebar when an IdeaSketch editor starts."
      >
        <SettingsSwitch
          label="Open IdeaSketch sidebar by default"
          checked={settings.ideaSketch.openSidebarByDefault}
          onCheckedChange={(openSidebarByDefault) => { void updateSettings((current) => ({
            ...current,
            ideaSketch: { ...current.ideaSketch, openSidebarByDefault },
          })).catch(() => undefined); }}
        />
      </SettingsField>
      <SettingsField
        title="Default Page view"
        description="Choose how the Pages list appears when an IdeaSketch editor starts."
      >
        <select
          aria-label="Default Page view"
          className="ideanote-settings-control"
          value={settings.ideaSketch.pageViewMode}
          onChange={(event) => { void updateSettings((current) => ({
            ...current,
            ideaSketch: {
              ...current.ideaSketch,
              pageViewMode: event.target.value as "name" | "thumbnail",
            },
          })).catch(() => undefined); }}
        >
          <option value="name">Name</option>
          <option value="thumbnail">Thumbnail</option>
        </select>
      </SettingsField>
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
