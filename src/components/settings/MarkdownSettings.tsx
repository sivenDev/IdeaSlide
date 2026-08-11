import { useSettings } from "../../hooks/useSettings";
import { SettingsField } from "./SettingsField";
import { SettingsSwitch } from "./SettingsSwitch";

export function MarkdownSettings() {
  const { settings, updateSettings } = useSettings();
  return (
    <section aria-labelledby="settings-markdown-title">
      <h2 id="settings-markdown-title" className="ideanote-settings-title">Markdown</h2>
      <SettingsField title="Line numbers">
        <SettingsSwitch
          label="Show Markdown line numbers"
          checked={settings.markdown.showLineNumbers}
          onCheckedChange={(showLineNumbers) => void updateSettings((current) => ({
            ...current,
            markdown: { ...current.markdown, showLineNumbers },
          }))}
        />
      </SettingsField>
    </section>
  );
}
