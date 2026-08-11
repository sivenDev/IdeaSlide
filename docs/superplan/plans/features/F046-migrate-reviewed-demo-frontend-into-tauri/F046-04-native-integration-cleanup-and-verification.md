---
id: "F046-04"
title: "Complete Native Integration, Cleanup, and End-to-End Verification"
type: "feature"
status: "draft"
summary: "Close remaining Tauri boundaries, remove obsolete shell assumptions, and verify the migrated workbench against production file, editor, settings, Agent, and native-window behavior."
source: "docs/superplan/human/features.md"
created: "2026-08-11"
order: 59
depends_on: ["F046-02", "F046-03"]
parent: "F046"
---

# Complete Native Integration, Cleanup, and End-to-End Verification Plan

**Goal:** Finish the demo-to-production migration as a cohesive native release candidate with no mock leakage, obsolete Home chrome, or unverified file/Agent safety boundary.
**Scope:** Audit and complete all Tauri v2 commands, events, plugin permissions, settings migrations, native window subscriptions, file reveal/Trash/rename/move behavior, recents persistence, Agent metadata persistence, and frontend error/loading states required by F046-01 through F046-03. Remove obsolete production shell modules and demo-derived assumptions only after replacements are proven. Update product contracts and delivery evidence, then run focused, full frontend, Rust, build, native, responsive, accessibility, theme, and disposable-file acceptance. Keep the existing production IdeaSketch/Excalidraw editor and presentation behavior, including CSS loading and capture-phase keyboard handling.
**Non-Goals:** This plan does not migrate the demo Excalidraw editor, ship Review Scenarios or mock APIs, redesign editor content surfaces, add new providers/editors, alter user files for QA, package/publish a public release, delete archived user data, or weaken permissions/safety to make tests pass. It does not re-run unchanged evidence without a relevant mutation.
**Architecture:** Treat the approved F046 plans and production PRD as the authority. Every frontend action that crosses the desktop boundary has one typed wrapper, one registered Tauri command/plugin call, explicit capability permission, and a recoverable user-facing failure. Rust services remain format-agnostic except existing document-format modules; editor-specific settings/parsing stay within registry/editor boundaries. Settings migrations are versioned and backward compatible. File QA uses disposable temporary Workspaces and standalone files only. Final verification follows the high-risk profile because the change spans native lifecycle, real filesystem operations, settings/credential migrations, persistent Agent data, and broad shell replacement. Browser checks prove responsive interaction composition; native Tauri checks prove platform/window/dialog/filesystem integration. Production IdeaSketch is regression-only and never replaced by demo code.
**Baseline:** The first three F046 plans will alter broad frontend surfaces and may introduce narrowly scoped backend commands or schema fields. The repository already has Tauri v2 command registration, capability declarations, Rust unit tests, frontend contract tests, Vite production build, Tauri dev commands, local file recovery/external-change protections, and production IdeaSketch/Markdown/Agent implementations. Existing commands and permissions cover most required behavior, but the complete migration needs a final cross-boundary audit to prevent silent permission failures, stale legacy branches, mock copy, or inconsistent persistence.
**Exit Criteria:** No production import references `MockDesktopApi`, demo fixtures, Review Scenarios, failure injection, mock platform flags, mock labels, or demo Excalidraw modules. No Home/Launch route, global branded title bar, visible Save/Close/revision chrome, recent Workspace list, redundant Agent navigation, Automatic Skill, Incremental, or unsupported Skill-disable control remains. Every migrated native action has a typed boundary, registered command/plugin, least-required capability, truthful progress/error state, and regression evidence. Existing real-file invariants—atomic writes, recovery, external-change detection, no silent overwrite, Workspace containment, lazy metadata, registry-driven editors, shared Workspace/Standalone core—pass. Existing IdeaSketch editing/presentation, Excalidraw stylesheet loading from `public/excalidraw.css`, and capture-phase presentation keys pass unchanged. Full frontend tests, Rust tests, production build, native compile/start, browser/native acceptance, theme/accessibility/responsive checks, diff hygiene, Superplan validation, and separate F046 delivery commits pass.

## Task 1: Audit and Complete Tauri Commands, Permissions, and Migrations

**Outcome:** Every reviewed interaction uses a complete, typed, permissioned, backward-compatible production boundary.
**Files:**
- Modify: `src/lib/tauriCommands.ts`
- Modify: `src/lib/settings.ts`
- Modify: `src/lib/agent/types.ts`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/settings.rs`
- Modify: `src-tauri/src/recent_files.rs`
- Modify: `src-tauri/src/workspace.rs`
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/repository.rs`
- Modify: `src-tauri/src/agent/provider.rs`
- Modify: `src-tauri/src/agent/types.rs`
- Modify: `src-tauri/capabilities/default.json`
- Create: `tests/tauriCommandContract.test.mjs`
- Test: `src-tauri/src/settings.rs`
- Test: `src-tauri/src/recent_files.rs`
- Test: `src-tauri/src/workspace.rs`
- Test: `src-tauri/src/agent/repository.rs`

**Change Map:**
- command inventory: frontend wrapper -> invoke/plugin -> Rust handler/service -> serialization/error mapping
- capability audit: window, dialog, opener, store, events, and any new command permissions with no broad unused grants
- migrations: settings and Agent Turn metadata preserve legacy data and deterministic defaults
- native error contract: cancellation, permission denial, missing path, external conflict, provider failure, and unsupported capability remain distinguishable and user-actionable

**Verification:**
- `node --test tests/tauriCommandContract.test.mjs tests/settings.test.mjs tests/recentFiles.test.mjs tests/agentTurnEvidence.test.mjs`
- `cd src-tauri && cargo test`
- Static audit: every exported migrated wrapper has a registered command/plugin path and required capability; every new Rust command is covered by serialization/error tests.

- [ ] Build a complete cross-boundary inventory and add missing contract/migration regressions.
- [ ] Fill only the narrow commands and permissions required by the approved interaction plans.
- [ ] Verify legacy settings/Threads/Turns and all failure classes before cleanup.

## Task 2: Remove Obsolete and Mock-derived Production Paths

**Outcome:** Production contains one coherent workbench implementation and no fallback to the old Home or demo simulation architecture.
**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/index.css`
- Modify: `tests/reviewedWorkbenchShell.test.mjs`
- Modify: `tests/tauriCommands.test.mjs`
- Modify: `tests/settings.test.mjs`
- Modify: `tests/agentTurnEvidence.test.mjs`
- Modify: `docs/superplan/human/prd.md`

**Change Map:**
- obsolete shell: delete unreachable launch/Home props, actions, styles, tests, and copy after F046-01 equivalents are stable
- mock exclusion: reject demo platform APIs, review-only scenarios/flags/labels, and fixture semantics from production bundles
- product contract: align PRD wording with direct workbench startup, standalone-only Recents, reviewed Settings/Agent composition, and unchanged editor/file authority
- dependency hygiene: remove packages/imports made unused by old shell paths while preserving maintained primitives required by the new UI

**Verification:**
- `rg -n "LaunchScreen|mode === [\"']launch|GO_HOME|Back to Home|MockDesktopApi|Review Scenarios|Automatic Skill|Incremental|revision" src tests src-tauri docs/superplan/human/prd.md`
- `npm run build`
- `git diff --check`
- Cases: production bundle contains no demo imports or mock user-facing copy; TypeScript strict emits no unused locals/parameters.

- [ ] Remove legacy code only after replacement behavior and migrations are covered.
- [ ] Update the product contract without copying implementation detail into the PRD.
- [ ] Prove the production build and source inventory contain no review-demo leakage.

## Task 3: Run High-risk End-to-End Acceptance

**Outcome:** The complete migrated Tauri workbench is verified across browser composition, native integration, real disposable files, persistent settings, and Agent behavior.
**Files:**
- Modify: `tests/reviewedWorkbenchShell.test.mjs`
- Modify: `tests/workspaceSidebar.test.mjs`
- Modify: `tests/markdownEditorRefinement.test.mjs`
- Modify: `tests/agentTurnEvidence.test.mjs`
- Modify: `tests/tauriCommandContract.test.mjs`
- Modify: `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-01-production-shell-workspaces-and-recents.md`
- Modify: `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-02-settings-themes-and-markdown.md`
- Modify: `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-03-real-agent-panel.md`
- Modify: `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-04-native-integration-cleanup-and-verification.md`
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- focused/full regression: shell, sessions, Workspaces/Recents/dnd, Settings/provider/Skills, Markdown, Agent, IdeaSketch, recovery/external changes, native commands
- visual/native acceptance: reviewed geometry, compact menus, platform safe areas, full-screen transitions, panel states, themes, focus, reduced motion, long names/content
- disposable file workflows: Workspace/Standalone create/open/edit/move/rename/reveal/Trash/recent/recovery/conflict/restart without touching real user data
- workflow evidence: current commands, meaningful warnings, remaining limitations, plan completion, human entry done, generated catalog, and separate F046 commits

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo build`
- `npm run tauri dev`
- Browser/native acceptance at 1440x900, 1200x850, 1100x850, and 850x850; macOS windowed/fullscreen and Windows layout contract; Light/Dark/System; keyboard-only and reduced motion; disposable Workspace and standalone files; Markdown Edit/Split/Preview/line numbers/Undo; Agent Thread/model/reasoning/evidence/Tools; IdeaSketch regression and presentation keys.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [ ] Run focused checks during delivery and one relevant full regression/build/native matrix after implementation stabilizes.
- [ ] Complete browser and native acceptance with disposable data and map every exit criterion to current evidence.
- [ ] Mark all F046 plans complete and F046 done, refresh the generated index, and create separate task commits containing only F046 changes.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-01-production-shell-workspaces-and-recents.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-02-settings-themes-and-markdown.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-03-real-agent-panel.md`
- `.temp/f041-native-workbench-review/README.md`
- `.temp/f041-native-workbench-review/CAPABILITY_MATRIX.md`
- `src/lib/tauriCommands.ts`
- `src-tauri/capabilities/default.json`
- `src-tauri/src/lib.rs`
