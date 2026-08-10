# Open Frame Shell Review

This directory is an isolated frontend review project. It does not import the production IdeaNote application, invoke Tauri commands, or connect to local files.

## Review boundary

The prototype designs only the outer desktop shell:

- native macOS window integration and traffic-light placement;
- independent Workspace region;
- format-neutral Editor Host aperture;
- independent Agent region;
- region-local headers instead of one global title bar;
- Codex-style independent panel close and restore behavior;
- command entry points, Preferences, and Light/Dark/System preview.

It deliberately does not design table, IdeaSketch/Excalidraw, Markdown, Workflow, or any other editor-owned surface. Selecting the sample `.is`, `.md`, `.table`, and `.workflow` files changes only shell-owned document identity and the Agent's attached-document label. The center aperture remains identical.

## Design direction: Open Frame

The rejected F040 shell filled too much of the application with branded chrome and visually separated the Agent through a pale accent surface. Open Frame uses neutral native materials and lets structural seams do the work:

- no global title bar, centered product title, permanent Save button, Home button, gradient, glass surface, or decorative context line;
- Workspace, Editor Host, and Agent each own a compact local crown;
- Workspace and Agent use persistent panel icons in the top chrome instead of seam arrows or collapsed rails;
- the empty center is intentional and marks the ownership boundary for registered editors;
- Agent is application infrastructure, not the visual hero;
- color is limited to file identity, selection, focus, and truthful status.

## Panel interaction

The F042 refinement follows the supplied Codex client reference without copying its branding or content:

- the left panel button sits beside the macOS traffic lights;
- the right panel button stays at the outer-right edge of the top chrome;
- an open panel owns the surface underneath its button;
- a closed panel becomes `0px` wide and returns all released width to Editor Host;
- the same button remains stationary over Editor Host and restores the panel;
- Workspace and Agent state remain independent;
- no seam button, branded collapsed rail, or replacement global toolbar remains.

## Run locally

From the repository root:

```bash
./node_modules/.bin/vite --config .temp/f041-native-workbench-review/vite.config.js
```

Open `http://127.0.0.1:4176/`.

## Interactions to review

- Select each heterogeneous file in Workspace and confirm the center remains format-neutral.
- Close and restore Workspace and Agent independently from the two top-chrome panel buttons.
- Confirm each closed panel becomes `0px` wide rather than leaving a rail.
- Open the command palette with `Command/Ctrl + K`.
- Open Preferences with `Command/Ctrl + ,` and switch Light, Dark, and System.
- Resize through 1440x900, 1200x850, 1100x850, and 850x850.

## Review captures

- [`screenshots/workbench-light-1440x900.png`](screenshots/workbench-light-1440x900.png)
- [`screenshots/workbench-dark-1200x850.png`](screenshots/workbench-dark-1200x850.png)
- [`screenshots/workbench-compact-1100x850.png`](screenshots/workbench-compact-1100x850.png)
- [`screenshots/workbench-minimum-850x850.png`](screenshots/workbench-minimum-850x850.png)

The verified region widths are:

- 1440px default: `252 / 834 / 352`;
- 1440px with Workspace closed: `0 / 1086 / 352`;
- 1440px with both panels closed: `0 / 1438 / 0`;
- 1200px captured dark state with Agent closed: `252 / 946 / 0`;
- 1100px compact default: `0 / 778 / 320`;
- 850px minimum default: `0 / 848 / 0`;
- 850px with both panels restored: `252 / 276 / 320`.

Every state has zero page-level horizontal overflow. File selection, Agent attachment, Light/Dark/System, visible focus, and the generic editor ownership boundary remain unchanged while panels close and restore.

Production migration is explicitly out of scope. A separate human approval is required before any design from this directory moves into `src/`.
