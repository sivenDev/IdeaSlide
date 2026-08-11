import * as Switch from "@radix-ui/react-switch";

export function SettingsSwitch({ checked, onChange, label, disabled = false }) {
  return (
    <Switch.Root
      className="settings-switch"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onCheckedChange={onChange}
    >
      <Switch.Thumb className="settings-switch__thumb" />
    </Switch.Root>
  );
}
