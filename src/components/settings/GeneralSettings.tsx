import { useSettings } from "../../hooks/useSettings";
import { SettingsField } from "./SettingsField";

export function GeneralSettings() {
  const { settings, updateSettings } = useSettings();
  return (
    <section aria-labelledby="settings-general-title">
      <h2 id="settings-general-title" className="ideanote-settings-title">General</h2>
      <p className="ideanote-settings-lead">Application-wide preferences stay outside Workspace files.</p>
      <SettingsField title="Appearance" description="Follow the operating system or select an application theme.">
        <select
          aria-label="Appearance"
          className="ideanote-settings-control"
          value={settings.general.theme}
          onChange={(event) => void updateSettings((current) => ({
            ...current,
            general: { ...current.general, theme: event.target.value as "system" | "light" | "dark" },
          }))}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </SettingsField>
    </section>
  );
}
