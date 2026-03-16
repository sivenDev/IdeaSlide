---
name: ideaslide
description: Create and modify IdeaSlide presentations (.is files) using MCP tools. Use when user asks to create slides, presentations, or modify .is files.
trigger_patterns:
  - "create.*slide"
  - "make.*presentation"
  - "add.*slide"
  - "edit.*slide"
  - "modify.*presentation"
  - "generate.*slides"
  - "build.*deck"
---

# IdeaSlide Presentation Builder

Use this skill when working with IdeaSlide presentations (.is files). This skill leverages the idea-slide MCP server to programmatically create and modify presentations.

## Available MCP Tools

The following MCP tools are available (prefix with `mcp__plugin_idea-slide_idea-slide__`):

1. **read_me** - Get Excalidraw element format reference
   - Parameters: none
   - Returns: color palette, element types, layout guidelines, examples
   - Call ONCE at the start of a session before creating slide content

2. **create_presentation** - Create a new .is file
   - Parameters: `path` (absolute path)

3. **open_presentation** - Open existing .is file
   - Parameters: `path`
   - Returns: manifest metadata and slide list

4. **list_slides** - List all slides
   - Parameters: `path`
   - Returns: slide IDs and titles

5. **add_slide** - Add a new slide
   - Parameters: `path`, `index` (optional), `content` (optional Excalidraw JSON)

6. **delete_slide** - Delete a slide
   - Parameters: `path`, `slide_id`

7. **reorder_slides** - Reorder slides
   - Parameters: `path`, `slide_ids` (array in desired order)

8. **get_slide_content** - Get slide's Excalidraw JSON
   - Parameters: `path`, `slide_id`

9. **set_slide_content** - Update slide content
   - Parameters: `path`, `slide_id`, `content` (Excalidraw JSON string)

10. **preview_slide** - Render slide to PNG
    - Parameters: `path`, `slide_id`, `output_path` (optional)
    - Returns: base64 PNG data or file path

11. **preview_presentation** - Render all slides
    - Parameters: `path`, `output_dir` (optional)
    - Returns: array of base64 PNG data or file paths

12. **get_presentation_info** - Get metadata only
    - Parameters: `path`

## Excalidraw JSON Format

Slides use Excalidraw's JSON format. Basic structure:

```json
{
  "elements": [
    {
      "type": "rectangle",
      "x": 100,
      "y": 100,
      "width": 200,
      "height": 100,
      "strokeColor": "#000000",
      "backgroundColor": "#ffffff",
      "fillStyle": "solid",
      "strokeWidth": 2,
      "roughness": 1,
      "opacity": 100
    },
    {
      "type": "text",
      "x": 150,
      "y": 130,
      "width": 100,
      "height": 40,
      "text": "Hello World",
      "fontSize": 20,
      "fontFamily": 1,
      "textAlign": "center",
      "verticalAlign": "middle"
    }
  ],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "gridSize": null
  }
}
```

### Common Element Types

- **rectangle**: `{type, x, y, width, height, strokeColor, backgroundColor, fillStyle, strokeWidth, roughness, opacity}`
- **ellipse**: Same as rectangle
- **diamond**: Same as rectangle
- **text**: `{type, x, y, width, height, text, fontSize, fontFamily, textAlign, verticalAlign, strokeColor}`
- **line**: `{type, x, y, points: [[x1,y1], [x2,y2]], strokeColor, strokeWidth}`
- **arrow**: Same as line with `startArrowhead` and `endArrowhead`
- **freedraw**: `{type, x, y, points: [[x1,y1], ...], strokeColor, strokeWidth}`

### Common Properties

- **strokeColor**: Hex color (e.g., "#000000")
- **backgroundColor**: Hex color
- **fillStyle**: "solid", "hachure", "cross-hatch"
- **strokeWidth**: 1, 2, 4 (thin, bold, extra-bold)
- **roughness**: 0 (architect), 1 (artist), 2 (cartoonist)
- **opacity**: 0-100
- **fontFamily**: 1 (Virgil), 2 (Helvetica), 3 (Cascadia)

## Workflow

### Creating a New Presentation

1. **Get the format reference**
   ```
   Use mcp__plugin_idea-slide_idea-slide__read_me
   (no parameters — call once per session)
   ```

2. **Create the file**
   ```
   Use mcp__plugin_idea-slide_idea-slide__create_presentation
   with path="/absolute/path/to/presentation.is"
   ```

3. **Add slides with content**
   ```
   Use mcp__plugin_idea-slide_idea-slide__add_slide
   with path, content (Excalidraw JSON as string)
   ```

4. **Preview the result**
   ```
   Use mcp__plugin_idea-slide_idea-slide__preview_presentation
   with path, output_dir (optional)
   ```

### Modifying Existing Presentation

1. **Open and inspect**
   ```
   Use mcp__plugin_idea-slide_idea-slide__open_presentation
   to see slide list
   ```

2. **Get slide content**
   ```
   Use mcp__plugin_idea-slide_idea-slide__get_slide_content
   to retrieve current Excalidraw JSON
   ```

3. **Modify and update**
   ```
   Parse JSON, modify elements, then use
   mcp__plugin_idea-slide_idea-slide__set_slide_content
   with updated JSON string
   ```

4. **Preview changes**
   ```
   Use mcp__plugin_idea-slide_idea-slide__preview_slide
   to render the modified slide
   ```

## Best Practices

1. **Always use absolute paths** - MCP tools require absolute paths to .is files

2. **Validate JSON** - Ensure Excalidraw JSON is valid before calling set_slide_content

3. **Use preview tools** - Preview slides to verify visual output matches intent

4. **Coordinate elements** - Position elements with appropriate x, y coordinates
   - Canvas center is approximately (400, 300)
   - Leave margins for readability

5. **Layer elements** - Elements are rendered in array order (first = bottom layer)

6. **Text sizing** - Common font sizes: 20 (body), 28 (heading), 36 (title)

7. **Color consistency** - Use a consistent color palette across slides

8. **Error handling** - Check MCP tool responses for errors before proceeding

## Example: Create a Simple Title Slide

```javascript
// 1. Create presentation
mcp__plugin_idea-slide_idea-slide__create_presentation({
  path: "/Users/username/Desktop/demo.is"
})

// 2. Add title slide
const titleSlide = {
  elements: [
    {
      type: "text",
      x: 200,
      y: 250,
      width: 400,
      height: 100,
      text: "My Presentation",
      fontSize: 36,
      fontFamily: 2,
      textAlign: "center",
      verticalAlign: "middle",
      strokeColor: "#1971c2"
    },
    {
      type: "text",
      x: 250,
      y: 350,
      width: 300,
      height: 40,
      text: "Created with IdeaSlide",
      fontSize: 20,
      fontFamily: 2,
      textAlign: "center",
      verticalAlign: "middle",
      strokeColor: "#495057"
    }
  ],
  appState: {
    viewBackgroundColor: "#ffffff"
  }
}

mcp__plugin_idea-slide_idea-slide__add_slide({
  path: "/Users/username/Desktop/demo.is",
  content: JSON.stringify(titleSlide)
})

// 3. Preview
mcp__plugin_idea-slide_idea-slide__preview_slide({
  path: "/Users/username/Desktop/demo.is",
  slide_id: "...", // Get from add_slide response
  output_path: "/Users/username/Desktop/preview.png"
})
```

## Tips

- Start with simple shapes and text, then add complexity
- Use the preview tools frequently to verify visual output
- Keep slide content focused - one main idea per slide
- Use consistent spacing and alignment
- Test with different roughness values for visual style
- Remember: coordinates are in pixels, origin is top-left

## Common Patterns

### Centered Title
```json
{
  "type": "text",
  "x": 300,
  "y": 200,
  "width": 400,
  "height": 80,
  "text": "Title Here",
  "fontSize": 36,
  "fontFamily": 2,
  "textAlign": "center",
  "verticalAlign": "middle"
}
```

### Bullet Points
```json
{
  "type": "text",
  "x": 150,
  "y": 200,
  "width": 500,
  "height": 200,
  "text": "• Point 1\n• Point 2\n• Point 3",
  "fontSize": 20,
  "fontFamily": 1,
  "textAlign": "left",
  "verticalAlign": "top"
}
```

### Diagram Box
```json
{
  "type": "rectangle",
  "x": 200,
  "y": 200,
  "width": 150,
  "height": 100,
  "strokeColor": "#1971c2",
  "backgroundColor": "#e7f5ff",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "roughness": 1
}
```

### Arrow Connection
```json
{
  "type": "arrow",
  "x": 350,
  "y": 250,
  "points": [[0, 0], [100, 0]],
  "strokeColor": "#000000",
  "strokeWidth": 2,
  "startArrowhead": null,
  "endArrowhead": "arrow"
}
```
