import * as Switch from "@radix-ui/react-switch";

export function SettingsSwitch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Switch.Root
      aria-label={label}
      checked={checked}
      disabled={disabled}
      className="ideanote-settings-toggle"
      onCheckedChange={onCheckedChange}
    >
      <Switch.Thumb className="ideanote-settings-toggle__thumb" />
    </Switch.Root>
  );
}
