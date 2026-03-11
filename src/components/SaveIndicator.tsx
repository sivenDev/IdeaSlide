interface SaveIndicatorProps {
  isDirty: boolean;
  isSaving: boolean;
}

export function SaveIndicator({ isDirty, isSaving }: SaveIndicatorProps) {
  if (isSaving) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
        <span>Saving...</span>
      </div>
    );
  }

  if (isDirty) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <div className="w-2 h-2 bg-gray-400 rounded-full" />
        <span>Unsaved changes</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <div className="w-2 h-2 bg-green-500 rounded-full" />
      <span>Saved</span>
    </div>
  );
}
