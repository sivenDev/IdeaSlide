interface SaveIndicatorProps {
  isDirty: boolean;
  isSaving: boolean;
}

export function SaveIndicator({ isDirty, isSaving }: SaveIndicatorProps) {
  const state = isSaving ? "saving" : isDirty ? "dirty" : "saved";
  const label = isSaving ? "Saving..." : isDirty ? "Unsaved changes" : "Saved";

  return (
    <div
      className={`idea-slide-save-indicator is-${state}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="idea-slide-save-indicator__dot" aria-hidden="true" />
      <span className="idea-slide-save-indicator__label">{label}</span>
    </div>
  );
}
