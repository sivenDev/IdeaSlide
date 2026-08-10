---
id: "F039"
title: "Explore Workspace-first AI Agent Layout Concepts"
type: "feature"
status: "complete"
summary: "Preserve Cursor, Kition, and Teable design research and deliver three browser-runnable workspace-first product layout concepts."
source: "docs/superplan/human/features.md"
created: "2026-08-10"
order: 46
depends_on: ["B023", "F035"]
parent: ""
---

# Explore Workspace-first AI Agent Layout Concepts Plan

**Goal:** Give the product team three decision-ready HTML directions for replacing the Home-first experience with a workspace-first AI workbench.
**Scope:** Create one self-contained research and mockup package under `docs/design-research/f039-workspace-agent-layouts/`. Preserve dated source screenshots and accessibility observations from the locally installed Cursor and Kition clients, plus public Teable product evidence; document each product's layout, navigation, panel ownership, information hierarchy, interaction model, Agent behavior, reusable ideas, and mismatches with IdeaNote. Add simplified original SVG layout diagrams and one cross-product interaction comparison so later work does not depend on reopening the reference products. Within the same directory, create a comparison index and three standalone, browser-runnable HTML concepts. Every concept opens directly into the same left Workspace, center data editor, and right AI Agent product scenario, using realistic English workspace, table, field, record, Agent activity, and composer content. Concept A, **Atlas Table**, takes Kition's persistent file tree and data-grid clarity as its starting point; Concept B, **Agent Ledger**, takes Cursor's task, activity, and change-result hierarchy as its starting point; Concept C, **Workspace Loom**, creates a more recognizably IdeaNote-native workspace + table + Agent composition. The index explains the design thesis, tradeoffs, and recommended production direction, and links to the research and each concept. The concepts include representative interactive states such as Workspace selection, view switching, Agent context, row selection, panel collapse, and responsive panel behavior without connecting to Tauri or user files.
**Non-Goals:** This plan does not modify `App.tsx`, remove `LaunchScreen`, change startup/session behavior, refactor production `EditorLayout`, add a real table editor, change Agent runtime behavior, alter persistence, or select and implement the final product direction. It does not copy Cursor or Kition branding, proprietary assets, or exact screens.
**Architecture:** The research package separates captured evidence, derived diagrams, written analysis, and executable mockups: `sources/` stores reference notes and provenance, `screenshots/` stores bounded visual evidence, `diagrams/` stores original SVG abstractions rather than traced product screens, and `mockups/` stores isolated HTML/CSS/JavaScript with no production imports or build integration. All concepts preserve the established ownership boundary from B023: Workspace Explorer left, active editor center, independent Agent right. The center uses a Teable-like structured data surface to express the user's intended product shape while keeping file/session concepts consistent with the PRD. Shared content makes layout differences comparable; concept-specific token overrides and composition classes keep the visual systems distinct. The root research index is the durable navigation and decision surface for later production work rather than an alternative product specification.
**Baseline:** IdeaNote currently launches into a split violet Home screen with New File, Open Workspace, Open File, Settings, and recent history. `AppContent` renders `LaunchScreen` while mode is `launch`, then renders `EditorLayout`. The production shell already owns an independent left Workspace, center editor, and right Agent, but its current visual language evolved incrementally around IdeaSketch and does not yet read as a workspace-wide AI agent product. The locally installed Cursor emphasizes workspace/task history, conversation, and change results; the locally installed Kition emphasizes a persistent file tree, tabbed data editor, dense record toolbar, and permanently available AI chat. Existing F004 tokens and B023 ownership are useful constraints, while F035 establishes a Teable-like Agent activity rhythm.
**Exit Criteria:** `docs/design-research/f039-workspace-agent-layouts/README.md` indexes Cursor, Kition, and Teable evidence, layout diagrams, interaction notes, cross-product findings, and all mockups. Each product record names capture date/source, observed state, layout regions, key workflows, Agent/editor relationship, useful patterns, unsuitable patterns, and evidence limitations. The package contains at least one screenshot and one original layout diagram per product plus a cross-product interaction comparison. `mockups/index.html` opens locally and links to three standalone concepts. Each concept visibly opens in the main three-region shell with no Home screen, renders at least one realistic data-table editor state, keeps Workspace and Agent visually independent, and presents a materially different hierarchy rather than a color-only variation. At 1440×900 all three preserve usable left, center, and right regions; at 1100×760 they use defined compact behavior without overlapping controls or horizontal page overflow. Keyboard focus is visible, buttons have accessible labels, reduced-motion preferences are respected, and all user-facing copy is English. Browser inspection reports no console errors. The final comparison identifies one recommended direction and specific reusable ideas from the other two without changing production code.

## Task 1: Preserve the Reference-product Research Trail

**Outcome:** Later design and implementation work can inspect the evidence and reasoning without reopening Cursor, Kition, or Teable.
**Files:**
- Create: `docs/design-research/f039-workspace-agent-layouts/README.md`
- Create: `docs/design-research/f039-workspace-agent-layouts/sources/cursor.md`
- Create: `docs/design-research/f039-workspace-agent-layouts/sources/kition.md`
- Create: `docs/design-research/f039-workspace-agent-layouts/sources/teable.md`
- Create: `docs/design-research/f039-workspace-agent-layouts/sources/comparison.md`
- Create: `docs/design-research/f039-workspace-agent-layouts/screenshots/cursor-agents-redacted.jpg`
- Create: `docs/design-research/f039-workspace-agent-layouts/screenshots/kition-table-agent.jpg`
- Create: `docs/design-research/f039-workspace-agent-layouts/screenshots/teable-template-preview.jpg`
- Create: `docs/design-research/f039-workspace-agent-layouts/screenshots/teable-live-agent-redacted.png`
- Create: `docs/design-research/f039-workspace-agent-layouts/diagrams/cursor-layout.svg`
- Create: `docs/design-research/f039-workspace-agent-layouts/diagrams/kition-layout.svg`
- Create: `docs/design-research/f039-workspace-agent-layouts/diagrams/teable-layout.svg`
- Create: `docs/design-research/f039-workspace-agent-layouts/diagrams/interaction-comparison.svg`

**Change Map:**
- product records: provenance, observed screen state, region-by-region layout map, density and hierarchy, primary navigation, editor/table workflows, Agent workflow, keyboard/panel behavior, strengths, limitations, and IdeaNote applicability
- screenshots: bounded evidence for the exact observed reference state, excluding credentials and unrelated private content where possible
- original diagrams: simplified spatial ownership and interaction flows using labels and proportions rather than copied product assets
- comparison: exact mappings for Workspace discovery, document/table navigation, active-context signaling, Agent invocation, Tool/change evidence, review/application, and responsive panel behavior

**Verification:**
- Confirm every referenced screenshot and SVG opens locally from the root README.
- Confirm source notes distinguish direct observation, inference, and design recommendation.
- Confirm screenshots contain no credentials or unnecessary private content.

- [x] Capture and preserve representative Cursor, Kition, and Teable visual evidence with provenance.
- [x] Write the three product analyses and cross-product interaction comparison.
- [x] Draw the three layout diagrams and one interaction comparison diagram.

## Task 2: Build Three Comparable Workspace-first Concepts

**Outcome:** Three standalone mockups express different product strategies against the same workspace, table, and Agent scenario.
**Files:**
- Create: `docs/design-research/f039-workspace-agent-layouts/mockups/index.html`
- Create: `docs/design-research/f039-workspace-agent-layouts/mockups/atlas-table.html`
- Create: `docs/design-research/f039-workspace-agent-layouts/mockups/agent-ledger.html`
- Create: `docs/design-research/f039-workspace-agent-layouts/mockups/workspace-loom.html`
- Create: `docs/design-research/f039-workspace-agent-layouts/mockups/shared.css`
- Create: `docs/design-research/f039-workspace-agent-layouts/mockups/shared.js`

**Change Map:**
- comparison index: concise rationale, side-by-side criteria, concept links, and a recommendation grounded in IdeaNote's workspace + table + Agent identity
- Atlas Table: deep graphite surfaces, cool white data canvas, violet selection, compact sans typography, and a persistent context seam between the selected table and Agent; signature element is the live `Agent scope` strip that names the exact table/view/selection being discussed
- Agent Ledger: near-black Cursor-influenced workbench, dense utility typography, a wider right Agent with ordered activity/change evidence, and a quieter center grid; signature element is the `Turn output` ledger that connects Tool work to proposed table changes
- Workspace Loom: ink, mist, cobalt, mint, and warm signal tokens; a slim workspace command rail plus structured explorer, generous center table, and calm right Agent; signature element is a continuous vertical context thread linking selected Workspace object, active view, and Agent target
- shared behavior: concept navigation, row/view selection, panel collapse/restore, compact-width classes, keyboard focus, and reduced-motion handling

**Verification:**
- Serve `docs/design-research/f039-workspace-agent-layouts/mockups/` with a local static server and open the index plus every concept.
- Inspect at 1440×900 and 1100×760.
- Interaction cases: select a Workspace item, switch table views, select a record, collapse/restore left and right panels, inspect Agent target/activity changes, navigate between concepts, and use controls with keyboard focus.

- [x] Build the shared realistic workspace/table/Agent content model and comparison navigation.
- [x] Implement Atlas Table, Agent Ledger, and Workspace Loom as compositionally distinct concepts.
- [x] Add bounded interactions, compact behavior, accessibility states, and reduced-motion support.

## Task 3: Critique, Verify, and Present the Design Recommendation

**Outcome:** The concepts are visually coherent, technically clean, and presented with a clear recommendation for the later production refactor.
**Files:**
- Modify: `docs/design-research/f039-workspace-agent-layouts/README.md`
- Modify: `docs/design-research/f039-workspace-agent-layouts/sources/comparison.md`
- Modify: `docs/design-research/f039-workspace-agent-layouts/mockups/index.html`
- Modify: `docs/design-research/f039-workspace-agent-layouts/mockups/atlas-table.html`
- Modify: `docs/design-research/f039-workspace-agent-layouts/mockups/agent-ledger.html`
- Modify: `docs/design-research/f039-workspace-agent-layouts/mockups/workspace-loom.html`
- Modify: `docs/design-research/f039-workspace-agent-layouts/mockups/shared.css`
- Modify: `docs/design-research/f039-workspace-agent-layouts/mockups/shared.js`

**Change Map:**
- visual QA: hierarchy, panel proportions, table density, long-name truncation, Agent readability, focus treatment, and responsive behavior
- self-critique: remove decorative elements that do not encode Workspace, editor, selection, or Agent context
- recommendation: rank the concepts against immediate product comprehension, workspace scalability, table productivity, Agent trust, and fit with existing IdeaNote architecture

**Verification:**
- Browser screenshots at both target viewport sizes for all three concepts.
- Browser console remains free of errors and missing local assets.
- `git diff --check`
- Confirm the mockup directory has no imports from production source and is not referenced by the application bundle.

- [x] Capture and inspect all six target viewport renders, then refine spacing and hierarchy.
- [x] Verify interactions, keyboard focus, reduced motion, overflow, and console cleanliness.
- [x] Finish the comparison index with the recommended direction and reusable ideas from the alternatives.

## Task 4: Record and Commit the F039 Design Exploration

**Outcome:** The approved design exploration is traceable and independently committed without claiming that production layout work is complete.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F039-workspace-first-ai-agent-layout-concepts.md`
- Modify: `docs/superplan/plans/README.md`

**Change Map:**
- F039 request and plan: completion status plus concept and browser-verification evidence
- generated plan index: refreshed F039 lifecycle

**Verification:**
- `python3 <using-superplan-root>/scripts/human_requests.py --root . validate`
- `python3 <using-superplan-root>/scripts/generate_plans_readme.py --root . --write --check`
- `git diff --check`

- [x] Mark the plan complete only after all three HTML concepts and the comparison recommendation are delivered.
- [x] Mark F039 done, refresh the plan index, and create a separate `feat(F039)` task commit.

## Delivery Evidence

- Preserved the reference trail under `docs/design-research/f039-workspace-agent-layouts/`: three product analyses, one cross-product comparison, Cursor/Kition/Teable screenshots with provenance and privacy notes, three original layout diagrams, and one interaction-comparison diagram.
- Added direct signed-in Teable evidence from the user-opened sample base. The saved screenshot covers the account identity while retaining the left directory, Gallery editor, right Agent, activity evidence, and composer geometry.
- Delivered four directly openable HTML pages: one comparison/recommendation index plus Atlas Table, Agent Ledger, and the recommended Workspace Loom concept. Shared JavaScript verifies file/view/record context updates, independent panel collapse/restore, keyboard record selection, and ordered Agent activity/results.
- Captured and inspected all six approved renders. At 1440×900 every concept preserves the three-region shell. At 1100×760 Workspace compacts to a 48px rail, the editor remains approximately 722–726px, the Agent remains 326–330px, and no page-level horizontal overflow occurs.
- Browser interaction runs reported no page console warnings or errors. Local Markdown links resolve, all SVGs pass XML parsing, `shared.js` passes `node --check`, all user-facing mockup copy is English, no production source is imported or modified, and `git diff --check` passes.

## References

- `docs/superplan/human/features.md`
- `docs/superplan/human/prd.md`
- `docs/superplan/plans/03-multifile-workspace-shell.md`
- `docs/superplan/plans/features/F004-refine-editor-shell.md`
- `docs/superplan/plans/features/F013-compact-workspace-and-navigator-layout.md`
- `docs/superplan/plans/features/F016-refine-launch-actions-and-add-recent-workspaces.md`
- `docs/superplan/plans/features/F035-agent-history-codex-runtime-and-streaming-activity.md`
- `docs/superplan/plans/bugs/B023-separate-agent-right-column.md`
- `src/App.tsx`
- `src/components/EditorLayout.tsx`
- `src/components/WorkspaceExplorer.tsx`
- `src/components/AgentPanel.tsx`
