---
id: "B034"
title: "Restore Reviewed Demo Parity in the Tauri Workbench"
type: "bugfix"
status: "complete"
summary: "Make the production workbench, Settings, Welcome, and Agent visually and interactively match the approved review demo while retaining real Tauri behavior."
source: "docs/superplan/human/bugs.md"
created: "2026-08-11"
order: 34
depends_on: ["F046-04", "F048"]
parent: ""
---

# Restore Reviewed Demo Parity in the Tauri Workbench Plan

**Goal:** Correct the F046 migration so the production Tauri interface is recognizably the approved review demo rather than a separately styled approximation.
**Scope:** Align the production outer workbench with `.temp/f041-native-workbench-review` at the structural, token, geometry, and interaction levels. Match the native window crown, macOS/Windows/fullscreen safe areas, document identity and path, Workspace/editor/Agent surfaces, 7px resize rails with a 1px resting divider, compact panel dimensions, Welcome actions, Agent crown and conversation menus, Settings dialog geometry/control density, and Light/Dark/System palettes. Keep all production Workspace, editor, Settings, credential, Agent, Thread, Tool, persistence, recovery, and Tauri v2 boundaries real. The demo is the visual and interaction baseline except where the later F048 human direction explicitly replaces its Settings navigation and manual-save lifecycle with an icon-led IdeaNote navigation and safe automatic persistence.
**Non-Goals:** This bugfix does not copy `MockDesktopApi`, fixtures, Review Scenarios, failure injection, mock platform query parameters, simulated status text, or the demo IdeaSketch/Excalidraw editor into production. It does not redesign editor-owned Markdown or IdeaSketch content, change filesystem or Agent safety semantics, expose stored credentials, add providers/editors, remove real runtime diagnostics from the Inspector, or modify `.temp/f041-native-workbench-review` except if a test fixture must reference it read-only as the approved baseline.
**Architecture:** Introduce one production shell token contract derived directly from the reviewed demo instead of continuing the separate hard-coded purple/rounded production theme. Light uses Paper `#ffffff`, Workspace `#e9eae7`, Agent `#f4f4f2`, Frost `#f1f2f4`, Graphite `#252930`, Line `#d5d8dc`/Strong `#c4c8ce`, Cobalt `#2f5dcc`, and Danger `#b4433c`; Dark uses Paper `#17191d`, Workspace `#202329`, Agent `#1c1f24`, Frost `#191c21`, Graphite `#e5e7eb`, Line `#30343b`/Strong `#3c424b`, Cobalt `#7396ec`, and Danger `#ea7d75`. System resolves to the same Light or Dark contract. Controls/body use the native system face; paths, timestamps, and compact status metadata alone use `ui-monospace`. Preserve aligned 45px window/editor/Agent crowns, the 254px default Workspace panel, compact 352px Agent panel, and the status-close lens as the single signature interaction. macOS traffic lights remain Tauri/WebView native through decorated Overlay title bars so the operating system owns active, inactive, and fullscreen appearance; no HTML traffic-light replicas are rendered. Radix remains the maintained owner for Dialog, Popover, Dropdown Menu, focus restoration, collision, and dismissal. F048 is the sole authority for Settings navigation and persistence: its icon-led sidebar, active violet rail, registry header, automatic save queue, failure retry, and Test-gated credential storage supersede the earlier reviewed-demo draft/Save interaction while retaining compatible compact dialog geometry and production security boundaries.
**Baseline:** The approved demo was measured in a fresh browser session and refined through native review. Window, editor, and Agent crowns are aligned at 45px; Workspace is 254px wide with `#e9eae7`; the editor is Paper white; Agent is `#f4f4f2`; resize rails are 7px with a 1px line; conversation trigger is 33px high; the composer has 10px padding and a 6px-radius Paper input surface. Settings is 760x560 with an 8px radius, 54px header, 170px navigation, compact group labels, three theme cards, and explicit Save changes. The production browser reproduction renders a 900x650 Settings dialog with an 18px radius, icon-heavy 218px navigation, purple accent system, large controls, and automatic-save presentation. Production `WorkbenchCrown` centers a one-line title without the reviewed relative path; `WorkbenchWelcome` adds Settings and Open Workspace actions; `AgentThreadHeader` explicitly renders Open Agent settings; the conversation row Dropdown Menu portals from inside a Popover without a proven higher stacking/collision contract; and an HTML traffic-light overlay replaces the native inactive state with white circles.
**Reproduction:** Launch the current native app in Light at a desktop width comparable to the approved demo, open a Markdown file, show both Workspaces and Agent, then compare against `.temp/f041-native-workbench-review`. The traffic-light/toggle placement, document crown, title/path treatment, surface colors, divider rails, Agent crown/actions, and panel density differ. Open the conversation selector and a row three-dot menu: the action surface can be obscured by the history popover. Open Settings: its size, radius, navigation, theme control, row density, colors, and save interaction differ materially. Close the file: Welcome contains additional Settings and Open Workspace actions not present in the approved baseline.
**Root Cause:** F046 migrated production capability boundaries and rebuilt the shell around existing production components, but it did not enforce the demo as an executable visual/interaction contract. `src/index.css` retained a separate collection of hard-coded Settings, Agent, and shell colors/sizes instead of the reviewed tokens. Production-specific composition also survived in `WorkbenchCrown`, `WorkbenchWelcome`, and `AgentThreadHeader`, so extra controls and different title geometry remained. Tests asserted the absence of old Home/mock paths and the presence of broad components, but did not compare approved token values, component action sets, key dimensions, or nested overlay stacking; automated screenshot QA was unavailable, and the earlier completion incorrectly treated native launch plus broad functional checks as migration-parity evidence.
**Exit Criteria:** At equivalent content, theme, and viewport states, production matches the reviewed demo's shell hierarchy and visual identity: native controls/toggles occupy the same safe-area model; macOS traffic lights are rendered only by the native decorated Overlay title bar and use Tauri/macOS active, inactive, and fullscreen appearance; document status-close, type, title, relative path, and save status align like the demo; Workspace, editor, Agent, crowns, dividers, composer, menus, and focus states use the reviewed tokens and density. Welcome contains only Open most recent when available, Open File, and New File, with no Settings or Open Workspace action. Agent crown contains the conversation selector plus New, Inspector, and Close only; no Settings control or redundant runtime-health copy appears there. Conversation Rename/Delete menus render above and beside the history popover, stay inside every target viewport, and dismiss/restore focus correctly. Settings retains the compact dialog, theme cards, field rows, controls, and real Provider/Skill behavior, while its navigation and automatic persistence satisfy the newer complete F048 contract rather than the superseded reviewed-demo Save lifecycle; production omits only the explicitly excluded Review Scenarios section. Light, Dark, System, macOS windowed/fullscreen, Windows windowed/fullscreen, Workspace/Agent open and closed, long titles, 1440x900/1200x850/1100x850/850x850, keyboard focus, reduced motion, native Tauri startup, full frontend regression, production build, and diff hygiene pass without changing editor-owned content or real persistence/safety boundaries.

## Task 1: Establish an Executable Parity Contract and Align the Workbench Frame

**Outcome:** The native shell, window controls, document crown, panel surfaces, dividers, and Welcome use the reviewed structure and tokens rather than production-only styling.
**Files:**
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/WorkbenchCrown.tsx`
- Modify: `src/components/WorkbenchWelcome.tsx`
- Modify: `src/components/WorkspaceSidebar.tsx`
- Modify: `src/components/ResizableDivider.tsx`
- Modify: `src/hooks/useNativeWindowFrame.ts`
- Modify: `src/index.css`
- Modify: `tests/reviewedWorkbenchShell.test.mjs`
- Modify: `tests/nativeWindowFrame.test.mjs`
- Create: `tests/reviewedDemoParity.test.mjs`

**Change Map:**
- parity regression: assert the approved Light/Dark token values, crown/panel/settings dimensions, divider contract, Welcome action set, and absence of production-only chrome against stable source/DOM contracts
- window crown: use real platform/fullscreen state with the demo's shared left/right safe-area model, 45px crown, native drag region, and Workspace restore placement
- document identity: leading status-close lens, registry file glyph, two-line title plus Workspace-relative/standalone path, live save state, and no centered Welcome title strip
- panels and dividers: reviewed Workspace/Editor/Agent surfaces, default widths, 7px interactive rails, 1px resting line, 3px focus/hover line, and released center width when closed
- Welcome: retain only approved recent/file/new entry points and remove the duplicate Settings/Open Workspace actions

**Verification:**
- `node --test tests/reviewedDemoParity.test.mjs tests/reviewedWorkbenchShell.test.mjs tests/nativeWindowFrame.test.mjs tests/panelSizing.test.mjs`
- Browser/native geometry at 1440x900, 1200x850, 1100x850, and 850x850: macOS windowed/fullscreen, Windows windowed/fullscreen, panels open/closed/resized, Welcome, Workspace file, standalone file, long names, keyboard divider, and zero horizontal overflow.

- [x] Capture focused failures for the current token, crown, divider, path, and Welcome mismatches.
- [x] Replace the parallel production shell styling with the reviewed token and safe-area contract.
- [x] Verify every panel/window combination without changing editor-owned content or session behavior.

## Task 2: Integrate the Newer F048 Settings Experience with the Compact Shell

**Outcome:** Production Settings retains the compact shell and real capabilities while F048 owns its newer navigation hierarchy and automatic persistence behavior.
**Files:**
- Modify: `tests/settingsCenter.test.mjs`
- Modify: `tests/settings.test.mjs`
- Modify: `tests/reviewedDemoParity.test.mjs`
- Modify: `docs/superplan/plans/bugs/B034-restore-reviewed-demo-parity-in-tauri.md`

**Change Map:**
- authority: require completed F048 and remove B034 assertions that demand icon-free navigation, explicit Save, dirty state, or discard-on-close
- shell integration: retain compact dialog geometry, restrained overlay/shadow, theme cards, field density, and responsive containment around the F048 sidebar/header/status composition
- capability protection: continue verifying production editor sections, Provider Test/catalog, secure credentials, Agent settings, and real Skill rules without Review Scenarios or mock values
- parity record: document the F048 navigation/auto-apply experience as an intentional later human-approved divergence from the reviewed demo rather than a B034 mismatch

**Verification:**
- `node --test tests/settingsCenter.test.mjs tests/settings.test.mjs tests/reviewedDemoParity.test.mjs`
- Cases: completed F048 automatic persistence, close flush, retry, Provider Test-gated credential storage, registry navigation, theme cards, editor sections, compact shell, keyboard navigation, Light/Dark/System, and target widths.

- [x] Remove superseded reviewed-demo Save/discard and icon-free-navigation assertions after F048 completes.
- [x] Verify F048 fits the compact production dialog without weakening real Settings capabilities.
- [x] Record the newer approved Settings direction as an intentional parity exception.

## Task 3: Match the Reviewed Agent Crown, Conversation Overlays, and Composer Surface

**Outcome:** The real Agent keeps its production runtime behavior inside the exact concise demo chrome, with unobscured row actions.
**Files:**
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/agent/AgentThreadHeader.tsx`
- Modify: `src/components/agent/AgentConversationSelector.tsx`
- Modify: `src/components/agent/AgentComposer.tsx`
- Modify: `src/components/agent/AgentRuntimeInspector.tsx`
- Modify: `src/index.css`
- Modify: `tests/agentPanel.test.mjs`
- Modify: `tests/agentThreadHistory.test.mjs`
- Modify: `tests/agentRuntimeInspector.test.mjs`
- Modify: `tests/agentInteraction.test.mjs`

**Change Map:**
- crown: conversation selector on the left and New/Inspector/Close on the right; remove Open Agent settings and runtime-health duplication while leaving diagnostics in Inspector
- selector: show title plus Turn count only, match the demo's 33px trigger and compact popover, and keep real resume/loading/error constraints
- nested actions: give Rename/Delete Dropdown Menu a higher portal layer than the conversation Popover, right/start placement, collision padding, viewport fallback, outside/Escape dismissal, and deterministic trigger focus restoration
- panel surface: reviewed Agent background, 45px crown aligned with the editor crown, transcript spacing, bottom 10px composer surround, 6px Paper composer box, and compact model/reasoning/send controls without changing Turn execution
- configuration state: retain the body-level Provider configuration action when required, without restoring a permanent Settings icon to the crown

**Verification:**
- `node --test tests/agentPanel.test.mjs tests/agentThreadHistory.test.mjs tests/agentRuntimeInspector.test.mjs tests/agentInteraction.test.mjs tests/reviewedDemoParity.test.mjs`
- Browser/native cases: empty/one/many conversations; selector and nested row menu at top/middle/bottom; rename/delete cancel/confirm/failure/running; long titles; Inspector; provider-required state; empty/long/running transcript; composer bottom geometry; Light/Dark/System and all target widths.

- [x] Capture the extra Settings action, redundant selector metadata, overlay obstruction, and Agent surface mismatches as focused failures.
- [x] Apply the reviewed crown, popover/menu layering, and composer geometry over the real Agent state.
- [x] Regress streaming, cancellation, retry, Tools, Skills, persistence, and direct editor edits after the chrome change.

## Task 4: Prove Native Visual and Interaction Parity Before Delivery

**Outcome:** B034 closes only with current automated and human-reviewable evidence that production now matches the approved demo.
**Files:**
- Modify: `tests/reviewedDemoParity.test.mjs`
- Modify: `tests/reviewedWorkbenchShell.test.mjs`
- Modify: `docs/superplan/plans/bugs/B034-restore-reviewed-demo-parity-in-tauri.md`
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- focused/full regression: parity contract, shell, native frame, Settings, Agent menus/dialogs, themes, responsive layout, existing Markdown/IdeaSketch boundaries
- visual matrix: side-by-side approved demo and production captures at the same frame/theme/state, including Welcome, Markdown with both panels, conversation menu, Settings, macOS fullscreen, and Windows windowed
- native acceptance: real Tauri window controls, fullscreen transitions, focus/dismissal, Settings persistence, conversation actions, and no console/runtime errors
- workflow: document exact remaining intentional differences, require explicit human visual approval, mark B034 complete/done, refresh index, and create one `fix(B034)` commit

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `cd src-tauri && cargo test`
- `cd src-tauri && cargo build`
- `npm run tauri dev`
- Browser/native side-by-side inspection at 1440x900, 1200x850, 1100x850, and 850x850 in Light/Dark/System; macOS windowed/fullscreen and Windows windowed/fullscreen; keyboard-only and reduced motion.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run one stabilized full regression/build/native matrix after implementation stops changing.
- [x] Present same-state demo/production evidence and obtain explicit human visual approval without substituting startup smoke for parity.
- [x] Mark B034 complete/done and create a separate task commit containing only B034 changes.

## Current Delivery Evidence

- Production parity was delivered in `adaaf27 fix(B034): align production workbench with reviewed theme`, covering the native frame, crown, Workspace, Agent, Settings, Welcome, themes, and responsive shell contracts.
- The stabilized production verification passed the complete frontend suite, `npm run build`, all 171 Rust tests, and `cargo build`; only the existing Vite chunk and Rust Agent dead-code warnings remain.
- The corresponding reviewed demo passed all 68 tests and its production build, with the reference PNG matrix present at all four target sizes.
- The human explicitly confirmed B034 complete on 2026-08-13 before the `v0.3.0` release preparation.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/features/F045-refine-review-demo-workspace-actions-and-document-chrome.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-01-production-shell-workspaces-and-recents.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-02-settings-themes-and-markdown.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-03-real-agent-panel.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-04-native-integration-cleanup-and-verification.md`
- `docs/superplan/plans/bugs/B030-fix-transient-menus-settings-and-agent-history.md`
- `docs/superplan/plans/bugs/B031-compact-workspace-agent-menus-and-labels.md`
- `docs/superplan/plans/bugs/B032-refine-agent-window-chrome-menus-and-workspace-dragging.md`
- `docs/superplan/plans/features/F048-refine-settings-navigation-and-auto-apply.md`
- `.temp/f041-native-workbench-review/src/styles.css`
- `.temp/f041-native-workbench-review/src/components/layout/WindowChrome.jsx`
- `.temp/f041-native-workbench-review/src/components/layout/ResizableDivider.jsx`
- `.temp/f041-native-workbench-review/src/components/editor/EditorHost.jsx`
- `.temp/f041-native-workbench-review/src/components/settings/SettingsCenter.jsx`
- `.temp/f041-native-workbench-review/src/components/agent/AgentPanel.jsx`
- Human-supplied production screenshot and parity feedback from `2026-08-11`
