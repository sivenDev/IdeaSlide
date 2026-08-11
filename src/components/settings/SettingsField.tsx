import type { ReactNode } from "react";

export function SettingsField({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="ideanote-settings-field">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        {description && <div className="ideanote-settings-field__description">{description}</div>}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}
