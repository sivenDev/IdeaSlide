# Cursor Agents Research

## Provenance

- Source: locally installed Cursor desktop client
- Captured: 2026-08-10, macOS
- Observed surface: Cursor Agents with a historical Agent thread and an IDE Changes panel
- Screenshot: [`../screenshots/cursor-agents-redacted.jpg`](../screenshots/cursor-agents-redacted.jpg)
- Privacy treatment: the screenshot was aggressively downsampled and re-expanded so project names, messages, code, and account details are unreadable while panel geometry remains visible

## Observed layout

Cursor Agents uses three strong regions in the captured state:

1. **Global Agent navigation and Workspaces** on the left.
   - Persistent product actions: New Agent, Search, Automations, and Customize.
   - Workspaces organize prior Agent tasks or conversations.
   - Account, update, and settings actions stay at the bottom.
2. **Agent thread** in the center.
   - The thread title sits in a compact top bar.
   - Messages, elapsed-work labels, Tool or subagent activity, and a changed-files summary form one chronological work record.
   - The composer includes model, environment, branch, context, attachments/tools, and voice affordances.
3. **IDE result surface** on the right.
   - The selected tab can show Changes, diffs, or another IDE surface.
   - Change scope, branch, totals, review, push, and file-by-file diffs are first-class.

See the original abstraction in [`../diagrams/cursor-layout.svg`](../diagrams/cursor-layout.svg).

## Observed interaction model

```text
Choose workspace/task
        ↓
Continue an Agent thread
        ↓
Observe work/activity and changed files
        ↓
Inspect the IDE or diff result
        ↓
Review, follow up, or deliver the change
```

- The Agent thread is the primary work surface rather than a secondary assistant.
- Progress and elapsed time appear before the final answer, so waiting has an explicit state.
- Changed files are summarized in the thread and expanded in the adjacent result panel.
- Follow-up is cheap because the composer remains attached to the current task and environment.
- Branch and environment context are visible near the composer instead of hidden in settings.

## Strengths

- Strong causal connection between Agent work and reviewable output.
- Clear task continuity through workspace-scoped thread history.
- Activity, changes, and final response appear in one ordered narrative.
- The adjacent result surface lets users inspect evidence without leaving the task.
- Environment, branch, model, and context are visible at the point of action.

## Limitations for IdeaNote

- The captured layout centers the Agent and pushes the editor/result surface right; IdeaNote's product contract requires the editor to remain central.
- Workspaces are primarily Agent-task containers in this view, not a real local file tree.
- Source-control concepts such as branch, push, and diff dominate the result language.
- The density and near-black utility styling fit coding but can overpower visual or structured-data work.
- A long Agent transcript can become the user's mental model of the product, weakening direct manipulation of content.

## IdeaNote recommendations

- **Adopt:** ordered Agent activity, elapsed work state, reviewable change summaries, visible runtime/context metadata, and a persistent follow-up composer.
- **Adapt:** place the activity/change ledger in the right Agent column while the center editor stays primary.
- **Reject:** using Agent tasks instead of the real Workspace tree, source-control delivery language, and an Agent-first center column.
- **Design principle:** every Agent action should point to a visible editor target and an inspectable result, but the editor remains the authority.
