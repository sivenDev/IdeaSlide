import { Monitor, Moon, Sun } from "lucide-react";
import { useSettingsDraft } from "../../hooks/useSettings";

export function GeneralSettings() {
  const { settings, updateSettings } = useSettingsDraft();
  const options = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "System", Icon: Monitor },
  ] as const;
  return (
    <section className="ideanote-settings-section" aria-labelledby="settings-general-title">
      <h2 id="settings-general-title" className="ideanote-settings-title">Appearance</h2>
      <div className="ideanote-theme-options" aria-label="Appearance">
        {options.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            className={settings.general.theme === value ? "is-selected" : ""}
            aria-pressed={settings.general.theme === value}
            onClick={() => updateSettings((current) => ({
              ...current,
              general: { ...current.general, theme: value },
            }))}
          >
            <Icon aria-hidden size={16} />
            <strong>{label}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
