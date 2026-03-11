import { SaveIndicator } from "./SaveIndicator";

interface ToolbarProps {
  fileName?: string;
  isDirty: boolean;
  isSaving: boolean;
  onNewIdea: () => void;
  onOpenFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onGoHome: () => void;
}

export function Toolbar({
  fileName,
  isDirty,
  isSaving,
  onNewIdea,
  onOpenFile,
  onSave,
  onSaveAs,
  onGoHome,
}: ToolbarProps) {
  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onGoHome}
          className="px-2 py-1.5 text-sm rounded transition-colors text-gray-500 hover:bg-gray-100"
          title="Back to home"
        >
          🏠
        </button>
        <div className="font-semibold text-gray-900">
          {fileName || "Untitled"}
        </div>
        <SaveIndicator isDirty={isDirty} isSaving={isSaving} />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onNewIdea}
          className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          New
        </button>
        <button
          onClick={onOpenFile}
          className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          Open
        </button>
        <button
          onClick={onSave}
          className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          Save
        </button>
        <button
          onClick={onSaveAs}
          className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          Save As
        </button>
      </div>
    </div>
  );
}
