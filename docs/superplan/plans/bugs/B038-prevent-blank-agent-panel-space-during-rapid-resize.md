---
id: "B038"
title: "Prevent Blank Agent Panel Space During Rapid Resize"
type: "bugfix"
status: "complete"
summary: "Make the Agent column track divider dragging synchronously so rapid narrowing never exposes an empty strip."
source: "docs/superplan/human/bugs.md"
created: "2026-08-12"
order: 38
depends_on: []
parent: ""
---

# Prevent Blank Agent Panel Space During Rapid Resize Plan

**Goal:** Keep the complete Agent surface attached to the right edge and continuously filled while its divider is dragged at any speed.
**Scope:** Correct the app-level Agent column resize lifecycle in `EditorLayout`: pointer and keyboard resizing remain bounded to 260–420px, width changes track the divider without animation during an active pointer drag, and the existing 200ms width transition is restored only after dragging ends for normal show/hide behavior. Preserve the current Agent content, scroll position, thread state, persisted panel width, divider accessibility, and independent Workspace/editor Navigator sizing.
**Non-Goals:** This bugfix does not redesign the Agent panel, change its minimum/maximum/default widths, alter message rendering or virtualization, remove normal panel open/close animation, change Workspace or IdeaSketch Navigator behavior, modify `ResizableDivider` pointer mathematics, or change Agent runtime and persistence behavior.
**Architecture:** Mirror the already-correct Workspace resize lifecycle at the Agent ownership boundary. `EditorLayout` owns a dedicated `isResizingAgent` flag, passes start/end callbacks to the shared right `ResizableDivider`, and conditionally removes `transition-[width] duration-200` only from the Agent width wrapper while pointer capture is active. The wrapper and its fixed-width child then consume the same `agentPanelWidth` synchronously on every move; pointer up/cancel restores the transition class. Keyboard resizing does not enter pointer-drag state and remains an immediate bounded step, matching existing behavior.
**Baseline:** `ResizableDivider` emits `onResizeStart` on pointer down and `onResizeEnd` on pointer up/cancel. The Workspace column consumes both callbacks and suppresses its width transition during dragging. The Agent column supplies only `onResize`; its outer wrapper always has `transition-[width] duration-200`, while the inner child receives the new `agentPanelWidth` immediately.
**Reproduction:** Open a document with Agent visible, grab the left edge of the right Agent column, and move the divider quickly from left to right to narrow it. The inner Agent surface jumps to the latest narrow width, but the outer animated wrapper remains temporarily wider, exposing a blank strip at the panel's right edge. Slow dragging makes the mismatch less obvious; releasing the pointer eventually lets the wrapper catch up.
**Root Cause:** The first incorrect source is the unconditional width transition on the Agent wrapper in `EditorLayout`. React updates both width declarations together, but CSS interpolates only the outer wrapper over 200ms while the inner fixed-width child changes immediately. The resulting transient width delta is rendered as empty background. This is not a pointer-event loss or Agent render failure: the same shared divider works correctly for Workspace because Workspace disables that transition during its drag lifecycle.
**Exit Criteria:** Rapidly drag the Agent divider left-to-right and right-to-left across its full range in Light and Dark. During every active drag frame, the Agent wrapper and inner content widths match, no blank strip appears at the right edge, content remains mounted and scrollable, and the divider stays attached to the panel edge. Pointer up and pointer cancel restore normal transition behavior. Home/End and arrow-key resizing still respect 260–420px and accurate ARIA values; the final width persists across reload. Workspace and IdeaSketch Navigator resizing remain unchanged. Focused divider/shell regressions, full frontend regression, production build, native startup smoke, visual drag inspection, workflow validation, diff hygiene, and a separate `fix(B038)` commit pass.

## Task 1: Lock the Agent Resize Lifecycle Regression

**Outcome:** A focused source-level behavior contract distinguishes the broken always-animated Agent wrapper from the already-correct Workspace drag lifecycle.
**Files:**
- Modify: `tests/panelDividerWiring.test.mjs`
- Modify: `tests/agentShellLayout.test.mjs`

**Change Map:**
- Agent regression: require dedicated Agent resize state, divider start/end wiring, and a wrapper whose width transition is absent only while Agent pointer dragging is active
- preservation contract: retain Agent bounds, persisted width, independent app-shell ownership, and the shared divider's pointer-capture/keyboard semantics

**Verification:**
- `node --test tests/panelDividerWiring.test.mjs tests/agentShellLayout.test.mjs`
- Pre-fix evidence: the contract fails because Agent has no resize state/start/end callbacks and its wrapper transition is unconditional.

- [x] Add the focused failing Agent drag-lifecycle regression.
- [x] Preserve the existing bounded, accessible, independently owned Agent column contract.

## Task 2: Synchronize the Agent Wrapper During Dragging

**Outcome:** Agent width follows the pointer without interpolation during drag and returns to normal show/hide animation afterward.
**Files:**
- Modify: `src/components/EditorLayout.tsx`
- Modify: focused tests from Task 1

**Change Map:**
- `isResizingAgent`: pointer-drag lifecycle owned beside `agentPanelWidth`
- right `ResizableDivider`: call Agent resize start/end setters without changing shared pointer calculations
- Agent width wrapper: conditionally apply the existing transition classes only outside active pointer dragging

**Verification:**
- Run the focused Task 1 suite.
- Browser/native interaction: rapidly sweep the divider across both bounds, release and cancel a drag, use keyboard Home/End/arrows, reload to confirm persisted width, and inspect wrapper/child computed widths plus console diagnostics.

- [x] Add the smallest Agent-specific lifecycle wiring matching the Workspace pattern.
- [x] Verify rapid drag, release/cancel, keyboard resizing, bounds, persistence, and independent panel behavior.

## Task 3: Verify and Deliver B038

**Outcome:** The resize fix closes with visual, regression, workflow, and source-control evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/bugs/B038-prevent-blank-agent-panel-space-during-rapid-resize.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- final regression: panel divider, Agent shell, reviewed workbench, and complete frontend behavior
- runtime: Light/Dark rapid resizing at supported desktop widths with no blank edge or console errors
- workflow: complete B038/done, refresh the plan index, and stage only B038 artifacts

**Verification:**
- `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs`
- `npm run build`
- `npm run tauri dev`
- Visual rapid-drag inspection in Light and Dark, including pointer release/cancel, both bounds, keyboard resizing, persisted width, content scroll, and console diagnostics.
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/human_requests.py --root . validate`
- `python3 /Users/zhengxiwan/.codex/plugins/cache/superplan-dev/superplan/0.4.0+codex.20260804101449/skills/using-superplan/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`
- `git status --short`

- [x] Run focused checks during implementation and one full stabilized frontend regression afterward.
- [x] Inspect genuine rapid Agent resizing in both themes and supported panel states.
- [x] Mark B038 complete/done and create a separate `fix(B038)` commit.

## Delivery Evidence

- Focused regression: `node --test tests/panelDividerWiring.test.mjs tests/agentShellLayout.test.mjs` passed 6/6 after failing 2/6 before the implementation.
- Full frontend regression: `node --test --test-concurrency=1 --test-reporter=dot tests/*.test.mjs` passed.
- Production build: `npm run build` passed with only the existing Excalidraw mixed-import and large-chunk warnings.
- Native startup smoke: `npm run tauri dev -- --no-watch --config '{"build":{"beforeDevCommand":""}}'` built and launched `target/debug/idea-slide`; existing Rust dead-code warnings were unchanged.
- Runtime drag inspection: the local app was exercised in Light and Dark with rapid drags in both directions. Repeated samples observed a maximum wrapper/content width delta of `0px`, the Agent width transition was absent during active dragging and restored after release, and no browser console warnings or errors were reported.
- Bounds and persistence: keyboard Home/End and arrow resizing remained bounded to 260–420px with matching ARIA values; the final 412px width was restored after reload with wrapper and content both measuring 412px.
- Pointer cancel and shared behavior: the focused divider contract retained the existing shared pointer-cancel cleanup, pointer capture, keyboard semantics, and independent Workspace/IdeaSketch sizing without modifying `ResizableDivider`.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/plans/bugs/B023-separate-agent-right-column.md`
- `docs/superplan/plans/bugs/B034-restore-reviewed-demo-parity-in-tauri.md`
- `docs/superplan/plans/features/F004-refine-editor-shell.md`
- Human-supplied Agent resize screenshot from `2026-08-12`
- `src/components/EditorLayout.tsx`
- `src/components/ResizableDivider.tsx`
- `src/components/RightSidebarHost.tsx`
- `tests/panelDividerWiring.test.mjs`
- `tests/agentShellLayout.test.mjs`
