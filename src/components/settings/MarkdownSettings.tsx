import { useSettingsDraft } from "../../hooks/useSettings";
import { SettingsField } from "./SettingsField";
import { SettingsSwitch } from "./SettingsSwitch";

export function MarkdownSettings() {
  const { settings, updateSettings } = useSettingsDraft();
  return (
    <section className="ideanote-settings-section" aria-label="Markdown settings">
      <SettingsField title="Line numbers">
        <SettingsSwitch
          label="Show Markdown line numbers"
          checked={settings.markdown.showLineNumbers}
          onCheckedChange={(showLineNumbers) => { void updateSettings((current) => ({
            ...current,
            markdown: { ...current.markdown, showLineNumbers },
          })).catch(() => undefined); }}
        />
      </SettingsField>
    </section>
  );
}
