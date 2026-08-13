import { useSettingsDraft } from "../../hooks/useSettings";
import { SettingsField } from "./SettingsField";
import { SettingsSwitch } from "./SettingsSwitch";

export function MarkdownSettings() {
  const { settings, updateSettings } = useSettingsDraft();
  return (
    <section className="ideanote-settings-section" aria-label="Markdown settings">
      <SettingsField title="Open Outline by default">
        <SettingsSwitch
          label="Open Markdown Outline by default"
          checked={settings.markdown.openOutlineByDefault}
          onCheckedChange={(openOutlineByDefault) => { void updateSettings((current) => ({
            ...current,
            markdown: { ...current.markdown, openOutlineByDefault },
          })).catch(() => undefined); }}
        />
      </SettingsField>
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
