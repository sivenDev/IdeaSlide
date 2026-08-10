# Teable Research

## Provenance

- Sources: public Teable website, public Task Tracker template preview, official Teable AI Chat documentation, and a user-opened signed-in sample base
- Captured: 2026-08-10
- Public template: `https://teable.ai/zh?templateId=tpliHbyo7seV110GAH4`
- AI Chat documentation: `https://help.teable.ai/zh/basic/ai/ai-chat`
- Screenshot: [`../screenshots/teable-template-preview.jpg`](../screenshots/teable-template-preview.jpg)
- Live screenshot: [`../screenshots/teable-live-agent-redacted.png`](../screenshots/teable-live-agent-redacted.png)
- Live privacy treatment: the account identity at the bottom of the left rail was covered before the screenshot was saved; the remaining content is a small user-provided sample table and non-sensitive Agent conversation

## Observed data-workbench layout

The public Task Tracker preview shows a conventional structured-data hierarchy:

1. **Base/navigation tree** on the left.
   - The template/base identity appears first.
   - A folder-like node groups the active table and a dashboard/application artifact.
2. **Table/view identity** across the center header.
   - The active table is named before the selected Grid view.
   - View ownership is clearly nested under the table rather than treated as a global mode.
3. **View toolbar** directly above the grid.
   - Field configuration, filter, sort, grouping, and related actions are visually attached to the current view.
4. **Dense record grid** as the dominant content.
   - Field types are visible in headers.
   - Groups segment records by Progress.
   - Colored status pills keep scanning fast.
   - Horizontal and vertical scrolling communicate large-data expectations.

See the abstraction in [`../diagrams/teable-layout.svg`](../diagrams/teable-layout.svg).

## Live table and Agent observation

The signed-in sample base added direct evidence that was not visible in the public template preview:

1. **The left directory owns more than tables.** The observed tree places a Teable App, an Automation, and the active Table at the same level under the base. Base-level permissions, invitation, more actions, creation, account, and notifications stay inside this region.
2. **View types are first-class editor modes.** Grid, Gallery, Form, and Kanban appear as adjacent view tabs above the content. Switching to Gallery changes the view toolbar from field-oriented controls to Add record, Card configuration, Filter, and Sort while the active table identity remains stable.
3. **The AI panel is a persistent independent column.** It has its own task title, new conversation, history, collapse, scrollable transcript, pinned composer, attachment action, model/reasoning selector, voice input, and send action.
4. **Agent work evidence is inline and ordered.** The transcript shows elapsed duration, expandable read operations, command/result evidence, copy and reuse actions, feedback controls, and a final statement that no data was modified.
5. **Editor and Agent remain simultaneously usable.** The Gallery view remains visible while the Agent conversation scrolls independently; neither surface replaces the other.

These observations strengthen the F039 recommendation to keep a permanently addressable Agent column while making its current table/view/selection scope more explicit than it appears in the captured Teable shell.

## Official AI interaction model

The following are direct statements from Teable's official AI Chat documentation:

- AI Chat opens from a top-right Cuppy action after a table or view is open.
- The Agent prioritizes the current page.
- Current table, current view, active filters, and active sorting are implicit context.
- Selected rows, columns, cells, or cell ranges become priority context.
- Typing `@` can add tables, views, applications, automations, or folders from the directory tree.
- Selected table areas can be sent to AI Chat from a context menu and appear as tags in the composer.
- Files can be pasted, dragged, or uploaded into the conversation.
- Users are advised to ask for a plan before tasks that modify data or create nodes.
- Messages sent while AI is running can queue; eligible text can be sent as a non-interrupting follow-up.
- The Agent can analyze data, create or update tables and views, build applications and automations, generate temporary reports, and work with files.
- Long tasks show ongoing progress and an explicit completed state.

## Strengths

- Context is a first-class interaction model rather than an invisible implementation detail.
- Implicit current-view context keeps ordinary questions fast.
- Explicit `@` references and selection tags scale to cross-table work without replacing the directory tree.
- Direct manipulation and AI share the same table vocabulary.
- Plan-before-mutation guidance creates a comprehensible safety checkpoint.
- Queued follow-ups support long-running Agent work without forcing a new thread.

## Limitations for IdeaNote

- Teable is database-first and cloud-collaborative; IdeaNote must preserve real local files and registry-driven editors.
- The public template evidence does not show the complete live AI panel, so its exact panel proportions are not treated as observed fact.
- Teable's broad node graph includes applications and automations that are not currently IdeaNote artifacts.
- Dense field and view controls can overwhelm visual editors such as IdeaSketch.
- The product can rely on database identifiers and server-side context in ways IdeaNote cannot assume.

## IdeaNote recommendations

- **Adopt:** implicit active editor/view context, visible selection/context chips, `@`-style Workspace references, plan-before-mutation, progress, and queued follow-up concepts.
- **Adapt:** map Teable nodes to local Workspace paths and editor-registry entities; keep context bounded and show what will be shared with the Agent.
- **Reject:** cloud-database assumptions, hidden server-side context expansion, and table-only shell decisions.
- **Design principle:** the right Agent should always answer the question, "What exact local file, editor view, and selection am I acting on?"
