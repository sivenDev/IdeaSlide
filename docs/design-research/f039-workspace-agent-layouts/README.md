# F039 Workspace-first AI Agent Layout Research

This directory preserves the design evidence and decisions behind the F039 workspace-first product layout exploration.

## Research question

How should IdeaNote open directly into a workspace-oriented product shell where real local files remain the source of truth, structured data is the dominant editor experience, and an AI Agent is continuously available without taking ownership away from the editor?

## Evidence index

| Product | Evidence | Layout diagram | Research notes |
| --- | --- | --- | --- |
| Cursor Agents | [Redacted local screenshot](screenshots/cursor-agents-redacted.jpg) | [Cursor layout](diagrams/cursor-layout.svg) | [Cursor analysis](sources/cursor.md) |
| Kition | [Local client screenshot](screenshots/kition-table-agent.jpg) | [Kition layout](diagrams/kition-layout.svg) | [Kition analysis](sources/kition.md) |
| Teable | [Public template preview](screenshots/teable-template-preview.jpg) · [Live table + Agent, redacted](screenshots/teable-live-agent-redacted.png) | [Teable layout](diagrams/teable-layout.svg) | [Teable analysis](sources/teable.md) |

The [interaction comparison](diagrams/interaction-comparison.svg) and [cross-product analysis](sources/comparison.md) map the reference patterns to IdeaNote.

## Mockups

- [Concept comparison](mockups/index.html)
- [Atlas Table](mockups/atlas-table.html) — Kition-influenced data workbench
- [Agent Ledger](mockups/agent-ledger.html) — Cursor-influenced execution workbench
- [Workspace Loom](mockups/workspace-loom.html) — recommended IdeaNote-native direction

## Browser QA evidence

Each concept was captured after browser interaction checks at both approved target sizes:

| Concept | 1440×900 | 1100×760 |
| --- | --- | --- |
| Atlas Table | [Desktop render](screenshots/qa-atlas-table-1440x900.jpg) | [Compact render](screenshots/qa-atlas-table-1100x760.jpg) |
| Agent Ledger | [Desktop render](screenshots/qa-agent-ledger-1440x900.jpg) | [Compact render](screenshots/qa-agent-ledger-1100x760.jpg) |
| Workspace Loom | [Desktop render](screenshots/qa-workspace-loom-1440x900.jpg) | [Compact render](screenshots/qa-workspace-loom-1100x760.jpg) |

All six renders had three owned regions, no page-level horizontal overflow, and no page console warnings or errors. At 1100×760 the Workspace becomes a 48px restore rail while the editor retains roughly 722–726px and the Agent retains 326–330px.

## Evidence policy

- **Observed** statements come from the captured screen or the cited official Teable documentation.
- **Inferred** statements interpret visible ownership, hierarchy, or expected interaction without claiming hidden implementation facts.
- **Recommendation** statements describe how IdeaNote should use or reject a pattern.
- The Cursor screenshot is deliberately downsampled and enlarged so its private project content is unreadable while its panel proportions remain visible.
- Kition content is bundled sample content in the local application.
- Teable evidence comes from a public template preview and official product documentation captured on 2026-08-10.
- The live Teable screenshot came from the user-provided signed-in sample base. The account identity was covered before saving; only the product shell, sample animal cards, and non-sensitive Agent interaction remain visible.

## Decision summary

The recommended direction is **Workspace Loom**:

1. Keep Kition's immediately legible left Workspace, center data surface, and independent right Agent.
2. Adopt Teable's explicit Agent scope model: current table/view/selection first, then add references with visible context chips.
3. Adopt Cursor's ordered work evidence and review loop inside the Agent column, without turning the product into a source-control client.
4. Keep IdeaNote's editor registry, local-file safety, and format-agnostic shell as hard architectural boundaries.

Production implementation is intentionally outside F039. This package is the input to a later feature plan after a concept is selected.
