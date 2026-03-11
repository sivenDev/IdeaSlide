import { memo, useRef, useEffect } from "react";

interface SlideThumbnailProps {
  svgElement: SVGSVGElement | undefined;
  slideIndex: number;
}

export const SlideThumbnail = memo(function SlideThumbnail({
  svgElement,
  slideIndex,
}: SlideThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (svgElement) {
      container.replaceChildren(svgElement.cloneNode(true));
    } else {
      container.replaceChildren();
    }
  }, [svgElement]);

  if (!svgElement) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="text-2xl font-bold">{slideIndex + 1}</div>
          <div className="text-xs">Slide {slideIndex + 1}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden bg-white [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
      />
      <span className="absolute bottom-1 left-1 min-w-5 h-5 flex items-center justify-center rounded bg-black/50 text-white text-xs font-medium px-1">
        {slideIndex + 1}
      </span>
    </div>
  );
});
