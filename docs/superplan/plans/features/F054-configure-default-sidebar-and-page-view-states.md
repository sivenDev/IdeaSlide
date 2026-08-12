---
id: "F054"
title: "Configure Default Sidebar and Page View States"
type: "feature"
status: "complete"
summary: "Persist startup defaults for the Agent panel, IdeaSketch drawer, and IdeaSketch Page name or thumbnail view."
source: "docs/superplan/human/features.md"
created: "2026-08-12"
order: 54
depends_on: ["F019", "F048", "F053"]
parent: ""
---

# Configure Default Sidebar and Page View States Plan

**Goal:** Let users choose the initial visibility and Page presentation of IdeaNote's Agent and IdeaSketch side panels instead of relying on hard-coded component defaults.
**Scope:** Add three persistent global preferences to the existing versioned Settings model: whether the Agent panel opens by default, whether the IdeaSketch drawer opens by default, and whether the IdeaSketch Pages tab initially uses Name or Thumbnail view. Agent defaults to closed as explicitly requested; the IdeaSketch drawer also preserves its current closed default, and Pages preserve their current Name default. Expose the Agent preference in Agent Settings and both IdeaSketch preferences in IdeaSketch Settings. Apply each preference when the owning shell/editor mounts while keeping the existing Agent and drawer controls and the Pages Name/Thumbnail switch available for normal in-session changes.
**Non-Goals:** This feature does not persist every manual panel toggle or Page view switch back into Settings, change Workspace panel behavior, remove existing width/tab local storage, change AI enablement or Agent activation rules, write UI preferences into `.is` files or Workspace metadata, generate thumbnails while Name mode is selected, or alter Page, Camera, document, autosave, and Agent runtime semantics.
**Architecture:** Extend `AppSettings` and `normalizeSettings` with backward-compatible defaults under the existing `agent` and `ideaSketch` sections, incrementing the settings schema version so stored older snapshots normalize safely. `EditorLayout` derives its initial Agent visibility from the loaded preference and still treats AI-disabled or context-free states as authoritative closures; it must not automatically reopen the panel merely because an editor or Workspace becomes active when the preference is off. `IdeaSketchEditor` derives only its initial drawer visibility from Settings while preserving width and selected tab in the existing local-storage record. `PageOrganizer` receives an explicit initial view-mode preference from the registry-driven IdeaSketch editor boundary, owns subsequent local switching, and keeps thumbnail demand disabled whenever the effective mode is Name. Settings controls use the completed F048 automatic-persistence session.
**Baseline:** `AppSettings` schema version 5 currently stores Agent policy, the IdeaSketch preview-laser preference, and Markdown line numbers. `EditorLayout` initializes `showAgent` to `true` and an activation effect reopens it whenever AI is usable and an editor or Workspace is active. `IdeaSketchEditor` initializes `drawerOpen` to `false`; its local-storage record retains only drawer width and selected tab. `PageOrganizer` owns local `name | thumbnail` state initialized to `name`. Agent and IdeaSketch already have registry-backed Settings sections with automatically persisted controls.
**Exit Criteria:** A clean or migrated settings snapshot contains `agent.openPanelByDefault: false`, `ideaSketch.openSidebarByDefault: false`, and `ideaSketch.pageViewMode: "name"`. Settings exposes clear English controls for all three values and persists them automatically. Starting the shell with the Agent preference off leaves the Agent panel closed even when AI is ready and a document or Workspace is active; the existing Agent toggle can still open it. Turning the preference on makes a newly mounted shell start with the Agent panel open when activation and context permit, without overriding AI-disabled or no-context states. A newly mounted IdeaSketch editor follows its drawer preference, and a newly mounted Pages organizer follows Name or Thumbnail preference while manual switching remains local to that mount. Name mode schedules no thumbnail work. Existing stored settings, drawer width/tab storage, panel resizing, AI gating, Page lifecycle, and full frontend build remain valid.

## Task 1: Extend and Expose the Persistent Defaults

**Outcome:** The versioned Settings contract and registry-driven UI safely persist all three startup preferences with conservative defaults.
**Files:**
- Modify: `src/lib/settings.ts`
- Modify: `src/components/settings/AgentSettings.tsx`
- Modify: `src/components/settings/IdeaSketchSettings.tsx`
- Modify: `tests/settings.test.mjs`

**Change Map:**
- `AppSettings` and defaults: add the Agent panel boolean, IdeaSketch drawer boolean, and `name | thumbnail` Page view enum; bump schema version and normalize malformed or older values to false/false/name
- Agent Settings: add an automatically persisted switch describing whether the Agent panel starts open
- IdeaSketch Settings: add an automatically persisted drawer switch and Page view selector using English labels and the existing Settings primitives
- focused settings regression: prove defaults, migration, invalid-value fallback, and source contracts for the three controls

**Verification:**
- `node --test tests/settings.test.mjs tests/settingsCenter.test.mjs`

- [x] Add focused failing assertions for the schema, migration defaults, invalid Page mode fallback, and Settings controls.
- [x] Implement typed normalization and the registry-owned Settings controls through the existing automatic persistence boundary.
- [x] Run the focused Settings checks and inspect normalization and accessibility failures.

## Task 2: Apply Preferences at the Correct UI Lifecycle Boundaries

**Outcome:** Agent, IdeaSketch drawer, and Pages start from Settings without converting in-session controls into persistent state.
**Files:**
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/IdeaSketchNavigator.tsx`
- Modify: `src/components/PageOrganizer.tsx`
- Modify: `tests/editorLayout.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/ideaSketchNavigator.test.mjs`
- Modify: `tests/pageOrganizer.test.mjs`

**Change Map:**
- `EditorLayout`: initialize Agent visibility from Settings after load, preserve manual open/close, and narrow the activation effect so it enforces disabled/no-context closure without defeating the default-off preference
- `IdeaSketchEditor`: initialize drawer visibility from the IdeaSketch setting while retaining the local-storage width/tab contract and current close/open controls
- `IdeaSketchNavigator` and `PageOrganizer`: pass a typed initial Page mode into the Page presentation boundary; local mode changes continue to control only the mounted organizer
- behavior regressions: cover default-off and default-on Agent startup under ready/disabled/no-context states, drawer defaults, Name/Thumbnail initial mode, manual switching, and zero thumbnail demand in Name mode

**Verification:**
- `node --test tests/editorLayout.test.mjs tests/ideaSketchEditor.test.mjs tests/ideaSketchNavigator.test.mjs tests/pageOrganizer.test.mjs tests/pageThumbnails.test.mjs`

- [x] Add focused failing lifecycle contracts for each default and the existing manual controls.
- [x] Wire settings through the shell and registry-driven IdeaSketch editor without persisting document or transient toggle state.
- [x] Run focused UI regressions and inspect Agent gating, remount behavior, and thumbnail-demand boundaries.

## Task 3: Verify and Deliver F054

**Outcome:** The three preferences ship with current regression, build, workflow, and source-control evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F054-configure-default-sidebar-and-page-view-states.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- regression and build: settings migration, automatic persistence, panel initialization, AI gating, Page mode behavior, thumbnail inactivity, and unchanged editor interactions
- workflow: record completion evidence, mark F054 complete/done, regenerate the plan index, and stage only F054 changes

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run one stabilized full frontend regression and production build after implementation stops changing.
- [x] Compare the final diff with every Exit Criterion and confirm no `.is`, Workspace metadata, or unrelated panel persistence changes.
- [x] Mark F054 complete/done and create a separate `feat(F054)` commit containing only this feature.

## Completion Evidence

- Settings schema version 6 normalizes older or malformed snapshots to `agent.openPanelByDefault: false`, `ideaSketch.openSidebarByDefault: false`, and `ideaSketch.pageViewMode: "name"`; explicit `true` and `"thumbnail"` values round-trip through the existing automatic persistence boundary.
- Focused Settings and lifecycle verification passed: `node --test tests/settings.test.mjs tests/editorLayout.test.mjs tests/ideaSketchEditor.test.mjs tests/ideaSketchNavigator.test.mjs tests/pageOrganizer.test.mjs tests/settingsCenter.test.mjs tests/pageThumbnails.test.mjs`.
- The stabilized full frontend regression passed: `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`.
- Production TypeScript and Vite build passed: `npm run build`; only the existing Excalidraw mixed-import and large-chunk warnings were reported.
- Final diff inspection confirmed the preferences affect mount/start state only: Agent and IdeaSketch controls remain manually toggleable, Page mode remains local after initialization, Name mode submits no thumbnail demand, drawer width/tab storage is unchanged, and no `.is` or Workspace metadata path changed.
- `git diff --check` passed.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/plans/features/F019-add-page-list-view-mode-switch.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-01-settings-and-ai-gating.md`
- `docs/superplan/plans/features/F048-refine-settings-navigation-and-auto-apply.md`
- `docs/superplan/plans/features/F053-migrate-unified-ideasketch-drawer-to-tauri.md`
- `src/lib/settings.ts`
- `src/components/EditorLayout.tsx`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/PageOrganizer.tsx`
