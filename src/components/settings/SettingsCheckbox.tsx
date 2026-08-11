import * as Checkbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

export function SettingsCheckbox({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  title,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <Checkbox.Root
      aria-label={label}
      checked={checked}
      className="ideanote-settings-checkbox"
      disabled={disabled}
      title={title}
      onCheckedChange={(nextChecked) => onCheckedChange(nextChecked === true)}
    >
      <Checkbox.Indicator className="ideanote-settings-checkbox__indicator">
        <Check aria-hidden size={11} strokeWidth={2.5} />
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
}
