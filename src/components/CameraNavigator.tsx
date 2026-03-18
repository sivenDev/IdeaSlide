import { useEffect, useRef, memo } from "react";
import { useCameraThumbnails } from "../hooks/useCameraThumbnails";
import type { Camera } from "../lib/cameraUtils";

interface CameraNavigatorProps {
  cameras: Camera[];
  currentCameraIndex: number;
  elements: readonly any[];
  files: Record<string, any>;
  onSelect: (index: number) => void;
  onClose: () => void;
}

const CameraCard = memo(function CameraCard({
  svgElement,
  order,
  isCurrent,
  onSelect,
}: {
  svgElement: SVGSVGElement | undefined;
  order: number;
  isCurrent: boolean;
  onSelect: () => void;
}) {
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

  return (
    <button
      aria-label={`Jump to camera ${order}`}
      className="relative rounded-lg overflow-hidden cursor-pointer transition-colors duration-150 outline-none focus:ring-2 focus:ring-amber-500"
      style={{
        border: `2px solid ${isCurrent ? '#f59e0b' : 'transparent'}`,
        backgroundColor: '#2a2a2a',
        aspectRatio: '16/9',
      }}
      onClick={onSelect}
      onMouseEnter={(e) => {
        if (!isCurrent) {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.3)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isCurrent) {
          (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
        }
      }}
    >
      <div className="w-full h-full flex items-center justify-center p-2">
        {svgElement ? (
          <div
            ref={containerRef}
            className="w-full h-full overflow-hidden bg-white [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
          />
        ) : (
          <div className="text-gray-500 text-sm">{order}</div>
        )}
      </div>

      <div
        className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium text-white"
        style={{ backgroundColor: 'rgba(245, 158, 11, 0.7)' }}
      >
        {order}
      </div>
    </button>
  );
});

export function CameraNavigator({
  cameras,
  currentCameraIndex,
  elements,
  files,
  onSelect,
  onClose,
}: CameraNavigatorProps) {
  const thumbnails = useCameraThumbnails(cameras, elements, files, 0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="dialog"
      aria-label="Camera navigator"
      className="fixed inset-0 z-[60] flex items-center justify-center outline-none"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        animation: 'fadeIn 200ms ease-in-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="grid gap-4 p-8 overflow-y-auto max-h-[90vh]"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          maxWidth: '1400px',
          width: '100%',
        }}
      >
        {cameras.map((camera, index) => (
          <CameraCard
            key={camera.id}
            svgElement={thumbnails.get(camera.id)}
            order={camera.order}
            isCurrent={index === currentCameraIndex}
            onSelect={() => onSelect(index)}
          />
        ))}
      </div>
    </div>
  );
}
