# Kition Research

## Provenance

- Source: locally installed Kition desktop client
- Captured: 2026-08-10, macOS
- Observed surface: sample `Business Analytics Dashboard.kitable` file with Grid view and an unconfigured AI chat
- Screenshot: [`../screenshots/kition-table-agent.jpg`](../screenshots/kition-table-agent.jpg)
- Content note: visible workspace and table content is Kition's bundled sample data

## Observed layout

Kition is the closest structural reference to the requested IdeaNote product shape:

1. **Workspace explorer** on the left.
   - Files are grouped into named folders such as Operations & Analytics and Projects & Planning.
   - Folder, table, Markdown, and image types use distinct icons.
   - Search, Browser, create, workflows, refresh, workspace switching, profile, and settings remain inside the Workspace region.
2. **Tabbed editor and data workbench** in the center.
   - A top document tab strip keeps multiple work artifacts visible.
   - The active data file has an internal section/view selector.
   - A compact toolbar exposes Add record, Customize field, Filter, Sort, Group by, Row height, Search, Undo, and Redo.
   - The grid is the dominant surface; bottom summaries expose record count and field aggregates.
3. **Independent AI chat** on the right.
   - The chat owns its own tab, history, new-chat, collapse, and resize controls.
   - The empty state explicitly says the Agent can summarize, add columns, or query the current table.
   - The composer remains pinned to the bottom.

See the original abstraction in [`../diagrams/kition-layout.svg`](../diagrams/kition-layout.svg).

## Observed interaction model

```text
Choose a workspace file
        ↓
Choose the file's table/view
        ↓
Filter, sort, group, search, or edit records
        ↓
Ask the Agent about the current table
        ↓
Inspect or apply data-structure/content changes
```

- Workspace, editor, and Agent are simultaneously visible and independently collapsible.
- Table commands live immediately above the grid, preserving direct manipulation.
- The AI empty state describes operations in the user's table vocabulary instead of generic chat language.
- Document tabs and chat tabs indicate that both artifacts and conversations have continuity.
- Bottom field summaries make aggregate data visible without opening another mode.

## Strengths

- Immediate comprehension of the three-region product structure.
- The table remains visually dominant while AI is always available.
- Workspace organization scales across heterogeneous artifact types.
- Dense but familiar table controls support fast, direct data work.
- Agent copy is contextual to the open table rather than detached from the editor.

## Limitations for IdeaNote

- The screenshot does not make the exact Agent context scope explicit beyond the current-table copy.
- A full document tab system conflicts with IdeaNote's current single-active-editor product decision.
- Dark, low-contrast surfaces make the table feel more technical and less spatial than IdeaNote's current visual language.
- Separate Workspace, editor, and Agent tabs can create too many nested navigation layers.
- The blank Agent panel consumes substantial width before a model is configured.

## IdeaNote recommendations

- **Adopt:** the left-center-right ownership, table-first center surface, compact record toolbar, bottom aggregates, and independent Agent lifecycle.
- **Adapt:** replace file tabs with one clear active-document header and use a visible Agent scope strip for table/view/selection.
- **Reject:** nested tab proliferation and a permanently empty right panel when AI is disabled.
- **Design principle:** make the product read as a data workbench first and an AI product through contextual capability, not through a large chat-first brand moment.
