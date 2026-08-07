---
id: "B023"
title: "Move Agent to the App-level Right Column"
type: "bugfix"
status: "complete"
summary: "Restore the three-region shell by keeping the Workspace Explorer left, the active editor center, and an independent generic Agent column right."
source: "docs/superplan/human/bugs.md"
created: "2026-08-08"
order: 23
depends_on: ["03", "F009", "F014", "F031-02"]
parent: ""
---

# Move Agent to the App-level Right Column Plan

**Goal:** Make the Agent an application-level right column instead of a tab inside the IdeaSketch Navigator.
**Scope:** Correct the product contract and React composition so Workspace Mode presents the real directory Explorer on the left, one active document editor region in the center, and a dedicated generic Agent column on the right. The center region may contain editor-owned controls such as IdeaSketch Pages/Cameras, but those controls must not own, switch, or render the Agent. `EditorLayout` owns Agent visibility, bounded resizing, activation gating, and the rightmost divider. The mounted editor publishes a generic active-editor Agent binding containing its extension, bounded context target, reviewed Apply callback, and Undo callback; future Markdown or other editors can publish the same contract without changing the shell or Agent panel. AI remains default-on, disabling AI removes the complete right column and lifecycle, and enabled-without-provider shows configuration guidance in that right column.
**Non-Goals:** This bugfix does not redesign Workspace Explorer, remove or relocate the IdeaSketch Pages/Cameras navigator outside the center editor region, add another editor, change Agent provider/runtime behavior, change Skill or Tool schemas, allow direct file writes, persist panel widths, or alter document save, recovery, external-change, and presentation behavior.
**Architecture:** `EditorLayout` becomes the sole app-shell owner of the Agent column and renders it as a sibling after the center `DocumentEditorHost`. `IdeaSketchEditor` returns to owning only its Canvas plus Pages/Cameras navigator and publishes an `ActiveAgentEditorBinding` through a format-agnostic callback. `RightSidebarHost` is reduced or renamed to an Agent-only shell with no Navigator/Agent surface switcher. The binding carries generic `AgentExtension`, `DocumentSession`, active-context id, read-only state, reviewed Apply, and Undo operations; all IdeaSketch mutations remain implemented inside IdeaSketch. The shell clears stale bindings on active-document/editor changes. The independent Agent divider and editor navigator divider retain separate bounded/collapsible state so neither column impersonates the other.
**Baseline:** F031 mounts `RightSidebarHost` inside `IdeaSketchEditor`, passes both `IdeaSketchNavigator` and `AgentPanel`, and switches them through `rightSidebarSurface`. Consequently the visible Agent is structurally and visually part of the `.is` editor navigator, while `EditorLayout` only owns the Workspace Explorer and center editor host.
**Reproduction:** Open or create an IdeaSketch document, inspect the editor's right panel, and select the `Agent` tab beside `Navigator`. The Pages/Cameras navigator disappears because both surfaces share the same editor-owned physical sidebar. In Workspace Mode the application shell therefore has no independent rightmost Agent region.
**Root Cause:** The completed F031 layout decision deliberately merged editor navigation and Agent into one physical sidebar. Its implementation placed the shared host at the first incorrect ownership boundary—inside `IdeaSketchEditor`—instead of keeping editor navigation within the center editor region and mounting the generic Agent beside `DocumentEditorHost` in `EditorLayout`.
**Exit Criteria:** In Workspace Mode, DOM/layout inspection and browser verification show Workspace Explorer as the left app-shell region, the active editor as the center region, and Agent as an independent rightmost region. IdeaSketch Pages/Cameras remain usable inside the center editor region and never expose an Agent tab or import/render `AgentPanel`. Collapsing or resizing Navigator does not hide or resize Agent, and collapsing or resizing Agent does not change Navigator state. Single File Mode omits the left Explorer but keeps center editor plus right Agent. AI disabled mounts no Agent host, divider, Skill discovery, or runtime; enabled-unconfigured shows only setup guidance in the right column. Active document/editor switching replaces or clears the generic binding without leaving stale IdeaSketch callbacks. Reviewed Apply, stale/conflict rejection, Undo, Canvas pointer alignment, supported desktop widths, focused regressions, the full Node suite, production build, and diff checks pass.

## Task 1: Lock the Three-region Ownership Contract

**Outcome:** A focused regression fails while Agent remains inside IdeaSketch and proves the intended app-shell ownership before implementation changes.
**Files:**
- Create: `tests/agentShellLayout.test.mjs`
- Modify: `tests/rightSidebarHost.test.mjs`
- Modify: `tests/ideaSketchEditor.test.mjs`
- Modify: `tests/panelDividerWiring.test.mjs`
- Modify: `docs/superplan/human/prd.md`

**Change Map:**
- shell regression: require Agent composition in `EditorLayout` after the center editor host and reject `AgentPanel`, Agent surface state, or Navigator/Agent switching inside `IdeaSketchEditor`
- ownership regression: require independent Agent and Navigator dividers/state plus a generic editor-to-shell binding contract
- activation regression: preserve complete AI-disabled teardown and configuration-required right-column behavior
- PRD correction: replace the shared Navigator/Agent sidebar decision and diagram with left Explorer, center editor region, and independent right Agent ownership

**Verification:**
- `node --test tests/agentShellLayout.test.mjs tests/rightSidebarHost.test.mjs tests/ideaSketchEditor.test.mjs tests/panelDividerWiring.test.mjs`

- [x] Add the focused failing layout/ownership contract against the current nested Agent composition.
- [x] Correct the PRD without changing the generic Agent extension or reviewed-mutation principles.

## Task 2: Move Agent Ownership to the Application Shell

**Outcome:** The app renders an independent right Agent while each editor retains its own internal navigation and mutation implementation.
**Files:**
- Modify: `src/lib/agent/types.ts`
- Modify: `src/components/EditorLayout.tsx`
- Modify: `src/components/IdeaSketchEditor.tsx`
- Modify: `src/components/RightSidebarHost.tsx`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `src/components/ResizableDivider.tsx`
- Modify: `src/index.css`
- Modify: `tests/agentShellLayout.test.mjs`
- Modify: `tests/rightSidebarHost.test.mjs`
- Modify: `tests/agentPanel.test.mjs`
- Modify: `tests/ideaSketchNavigator.test.mjs`

**Change Map:**
- `ActiveAgentEditorBinding`: format-agnostic active-document/extension/context/Apply/Undo bridge with no IdeaSketch operation types in the shell
- `EditorLayout`: own Agent visibility/width/divider, mount the rightmost Agent host, receive and clear active editor bindings, and render unsupported/no-document states safely
- `IdeaSketchEditor`: remove Agent surface state and shared host usage, restore Navigator-only composition, and publish/clean up its generic binding while retaining editor-local Change Set application and Undo
- right host/panel: remove Navigator/Agent tabs and render an Agent-only header/content boundary; keep configuration, conversation, review, cancellation, and AI gate behavior
- sizing/CSS: maintain independent bounded columns and trigger Canvas resize/pointer recalculation after either editor Navigator or app Agent transitions

**Verification:**
- Run the focused Task 1 suite.
- `node --test tests/agentChangeSet.test.mjs tests/agentExtensionRegistry.test.mjs tests/agentPanel.test.mjs tests/ideaSketchAgentExtension.test.mjs tests/ideaSketchNavigator.test.mjs tests/editorSession.test.mjs tests/externalFileChanges.test.mjs tests/recovery.test.mjs`
- Browser cases: Workspace left/center/right layout; standalone center/right layout; independent collapse/resize; AI disabled; provider-required; document switch; Page/Camera actions; reviewed Apply/Undo; 1200px, 1024px, and minimum supported width.

- [x] Move only Agent shell ownership out of IdeaSketch while keeping format-specific mutation logic inside the editor extension.
- [x] Verify Navigator and Agent state, sizing, lifecycle, and focus remain independent across supported modes and widths.

## Task 3: Verify and Deliver B023

**Outcome:** The corrected layout ships with behavior-level proof and updated Superplan evidence.
**Files:**
- Modify: `docs/superplan/human/bugs.md`
- Modify: `docs/superplan/plans/README.md`
- Modify: `docs/superplan/plans/bugs/B023-separate-agent-right-column.md`

**Change Map:**
- B023 request/plan: checked outcomes, root-cause fix evidence, browser layout evidence, and final status
- generated index: refreshed B023 lifecycle

**Verification:**
- `node --test tests/*.test.mjs`
- `npm run build`
- `git diff --check`
- Superplan registry, catalog, dependency, artifact, and generated-index validation

- [x] Run focused checks during implementation and the complete frontend regression/build matrix after the layout stabilizes.
- [x] Inspect the final diff, record browser acceptance, complete B023, and create a separate `fix(B023)` commit.

## Completion Evidence

- Regression-first proof: the initial ownership suite failed 4/4 while Agent was still nested inside the IdeaSketch sidebar.
- Focused layout suite: 15/15 passed after moving Agent ownership to `EditorLayout` and separating both dividers.
- Agent/editor safety matrix: 40/40 passed for Change Sets, extension registry reuse, IdeaSketch context/tools, Navigator, editor sessions, external changes, and recovery.
- Full frontend regression: 273/273 Node tests passed.
- Production verification: `npm run build` passed; only the pre-existing Excalidraw import-overlap and large-chunk warnings remain.
- Visual verification: the local HTML showed the editor-owned Pages/Cameras Navigator and the independent rightmost Agent simultaneously; Navigator and Agent collapsed independently; configuration-required guidance rendered in Agent; disabling AI removed only the Agent column and restoring AI remounted it.
- Runtime verification: a fresh browser session reported no console errors after stabilizing the active-editor binding; desktop Workspace inspection confirmed Workspace Explorer remains the left app-shell region while the IdeaSketch Navigator remains within the center editor region.
- Hygiene: `git diff --check` and Superplan registry/catalog validation passed before delivery.

## References

- `docs/superplan/human/bugs.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/03-multifile-workspace-shell.md`
- `docs/superplan/plans/features/F009-tabbed-ideasketch-navigator.md`
- `docs/superplan/plans/features/F013-compact-workspace-and-navigator-layout.md`
- `docs/superplan/plans/features/F014-simplify-file-and-navigator-controls.md`
- `docs/superplan/plans/features/F031-configurable-ai-agent/F031-02-generic-agent-runtime.md`
- `src/components/EditorLayout.tsx`
- `src/components/IdeaSketchEditor.tsx`
- `src/components/RightSidebarHost.tsx`
- `src/components/AgentPanel.tsx`
- `src/components/IdeaSketchNavigator.tsx`
