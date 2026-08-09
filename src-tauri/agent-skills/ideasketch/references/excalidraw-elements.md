# Excalidraw Element Guidance

Prefer simple editable elements with stable ids, numeric geometry, and explicit visual properties. Use rectangles, ellipses, arrows, lines, and text. Keep bindings optional and avoid embedding binary files unless the editor explicitly supplies a file tool.

Every generated element is validated by the IdeaSketch extension before the active editor can apply it. Invalid or unsupported elements are rejected rather than written.
