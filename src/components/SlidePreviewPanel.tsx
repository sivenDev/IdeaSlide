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
}: SlidePreviewPanelProps) {
  return (
    <div className="w-full h-[150px] bg-gray-50 border-t border-gray-200 flex items-center px-3 gap-3 overflow-x-auto flex-shrink-0">
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`relative group cursor-pointer border-2 rounded-lg overflow-hidden transition-all flex-shrink-0 w-[160px] h-[100px] ${
            index === currentSlideIndex
              ? "border-blue-500 shadow-md"
              : "border-gray-200 hover:border-gray-300"
          }`}
          onClick={() => onSlideSelect(index)}
        >
          <div className="w-full h-full bg-white">
            <SlideThumbnail
              svgElement={thumbnails.get(slide.id)}
              slideIndex={index}
            />
          </div>

          <span className="absolute bottom-1 left-2 text-[11px] text-gray-400">
            {index + 1}
          </span>

          {slides.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSlide(index);
              }}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
            >
              ×
            </button>
          )}
        </div>
      ))}

      <button
        onClick={onAddSlide}
        className="flex-shrink-0 w-[160px] h-[100px] rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-center transition-all cursor-pointer"
      >
        <span className="text-2xl text-gray-300 hover:text-blue-500">+</span>
      </button>
    </div>
  );
}
