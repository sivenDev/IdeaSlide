import type { Slide } from "../types";

interface SlidePreviewPanelProps {
  slides: Slide[];
  currentSlideIndex: number;
  onSlideSelect: (index: number) => void;
  onAddSlide: () => void;
  onDeleteSlide: (index: number) => void;
}

export function SlidePreviewPanel({
  slides,
  currentSlideIndex,
  onSlideSelect,
  onAddSlide,
  onDeleteSlide,
}: SlidePreviewPanelProps) {
  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={onAddSlide}
          className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          + Add Slide
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`relative group cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
              index === currentSlideIndex
                ? "border-blue-500 shadow-md"
                : "border-gray-200 hover:border-gray-300"
            }`}
            onClick={() => onSlideSelect(index)}
          >
            <div className="aspect-video bg-white flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-2xl font-bold">{index + 1}</div>
                <div className="text-xs">Slide {index + 1}</div>
              </div>
            </div>

            {slides.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSlide(index);
                }}
                className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
