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

## Color Palette (use consistently across slides)

### Primary Colors
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

## Element Types

### Rectangle
```json
{ "type": "rectangle", "x": 100, "y": 100, "width": 200, "height": 100 }
```
- `roundness: { "type": 3 }` for rounded corners
- `backgroundColor: "#a5d8ff"`, `fillStyle: "solid"` for filled

### Ellipse
```json
{ "type": "ellipse", "x": 100, "y": 100, "width": 150, "height": 150 }
```

### Diamond
```json
{ "type": "diamond", "x": 100, "y": 100, "width": 150, "height": 150 }
```

### Text
```json
{ "type": "text", "x": 150, "y": 138, "text": "Hello", "fontSize": 20 }
```
- `fontFamily`: 1 (Virgil/hand-drawn), 2 (Helvetica), 3 (Cascadia/mono)
- `textAlign`: "left", "center", "right" (only affects multi-line wrapping)
- x is the LEFT edge. To center at cx: set x = cx - (text.length × fontSize × 0.5) / 2

### Arrow
```json
{
  "type": "arrow", "x": 300, "y": 150,
  "width": 200, "height": 0,
  "points": [[0,0],[200,0]],
  "endArrowhead": "arrow"
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
  "strokeColor": "#000000", "strokeWidth": 2
}
```

## Common Properties (all elements)

| Property        | Default       | Options                              |
|-----------------|---------------|--------------------------------------|
| strokeColor     | "#1e1e1e"     | Any hex color                        |
| backgroundColor | "transparent" | Any hex color                        |
| fillStyle       | "solid"       | "solid", "hachure", "cross-hatch"    |
| strokeWidth     | 2             | 1 (thin), 2 (normal), 4 (bold)      |
| roughness       | 1             | 0 (architect), 1 (artist), 2 (cartoon) |
| opacity         | 100           | 0-100                                |

## Slide Canvas Dimensions

IdeaSlide renders at approximately 800×600. Design for this viewport:
- Center content around (400, 300)
- Leave 50px margins on all sides
- Effective content area: roughly 700×500

## Font Size Guidelines

| Use Case    | fontSize | Notes                    |
|-------------|----------|--------------------------|
| Title       | 36       | One per slide, prominent |
| Heading     | 28       | Section headers          |
| Body        | 20       | Default readable size    |
| Caption     | 16       | Minimum readable size    |
| NEVER below | 14       | Unreadable at display    |

## Text Contrast Rules

- On white backgrounds: minimum text strokeColor is #555555
- For colored text on light fills: use dark variants (#15803d not #22c55e)
- Do NOT use emoji in text — Excalidraw fonts don't render them

## Layout Best Practices

1. **Title slide**: Large centered title (fontSize 36) + subtitle (fontSize 20)
2. **Content slide**: Title at top + body content below
3. **Diagram slide**: Shapes + arrows + labels
4. **Minimum shape size**: 120×60 for labeled shapes
5. **Spacing**: 20-30px gaps between elements minimum
6. **Z-order**: Array order = z-order (first = back, last = front)

## Example: Title Slide

```json
{
  "elements": [
    {
      "type": "text",
      "x": 200, "y": 220,
      "width": 400, "height": 80,
      "text": "My Presentation",
      "fontSize": 36,
      "fontFamily": 2,
      "textAlign": "center",
      "strokeColor": "#1971c2"
    },
    {
      "type": "text",
      "x": 250, "y": 320,
      "width": 300, "height": 40,
      "text": "Created with IdeaSlide",
      "fontSize": 20,
      "fontFamily": 2,
      "textAlign": "center",
      "strokeColor": "#495057"
    }
  ],
  "appState": { "viewBackgroundColor": "#ffffff" }
}
```

## Example: Two Connected Boxes

```json
{
  "elements": [
    {
      "type": "rectangle", "x": 100, "y": 250,
      "width": 200, "height": 100,
      "roundness": { "type": 3 },
      "backgroundColor": "#a5d8ff", "fillStyle": "solid"
    },
    {
      "type": "text", "x": 150, "y": 285,
      "text": "Step 1", "fontSize": 20, "fontFamily": 2
    },
    {
      "type": "rectangle", "x": 500, "y": 250,
      "width": 200, "height": 100,
      "roundness": { "type": 3 },
      "backgroundColor": "#b2f2bb", "fillStyle": "solid"
    },
    {
      "type": "text", "x": 555, "y": 285,
      "text": "Step 2", "fontSize": 20, "fontFamily": 2
    },
    {
      "type": "arrow", "x": 300, "y": 300,
      "width": 200, "height": 0,
      "points": [[0,0],[200,0]],
      "endArrowhead": "arrow",
      "strokeWidth": 2
    }
  ],
  "appState": { "viewBackgroundColor": "#ffffff" }
}
```

## Workflow Reminder

1. Call `read_me` once (you just did!)
2. `create_presentation` to make a new .is file
3. `add_slide` with `content` JSON string for each slide
4. `preview_slide` or `preview_presentation` to verify visuals
5. `set_slide_content` to update existing slides
"##;
