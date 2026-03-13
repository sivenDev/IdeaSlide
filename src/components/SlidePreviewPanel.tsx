import type { Slide } from "../types";
import { SlideThumbnail } from "./SlideThumbnail";

interface SlidePreviewPanelProps {
  slides: Slide[];
  currentSlideIndex: number;
  thumbnails: Map<string, SVGSVGElement>;
  onSlideSelect: (index: number) => void;
  onAddSlide: () => void;
  onDeleteSlide: (index: number) => void;
  onStartPresentation?: () => void;
}

export function SlidePreviewPanel({
  slides,
  currentSlideIndex,
  thumbnails,
  onSlideSelect,
  onAddSlide,
  onDeleteSlide,
  onStartPresentation,
}: SlidePreviewPanelProps) {
  return (
    <div className="h-full w-64 min-w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200 flex gap-2">
        <button
          onClick={onAddSlide}
          className="flex-1 py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          + Add Slide
        </button>
        {onStartPresentation && (
          <button
            onClick={onStartPresentation}
            className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors"
            title="放映幻灯片"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
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
            <div className="aspect-video bg-white">
              <SlideThumbnail
                svgElement={thumbnails.get(slide.id)}
                slideIndex={index}
              />
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
