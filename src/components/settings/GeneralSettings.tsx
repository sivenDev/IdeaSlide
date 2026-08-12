import { useSettingsDraft } from "../../hooks/useSettings";

export function GeneralSettings() {
  const { settings, updateSettings } = useSettingsDraft();
  const options = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ] as const;
  return (
    <section className="ideanote-settings-section" aria-label="General settings">
      <div className="ideanote-theme-options" aria-label="Appearance">
        {options.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            data-theme-option={value}
            className={settings.general.theme === value ? "is-selected" : ""}
            aria-pressed={settings.general.theme === value}
            onClick={() => { void updateSettings((current) => ({
              ...current,
              general: { ...current.general, theme: value },
            })).catch(() => undefined); }}
          >
            <span className="ideanote-theme-preview" aria-hidden>
              <span className="ideanote-theme-preview__rail" />
              <span className="ideanote-theme-preview__canvas"><span /></span>
            </span>
            <span className="ideanote-theme-option__label"><strong>{label}</strong></span>
          </button>
        ))}
      </div>
    </section>
  );
}
