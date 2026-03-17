/// Returns the Excalidraw element format reference for AI models.
/// Modeled after Excalidraw MCP's `read_me` tool — gives the caller
/// everything it needs to construct valid slide content in one shot.
pub fn handle_read_me() -> Result<String, String> {
    Ok(EXCALIDRAW_CHEAT_SHEET.to_string())
}

const EXCALIDRAW_CHEAT_SHEET: &str = r##"# Excalidraw Element Format for IdeaSlide

Call this tool ONCE at the start of a session. Do NOT call it again — the content never changes.
Then use `set_slide_content` or `add_slide` with the `content` parameter to create slides.

## Slide Content Structure

Every slide is an Excalidraw scene. Pass as a JSON string to `set_slide_content` or `add_slide`:

```json
{
  "elements": [ ... ],
  "appState": {
    "viewBackgroundColor": "#ffffff"
  }
}
```

## Visual Style — Hand-Drawn Is Default

Excalidraw's signature look is **hand-drawn / sketchy**. Embrace it!

- **fontFamily: 1** (Virgil) — the hand-drawn font. Use it for EVERYTHING except code snippets.
- **roughness: 1** (artist) — default hand-drawn edges. Use roughness 2 (cartoon) for playful slides.
- **roughness: 0** (architect) — clean lines. Only use for technical/formal diagrams.
- **fillStyle: "hachure"** — hand-drawn hatching fill. More expressive than "solid" for shapes.
- **fillStyle: "cross-hatch"** — cross-hatched fill. Great for emphasis.
- **fillStyle: "solid"** — flat fill. Use for backgrounds/zones, not primary shapes.

Rule: If the user doesn't request a specific style, default to hand-drawn (fontFamily 1, roughness 1, hachure fills).

## Color Palette (use consistently across slides)

### Primary Colors (for strokes, text, accents)
| Name   | Hex       | Use                              |
|--------|-----------|----------------------------------|
| Blue   | #4a9eed   | Primary actions, links, series 1 |
| Amber  | #f59e0b   | Warnings, highlights, series 2   |
| Green  | #22c55e   | Success, positive, series 3      |
| Red    | #ef4444   | Errors, negative, series 4       |
| Purple | #8b5cf6   | Accents, special, series 5       |
| Pink   | #ec4899   | Decorative, series 6             |
| Cyan   | #06b6d4   | Info, secondary, series 7        |

### Pastel Fills (for shape backgrounds)
| Color        | Hex       | Good For                    |
|--------------|-----------|-----------------------------|
| Light Blue   | #a5d8ff   | Input, sources, primary     |
| Light Green  | #b2f2bb   | Success, output, completed  |
| Light Orange | #ffd8a8   | Warning, pending, external  |
| Light Purple | #d0bfff   | Processing, middleware      |
| Light Red    | #ffc9c9   | Error, critical, alerts     |
| Light Yellow | #fff3bf   | Notes, decisions, planning  |
| Light Teal   | #c3fae8   | Storage, data, memory       |
| Light Pink   | #eebefa   | Analytics, metrics          |

### Background Zones (use with opacity: 30 for layered diagrams)
| Color        | Hex       | Good For                    |
|--------------|-----------|-----------------------------|
| Blue zone    | #dbe4ff   | UI / frontend layer         |
| Purple zone  | #e5dbff   | Logic / processing layer    |
| Green zone   | #d3f9d8   | Data / storage layer        |

## Element Types

### Rectangle
```json
{ "type": "rectangle", "x": 100, "y": 100, "width": 200, "height": 100, "roughness": 1, "backgroundColor": "#a5d8ff", "fillStyle": "hachure", "roundness": { "type": 3 } }
```
- `roundness: { "type": 3 }` for rounded corners (recommended for most shapes)
- Combine `backgroundColor` + `fillStyle` for filled look

### Ellipse
```json
{ "type": "ellipse", "x": 100, "y": 100, "width": 150, "height": 150, "roughness": 1 }
```

### Diamond
```json
{ "type": "diamond", "x": 100, "y": 100, "width": 150, "height": 150, "roughness": 1 }
```

### Text — IMPORTANT: `width` and `height` are REQUIRED
```json
{ "type": "text", "x": 150, "y": 138, "width": 120, "height": 27, "text": "Hello", "fontSize": 20, "fontFamily": 1 }
```
- **`width` and `height` MUST be provided** or text will be invisible!
- Width formula: `characters × fontSize × 0.6` (ASCII) or `characters × fontSize` (CJK/中文)
- Height formula: `lines × fontSize × 1.35`
- Example: "Hello World" (11 chars) at fontSize 20 → width: 132, height: 27
- Example: "你好世界" (4 CJK) at fontSize 20 → width: 80, height: 27
- Multi-line: "Line1\nLine2\nLine3" at fontSize 20 → height: 81
- **fontFamily: 1** (Virgil/hand-drawn) — DEFAULT, use for almost everything
- fontFamily: 2 (Helvetica) — only for formal/corporate slides
- fontFamily: 3 (Cascadia/mono) — only for code snippets
- `textAlign`: "left", "center", "right" (only affects multi-line wrapping)
- x is the LEFT edge. To center at cx: set x = cx - width / 2

### Arrow
```json
{
  "type": "arrow", "x": 300, "y": 150,
  "width": 200, "height": 0,
  "points": [[0,0],[200,0]],
  "endArrowhead": "arrow",
  "roughness": 1, "strokeWidth": 2
}
```
- points: [dx, dy] offsets from element x,y
- endArrowhead: null | "arrow" | "bar" | "dot" | "triangle"
- startArrowhead: same options

### Line
```json
{
  "type": "line", "x": 100, "y": 100,
  "points": [[0,0],[200,100]],
  "strokeColor": "#1e1e1e", "strokeWidth": 2, "roughness": 1
}
```

## Common Properties (all elements)

| Property        | Default       | Recommended                          |
|-----------------|---------------|--------------------------------------|
| strokeColor     | "#1e1e1e"     | Any hex color                        |
| backgroundColor | "transparent" | Pastel fill from palette above       |
| fillStyle       | "solid"       | **"hachure"** for hand-drawn look    |
| strokeWidth     | 2             | 1 (thin), 2 (normal), 4 (bold)      |
| roughness       | 1             | **1 (artist)** or 2 (cartoon)        |
| opacity         | 100           | 30 for background zones              |
| roundness       | null          | `{ "type": 3 }` for rounded corners |

## Slide Canvas Dimensions

IdeaSlide renders at 800×600. Design for this viewport:
- Center content around (400, 300)
- Leave 50px margins on all sides
- Effective content area: 700×500

## Font Size Guidelines

| Use Case    | fontSize | Notes                    |
|-------------|----------|--------------------------|
| Title       | 36       | One per slide, prominent |
| Heading     | 28       | Section headers          |
| Body        | 20       | Default readable size    |
| Caption     | 16       | Minimum readable size    |
| NEVER below | 14       | Unreadable at display    |

## Text Contrast Rules (CRITICAL)

- On white backgrounds: minimum text strokeColor is **#555555** (never lighter!)
- For colored text on light fills: use DARK variants (#15803d not #22c55e, #2563eb not #4a9eed)
- White text needs dark backgrounds
- Do NOT use emoji in text — Excalidraw fonts don't render them

## Element Ordering (CRITICAL for streaming)

Array order = z-order (first = back, last = front).

**Draw progressively — group related elements together:**
- GOOD: bg_zone → shape1 → text1 → arrow1 → shape2 → text2 → arrow2
- BAD: all rectangles → all texts → all arrows

For slides: background zone first → title → content shapes with their labels → connecting arrows → decorations last.

## Layout Best Practices

1. **Title slide**: Large centered title (fontSize 36, fontFamily 1) + subtitle (fontSize 20) + optional decorative shape
2. **Content slide**: Title at y≈60 + body content below y≈130
3. **Diagram slide**: Background zone (opacity 30) + shapes with labels + arrows
4. **Bullet list**: Title + multi-line text with "• " prefix per line
5. **Minimum shape size**: 140×70 for shapes with text inside
6. **Spacing**: 30px gaps between elements minimum
7. **Arrow spacing**: Leave 10-20px gap between shape edge and arrow start/end
8. **Decoration**: Add small shapes (ellipses, lines) as accents to make slides visually interesting

## Example: Title Slide (Hand-Drawn Style)

```json
{
  "elements": [
    {
      "type": "rectangle", "x": 120, "y": 160,
      "width": 560, "height": 220,
      "strokeColor": "#4a9eed", "strokeWidth": 2,
      "backgroundColor": "#dbe4ff", "fillStyle": "hachure",
      "roughness": 2, "roundness": { "type": 3 },
      "opacity": 40
    },
    {
      "type": "text",
      "x": 160, "y": 200,
      "width": 480, "height": 49,
      "text": "My Presentation",
      "fontSize": 36,
      "fontFamily": 1,
      "textAlign": "center",
      "strokeColor": "#1e1e1e"
    },
    {
      "type": "line", "x": 200, "y": 260,
      "points": [[0,0],[400,0]],
      "strokeColor": "#4a9eed", "strokeWidth": 2, "roughness": 2
    },
    {
      "type": "text",
      "x": 200, "y": 280,
      "width": 264, "height": 27,
      "text": "Created with IdeaSlide",
      "fontSize": 20,
      "fontFamily": 1,
      "textAlign": "center",
      "strokeColor": "#757575"
    }
  ],
  "appState": { "viewBackgroundColor": "#ffffff" }
}
```

## Example: Diagram with Connected Boxes

```json
{
  "elements": [
    {
      "type": "rectangle", "x": 50, "y": 180,
      "width": 700, "height": 260,
      "backgroundColor": "#d3f9d8", "fillStyle": "solid",
      "roughness": 1, "roundness": { "type": 3 },
      "strokeColor": "#22c55e", "strokeWidth": 1, "opacity": 30
    },
    {
      "type": "text", "x": 70, "y": 190,
      "width": 120, "height": 22,
      "text": "Data Flow", "fontSize": 16, "fontFamily": 1,
      "strokeColor": "#15803d"
    },
    {
      "type": "rectangle", "x": 80, "y": 260,
      "width": 180, "height": 90,
      "roundness": { "type": 3 }, "roughness": 1,
      "backgroundColor": "#a5d8ff", "fillStyle": "hachure",
      "strokeColor": "#4a9eed", "strokeWidth": 2
    },
    {
      "type": "text", "x": 125, "y": 290,
      "width": 72, "height": 27,
      "text": "Input", "fontSize": 20, "fontFamily": 1,
      "strokeColor": "#1e1e1e"
    },
    {
      "type": "arrow", "x": 260, "y": 305,
      "width": 100, "height": 0,
      "points": [[0,0],[100,0]],
      "endArrowhead": "arrow",
      "strokeColor": "#1e1e1e", "strokeWidth": 2, "roughness": 1
    },
    {
      "type": "rectangle", "x": 360, "y": 260,
      "width": 180, "height": 90,
      "roundness": { "type": 3 }, "roughness": 1,
      "backgroundColor": "#d0bfff", "fillStyle": "hachure",
      "strokeColor": "#8b5cf6", "strokeWidth": 2
    },
    {
      "type": "text", "x": 397, "y": 290,
      "width": 96, "height": 27,
      "text": "Process", "fontSize": 20, "fontFamily": 1,
      "strokeColor": "#1e1e1e"
    },
    {
      "type": "arrow", "x": 540, "y": 305,
      "width": 100, "height": 0,
      "points": [[0,0],[100,0]],
      "endArrowhead": "arrow",
      "strokeColor": "#1e1e1e", "strokeWidth": 2, "roughness": 1
    },
    {
      "type": "rectangle", "x": 640, "y": 260,
      "width": 100, "height": 90,
      "roundness": { "type": 3 }, "roughness": 1,
      "backgroundColor": "#b2f2bb", "fillStyle": "hachure",
      "strokeColor": "#22c55e", "strokeWidth": 2
    },
    {
      "type": "text", "x": 647, "y": 290,
      "width": 84, "height": 27,
      "text": "Output", "fontSize": 20, "fontFamily": 1,
      "strokeColor": "#1e1e1e"
    }
  ],
  "appState": { "viewBackgroundColor": "#ffffff" }
}
```

## Example: Content Slide with Bullets

```json
{
  "elements": [
    {
      "type": "text",
      "x": 60, "y": 50,
      "width": 300, "height": 38,
      "text": "Key Takeaways",
      "fontSize": 28, "fontFamily": 1,
      "strokeColor": "#1e1e1e"
    },
    {
      "type": "line", "x": 60, "y": 95,
      "points": [[0,0],[680,0]],
      "strokeColor": "#4a9eed", "strokeWidth": 2, "roughness": 2
    },
    {
      "type": "text",
      "x": 80, "y": 120,
      "width": 600, "height": 189,
      "text": "• First important point goes here\n\n• Second point with more detail\n\n• Third point wraps up the section\n\n• Final conclusion and next steps",
      "fontSize": 20, "fontFamily": 1,
      "textAlign": "left",
      "strokeColor": "#1e1e1e"
    },
    {
      "type": "ellipse", "x": 650, "y": 430,
      "width": 80, "height": 80,
      "backgroundColor": "#fff3bf", "fillStyle": "hachure",
      "strokeColor": "#f59e0b", "strokeWidth": 2, "roughness": 2, "opacity": 50
    }
  ],
  "appState": { "viewBackgroundColor": "#ffffff" }
}
```

## Common Mistakes to Avoid

- **Missing width/height on text** — text will be INVISIBLE. Always calculate!
- **Using fontFamily 2 everywhere** — slides look generic. Use fontFamily 1 (Virgil) for the Excalidraw hand-drawn aesthetic.
- **Using roughness 0 everywhere** — loses the sketchy charm. Default to roughness 1.
- **Using fillStyle "solid" everywhere** — "hachure" looks much more hand-drawn and expressive.
- **Text too light on white bg** — never use strokeColor lighter than #555555 on white.
- **Shapes too small** — minimum 140×70 for shapes that contain text.
- **No visual hierarchy** — use background zones (opacity 30) to group related elements.
- **Flat, boring layouts** — add decorative elements (lines, shapes) as accents.

## Workflow Reminder

1. Call `read_me` once (you just did!)
2. `create_presentation` to make a new .is file
3. `add_slide` with `content` JSON string for each slide
4. `preview_slide` or `preview_presentation` to verify visuals
5. `set_slide_content` to update existing slides
"##;
