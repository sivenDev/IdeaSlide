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
      <div className="ideanote-settings-field__copy">
        <strong>{title}</strong>
        {description && <div className="ideanote-settings-field__description">{description}</div>}
      </div>
      <div className="ideanote-settings-field__control">{children}</div>
    </div>
  );
}
