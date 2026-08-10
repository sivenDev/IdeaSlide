# Cross-product Comparison and IdeaNote Direction

## Exact pattern mapping

| Design concern | Cursor Agents | Kition | Teable | IdeaNote decision |
| --- | --- | --- | --- | --- |
| Primary left navigation | Agent workspaces and task history | Real artifact tree | Base/table/application tree | Keep the real local Workspace tree; add Agent history inside the Agent column |
| Primary center surface | Agent thread | Data editor | Table view | Keep the active editor central; structured data is the representative F039 content |
| Right-side surface | IDE/Changes result | Independent AI chat | AI opens from current table/view | Keep an independent right Agent with inspectable results inside it |
| Context default | Workspace, branch, environment | Implied current file/table | Current page, table, view, filters, sorting | Active document and editor view are implicit and visibly named |
| Explicit context | Attach agents, context, tools | Not evident in captured state | `@` nodes, selection tags, attachments | Add visible Workspace references and selection chips |
| Work evidence | Elapsed state, Tool work, changed files, diff | Table operations and eventual chat output | Progress, plan, created/updated nodes | Show an ordered Agent activity and change ledger |
| Mutation safety | Review changes, inspect diff, deliver | Not observable in empty state | Ask for a plan before modification | Plan first; show exact target and proposed changes before Apply |
| Long-running work | Persistent thread and follow-up | Persistent chat tab | Progress, completion, queued messages | Keep thread continuity and allow queued follow-up where runtime supports it |
| Responsive behavior | Independent resizable panels | Independent collapsible/resizable panels | Large scrollable grid | Preserve bounded independent panels and protect editor minimum width |

## Recommended product hierarchy

```text
Workspace authority        Editor authority             Agent assistance
┌─────────────────┐       ┌──────────────────────┐      ┌──────────────────┐
│ real local files │  →    │ active file + view   │  ↔   │ visible scope    │
│ folders + types  │       │ direct manipulation  │      │ activity + plan  │
│ recent locations │       │ save/undo/recovery   │      │ tools + changes  │
└─────────────────┘       └──────────────────────┘      └──────────────────┘
```

The arrows are asymmetric: Workspace and editor state are authoritative; the Agent receives bounded context and proposes or performs only editor-supported actions.

## Recommended layout proportions

- Expanded desktop at 1440px: Workspace 228–248px, Agent 340–390px, editor receives the remaining width.
- Compact desktop at 1100px: Workspace 52px rail or collapsed, Agent 300–330px, editor stays above its minimum useful width.
- Do not show an empty Home screen. When no Workspace is open, keep the shell and turn the left region into a recent/open Workspace chooser while the center explains the next action.
- Do not use a permanent full-width document tab strip unless a later product decision reverses the single-active-editor rule.

## Interaction contract for the mockups

1. Selecting a Workspace item changes the active table and Agent scope.
2. Switching a view changes filter/sort context and updates the Agent scope strip.
3. Selecting a record creates a visible selection chip for the Agent.
4. Starting an Agent task creates an ordered activity trail before the answer.
5. A proposed mutation names the target table, view, fields, and record count.
6. The editor remains directly usable while the Agent works.
7. Collapsing either outer panel does not change the other panel or the active editor.

See [`../diagrams/interaction-comparison.svg`](../diagrams/interaction-comparison.svg).

## Recommended concept

**Workspace Loom** is the recommended direction because it combines the structural clarity of Kition, the contextual precision of Teable, and the execution evidence of Cursor while preserving a product identity distinct from all three.

Reusable secondary ideas:

- From **Atlas Table**: strongest dense-data toolbar and grid scanning.
- From **Agent Ledger**: strongest Tool/change review narrative.
- From **Workspace Loom**: strongest active-context signaling and adaptable editor ownership.

## Final concept scorecard

Scores use a five-point comparative scale within this exploration, not production usability-test results.

| Criterion | Atlas Table | Agent Ledger | Workspace Loom |
| --- | ---: | ---: | ---: |
| Immediate product comprehension | 5 | 4 | 5 |
| Workspace scalability | 4 | 3 | 5 |
| Table productivity | 5 | 4 | 5 |
| Agent trust and evidence | 4 | 5 | 5 |
| Fit with IdeaNote architecture | 4 | 3 | 5 |
| **Total** | **22** | **19** | **25** |

The Teable live-base observation reinforced one important distinction: a persistent Agent panel can coexist successfully with view-specific table controls, but IdeaNote should make the exact file/view/selection scope more visible than the captured Teable shell. Workspace Loom turns that gap into its primary visual signature.
