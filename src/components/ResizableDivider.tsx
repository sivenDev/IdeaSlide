interface ResizableDividerProps {
  isVisible: boolean;
  onToggle: () => void;
}

export function ResizableDivider({ isVisible, onToggle }: ResizableDividerProps) {
  return (
    <div className="relative w-1 bg-gray-200 flex-shrink-0">
      <button
        onClick={onToggle}
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-6 h-6 rounded-full bg-white border border-gray-300 hover:bg-gray-100 hover:border-gray-400 flex items-center justify-center text-xs text-gray-500 z-10"
        title={isVisible ? "Hide slides panel" : "Show slides panel"}
      >
        {isVisible ? "◀" : "▶"}
      </button>
    </div>
  );
}
