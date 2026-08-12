---
id: "B043@fix-welcome-sidebar-motion"
title: "Keep Welcome Title Motion Coherent While Opening Workspaces"
type: "bugfix"
status: "complete"
summary: "Preserve a polished Workspace sidebar transition while keeping the Welcome identity on one continuous visual trajectory."
source: "docs/superplan/human/bugs.md"
created: "2026-08-12"
order: 43
depends_on: ["F043", "F046-01"]
parent: ""
---

# Keep Welcome Title Motion Coherent While Opening Workspaces Plan

**Goal:** Make the Workspaces sidebar feel deliberately animated without letting the fileless Welcome identity jump or reverse direction during open and close transitions.
**Scope:** Refine only the production shell's left-panel transition. Keep the current collapsible, resizable Workspace column and its released editor width, but orchestrate the column width, sidebar reveal, restore-button exit, crown inset, and Welcome/document identity as one 190ms motion. The restore button remains mounted in an absolute crown position while it fades and scales, the crown inset transitions on the same timing curve, and the clipped sidebar content uses a restrained slide/fade so the title follows one continuous screen-space trajectory. Closing plays the exact reverse. Pointer resizing remains synchronous, and reduced-motion users receive an immediate state change.
**Non-Goals:** This bugfix does not turn Workspaces into an overlay, change panel widths or persistence, redesign Workspace content, change title typography or copy, animate editor-owned content, modify Agent or IdeaSketch drawer behavior, alter native traffic-light geometry, or reopen the broader B034 visual-parity scope.
**Architecture:** Keep `EditorLayout` as the owner of Workspace visibility and width. Replace the generic width utility with a named shell-motion class and explicit open/closed state so the width wrapper and fixed-width sidebar child share one easing contract. Keep the Workspace restore button structurally present and absolutely positioned in `WorkbenchCrown`; use open/closed state to animate only its opacity and scale while preventing focus/pointer access when inactive. Animate the crown's platform-specific leading inset on the same curve instead of switching it instantly. Because the button never participates in flex layout, the title's screen position becomes the Workspace width plus one synchronized crown-padding term, producing one monotonic path rather than a left jump followed by a right slide. Keep an invisible 1px-equivalent seam footprint while the divider is absent so its mount lifecycle cannot add a final pixel jump. Use CSS as the animation clock; do not add timeout-driven React transition state. Preserve the existing `isResizingWorkspace` transition suppression so dragging never interpolates stale widths.
**Baseline:** On committed baseline `48bdcaa`, `EditorLayout` changes the Workspace wrapper from `0` to the persisted panel width with `transition-[width] duration-200`. In the same render, `WorkbenchCrown` removes the restore button and switches from `without-workspace` to `has-workspace`; macOS windowed leading padding changes from `82px` to `13px` immediately. The identity is normal flex content, so its local anchor jumps left before the animated main column carries it right. Existing focused crown/parity tests pass 11/11 because they assert static structure and geometry rather than transition coordination.
**Reproduction:** Start with no active document and Workspaces closed, then click `Show Workspaces`. The `Welcome / Choose a file to begin` identity visibly snaps left when the button and native-frame inset disappear, then travels right while the Workspace width expands. Closing shows the inverse discontinuity. The effect is clearest in a macOS windowed frame because the crown inset changes by 69px in the same render.
**Root Cause:** One `showWorkspace` state change controls two independently timed layout systems. The outer Workspace width is CSS-interpolated for 200ms, while the crown button's conditional rendering and platform-specific padding change synchronously with React. The title therefore receives an instantaneous local-position delta and a separate animated ancestor-position delta. The first incorrect source is the conditional removal and non-animated crown geometry, not the Welcome component itself or the sidebar width animation.
**Exit Criteria:** Opening and closing Workspaces from the fileless Welcome state produces one continuous title trajectory with no snap, reversal, or late settling in macOS windowed/fullscreen and Windows windowed states. The sidebar reveal and restore-button fade feel like one restrained 180–200ms interaction; the button is inaccessible while visually absent and remains truthfully labeled while active. The same transition stays coherent with an open document and long document identity. Workspace pointer resizing remains animation-free and gapless, persisted width and panel defaults remain unchanged, the Agent and IdeaSketch drawer transitions are untouched, and `prefers-reduced-motion: reduce` removes the coordinated motion. Focused behavior contracts, full frontend regression, production build, and visual open/close inspection pass.

## Task 1: Lock the Coordinated Workspace Motion Contract

**Outcome:** A focused regression distinguishes the current split-timing title jump from a shell whose width, crown inset, and restore control share one transition contract.
**Files:**
- Modify: `tests/editorChromeNavigation.test.mjs`
- Modify: `tests/panelDividerWiring.test.mjs`

**Change Map:**
- crown regression: require a persistent Workspace restore control with inactive accessibility semantics instead of conditional unmounting
- shell regression: require named open/closed Workspace motion state, shared duration/easing hooks, and resize-time transition suppression
- accessibility and motion: require reduced-motion coverage and preservation of native-frame inset selectors

**Verification:**
- `node --test tests/editorChromeNavigation.test.mjs tests/panelDividerWiring.test.mjs`
- Pre-fix evidence: the focused contract fails because the restore control is conditionally removed and crown geometry has no coordinated transition state.

- [x] Add a focused failing contract for persistent crown geometry and coordinated Workspace motion.
- [x] Preserve static crown, divider, platform-inset, bounds, and accessibility contracts.

## Task 2: Orchestrate the Sidebar, Crown, and Identity Transition

**Outcome:** The Workspace column opens and closes with one deliberate motion while the title follows a continuous path.
**Files:**
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/WorkbenchCrown.tsx`
- Modify: `src/index.css`
- Modify: focused tests from Task 1

**Change Map:**
- `EditorLayout` Workspace wrapper: named open/closed state, shared motion class, clipped sidebar slide/fade, and unchanged drag-time transition suppression
- `WorkbenchCrown`: persistent restore control, open-state accessibility/focus handling, and stable identity structure
- crown CSS: absolute restore-control opacity/scale, platform-specific leading inset transitions, one shell-specific easing curve, and exact reverse close motion
- reduced motion: disable width, transform, opacity, gap, and inset interpolation without changing final geometry

**Verification:**
- Run the focused Task 1 suite.
- Visual interaction at 1440x900 and 850x850: repeatedly open/close Workspaces with Welcome, a normal document, and a long document name; inspect macOS windowed/fullscreen and Windows windowed classes.
- During pointer resize, confirm wrapper and sidebar widths remain synchronous and the new reveal transition is suppressed.

- [x] Apply the smallest CSS-led orchestration without timer-driven React transition state.
- [x] Verify continuous open/close trajectories, button accessibility, reverse motion, resizing, and reduced motion.

## Task 3: Verify and Deliver the Isolated Bugfix

**Outcome:** The motion refinement closes with current regression, build, workflow, and source-control evidence on its dedicated branch.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B043@fix-welcome-sidebar-motion-keep-welcome-title-motion-coherent.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- final regression: crown/navigation, panel-divider, reviewed-shell, theme, and complete frontend behavior
- runtime evidence: Welcome/document open-close motion, supported native frame states, reduced motion, keyboard focus, and clean console
- workflow: complete the branch-qualified B043 request/plan, refresh the index, and stage only B043 artifacts

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run focused checks while iterating and one full stabilized frontend regression/build afterward.
- [x] Inspect genuine open/close motion in normal and reduced-motion modes with no title discontinuity or console error.
- [x] Mark B043 complete/done and create a separate `fix(B043@fix-welcome-sidebar-motion)` commit.

## Delivery Evidence

- Focused regression: `node --test tests/editorChromeNavigation.test.mjs tests/panelDividerWiring.test.mjs` failed 3/12 before implementation on conditional restore-control removal, missing coordinated Workspace motion state, and missing crown-padding transition; it passed 12/12 after the fix.
- Runtime trajectory: a temporary Playwright sampler captured the title from the pre-click frame through 260ms. Opening was strictly monotonic from `x=124px` to `x=269px`; closing was strictly monotonic from `x=269px` to `x=124px`; both reported zero reversal samples and zero console/page errors.
- Motion/accessibility: the Workspace wrapper, crown padding, sidebar reveal, and restore-control fade/scale share `190ms cubic-bezier(.2, .8, .2, 1)`. The restore control remains mounted but is disabled and `aria-hidden` while inactive. Reduced-motion sampling reported `0s` transitions for the Workspace wrapper, crown, and restore control.
- Geometry: the restore control is absolutely positioned so it never changes the identity's flex anchor. Platform-specific crown padding provides the animated closed-state reserve, and an invisible 1px-equivalent seam footprint prevents divider mount/unmount from adding a final pixel discontinuity.
- Resize preservation: the existing `isResizingWorkspace` lifecycle still removes width and content transitions while pointer dragging is active; panel bounds, persisted width, Agent behavior, and IdeaSketch drawer behavior remain unchanged.
- Full frontend regression: `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs` passed.
- Production build: `npm run build` passed. Only the existing Excalidraw mixed-import and large-chunk warnings were emitted.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/features/F042-codex-style-workspace-agent-panel-toggles.md`
- `docs/superplan/plans/features/F043-refine-prototype-navigation-settings-welcome-and-agent-affordance.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-01-production-shell-workspaces-and-recents.md`
- `docs/superplan/plans/bugs/B034-restore-reviewed-demo-parity-in-tauri.md`
- `docs/superplan/plans/bugs/B038-prevent-blank-agent-panel-space-during-rapid-resize.md`
- `src/components/EditorLayout.tsx`
- `src/components/WorkbenchCrown.tsx`
- `src/index.css`
- Human-supplied Welcome-title motion screenshot and feedback from `2026-08-12`
