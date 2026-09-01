---
id: "F069"
title: "Generate Agent Conversation Titles from Visible Content"
type: "feature"
status: "draft"
summary: "Generate one stable persistent conversation title from the first visible user prompt while preserving explicit user renames."
source: "docs/superplan/human/features.md"
created: "2026-09-01"
order: 69
depends_on: ["F046-03"]
parent: ""
---

# Generate Agent Conversation Titles from Visible Content Plan

**Goal:** Make Agent conversation names describe the conversation itself instead of the document that happened to be active when the Thread was created.
**Scope:** Give new Agent Threads a neutral initial title, generate a concise title locally from the first non-empty visible user prompt, persist that title with the Thread, and keep it unchanged when the same conversation is reused across Workspace, Markdown, and IdeaSketch contexts. Track whether a title is initial, generated, or manually renamed so explicit Rename always wins. Preserve existing Thread history, restart/resume, deletion, runtime selection, Tool routing, and editor bindings.
**Non-Goals:** Do not send a separate Provider or Codex request for title generation, use assistant text, hidden reasoning, Tool input/results, document contents, file names, or Workspace names as title material; do not continuously retitle an existing conversation; do not rename legacy saved Threads automatically; and do not change conversation selection or editor-context behavior.
**Architecture:** Keep title generation in the IdeaNote-owned frontend Agent SDK so it is runtime- and editor-agnostic. A small pure formatter derives one Unicode-safe, whitespace-normalized, Markdown-cleaned title from the first visible user prompt with a bounded readable truncation. `AgentThread` persists an optional title provenance value. New Threads start as `initial`, first submission changes them to `generated`, and explicit Rename changes them to `manual`. Hydration treats legacy records without provenance as manual to preserve existing names. The Rust repository remains the atomic storage owner and marks native Rename operations as manual without changing the schema version because the new field is optional and backward-compatible.
**Baseline:** `AgentPanel` currently passes the active document display name or Workspace name into `useAgentThread`; `createAgentThreadState` stores it as the Thread title, so a conversation created while editing Markdown keeps that Markdown filename even after later use with IdeaSketch. Thread persistence and the conversation selector already store, list, resume, and manually rename titles, but there is no provenance or automatic content-based naming boundary.
**Exit Criteria:** A new Thread initially shows `New conversation`; submitting its first visible user prompt produces a concise title derived only from that prompt and persists it across history refresh and application restart. Switching between Markdown, IdeaSketch, Workspace-only, and other supported contexts never changes the generated title. Later prompts do not retitle it. Rename before or after the first Turn marks the title manual and prevents automatic replacement. Legacy Threads retain their existing titles. Empty/Markdown-heavy/multiline/long/CJK/emoji prompts produce safe bounded titles, and focused frontend/Rust tests plus full regression and build checks pass.

## Task 1: Add Stable Title Provenance and Deterministic Generation

**Outcome:** The Agent SDK can distinguish neutral, generated, manual, and legacy titles and derive a safe concise title from visible user text without an extra runtime call.
**Files:**
- Create: `src/lib/agent/agentThreadTitle.ts`
- Modify: `src/lib/agent/protocol.ts`
- Modify: `src/lib/agent/agentStore.ts`
- Modify: `src-tauri/src/agent/repository.rs`
- Create: `tests/agentThreadTitle.test.mjs`
- Modify: `tests/agentStore.test.mjs`
- Modify: `tests/agentThreadRepository.test.mjs`

**Change Map:**
- title formatter: collapse whitespace, remove leading Markdown decoration, choose a readable sentence/word boundary, preserve Unicode graphemes, and enforce the existing 160-character repository ceiling with a shorter UI-oriented target
- Thread provenance: persist optional `initial`, `generated`, or `manual` origin; normalize unknown/missing legacy values to manual on hydration
- manual Rename: update both title and provenance atomically in frontend state and the native repository command
- compatibility: retain schema version 1 and keep existing Thread JSON readable without rewriting legacy titles

**Verification:**
- `node --test tests/agentThreadTitle.test.mjs tests/agentStore.test.mjs tests/agentThreadRepository.test.mjs`
- `cd src-tauri && cargo test agent::repository`
- Cases: short English and Chinese prompts; headings/lists/quotes; multiline and repeated whitespace; emoji/grapheme-safe truncation; empty fallback; generated-once; manual-before-first-Turn; manual-after-generation; legacy hydration; restart persistence.

- [ ] Generate one bounded title from visible user content without runtime/editor coupling.
- [ ] Persist and normalize title provenance without breaking legacy Thread records.
- [ ] Make explicit Rename permanently override automatic naming.

## Task 2: Bind First Submission to the Persistent Conversation Title

**Outcome:** Production Threads stop inheriting document names and update their visible/history title exactly once when the first prompt is submitted.
**Files:**
- Modify: `src/hooks/useAgentThread.ts`
- Modify: `src/components/AgentPanel.tsx`
- Modify: `tests/agentPanel.test.mjs`
- Modify: `tests/agentThreadHistory.test.mjs`

**Change Map:**
- Thread creation: use the neutral `New conversation` title while retaining document- and Workspace-specific welcome/context copy
- first submission: prepare and persist the generated title before starting the Turn, refresh conversation history, and leave the captured editor binding unchanged
- stability: skip generation for generated, manual, resumed legacy, retry, and later-Turn states so editor switches cannot retitle a conversation
- UI contract: the existing conversation selector immediately reflects the generated/manual persistent title without a separate title control

**Verification:**
- `node --test tests/agentPanel.test.mjs tests/agentThreadHistory.test.mjs tests/agentThreadTitle.test.mjs tests/agentStore.test.mjs`
- Cases: new Thread, first submission success/failure, retry, later prompt, Markdown-to-IdeaSketch switch, Workspace-only Turn, manual Rename before/after first prompt, resume after restart, browser fallback without native persistence.

- [ ] Replace document-derived initial titles with the neutral conversation state.
- [ ] Generate and persist the first-prompt title before Turn execution without changing its editor binding.
- [ ] Prove cross-editor reuse and manual Rename remain stable.

## Task 3: Verify and Deliver F069

**Outcome:** Automatic conversation titles ship with complete regression, persistence, and workflow evidence.
**Files:**
- Modify: `docs/superplan/human/features.md`
- Modify: `docs/superplan/plans/features/F069-generate-agent-conversation-titles-from-visible-content.md`
- Modify: `docs/superplan/plans/README.md`

**Verification:**
- `node --test tests/*.test.mjs`
- `cd src-tauri && cargo test`
- `npm run build`
- `cd src-tauri && cargo build`
- Superplan registry and plan-index validation.
- `git diff --check`

- [ ] Run focused and full verification after implementation stabilizes.
- [ ] Mark F069 delivered, refresh the plan index, inspect the task-only diff, and create a separate `feat(F069)` commit.

## References
- `docs/superplan/human/features.md#F069`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-01-normalized-agent-sdk-and-ui.md`
- `docs/superplan/plans/features/F033-codex-style-agent-implementation/F033-04-persistent-threads-and-editor-tools.md`
- `docs/superplan/plans/features/F035-agent-history-codex-runtime-and-streaming-activity.md`
- `docs/superplan/plans/features/F046-migrate-reviewed-demo-frontend-into-tauri/F046-03-real-agent-panel.md`
- `docs/superplan/plans/bugs/B030-fix-transient-menus-settings-and-agent-history.md`
- `src/components/AgentPanel.tsx`
- `src/hooks/useAgentThread.ts`
- `src/lib/agent/agentStore.ts`
- `src-tauri/src/agent/repository.rs`
