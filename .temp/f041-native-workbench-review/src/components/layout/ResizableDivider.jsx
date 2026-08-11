import { useRef } from "react";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function ResizableDivider({
  label,
  value,
  min,
  max,
  onChange,
  direction = 1,
  mode = "flow",
  style,
}) {
  const dragRef = useRef(null);

  const update = (next) => onChange(clamp(Math.round(next), min, max));
  const onPointerDown = (event) => {
    event.preventDefault();
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startValue: value };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    update(dragRef.current.startValue + (event.clientX - dragRef.current.startX) * direction);
  };
  const stop = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <div
      className={`resizable-divider resizable-divider--${mode}`}
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 24 : 8;
        if (event.key === "ArrowLeft") { event.preventDefault(); update(value - step * direction); }
        if (event.key === "ArrowRight") { event.preventDefault(); update(value + step * direction); }
        if (event.key === "Home") { event.preventDefault(); update(min); }
        if (event.key === "End") { event.preventDefault(); update(max); }
      }}
    />
  );
}
