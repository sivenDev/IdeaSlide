import { useSettings } from "../../hooks/useSettings";
import { SettingsField } from "./SettingsField";

export function GeneralSettings() {
  const { settings, updateSettings } = useSettings();
  return (
    <section aria-labelledby="settings-general-title">
      <h2 id="settings-general-title" className="ideanote-settings-title">Appearance</h2>
      <SettingsField title="Theme">
        <select
          aria-label="Appearance"
          className="ideanote-settings-control"
          value={settings.general.theme}
          onChange={(event) => void updateSettings((current) => ({
            ...current,
            general: { ...current.general, theme: event.target.value as "system" | "light" | "dark" },
          }))}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </SettingsField>
    </section>
  );
}
