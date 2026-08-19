<!-- managed-by: superplan:start -->
<!-- superplan-workspace: schema=1; generated-by=0.6.0 -->
# Workflow Guardrails
1. Before starting any new task, establish fresh workspace-safety evidence and inspect recent progress. Reuse that evidence only while the branch/worktree and relevant Git state remain unchanged. For Superplan-routed work, ask whether to use a new worktree before any mutation when meaningful Git changes risk overwrite, commit mixing, or conflicts; ignore insignificant noise. Before a required human-decision pause after current-task mutations, validate and create a task-scoped checkpoint commit without including pre-existing, unrelated, or known-invalid state. When the task is done, create a separate commit for that task's changes.
2. At task start, check workspace compatibility, then inspect progress through compact human summaries/exact entries and the plan catalog; read full registries only for repair or cross-entry analysis. Update progress when complete. Plans live under `./docs/superplan/plans`.
3. For structural plan changes, run exhaustive global validation, search all statuses for source/dependency/scope/artifact candidates, and read the changed plan plus discovered related closure in full; use local plan/index validation for routine progress updates.
4. For work routed through Superplan, the approved plan, delivery-loop risk profile, and artifact-aware verification matrix are the project-level authority for persisted artifacts, testing, verification, delegation, and task-level traceability. Reuse unaffected evidence instead of rerunning unchanged checks.
<!-- managed-by: superplan:end -->

# IdeaNote

Product scope, architecture decisions, and acceptance criteria are defined in `docs/superplan/human/prd.md`. Do not duplicate or contradict them here; implementation follows approved plans in `docs/superplan/plans/`.

## Commands

```bash
npm run tauri dev                    # Tauri app + Vite
npm run dev                          # Frontend only
npm run build                        # TypeScript check + production build
cd src-tauri && cargo build          # Rust build
cd src-tauri && cargo test           # Rust tests
```

## Rules

- Prefer established, actively maintained open-source libraries for controls and UI primitives. Build custom controls only when no suitable library meets the requirement.
- Preserve the PRD principles: real files are the source of truth, Workspace and Single File modes share one core, metadata is lazy, and editors remain registry-driven.
- Keep shared commands and infrastructure format-agnostic; isolate editor-specific parsing, validation, reading, and writing.
- Keep file operations local-first and safe: atomic writes, recovery where applicable, and no silent overwrite of external changes.
- Use Tauri v2 APIs. Add required permissions to `src-tauri/capabilities/default.json`; missing permissions may fail silently.
- Keep TypeScript strict and free of unused locals/parameters.
- Keep all user-facing text in English.
- Load Excalidraw CSS from `public/excalidraw.css` via `index.html`, not a JS import.
- Handle presentation keyboard events in capture phase so Excalidraw cannot consume them first.
