# Complete Review Capability Matrix

| Capability | Review interaction | Real frontend behavior | Mocked platform boundary | Evidence |
| --- | --- | --- | --- | --- |
| Open Frame shell | Launch directly into Welcome; collapse either outer panel | Explicit grid areas keep Editor Host visible and expanded; Agent remains context-gated on documents | Native window chrome and drag regions are visual only | Compact and minimum screenshots; shell chrome tests |
| Workspaces and Recents | Expand roots and folders; open standalone Recents | Shared navigation, selection, supported-file filtering, row actions, standalone-only Recent invariant | Directory enumeration and Recent persistence | Browser walkthrough; navigation and `MockDesktopApi` tests |
| Workspace and Single File sessions | Open tree file or `personal-notes.md` | One document-session core and editor registry | Native open dialogs and real path access | Session and desktop API tests |
| File operations | Use a root/directory `+`; use root/directory/file overflow | Target-relative creation and Radix-backed menus with outside/Escape dismissal; contextual rename, simulated Finder reveal, Trash, Workspace removal, and confirmation | Real filesystem mutation, Finder, and system Trash | Light/minimum screenshots; transient-overlay, navigation, and desktop API tests |
| Save lifecycle | Edit, use `Command/Ctrl+S`, autosave, switch or close while dirty | Leading status/close lens communicates clean/dirty/saving/warning/error and preserves Save/Discard/Cancel | Atomic write, external fingerprint, recovery write | Shell chrome, session, and reliability tests |
| Save As and exit | Command Palette or protected-state action | Explicit copy decision and dirty application-exit gate | Native save dialog and actual app termination | Command and browser QA |
| Recovery | Select Recovery available/corrupt | Restore/Discard decisions, dirty restored draft, preserved source | Recovery-file discovery and parsing | Scenario and browser QA |
| External changes | Select clean/dirty/rename/delete/root-missing | Reload, Keep, Save As, Reload/Discard, Cancel, Close; no silent overwrite | Filesystem watcher events and root availability | Reliability tests; browser QA |
| Unsupported documents | Select Unsupported file | Registry fallback with safe read-only preview | File bytes originate from fixtures | Scenario QA |
| Markdown editor | Open `product-brief.md` or `field-notes.md` | CodeMirror 6, GFM preview, Outline, formatting, line endings, Undo/Redo | Source read/write | Markdown tests; dark screenshot |
| IdeaSketch editor | Open `launch-plan.is` | Excalidraw, Pages, Cameras, presentation, laser, conversions, exports | Source read/write and native export dialogs | IdeaSketch tests; compact screenshot |
| Settings | Open Settings or `Command/Ctrl+,` | Grouped Application/AI/Editors/Review navigation, immediate theme, Agent-owned AI gate, password Token, deterministic Test connection, and test-gated Model select | Native secure storage and Provider network/model catalog | Settings tests; Provider screenshot; browser QA |
| Themes | Choose Light, Dark, System | CSS tokens and system preference response | None beyond browser preference | Light/dark screenshots |
| Runtime selection | Settings → Agent | Automatic Codex selection or honest Compatibility capability reduction | Real app-server/process health | Agent Tool tests; Runtime Inspector |
| Skills | Settings → Skills | Managed list, scope, enable/disable, invalid-state explanation | Folder picker, Skill parser, persisted registry | Settings and scenario QA |
| Agent conversations | Open the crown conversation selector and a row overflow menu | Current-conversation selector, Rename/Delete-only row menus, safe dialogs, unique local identities, New conversation, steering, cancel, and retry | Provider conversation persistence | Dark screenshot; Agent panel and interaction tests |
| Agent diagnostics and composer | Open Runtime Inspector; review short and long transcripts | Dismissible Radix dialog with Escape/focus restoration; transcript owns remaining height and scrolling while composer stays at panel bottom | Runtime health, model, context, and capability evidence | Agent panel regression; browser outside-click and geometry checks |
| Agent activity and Tools | Ask for outline or native edit | Public chronology, bounded adapters, native editor transaction and Undo | Model output, Tool planning, token counts | Agent interaction and Tool policy tests |
| Protected Agent edits | Select Editor Tool rejected | Read-only/conflict/missing/stale adapter rejection | Real backend Tool execution | Agent Tool tests; scenario QA |
| Command Palette | `Command/Ctrl+K` | Search, keyboard navigation, contextual disablement, routing | Actual application exit only | Layout/command tests; browser QA |
| Independent resizing | Drag or arrow Workspaces, Navigator, split, Agent | Bounded pointer/keyboard dividers and stored demo preferences | Native window resizing | Browser QA at four target frames |
| Responsive behavior | Review 1440×900, 1200×850, 1100×850, 850×850 | Minimum editor width, independent panel collapse, no shell overflow | Host window size | Four PNG screenshots; browser bounds checks |

## Verification boundary

Passing this matrix proves the browser frontend behavior and deterministic contracts shown here. It does not prove real filesystem safety, Tauri permissions, OS dialog behavior, native fullscreen, system Trash, credential security, provider compatibility, process supervision, or network reliability.
