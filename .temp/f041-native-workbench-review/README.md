# F041 Open Frame Shell Review

This directory is an isolated frontend review project. It does not import the production IdeaNote application, invoke Tauri commands, or connect to local files.

## Review boundary

The prototype designs only the outer desktop shell:

- native macOS window integration and traffic-light placement;
- persistent Workspace region;
- format-neutral Editor Host aperture;
- independent Agent region;
- region-local headers instead of one global title bar;
- independent panel collapse and restore behavior;
- command entry points, Preferences, and Light/Dark/System preview.

It deliberately does not design table, IdeaSketch/Excalidraw, Markdown, Workflow, or any other editor-owned surface. Selecting the sample `.is`, `.md`, `.table`, and `.workflow` files changes only shell-owned document identity and the Agent's attached-document label. The center aperture remains identical.

## Design direction: Open Frame

The rejected F040 shell filled too much of the application with branded chrome and visually separated the Agent through a pale accent surface. Open Frame uses neutral native materials and lets structural seams do the work:

- no global title bar, centered product title, permanent Save button, Home button, gradient, glass surface, or decorative context line;
- Workspace, Editor Host, and Agent each own a compact local crown;
- the empty center is intentional and marks the ownership boundary for registered editors;
- Agent is application infrastructure, not the visual hero;
- color is limited to file identity, selection, focus, and truthful status.

## Run locally

From the repository root:

```bash
./node_modules/.bin/vite --config .temp/f041-native-workbench-review/vite.config.js
```

Open `http://127.0.0.1:4176/`.

## Interactions to review

- Select each heterogeneous file in Workspace and confirm the center remains format-neutral.
- Collapse and restore Workspace and Agent independently.
- Open the command palette with `Command/Ctrl + K`.
- Open Preferences with `Command/Ctrl + ,` and switch Light, Dark, and System.
- Resize through 1440x900, 1200x850, 1100x850, and 850x850.

## Review captures

- [`screenshots/workbench-light-1440x900.png`](screenshots/workbench-light-1440x900.png)
- [`screenshots/workbench-dark-1200x850.png`](screenshots/workbench-dark-1200x850.png)
- [`screenshots/workbench-compact-1100x850.png`](screenshots/workbench-compact-1100x850.png)
- [`screenshots/workbench-minimum-850x850.png`](screenshots/workbench-minimum-850x850.png)

The verified default region widths are 252 / 834 / 352 at 1440px, 252 / 594 / 352 at 1200px, 48 / 730 / 320 at 1100px, and 48 / 752 / 48 at 850px. At the minimum width, either side can still be restored independently; restoring both leaves a 276px Editor Host and does not create page-level overflow.

Production migration is explicitly out of scope. A separate human approval is required before any design from this directory moves into `src/`.
