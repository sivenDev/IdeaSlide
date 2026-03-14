# IdeaSlide

A desktop presentation editor powered by [Excalidraw](https://excalidraw.com/) — sketch your slides with a freehand canvas.

[中文文档](./README.zh-CN.md)

## Features

- **Freehand Canvas** — Draw, write, and layout slides using the full Excalidraw toolkit
- **Slide Management** — Add, delete, reorder slides with live thumbnail previews
- **Image Support** — Paste or drag images onto the canvas; they persist with the file
- **Presentation Mode** — Preview and fullscreen playback with keyboard navigation
- **Native File Format** — Projects saved as `.is` files (zip archive), portable and self-contained
- **Auto Save** — Changes are automatically saved to disk
- **Recent Files** — Quick access to recently opened projects

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS v4 |
| Canvas | @excalidraw/excalidraw 0.18 |
| Desktop | Tauri v2 |
| Backend | Rust |

## Getting Started

### Prerequisites

- Node.js 18+
- Rust stable toolchain
- Tauri v2 dependencies ([setup guide](https://v2.tauri.app/start/prerequisites/))

### Install

```bash
npm install
```

### Development

```bash
# Frontend only (opens at http://localhost:1420)
npm run dev

# Full desktop app (Tauri + Vite)
npm run tauri dev
```

### Build

```bash
# Frontend production build
npm run build

# Desktop app bundle
npm run tauri build
```

### Tests

```bash
# Rust backend tests
cd src-tauri && cargo test

# Frontend regression checks
node scripts/tauriCommands-media-regression.mjs
node scripts/slide-thumbnails-image-regression.mjs
```

## Project Structure

```text
src/
  components/           # UI components (editor, preview panel, toolbar, etc.)
  hooks/                # State management and business logic hooks
  lib/tauriCommands.ts  # Frontend ↔ Backend data conversion and Tauri IPC
src-tauri/
  src/
    commands.rs         # Tauri command handlers
    file_format.rs      # .is zip format read/write with media persistence
    recent_files.rs     # Recent files tracking
    lib.rs              # Tauri app setup and command registration
```

## `.is` File Format

The `.is` file is a zip archive containing:

```text
manifest.json          # Version, timestamps, slide index
slides/{id}.json       # Per-slide Excalidraw scene data
media/index.json       # Media file registry
media/{id}.{ext}       # Image binary files
```

Saves are atomic (write to `.is.tmp`, then rename). A `.is.bak` backup is created before each overwrite.

## Contributing

Contributions are welcome! Feel free to open issues and pull requests.

## License

[MIT](./LICENSE)
