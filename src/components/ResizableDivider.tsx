interface ResizableDividerProps {
  side: "left" | "right";
  isVisible: boolean;
  onToggle: () => void;
}

export function ResizableDivider({ side, isVisible, onToggle }: ResizableDividerProps) {
  const isLeft = side === "left";
  const title = isLeft
    ? isVisible ? "Hide workspace" : "Show workspace"
    : isVisible ? "Hide cameras" : "Show cameras";
  const arrow = isLeft
    ? isVisible ? "‹" : "›"
    : isVisible ? "›" : "‹";

  return (
    <div className="relative z-20 h-full w-px flex-shrink-0 bg-gray-200">
      <button
        type="button"
        onClick={onToggle}
        title={title}
        aria-label={title}
        className="absolute left-1/2 top-1/2 flex h-12 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white text-sm font-semibold text-gray-500 shadow-sm hover:border-gray-400 hover:bg-gray-50 hover:text-gray-800"
      >
        {arrow}
      </button>
    </div>
  );
}
