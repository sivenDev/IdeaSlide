<!-- managed-by: superplan:start -->
<!-- superplan-workspace: schema=1; generated-by=0.4.0 -->
# Workflow Guardrails
1. Before starting any new task, establish fresh workspace-safety evidence and inspect recent progress. Reuse that evidence only while the branch/worktree and relevant Git state remain unchanged. For Superplan-routed work, ask whether to use a new worktree before any mutation when meaningful Git changes risk overwrite, commit mixing, or conflicts; ignore insignificant noise. When the task is done, create a separate commit for that task's changes.
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

## Known Pitfalls

- Load Excalidraw CSS from `public/excalidraw.css` via `index.html`, not a JS import.
- Initialize `appState.collaborators` with `new Map()`; keep `SlideCanvas.onChange` stable and skip its first call after mount.
- Handle presentation keyboard events in capture phase so Excalidraw cannot consume them first.
- Global scrolling is disabled in `src/index.css`; scroll inside explicit containers and keep the editor preview wrapper `overflow-hidden`.

<claude-mem-context>
# Memory Context

# [idea-slide] recent context, 2026-07-03 10:50am GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (13,796t read) | 2,945,709t work | 100% savings

### Apr 21, 2026
6353 11:52a ⚖️ Slide store reducer will be extracted into pure library module for testing
6362 11:59a ⚖️ IdeaSlide implementation will use same-session subagent-driven execution instead of parallel plan execution
6363 " ⚖️ IdeaSlide execution workflow requires isolated workspace before implementation starts
6364 " ⚖️ IdeaSlide task completion will require fresh verification evidence and explicit review requests
6365 12:00p ⚖️ IdeaSlide feature execution must leave `master` and use ignored `.worktrees` workspace
6383 12:05p 🔄 Slide store reducer moved into pure library module in IdeaSlide
6384 " 🟣 IdeaSlide slides now carry persistent title field and titled slide creation path
6387 12:06p 🔄 Slide store reducer extracted into pure module
6388 " 🟣 Slides now carry persistent title field
6389 " 🔴 Node test imports require explicit `.ts` path for reducer helper
6390 " 🔵 Title persistence helper still missing manifest serializer
6391 " ⚖️ Organizer and laser work split between persistent store logic and presentation-local pointer state
6392 12:09p 🔵 Editor session persistence flow preserves slide titles during draft commit and flush
6395 " 🟣 IS file conversions now persist slide titles through save and load
6396 " ✅ Title-aware editor session persistence passed focused tests and production build
6399 12:10p 🔵 Slide organizer wiring now guarded by source-level test for shared UI primitives
6402 " ✅ Slide organizer dependencies installed for popover and drag sorting
6403 " 🟣 Shared Popover primitive added for organizer surface
6406 " 🟣 Shared Input primitive added for slide organizer rename flow
6407 12:11p ✅ Shared organizer primitives committed with dependency graph update
6409 " ⚖️ Organizer migration will replace inline toolbar slide rows with dedicated popover component
6412 " 🔵 Toolbar still uses legacy slide dropdown and numeric slide summary
6413 " 🔵 EditorLayout already holds state needed for organizer persistence-safe toolbar migration
6414 12:13p 🔵 Organizer TDD now blocked by missing toolbar migration and absent SlideOrganizer component
6415 " 🔵 Editor and store layers already support title-aware organizer wiring
6424 12:16p ✅ Slide organizer popover wiring passes dedicated guard tests
6425 " 🔴 Toolbar build failure fixed after dropdown-to-popover migration
6426 " 🔵 IdeaSlide test setup is source-string based, not DOM-render based
6427 " 🔵 Slide title helper now normalizes manifest titles in both load and save paths
6431 " ✅ Slide organizer tests now require inline rename flow
6432 " 🔵 SlideOrganizer scaffold fails new rename contract at first missing input import
6437 12:17p 🟣 Slide organizer now supports inline title rename inside popover
6438 " ✅ Inline rename contract is green in tests and build
6448 12:18p 🟣 Slide organizer now supports drag reorder through dnd-kit sortable rows
6449 " ✅ Organizer reorder wiring verified with reducer regression coverage and production build
6450 " 🔵 Presentation laser pointer likely needs custom overlay instead of built-in Excalidraw collaborator API
6451 12:21p 🔵 Excalidraw package ships hidden type surface under dist/types despite sparse top-level install layout
6460 12:24p 🔵 SlideCanvas treats camera preview and collaborators as transient Excalidraw UI state
6461 " 🔵 Excalidraw public API supports laser pointers through collaborator scene updates
6462 " 🔵 PresentationMode test coverage exists for camera viewport flow but not laser toggle
6465 12:27p 🟣 Presentation mode now supports transient Excalidraw laser pointer toggled with K
6466 " 🟣 Presentation laser helper library added for scene-coordinate conversion and collaborator payloads
6467 " ✅ Presentation laser regression tests added and build stays green with known bundle warnings
6468 " ✅ Editor shell regression tests now lock organizer popover architecture instead of old inline slide rows
6469 " ✅ Organizer, title, reducer, camera, tooltip, and laser regression suites all pass together
6470 " ✅ Production build still succeeds after organizer and laser follow-up test updates
6473 12:28p ✅ Slide organizer and presentation laser implementation plan finished end to end
6490 2:05p 🔵 IdeaSlide Tauri dev flow boots Vite and Rust watcher together
6491 2:13p 🔵 Slide organizer now supports inline rename inside shared popover
6492 " 🔵 Toolbar slide control opens organizer through shared Popover

Access 2946k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
